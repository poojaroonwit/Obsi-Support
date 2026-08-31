const crypto = require('crypto');
const { publicKnowledgeFeedback } = require('../../../lib/knowledgebase/client.cjs');

function sessionId(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const seed = `${forwarded}|${String(req.headers['user-agent'] || '').slice(0, 240)}`;
  return crypto.createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ available: false, message: 'Method not allowed' });
  const organizationSlug = String(req.body?.organizationSlug || '').trim();
  const documentId = String(req.body?.documentId || '').trim();
  const publicationId = String(req.body?.publicationId || '').trim();
  const value = String(req.body?.value || '').trim();
  if (!organizationSlug || !documentId || !publicationId || !['helpful', 'not_helpful'].includes(value)) {
    return res.status(400).json({ available: true, message: 'Invalid feedback' });
  }
  const result = await publicKnowledgeFeedback(organizationSlug, { documentId, publicationId, value, reason: String(req.body?.reason || '').slice(0, 1000), sessionId: sessionId(req) });
  return res.status(result.available ? 201 : 200).json({ available: result.available, recorded: Boolean(result.feedback), errorCode: result.errorCode || null });
}
