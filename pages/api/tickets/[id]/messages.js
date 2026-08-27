const { requireAgent } = require('../../../../lib/auth');
const repository = require('../../../../lib/repository');
const resendTransport = require('../../../../lib/email/resend');
const { createEmailService } = require('../../../../lib/email-service');

export default async function handler(req, res) {
  const session = requireAgent(req, res);
  if (!session) return;
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
  try {
    const isInternal = Boolean(req.body?.isInternal);
    const service = createEmailService({ repository, transport: resendTransport, env: process.env });
    const deliveryChannel = !isInternal && service.isOutboundConfigured() ? 'email' : 'portal';
    const inserted = await repository.addAgentMessage({
      organizationId: session.organizationId,
      ticketId: req.query.id,
      session,
      body: req.body?.body,
      isInternal,
      deliveryChannel,
    });
    if (!inserted) return res.status(404).json({ success: false, message: 'Ticket not found' });
    let ticket = await repository.getTicket(session.organizationId, req.query.id);
    if (!isInternal && deliveryChannel === 'email') {
      const message = ticket.messages.find((item) => item.id === inserted.messageId);
      try {
        await service.deliverAgentReply({ ticket, message });
      } catch (error) {
        ticket = await repository.getTicket(session.organizationId, req.query.id);
        return res.status(502).json({ success: false, message: 'Reply was saved, but email delivery failed.', detail: error.message, ticket });
      }
      ticket = await repository.getTicket(session.organizationId, req.query.id);
    }
    return res.status(201).json({ success: true, ticket });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message || 'Unable to add message.' });
  }
}
