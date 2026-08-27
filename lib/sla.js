const DEFAULT_SLA_POLICY = Object.freeze({
  urgent: { firstResponseMinutes: 15, resolutionMinutes: 240 },
  high: { firstResponseMinutes: 60, resolutionMinutes: 480 },
  normal: { firstResponseMinutes: 240, resolutionMinutes: 1440 },
  low: { firstResponseMinutes: 480, resolutionMinutes: 2880 },
});

const normalizePriority = (value) => {
  const candidate = String(value || 'normal').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DEFAULT_SLA_POLICY, candidate) ? candidate : 'normal';
};
const addMinutes = (date, minutes) => new Date(new Date(date).getTime() + Number(minutes) * 60_000);
const calculateSlaTargets = (createdAt = new Date(), priority = 'normal', policy = DEFAULT_SLA_POLICY) => {
  const normalized = normalizePriority(priority);
  const rule = policy[normalized] || policy.normal || DEFAULT_SLA_POLICY.normal;
  return { firstResponseDueAt: addMinutes(createdAt, rule.firstResponseMinutes), resolutionDueAt: addMinutes(createdAt, rule.resolutionMinutes) };
};
const evaluateDeadline = ({ completedAt, dueAt, now }) => {
  if (!dueAt) return 'not_set';
  const due = new Date(dueAt).getTime();
  if (completedAt) return new Date(completedAt).getTime() <= due ? 'met' : 'breached';
  return new Date(now).getTime() > due ? 'breached' : 'running';
};
const evaluateSla = (ticket, now = new Date()) => {
  const firstResponse = evaluateDeadline({ completedAt: ticket.firstRespondedAt, dueAt: ticket.firstResponseDueAt, now });
  const resolution = evaluateDeadline({ completedAt: ticket.resolvedAt, dueAt: ticket.resolutionDueAt, now });
  const overall = firstResponse === 'breached' || resolution === 'breached' ? 'breached' : (firstResponse === 'met' && ['met', 'not_set'].includes(resolution) ? 'met' : 'running');
  return { firstResponse, resolution, overall };
};
module.exports = { DEFAULT_SLA_POLICY, calculateSlaTargets, evaluateSla, normalizePriority };
