// ============================================================
//  Gestion des fichiers uploadés.
//  - Images  -> renvoyées en data URL (pour la vision du modèle)
//  - Texte/PDF -> texte extrait (injecté dans le contexte du chat)
// ============================================================

// On importe directement le coeur de pdf-parse pour éviter le code de debug
// qui s'exécute quand on require le paquet racine.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';

const TEXT_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.js', '.py', '.html', '.css', '.xml', '.log', '.ts'];
const MAX_TEXT_CHARS = 12000; // on tronque les gros fichiers pour rester dans le contexte

function extname(name = '') {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

/**
 * Traite un fichier (objet multer en mémoire : { originalname, mimetype, buffer }).
 * @returns {Promise<{kind:'image'|'text', name:string, dataUrl?:string, text?:string}>}
 */
export async function processFile(file) {
  const ext = extname(file.originalname);
  const mime = file.mimetype || '';

  // --- Image -> vision ---
  if (mime.startsWith('image/')) {
    return {
      kind: 'image',
      name: file.originalname,
      dataUrl: `data:${mime};base64,${file.buffer.toString('base64')}`,
    };
  }

  // --- PDF -> texte ---
  if (ext === '.pdf' || mime === 'application/pdf') {
    const parsed = await pdfParse(file.buffer);
    return {
      kind: 'text',
      name: file.originalname,
      text: truncate(parsed.text || ''),
    };
  }

  // --- Fichiers texte ---
  if (TEXT_EXTENSIONS.includes(ext) || mime.startsWith('text/')) {
    return {
      kind: 'text',
      name: file.originalname,
      text: truncate(file.buffer.toString('utf8')),
    };
  }

  throw new Error(`Type de fichier non supporté : ${file.originalname} (${mime || ext || 'inconnu'})`);
}

function truncate(str) {
  if (str.length <= MAX_TEXT_CHARS) return str;
  return str.slice(0, MAX_TEXT_CHARS) + '\n\n[...fichier tronqué...]';
}
