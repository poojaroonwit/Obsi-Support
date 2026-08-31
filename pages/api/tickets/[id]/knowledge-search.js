const { requireAgent } = require('../../../../lib/auth');
const { getTicket } = require('../../../../lib/repository');
const { getDelegatedAccessToken } = require('../../../../lib/outborn/delegated-token');
const { agentKnowledgeSearch } = require('../../../../lib/knowledgebase/client.cjs');

export default async function handler(req, res) {
  const session = requireAgent(req, res);
  if (!session) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ available: false, results: [], message: 'Method not allowed' });
  }
  const ticket = await getTicket(session.organizationId, req.query.id);
  if (!ticket) return res.status(404).json({ available: false, results: [], message: 'Ticket not found' });
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.status(200).json({ available: true, results: [] });
  const accessToken = getDelegatedAccessToken(req);
  if (!accessToken) return res.status(200).json({ available: false, results: [], errorCode: 'DELEGATED_TOKEN_UNAVAILABLE' });
  const result = await agentKnowledgeSearch({ organizationId: session.organizationId, query, accessToken });
  return res.status(200).json({ available: result.available, results: result.items || [], errorCode: result.errorCode || null });
}
