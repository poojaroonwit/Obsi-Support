const { requireAgentConnect } = require('../../../lib/outborn/agent-connect-auth');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const session = await requireAgentConnect(req, res);
  if (!session) return;

  return res.json({
    success: true,
    product: { id: 'obsi-support', name: 'Obsi Support' },
    organization: {
      id: session.organizationId,
      slug: session.organizationSlug,
      name: session.organizationName,
    },
    capabilities: ['tickets.read', 'tickets.create', 'tickets.update', 'tickets.reply'],
  });
}
