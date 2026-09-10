// ============================================================
//  Service Tavily — recherche web (free tier : 1000 crédits/mois)
//  Clé gratuite : https://app.tavily.com
// ============================================================

const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_URL = 'https://api.tavily.com/search';

/**
 * Recherche web via Tavily.
 * @param {string} query
 * @returns {Promise<{answer:string, results:Array<{title,url,content}>}>}
 */
export async function searchWeb(query) {
  if (!TAVILY_API_KEY) {
    throw new Error(
      'TAVILY_API_KEY manquant. Ajoute ta clé dans .env (gratuite sur https://app.tavily.com).'
    );
  }

  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      include_answer: true,
      max_results: 5,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Tavily (${res.status}) : ${detail.slice(0, 500)}`);
  }

  const data = await res.json();
  return {
    answer: data.answer || '',
    results: (data.results || []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
    })),
  };
}

/**
 * Formate les résultats de recherche en un bloc de contexte
 * qu'on injecte dans le prompt du modèle.
 */
export function formatSearchContext(search) {
  const lines = [];
  if (search.answer) lines.push(`Résumé web : ${search.answer}`);
  search.results.forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title}\n${r.content}\nSource : ${r.url}`);
  });
  return lines.join('\n\n');
}
