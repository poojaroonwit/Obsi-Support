const CHANNELS = new Set(['portal','email','chat','api','manual']);
const PRIORITIES = new Set(['low','normal','high','urgent']);

const normalizeList = (values, allowed, label) => {
  if (values == null) return [];
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const result = [];
  for (const value of values) {
    const normalized = String(value || '').trim().toLowerCase();
    if (!allowed.has(normalized)) throw new Error(`Unsupported routing ${label.slice(0,-1)}: ${value}`);
    if (!result.includes(normalized)) result.push(normalized);
  }
  return result;
};

const normalizeRoutingConditions = (conditions = {}) => {
  if (!conditions || typeof conditions !== 'object' || Array.isArray(conditions)) throw new Error('Routing conditions must be an object');
  for (const key of Object.keys(conditions)) {
    if (!['channels','priorities'].includes(key)) throw new Error(`Unsupported routing condition: ${key}`);
  }
  const normalized = {};
  const channels = normalizeList(conditions.channels, CHANNELS, 'channels');
  const priorities = normalizeList(conditions.priorities, PRIORITIES, 'priorities');
  if (channels.length) normalized.channels = channels;
  if (priorities.length) normalized.priorities = priorities;
  return normalized;
};

const ruleMatchesTicket = (ticket = {}, conditions = {}) => {
  const normalized = normalizeRoutingConditions(conditions);
  const channel = String(ticket.channel || '').trim().toLowerCase();
  const priority = String(ticket.priority || '').trim().toLowerCase();
  if (normalized.channels?.length && !normalized.channels.includes(channel)) return false;
  if (normalized.priorities?.length && !normalized.priorities.includes(priority)) return false;
  return true;
};

const selectRoutingRule = (ticket, rules = []) => [...rules]
  .filter((rule) => rule && rule.enabled !== false)
  .sort((a,b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.id || '').localeCompare(String(b.id || '')))
  .find((rule) => ruleMatchesTicket(ticket, rule.conditions || {})) || null;

const normalizeCapacity = (value, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(0, Math.floor(Number(fallback) || 0));
  return Math.max(0, Math.floor(parsed));
};

const chooseLeastLoadMember = (members = []) => {
  const eligible = members
    .map((member) => member && ({ ...member, capacity: normalizeCapacity(member.capacity), load: Math.max(0, Number(member.load) || 0) }))
    .filter((member) => member && member.active !== false && member.capacity > 0 && member.load < member.capacity);
  eligible.sort((a,b) => {
    const ratio = (a.load / a.capacity) - (b.load / b.capacity);
    if (Math.abs(ratio) > Number.EPSILON) return ratio;
    if (a.load !== b.load) return a.load - b.load;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  return eligible[0] || null;
};

module.exports = { chooseLeastLoadMember, normalizeCapacity, normalizeRoutingConditions, ruleMatchesTicket, selectRoutingRule };
