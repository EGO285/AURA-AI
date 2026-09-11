// ============================================================
//  AURA (powered by EGO) — serveur Express
//  Chat compatible OpenAI (Groq/HF/…) + images + Tavily (web)
// ============================================================

import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chat, generateImage, chatConfigured, chatInfo, listModels } from './services/ai.js';
import { searchWeb, formatSearchContext } from './services/tavily.js';
import { processFile } from './services/files.js';
import { transcribe, speak, voiceConfigured } from './services/voice.js';
import { dbConfigured, listConversations, getConversation, saveConversation, deleteConversation } from './services/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Fichiers en mémoire, 15 Mo max par fichier
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

app.use(express.json({ limit: '6mb' }));

// Identifiant d'utilisateur (généré côté navigateur), assaini.
function uid(req) {
  return String(req.header('x-user-id') || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}
app.use(express.static(path.join(__dirname, '..', 'public')));

const SYSTEM_PROMPT =
  "Tu es AURA, un assistant IA francophone (powered by EGO), clair et utile. " +
  "Tu peux analyser des images et des fichiers fournis par l'utilisateur. " +
  "Quand un contexte de recherche web t'est donné, appuie-toi dessus et cite les sources par leur numéro [1], [2]...";

// ---------- État des clés (pour l'UI) ----------
app.get('/api/health', (req, res) => {
  const info = chatInfo();
  res.json({
    ok: true,
    chat: chatConfigured(),
    tavily: Boolean(process.env.TAVILY_API_KEY),
    voice: voiceConfigured(),
    db: dbConfigured(),
    chatModel: info.model,
    imageProvider: info.imageProvider,
  });
});

// ---------- Historique des conversations (Upstash) ----------
app.get('/api/conversations', async (req, res) => {
  try {
    if (!dbConfigured()) return res.json({ enabled: false, conversations: [] });
    const u = uid(req);
    if (!u) return res.status(400).json({ error: 'Identifiant utilisateur requis.' });
    res.json({ enabled: true, conversations: await listConversations(u) });
  } catch (err) {
    console.error('[conversations:list]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

app.get('/api/conversations/:id', async (req, res) => {
  try {
    if (!dbConfigured()) return res.status(404).json({ error: 'Historique désactivé.' });
    const u = uid(req);
    if (!u) return res.status(400).json({ error: 'Identifiant utilisateur requis.' });
    const conv = await getConversation(u, req.params.id);
    if (!conv) return res.status(404).json({ error: 'Conversation introuvable.' });
    res.json(conv);
  } catch (err) {
    console.error('[conversations:get]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

app.put('/api/conversations/:id', async (req, res) => {
  try {
    if (!dbConfigured()) return res.status(404).json({ error: 'Historique désactivé.' });
    const u = uid(req);
    if (!u) return res.status(400).json({ error: 'Identifiant utilisateur requis.' });
    const { title, messages } = req.body || {};
    const conv = await saveConversation(u, req.params.id, { title, messages });
    res.json(conv);
  } catch (err) {
    console.error('[conversations:save]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    if (!dbConfigured()) return res.status(404).json({ error: 'Historique désactivé.' });
    const u = uid(req);
    if (!u) return res.status(400).json({ error: 'Identifiant utilisateur requis.' });
    await deleteConversation(u, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[conversations:delete]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

// ---------- Liste des modèles de chat disponibles ----------
app.get('/api/models', async (req, res) => {
  try {
    res.json(await listModels());
  } catch (err) {
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

// ---------- Chat (texte + vision + fichiers + recherche web) ----------
app.post('/api/chat', upload.array('files', 5), async (req, res) => {
  try {
    const userText = (req.body.message || '').trim();
    const useWebSearch = req.body.webSearch === 'true';
    const model = (req.body.model || '').trim() || undefined;
    let history = [];
    try {
      history = JSON.parse(req.body.history || '[]');
    } catch {
      history = [];
    }

    if (!userText && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ error: 'Message ou fichier requis.' });
    }

    // 1) Traiter les fichiers
    const images = [];
    const textDocs = [];
    for (const file of req.files || []) {
      const processed = await processFile(file);
      if (processed.kind === 'image') images.push(processed);
      else textDocs.push(processed);
    }

    // 2) Recherche web optionnelle
    let sources = [];
    let searchContext = '';
    if (useWebSearch && userText) {
      const search = await searchWeb(userText);
      searchContext = formatSearchContext(search);
      sources = search.results;
    }

    // 3) Construire le message utilisateur
    let composedText = userText || 'Analyse ce contenu.';
    if (textDocs.length) {
      const docs = textDocs
        .map((d) => `--- Fichier: ${d.name} ---\n${d.text}`)
        .join('\n\n');
      composedText = `${composedText}\n\nContenu des fichiers joints :\n${docs}`;
    }
    if (searchContext) {
      composedText = `${composedText}\n\n[Contexte de recherche web]\n${searchContext}`;
    }

    let userContent;
    if (images.length) {
      userContent = [
        { type: 'text', text: composedText },
        ...images.map((img) => ({ type: 'image_url', image_url: { url: img.dataUrl } })),
      ];
    } else {
      userContent = composedText;
    }

    // 4) Assembler l'historique (texte seul pour rester léger)
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history
        .filter((m) => m && m.role && typeof m.text === 'string')
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.text })),
      { role: 'user', content: userContent },
    ];

    const reply = await chat(messages, model);
    res.json({ reply, sources });
  } catch (err) {
    console.error('[chat]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

// ---------- Voix : transcription (audio -> texte) ----------
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier audio requis.' });
    const text = await transcribe(req.file.buffer, req.file.originalname || 'audio.webm', req.file.mimetype);
    res.json({ text });
  } catch (err) {
    console.error('[transcribe]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

// ---------- Voix : synthèse (texte -> audio, voix féminine) ----------
app.post('/api/speak', async (req, res) => {
  try {
    const text = (req.body.text || '').trim();
    if (!text) return res.status(400).json({ error: 'Texte requis.' });
    const audio = await speak(text);
    res.json({ audio });
  } catch (err) {
    console.error('[speak]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

// ---------- Génération d'image ----------
app.post('/api/generate-image', async (req, res) => {
  try {
    const prompt = (req.body.prompt || '').trim();
    if (!prompt) return res.status(400).json({ error: 'Prompt requis.' });
    const dataUrl = await generateImage(prompt);
    res.json({ image: dataUrl });
  } catch (err) {
    console.error('[image]', err);
    res.status(500).json({ error: err.message || 'Erreur serveur.' });
  }
});

app.listen(PORT, () => {
  const info = chatInfo();
  console.log(`\n  🚀 AURA (powered by EGO) en ligne : http://localhost:${PORT}`);
  console.log(`     Chat    : ${info.baseUrl}  (modèle: ${info.model})`);
  console.log(`     Images  : ${info.imageProvider}`);
  if (!chatConfigured()) console.log('  ⚠️  CHAT_API_KEY manquante (chat désactivé).');
  if (!process.env.TAVILY_API_KEY) console.log('  ⚠️  TAVILY_API_KEY manquante (recherche web désactivée).');
});
