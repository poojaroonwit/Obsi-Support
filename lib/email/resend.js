const crypto = require('node:crypto');

const RESEND_API_BASE = 'https://api.resend.com';
const header = (headers, name) => headers?.[name] || headers?.[name.toLowerCase()] || headers?.[name.toUpperCase()] || '';
const timingSafeBase64Equal = (left, right) => {
  try {
    const a = Buffer.from(String(left), 'base64');
    const b = Buffer.from(String(right), 'base64');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
};

const verifySvixSignature = ({ payload, headers = {}, secret, now = Date.now(), toleranceSeconds = 300 }) => {
  const id = String(header(headers, 'svix-id') || '').trim();
  const timestamp = String(header(headers, 'svix-timestamp') || '').trim();
  const signatureHeader = String(header(headers, 'svix-signature') || '').trim();
  if (!id || !timestamp || !signatureHeader || !secret) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber) || Math.abs(Math.floor(now / 1000) - timestampNumber) > toleranceSeconds) return false;
  const encodedSecret = String(secret).replace(/^whsec_/, '');
  let key;
  try { key = Buffer.from(encodedSecret, 'base64'); } catch { return false; }
  if (!key.length) return false;
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64');
  return signatureHeader.split(/\s+/).some((entry) => {
    const [version, signature] = entry.split(',');
    return version === 'v1' && timingSafeBase64Equal(signature, expected);
  });
};

const requestJson = async (url, options, fetchImpl = globalThis.fetch) => {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is not available');
  const response = await fetchImpl(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.name || `Resend request failed (${response.status || 'unknown'})`);
  return payload;
};

const retrieveReceivedEmail = async (emailId, { apiKey, fetchImpl = globalThis.fetch } = {}) => {
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  if (!emailId) throw new Error('Received email id is required');
  return requestJson(`${RESEND_API_BASE}/emails/receiving/${encodeURIComponent(emailId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  }, fetchImpl);
};

const sendEmail = async ({ apiKey, from, to, replyTo, subject, text, html, headers = {}, idempotencyKey, fetchImpl = globalThis.fetch } = {}) => {
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');
  if (!from || !to) throw new Error('Email sender and recipient are required');
  const requestHeaders = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' };
  if (idempotencyKey) requestHeaders['Idempotency-Key'] = String(idempotencyKey).slice(0, 256);
  const body = { from, to: Array.isArray(to) ? to : [to], subject: String(subject || 'Obsi Support'), text: String(text || '') };
  if (html) body.html = html;
  if (replyTo) body.reply_to = replyTo;
  if (headers && Object.keys(headers).length) body.headers = headers;
  return requestJson(`${RESEND_API_BASE}/emails`, { method: 'POST', headers: requestHeaders, body: JSON.stringify(body) }, fetchImpl);
};

module.exports = { RESEND_API_BASE, retrieveReceivedEmail, sendEmail, verifySvixSignature };
