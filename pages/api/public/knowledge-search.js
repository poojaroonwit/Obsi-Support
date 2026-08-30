const { publicKnowledgeSearch } = require('../../../lib/knowledgebase/client');
const { normalizeSearchResult } = require('../../../lib/knowledgebase/help-center');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ available: false, suggestions: [], message: 'Method not allowed' });
  const organizationSlug = String(req.query.organizationSlug || '').trim();
  const query = String(req.query.q || '').trim().slice(0, 500);
  if (!organizationSlug || query.length < 2) return res.status(200).json({ available: true, results: [] });
  const result = await publicKnowledgeSearch({ organizationSlug, query });
  if (!result.available) return res.status(200).json({ available: false, results: [], errorCode: result.errorCode || 'KNOWLEDGE_UNAVAILABLE' });
  return res.status(200).json({ available: true, results: result.items.map((item) => normalizeSearchResult(organizationSlug, item)) });
}
