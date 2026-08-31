const { publicKnowledgeSearch } = require('../../../lib/knowledgebase/client.cjs');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ available: false, results: [], message: 'Method not allowed' });
  const organizationSlug = String(req.query.organizationSlug || '').trim();
  const query = String(req.query.q || '').trim();
  if (!organizationSlug || query.length < 2) return res.status(200).json({ available: true, results: [] });
  const result = await publicKnowledgeSearch(organizationSlug, query);
  return res.status(200).json({ available: result.available, results: result.items || [], errorCode: result.errorCode || null });
}
