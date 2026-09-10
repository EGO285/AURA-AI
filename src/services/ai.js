// ============================================================
//  Service IA — multi-fournisseurs (tous compatibles OpenAI)
//  - chat()          : conversation texte + vision
//  - generateImage() : génération d'image
//
//  CHAT : n'importe quel endpoint compatible OpenAI.
//    Défaut = Groq (gratuit). Marche aussi avec Hugging Face,
//    OpenRouter, Together, etc. — il suffit de changer 2 variables.
//  IMAGES : Pollinations (gratuit, SANS clé) par défaut, ou Hugging Face.
// ============================================================

// ---- Config CHAT (compatible OpenAI) ----
const CHAT_BASE_URL = process.env.CHAT_BASE_URL || 'https://api.groq.com/openai/v1';
const CHAT_API_KEY  = process.env.CHAT_API_KEY || process.env.HF_TOKEN || '';
const CHAT_MODEL    = process.env.CHAT_MODEL || process.env.HF_CHAT_MODEL || 'qwen/qwen3.8-27b';

// ---- Config IMAGES ----
const IMAGE_PROVIDER = (process.env.IMAGE_PROVIDER || 'pollinations').toLowerCase();
const HF_IMAGE_MODEL = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';

export function chatConfigured() { return Boolean(CHAT_API_KEY); }
export function chatInfo() {
  return { baseUrl: CHAT_BASE_URL, model: CHAT_MODEL, imageProvider: IMAGE_PROVIDER };
}

/**
 * Conversation (texte + images optionnelles), format OpenAI.
 */
export async function chat(messages) {
  if (!CHAT_API_KEY) {
    throw new Error(
      'Clé de chat manquante. Renseigne CHAT_API_KEY dans .env ' +
      '(ex : clé Groq gratuite sur https://console.groq.com/keys).'
    );
  }

  const res = await fetch(`${CHAT_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CHAT_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.7,
      stream: false,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    if (res.status === 402) {
      throw new Error(
        'Crédits épuisés chez le fournisseur de chat. Passe sur un fournisseur gratuit ' +
        '(ex : Groq — mets CHAT_BASE_URL=https://api.groq.com/openai/v1 et ta clé dans CHAT_API_KEY).'
      );
    }
    if (res.status === 401) {
      throw new Error('Clé de chat invalide (401). Vérifie CHAT_API_KEY.');
    }
    throw new Error(`Chat (${res.status}) : ${detail.slice(0, 400)}`);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Réponse vide du modèle de chat.');
  return reply;
}

/**
 * Génère une image depuis un prompt.
 * @returns {Promise<string>} data URL base64 (prête pour <img src>)
 */
export async function generateImage(prompt) {
  if (IMAGE_PROVIDER === 'hf') return generateImageHF(prompt);
  return generateImagePollinations(prompt);
}

// --- Pollinations : gratuit, aucune clé requise ---
async function generateImagePollinations(prompt) {
  const seed = Math.floor(Math.random() * 1e9);
  const url =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=1024&height=1024&nologo=true&seed=${seed}&model=flux`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Génération d'image (Pollinations ${res.status}). Réessaie.`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}

// --- Hugging Face (nécessite HF_TOKEN + crédits) ---
async function generateImageHF(prompt) {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error('HF_TOKEN manquant pour la génération d\'image HF.');
  const res = await fetch(`https://router.huggingface.co/hf-inference/models/${HF_IMAGE_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'image/png' },
    body: JSON.stringify({ inputs: prompt }),
  });
  if (!res.ok) {
    if (res.status === 402) throw new Error('Crédits HF épuisés. Passe IMAGE_PROVIDER=pollinations (gratuit, sans clé).');
    if (res.status === 503) throw new Error('Le modèle d\'image démarre (cold start). Réessaie dans ~20 s.');
    throw new Error(`Image HF (${res.status}).`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/png';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}
