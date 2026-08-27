const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { normalizeInboundEmail, buildReplySubject, extractTicketKey } = require('../lib/email-domain');
const { verifySvixSignature, retrieveReceivedEmail, sendEmail } = require('../lib/email/resend');
const { createEmailService, deliveryStatusForEvent } = require('../lib/email-service');

test('normalizes inbound mail and finds support ticket key', () => {
  const result = normalizeInboundEmail({
    id: 'recv_1', from: 'Ada Lovelace <ADA@example.com>', to: ['acme@support.example.com'],
    subject: 'Re: [SUP-000042] Cannot sign in', text: 'I still cannot sign in.\n', message_id: '<incoming@example.com>',
    headers: { 'in-reply-to': '<outgoing@example.com>', references: '<root@example.com> <outgoing@example.com>' },
  });
  assert.equal(result.senderEmail, 'ada@example.com');
  assert.equal(result.senderName, 'Ada Lovelace');
  assert.equal(result.ticketKey, 'SUP-000042');
  assert.equal(result.body, 'I still cannot sign in.');
  assert.deepEqual(result.referenceMessageIds, ['<outgoing@example.com>', '<root@example.com>']);
});

test('falls back from HTML to readable text', () => {
  const result = normalizeInboundEmail({ from: 'user@example.com', to: ['team@example.com'], subject: 'Help', html: '<p>Hello <strong>team</strong></p><p>Line two</p>' });
  assert.match(result.body, /Hello team/);
  assert.match(result.body, /Line two/);
});

test('ticket key extraction and reply subjects stay stable', () => {
  assert.equal(extractTicketKey('Fwd: SUP-000009 login issue'), 'SUP-000009');
  assert.equal(buildReplySubject({ key: 'SUP-000009', subject: 'Login issue' }), 'Re: [SUP-000009] Login issue');
  assert.equal(buildReplySubject({ key: 'SUP-000009', subject: 'Re: [SUP-000009] Login issue' }), 'Re: [SUP-000009] Login issue');
});

