# 🌌 AURA · powered by EGO

Un site web d'assistant IA construit **uniquement avec des API gratuites** :

| Fonction | Fournisseur (gratuit) |
|---|---|
| 💬 Chat texte | Hugging Face Inference |
| 👁️ Vision (analyse d'images) | Hugging Face (modèle vision-language) |
| 📎 Fichiers (PDF, .txt, .md, code…) | extraction locale + injection dans le contexte |
| 🎨 Génération d'images | Hugging Face (FLUX.1-schnell) |
| 🌐 Recherche web | Tavily |

Backend **Node.js + Express**, frontend HTML/CSS/JS pur (aucun framework). Les clés API restent côté serveur.

---

## 1. Récupérer les clés (100% gratuites)

**Hugging Face** — chat, vision et images
1. Crée un compte : https://huggingface.co
2. Génère un token : https://huggingface.co/settings/tokens → *New token* → type **Read**
3. Copie le token (`hf_...`)

> Le free tier donne un crédit mensuel d'inférence, largement suffisant pour tester et un usage perso.

**Tavily** — recherche web
1. Inscris-toi : https://app.tavily.com
2. Copie ta clé (`tvly-...`) — **1000 crédits/mois gratuits**

---

## 2. Installation locale

```bash
npm install
cp .env.example .env      # puis colle tes clés dans .env
npm start
```

Ouvre http://localhost:3000

---

## 3. Utilisation

- **Chat** : écris ton message, Entrée pour envoyer.
- **Vision** : clique 📎, joins une image, pose ta question dessus.
- **Fichiers** : joins un PDF ou un fichier texte/code — son contenu est lu et pris en compte.
- **Recherche web** : active le bouton 🌐 — AURA cherche sur le web et cite ses sources.
- **Génération d'image** : active 🎨 « Mode image », ton texte devient le prompt.

---

## 4. Déploiement gratuit (Render)

1. Pousse ce dossier sur GitHub.
2. Sur https://render.com : **New → Blueprint**, sélectionne ton repo (le fichier `render.yaml` est déjà prêt).
3. Dans l'onglet **Environment**, ajoute tes secrets : `HF_TOKEN` et `TAVILY_API_KEY`.
4. Déploie. Render te donne une URL publique.

> Railway fonctionne pareil : nouveau projet depuis le repo, ajoute les variables d'env, lance `npm start`.
> ⚠️ Sur le plan gratuit de Render, le service se met en veille après inactivité : le premier chargement peut prendre ~30 s.

---

## 5. Personnalisation

Tout se règle dans `.env` :

| Variable | Rôle | Défaut |
|---|---|---|
| `HF_CHAT_MODEL` | modèle chat + vision | `Qwen/Qwen2.5-VL-7B-Instruct` |
| `HF_IMAGE_MODEL` | modèle texte→image | `black-forest-labs/FLUX.1-schnell` |
| `PORT` | port du serveur | `3000` |

Le prompt système d'AURA se modifie dans `src/server.js` (`SYSTEM_PROMPT`).

---

## Structure

```
aura/
├── src/
│   ├── server.js            # serveur Express + routes API
│   └── services/
│       ├── huggingface.js   # chat/vision + génération d'images
│       ├── tavily.js        # recherche web
│       └── files.js         # extraction PDF / texte
├── public/
│   └── index.html           # interface de chat
├── .env.example
├── render.yaml
└── package.json
```

---

## Notes / limites du gratuit

- **Cold start** : au premier appel, un modèle HF peut renvoyer une erreur 503 le temps de « se réveiller » — réessaie ~20 s après.
- Si un modèle n'est pas dispo sur le free tier, change `HF_CHAT_MODEL` / `HF_IMAGE_MODEL` par un autre modèle Hugging Face compatible.
- Les fichiers texte volumineux sont tronqués (~12 000 caractères) pour tenir dans le contexte.
