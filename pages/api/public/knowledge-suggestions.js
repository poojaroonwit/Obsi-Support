const { publicKnowledgeSearch } = require('../../../lib/knowledgebase/client.cjs');
const { buildSuggestionQuery, shouldSuggest } = require('../../../lib/knowledgebase/suggestion-query.cjs');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ available: false, suggestions: [], message: 'Method not allowed' });
  const organizationSlug = String(req.body?.organizationSlug || '').trim();
  const query = buildSuggestionQuery({ subject: req.body?.subject, description: req.body?.description });
  if (!organizationSlug || !shouldSuggest(query)) return res.status(200).json({ available: true, suggestions: [] });

  const result = await publicKnowledgeSearch(organizationSlug, query);
  const suggestions = (result.items || []).slice(0, 5).map((item) => ({
    title: item.title || item.documentTitle || 'Knowledge article',
    snippet: item.snippet || item.contentText || '',
    url: item.sourceUrl || item.url || '',
    documentId: item.documentId || '',
    publicationId: item.publicationId || '',
    score: Number(item.score || 0),
  }));
  return res.status(200).json({ available: result.available, suggestions, errorCode: result.errorCode || null });
}
