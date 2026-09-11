// ============================================================
//  Historique des conversations — Upstash Redis (API REST)
//  Variables requises (console Upstash > ta base > section REST API) :
//    UPSTASH_REDIS_REST_URL
//    UPSTASH_REDIS_REST_TOKEN
//  Si absentes : l'historique serveur est désactivé (fallback navigateur).
// ============================================================

const URL = process.env.UPSTASH_REDIS_REST_URL || '';
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

export function dbConfigured() { return Boolean(URL && TOKEN); }

// Envoie une commande Redis via l'API REST d'Upstash (commande = tableau JSON).
async function redis(command) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`Upstash (${res.status}) : ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  if (data && data.error) throw new Error('Upstash : ' + data.error);
  return data.result;
}

const idxKey = (u) => `aura:${u}:index`;
const convKey = (u, c) => `aura:${u}:conv:${c}`;

// Liste des conversations (métadonnées), plus récentes d'abord.
export async function listConversations(user) {
  const raw = await redis(['GET', idxKey(user)]);
  const list = raw ? JSON.parse(raw) : [];
  return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export async function getConversation(user, id) {
  const raw = await redis(['GET', convKey(user, id)]);
  return raw ? JSON.parse(raw) : null;
}

export async function saveConversation(user, id, { title, messages }) {
  const updatedAt = Date.now();
  const conv = {
    id,
    title: (title || 'Nouvelle conversation').slice(0, 80),
    messages: Array.isArray(messages) ? messages : [],
    updatedAt,
  };
  await redis(['SET', convKey(user, id), JSON.stringify(conv)]);

  const raw = await redis(['GET', idxKey(user)]);
  let idx = raw ? JSON.parse(raw) : [];
  idx = idx.filter((c) => c.id !== id);
  idx.unshift({ id, title: conv.title, updatedAt });
  idx = idx.slice(0, 100); // on garde les 100 dernières
  await redis(['SET', idxKey(user), JSON.stringify(idx)]);
  return conv;
}

export async function deleteConversation(user, id) {
  await redis(['DEL', convKey(user, id)]);
  const raw = await redis(['GET', idxKey(user)]);
  let idx = raw ? JSON.parse(raw) : [];
  idx = idx.filter((c) => c.id !== id);
  await redis(['SET', idxKey(user), JSON.stringify(idx)]);
}