test('verifies Svix-compatible signatures and rejects tampering', () => {
  const rawSecret = crypto.randomBytes(32);
  const secret = `whsec_${rawSecret.toString('base64')}`;
  const payload = JSON.stringify({ type: 'email.received', data: { email_id: 'recv_1' } });
  const id = 'msg_123'; const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto.createHmac('sha256', rawSecret).update(`${id}.${timestamp}.${payload}`).digest('base64');
  const headers = { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${signature}` };
  assert.equal(verifySvixSignature({ payload, headers, secret }), true);
  assert.equal(verifySvixSignature({ payload: `${payload} `, headers, secret }), false);
});

test('retrieves received email through Resend receiving endpoint', async () => {
  let request;
  const fetchImpl = async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ id: 'recv_1', text: 'hello' }) }; };
  const result = await retrieveReceivedEmail('recv_1', { apiKey: 're_test', fetchImpl });
  assert.equal(request.url, 'https://api.resend.com/emails/receiving/recv_1');
  assert.equal(request.options.headers.Authorization, 'Bearer re_test');
  assert.equal(result.text, 'hello');
});

test('sends outbound email with threading headers and idempotency key', async () => {
  let request;
  const fetchImpl = async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ id: 'sent_1' }) }; };
  const result = await sendEmail({ apiKey: 're_test', from: 'Obsi Support <support@example.com>', to: 'ada@example.com', replyTo: 'acme@support.example.com', subject: 'Re: [SUP-000042] Cannot sign in', text: 'Please try again.', headers: { 'In-Reply-To': '<incoming@example.com>', References: '<root@example.com> <incoming@example.com>' }, idempotencyKey: 'ticket-message/msg_1', fetchImpl });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['Idempotency-Key'], 'ticket-message/msg_1');
  const body = JSON.parse(request.options.body);
  assert.equal(body.reply_to, 'acme@support.example.com');
  assert.equal(body.headers['In-Reply-To'], '<incoming@example.com>');
  assert.equal(result.id, 'sent_1');
});

test('inbound service retrieves received email and passes normalized content to repository', async () => {
  const calls = [];
  const repository = {
    resolveOrganizationForInbound: async (addresses, domain) => { calls.push(['resolve', addresses, domain]); return { organization_id: 'org-1', slug: 'acme', name: 'Acme' }; },
    ingestInboundEmail: async (payload) => { calls.push(['ingest', payload]); return { ticketId: 'ticket-1', created: true }; },
    updateEmailDelivery: async () => { throw new Error('not expected'); },
  };
  const transport = { retrieveReceivedEmail: async (id) => ({ id, from: 'Ada <ada@example.com>', to: ['acme@support.example.com'], subject: 'Help', text: 'Need help', message_id: '<m1>' }) };
  const service = createEmailService({ repository, transport, env: { SUPPORT_EMAIL_DOMAIN: 'support.example.com' } });
  const result = await service.handleWebhookEvent({ type: 'email.received', data: { email_id: 'recv-1' } });
  assert.equal(result.created, true);
  assert.deepEqual(calls[0], ['resolve', ['acme@support.example.com'], 'support.example.com']);
  assert.equal(calls[1][1].email.senderEmail, 'ada@example.com');
});

test('delivery webhook maps delivery states without touching inbound path', async () => {
  let update;
  const repository = { resolveOrganizationForInbound: async () => { throw new Error('not expected'); }, ingestInboundEmail: async () => { throw new Error('not expected'); }, updateEmailDelivery: async (payload) => { update = payload; return true; } };
  const service = createEmailService({ repository, transport: {}, env: {} });
  await service.handleWebhookEvent({ type: 'email.bounced', data: { email_id: 'sent-1', message_id: '<m2>', bounce: { message: 'Mailbox unavailable' } } });
  assert.equal(update.providerEmailId, 'sent-1');
  assert.equal(update.status, 'bounced');
  assert.equal(update.externalMessageId, '<m2>');
  assert.match(update.error, /Mailbox unavailable/);
  assert.equal(deliveryStatusForEvent('email.delivery_delayed'), 'delayed');
});

test('agent email reply is threaded and delivery state is persisted', async () => {
  let sent; let marked;
  const repository = { updateMessageDelivery: async (payload) => { marked = payload; return true; } };
  const transport = { sendEmail: async (payload) => { sent = payload; return { id: 'provider-1' }; } };
  const service = createEmailService({ repository, transport, env: { RESEND_API_KEY: 're_test', SUPPORT_EMAIL_FROM: 'Obsi Support <support@example.com>', SUPPORT_EMAIL_DOMAIN: 'support.example.com' } });
  const ticket = { id: 't1', key: 'SUP-000042', organizationSlug: 'acme', subject: 'Cannot sign in', requesterEmail: 'ada@example.com', messages: [{ externalMessageId: '<incoming@example.com>' }] };
  const message = { id: 'msg1', body: 'Please try again.' };
  await service.deliverAgentReply({ ticket, message });
  assert.equal(sent.replyTo, 'acme@support.example.com');
  assert.equal(sent.headers['In-Reply-To'], '<incoming@example.com>');
  assert.equal(sent.idempotencyKey, 'ticket-message/msg1');
  assert.deepEqual(marked, { ticketId: 't1', messageId: 'msg1', providerEmailId: 'provider-1', status: 'sent', error: '' });
});

test('suppressed delivery exposes provider reason', async () => {
  let update;
  const repository = { updateEmailDelivery: async (payload) => { update = payload; return true; } };
  const service = createEmailService({ repository, transport: {}, env: {} });
  await service.handleWebhookEvent({ type: 'email.suppressed', data: { email_id: 'sent-2', suppressed: { message: 'Recipient is suppressed' } } });
  assert.equal(update.status, 'failed');
  assert.match(update.error, /Recipient is suppressed/);
});
