const { buildReplySubject, buildThreadHeaders, normalizeInboundEmail } = require('./email-domain');

const deliveryStatusForEvent = (type) => ({
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.failed': 'failed',
  'email.bounced': 'bounced',
  'email.suppressed': 'failed',
}[String(type || '')] || '');

const deliveryError = (event) => String(
  event?.data?.bounce?.message
    || event?.data?.suppressed?.message
    || event?.data?.failed?.reason
    || event?.data?.error
    || '',
).slice(0, 2000);

const buildReplyTo = (ticket, env) => {
  const domain = String(env.SUPPORT_EMAIL_DOMAIN || '').trim().toLowerCase();
  const slug = String(ticket.organizationSlug || '').trim().toLowerCase();
  return domain && slug ? `${slug}@${domain}` : String(env.SUPPORT_EMAIL_REPLY_TO || '').trim();
};

const createEmailService = ({ repository, transport, env = process.env }) => ({
  isOutboundConfigured() {
    return Boolean(String(env.RESEND_API_KEY || '').trim() && String(env.SUPPORT_EMAIL_FROM || '').trim());
  },

  async handleWebhookEvent(event = {}) {
    if (event.type === 'email.received') {
      const providerEmailId = String(event?.data?.email_id || '').trim();
      if (!providerEmailId) throw new Error('Inbound email event is missing email_id');
      const detail = await transport.retrieveReceivedEmail(providerEmailId, { apiKey: env.RESEND_API_KEY });
      const email = normalizeInboundEmail(detail);
      const organization = await repository.resolveOrganizationForInbound(email.to, String(env.SUPPORT_EMAIL_DOMAIN || '').trim().toLowerCase());
      if (!organization) throw new Error('No Obsi Support organization matches the inbound address');
      return repository.ingestInboundEmail({
        organizationId: organization.organization_id || organization.organizationId,
        organizationSlug: organization.slug,
        email,
      });
    }

    const status = deliveryStatusForEvent(event.type);
    if (!status) return { ignored: true };
    await repository.updateEmailDelivery({
      providerEmailId: String(event?.data?.email_id || '').trim(),
      externalMessageId: String(event?.data?.message_id || '').trim(),
      status,
      error: deliveryError(event),
    });
    return { updated: true };
  },

  async deliverAgentReply({ ticket, message }) {
    if (!this.isOutboundConfigured()) return { skipped: true, reason: 'email-not-configured' };
    try {
      const result = await transport.sendEmail({
        apiKey: env.RESEND_API_KEY,
        from: env.SUPPORT_EMAIL_FROM,
        to: ticket.requesterEmail,
        replyTo: buildReplyTo(ticket, env) || undefined,
        subject: buildReplySubject(ticket),
        text: message.body,
        headers: buildThreadHeaders(ticket.messages || []),
        idempotencyKey: `ticket-message/${message.id}`,
      });
      await repository.updateMessageDelivery({ ticketId: ticket.id, messageId: message.id, providerEmailId: result.id, status: 'sent', error: '' });
      return result;
    } catch (error) {
      await repository.updateMessageDelivery({ ticketId: ticket.id, messageId: message.id, providerEmailId: '', status: 'failed', error: error.message || 'Email delivery failed' });
      throw error;
    }
  },
});

module.exports = { buildReplyTo, createEmailService, deliveryStatusForEvent };
