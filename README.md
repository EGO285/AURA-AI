# 🌌 AURA · powered by EGO

Un site web d'assistant IA construit **uniquement avec des API gratuites**.

| Fonction | Fournisseur (gratuit) |
|---|---|
| 💬 Chat texte | Groq (par défaut) — ou tout endpoint compatible OpenAI |
| 👁️ Vision (analyse d'images) | modèle multimodal compatible OpenAI |
| 📎 Fichiers (PDF, .txt, .md, code…) | extraction locale + injection dans le contexte |
| 🎨 Génération d'images | Pollinations.ai — **gratuit, sans clé** |
| 🌐 Recherche web | Tavily |

Backend **Node.js + Express**, frontend HTML/CSS/JS pur, thème spatial animé. Les clés restent côté serveur.

---

## 1. Récupérer les clés (gratuites)

**Groq** — chat (et vision) · *recommandé, gratuit, sans carte bancaire*
1. Crée un compte : https://console.groq.com
2. Génère une clé : https://console.groq.com/keys → copie-la (`gsk_...`)

**Tavily** — recherche web
1. Inscris-toi : https://app.tavily.com (1000 crédits/mois gratuits)
2. Copie ta clé (`tvly-...`)

**Images** : rien à faire — Pollinations.ai est gratuit et sans clé. ✅

---

## 2. Installation locale

```bash
npm install
cp .env.example .env      # colle tes clés dans .env
npm start
```

Ouvre http://localhost:3000

Le `.env` minimal :

```env
CHAT_BASE_URL=https://api.groq.com/openai/v1
CHAT_API_KEY=gsk_ta_cle_groq
CHAT_MODEL=llama-3.3-70b-versatile
TAVILY_API_KEY=tvly_ta_cle_tavily
IMAGE_PROVIDER=pollinations
```

> Pour l'analyse d'images (vision), mets un modèle multimodal, ex :
> `CHAT_MODEL=meta-llama/llama-4-scout-17b-16e-instruct`

---

## 3. Variables d'environnement

| Variable | Rôle | Défaut |
|---|---|---|
| `CHAT_API_KEY` | **(obligatoire)** clé du fournisseur de chat | — |
| `CHAT_BASE_URL` | endpoint compatible OpenAI | `https://api.groq.com/openai/v1` |
| `CHAT_MODEL` | modèle de chat | `llama-3.3-70b-versatile` |
| `TAVILY_API_KEY` | recherche web (optionnel) | — |
| `IMAGE_PROVIDER` | `pollinations` (gratuit) ou `hf` | `pollinations` |
| `HF_TOKEN` | requis seulement si `IMAGE_PROVIDER=hf` | — |
| `PORT` | port du serveur (Render le fournit tout seul) | `3000` |

**Changer de fournisseur de chat** = changer 3 variables :
- **OpenRouter** (modèles `:free`) : `CHAT_BASE_URL=https://openrouter.ai/api/v1`
- **Hugging Face** : `CHAT_BASE_URL=https://router.huggingface.co/v1`

---

## 4. Déploiement gratuit (Render)

1. Pousse ce dossier sur GitHub.
2. Sur https://render.com : **New → Blueprint**, sélectionne ton repo (le `render.yaml` est prêt).
3. Onglet **Environment** → ajoute tes 2 secrets : `CHAT_API_KEY` et `TAVILY_API_KEY`.
   (`CHAT_BASE_URL`, `CHAT_MODEL`, `IMAGE_PROVIDER` sont déjà dans le blueprint. Ne mets pas `PORT`.)
4. Déploie → Render te donne une URL publique.

> ⚠️ Plan gratuit Render : le service dort après ~15 min d'inactivité (premier chargement ~30 s).

---

## Structure

```
aura/
├── src/
│   ├── server.js          # serveur Express + routes API
│   └── services/
│       ├── ai.js          # chat (OpenAI-compatible) + génération d'images
│       ├── tavily.js      # recherche web
│       └── files.js       # extraction PDF / texte
├── public/
│   └── index.html         # interface spatiale
├── .env.example
├── render.yaml
└── package.json
```
