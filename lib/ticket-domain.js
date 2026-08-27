const { normalizePriority } = require('./sla');
const STATUSES = Object.freeze(['new', 'open', 'pending', 'resolved', 'closed']);
const CHANNELS = Object.freeze(['portal', 'email', 'chat', 'api', 'manual']);
const clean = (value, max = 1000) => String(value || '').trim().slice(0, max);
const normalizeEmail = (value) => clean(value, 320).toLowerCase();
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const normalizeTicketInput = (input = {}) => {
  const subject = clean(input.subject, 240);
  const description = clean(input.description, 20_000);
  const requesterName = clean(input.requesterName, 160) || 'Customer';
  const requesterEmail = normalizeEmail(input.requesterEmail);
  if (!subject) throw new Error('Ticket subject is required.');
  if (!requesterEmail || !isEmail(requesterEmail)) throw new Error('A valid requester email is required.');
  const channelValue = clean(input.channel, 40).toLowerCase();
  return { subject, description, requesterName, requesterEmail, priority: normalizePriority(input.priority), channel: CHANNELS.includes(channelValue) ? channelValue : 'portal' };
};
const normalizeStatus = (value, fallback = 'new') => { const candidate = clean(value, 40).toLowerCase(); return STATUSES.includes(candidate) ? candidate : fallback; };
const applyCustomerReplyState = () => 'open';
module.exports = { CHANNELS, STATUSES, applyCustomerReplyState, normalizeEmail, normalizeStatus, normalizeTicketInput };
