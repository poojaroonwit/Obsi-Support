const decodeEntities = (value) => String(value || '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'");

const stripHtmlToText = (html) => decodeEntities(String(html || '')
  .replace(/<\s*br\s*\/?>/gi, '\n')
  .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, '\n')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .replace(/ *\n */g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim());

const parseMailbox = (value) => {
  const raw = String(value || '').trim();
  const angle = raw.match(/^\s*([^<]*?)\s*<([^>]+)>\s*$/);
  const email = String(angle ? angle[2] : raw).trim().toLowerCase();
  const name = String(angle ? angle[1] : '').trim().replace(/^"|"$/g, '') || email.split('@')[0] || 'Customer';
  return { name: name.slice(0, 160), email: email.slice(0, 320) };
};

const extractTicketKey = (subject) => {
  const match = String(subject || '').toUpperCase().match(/\bSUP-\d{1,12}\b/);
  return match ? match[0] : '';
};

const extractMessageIds = (value) => {
  const seen = new Set();
  const matches = String(value || '').match(/<[^<>\s]+>/g) || [];
  return matches.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const normalizeInboundEmail = (email = {}) => {
  const sender = parseMailbox(email.from);
  const headers = email.headers && typeof email.headers === 'object' ? email.headers : {};
  const inReplyTo = headers['in-reply-to'] || headers['In-Reply-To'] || '';
  const references = headers.references || headers.References || '';
  const referenceMessageIds = [];
  for (const id of [...extractMessageIds(inReplyTo), ...extractMessageIds(references)]) {
    if (!referenceMessageIds.includes(id)) referenceMessageIds.push(id);
  }
  const subject = String(email.subject || '').trim().slice(0, 240) || 'Support request';
  const body = String(email.text || '').trim() || stripHtmlToText(email.html);
  return {
    providerEmailId: String(email.id || email.email_id || '').trim(),
    messageId: String(email.message_id || headers['message-id'] || headers['Message-ID'] || '').trim(),
    referenceMessageIds,
    to: Array.isArray(email.to) ? email.to.map((item) => String(item).trim().toLowerCase()).filter(Boolean) : [],
    senderName: sender.name,
    senderEmail: sender.email,
    subject,
    ticketKey: extractTicketKey(subject),
    body: body.slice(0, 20_000),
    attachments: Array.isArray(email.attachments) ? email.attachments : [],
  };
};

const buildReplySubject = (ticket = {}) => {
  const key = String(ticket.key || '').trim();
  const raw = String(ticket.subject || 'Support request').trim();
  const cleaned = raw.replace(/^\s*(re|fw|fwd)\s*:\s*/i, '').replace(/^\s*\[SUP-\d+\]\s*/i, '').trim();
  return `Re: [${key}] ${cleaned || 'Support request'}`.trim();
};

const buildThreadHeaders = (messages = []) => {
  const ids = [];
  for (const message of messages) {
    const id = String(message?.externalMessageId || '').trim();
    if (id && !ids.includes(id)) ids.push(id);
  }
  if (!ids.length) return {};
  return {
    'In-Reply-To': ids[ids.length - 1],
    References: ids.join(' '),
  };
};

module.exports = { buildReplySubject, buildThreadHeaders, extractMessageIds, extractTicketKey, normalizeInboundEmail, parseMailbox, stripHtmlToText };
