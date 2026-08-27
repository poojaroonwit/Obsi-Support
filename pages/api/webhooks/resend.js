const repository = require('../../../lib/repository');
const resendTransport = require('../../../lib/email/resend');
const { createEmailService } = require('../../../lib/email-service');
const { routeTicket } = require('../../../lib/routing-repository');
const { recalculateTicketSla } = require('../../../lib/sla-service');

export const config = { api: { bodyParser: false } };

const readRawBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
});

const tryRoute = async (organizationId, ticketId) => {
  try { await routeTicket({ organizationId, ticketId }); }
  catch (error) { console.error('Automatic email ticket routing failed:', error); }
};
const trySla = async (organizationId, ticketId) => {
  try { await recalculateTicketSla({ organizationId, ticketId }); }
  catch (error) { console.error('Email ticket SLA calculation failed:', error); }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  try {
    const payload = await readRawBody(req);
    const verified = resendTransport.verifySvixSignature({ payload, headers: req.headers, secret: process.env.RESEND_WEBHOOK_SECRET });
    if (!verified) return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    const event = JSON.parse(payload);
    const service = createEmailService({ repository, transport: resendTransport, env: process.env });
    const result = await service.handleWebhookEvent(event);
    if (event.type === 'email.received' && result?.created && result?.ticket?.organizationId && result?.ticketId) {
      await trySla(result.ticket.organizationId, result.ticketId);
      await tryRoute(result.ticket.organizationId, result.ticketId);
    }
    return res.status(200).json({ success: true, result });
  } catch (error) {
    console.error('Resend webhook failed:', error);
    return res.status(500).json({ success: false, message: error.message || 'Webhook processing failed' });
  }
}
