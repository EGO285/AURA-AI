// ============================================================
//  Service VOIX (via Groq, compatible OpenAI /audio)
//  - transcribe() : audio -> texte (Whisper)
//  - speak()      : texte -> audio (Orpheus, voix féminine)
//  Réutilise CHAT_BASE_URL + CHAT_API_KEY (fournisseur = Groq).
// ============================================================

const BASE_URL = process.env.CHAT_BASE_URL || 'https://api.groq.com/openai/v1';
const API_KEY  = process.env.CHAT_API_KEY || '';

const STT_MODEL = process.env.STT_MODEL || 'whisper-large-v3';
const TTS_MODEL = process.env.TTS_MODEL || 'canopylabs/orpheus-v1-english';
// Voix Groq/Orpheus. Féminine : hannah. Masculines : troy, austin. Défaut = hannah.
const TTS_VOICE = process.env.TTS_VOICE || 'hannah';

export function voiceConfigured() { return Boolean(API_KEY); }

/**
 * Transcrit un fichier audio en texte.
 * @param {Buffer} buffer  contenu audio
 * @param {string} filename  ex "audio.webm"
 * @param {string} mimetype  ex "audio/webm"
 * @returns {Promise<string>} texte transcrit
 */
export async function transcribe(buffer, filename = 'audio.webm', mimetype = 'audio/webm') {
  if (!API_KEY) throw new Error('Voix indisponible : CHAT_API_KEY (Groq) manquante.');

  const fd = new FormData();
  fd.append('file', new Blob([buffer], { type: mimetype }), filename);
  fd.append('model', STT_MODEL);
  fd.append('response_format', 'json');

  const res = await fetch(`${BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
    body: fd,
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Transcription (${res.status}) : ${detail.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.text || '').trim();
}

/**
 * Synthétise la parole (voix féminine) à partir de texte.
 * @param {string} text
 * @returns {Promise<string>} audio en data URL base64
 */
export async function speak(text) {
  if (!API_KEY) throw new Error('Voix indisponible : CHAT_API_KEY (Groq) manquante.');
  if (!text || !text.trim()) throw new Error('Texte requis pour la synthèse vocale.');

  // On limite la longueur (les TTS plafonnent l'entrée).
  const input = text.slice(0, 1200);

  const res = await fetch(`${BASE_URL}/audio/speech`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: TTS_MODEL,
      voice: TTS_VOICE,
      input,
      response_format: 'wav',
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Synthèse vocale (${res.status}) : ${detail.slice(0, 300)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'audio/wav';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}
