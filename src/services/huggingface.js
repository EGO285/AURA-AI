// ============================================================
//  Service Hugging Face
//  - chat() : conversation texte + vision (analyse d'images)
//  - generateImage() : génération d'image à partir de texte
//  Utilise l'API d'inférence gratuite de Hugging Face.
// ============================================================

const HF_TOKEN = process.env.HF_TOKEN;
const CHAT_MODEL = process.env.HF_CHAT_MODEL || 'Qwen/Qwen2.5-VL-7B-Instruct';
const IMAGE_MODEL = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';

// Endpoint OpenAI-compatible (route automatiquement vers un fournisseur gratuit)
const CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';
// Endpoint texte -> image (provider hf-inference)
const IMAGE_URL = `https://router.huggingface.co/hf-inference/models/${IMAGE_MODEL}`;

function assertToken() {
  if (!HF_TOKEN) {
    throw new Error(
      'HF_TOKEN manquant. Ajoute ta clé Hugging Face dans le fichier .env ' +
      '(récupère-la sur https://huggingface.co/settings/tokens).'
    );
  }
}

/**
 * Conversation avec le modèle (texte + images optionnelles).
 * @param {Array} messages  Historique au format OpenAI.
 *   Chaque message : { role: 'user'|'assistant'|'system', content: string | Array }
 *   Pour envoyer une image, content est un tableau :
 *   [ { type:'text', text:'...' }, { type:'image_url', image_url:{ url:'data:image/png;base64,...' } } ]
 * @returns {Promise<string>} réponse texte du modèle
 */
export async function chat(messages) {
  assertToken();

  const res = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
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
    throw new Error(`Hugging Face chat (${res.status}) : ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error('Réponse vide du modèle de chat.');
  return reply;
}

/**
 * Génère une image à partir d'un prompt texte.
 * @param {string} prompt
 * @returns {Promise<string>} image encodée en data URL (base64) prête pour <img src=...>
 */
export async function generateImage(prompt) {
  assertToken();

  const res = await fetch(IMAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'image/png',
    },
    body: JSON.stringify({ inputs: prompt }),
  });

  if (!res.ok) {
    const detail = await res.text();
    // 503 = le modèle se réveille (cold start) sur le free tier
    if (res.status === 503) {
      throw new Error('Le modèle d\'image démarre (cold start). Réessaie dans ~20 secondes.');
    }
    throw new Error(`Hugging Face image (${res.status}) : ${detail.slice(0, 500)}`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'image/png';
  return `data:${contentType};base64,${buffer.toString('base64')}`;
}
