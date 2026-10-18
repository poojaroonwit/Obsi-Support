/**
 * Optional, ticket-scoped safeguards for Agent Connect automation.
 * Human support staff retain their existing authenticated workflows.
 * This never disables organization identity, tenant isolation or platform policy.
 */
const RECOMMENDED = Object.freeze({
  requireHumanReview: true,
  maskRequesterForAgents: true,
  preventAutomaticClosure: true,
});
const DISABLED = Object.freeze({
  enabled: false,
  requireHumanReview: false,
  maskRequesterForAgents: false,
  preventAutomaticClosure: false,
});
function normalizeTicketAgentGovernance(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || input.enabled !== true) {
    return { ...DISABLED };
  }
  return {
    enabled: true,
    ...Object.fromEntries(Object.entries(RECOMMENDED)
      .map(([name, defaultValue]) => [name, typeof input[name] === 'boolean' ? input[name] : defaultValue])),
  };
}
function redactTicketForAgent(ticket) {
  if (!ticket) return ticket;
  const policy = normalizeTicketAgentGovernance(ticket.agentGovernance);
  if (!policy.maskRequesterForAgents) return ticket;
  return {
    ...ticket,
    requesterName: 'Requester hidden by ticket policy',
    requesterEmail: '',
    ...(Array.isArray(ticket.messages) ? {
      messages: ticket.messages.map(message => ({
        ...message,
        authorEmail: '',
        ...(message.authorType === 'customer' ? { authorName: 'Customer' } : {}),
      })),
    } : {}),
  };
}
function validateAutomatedTicketAction(ticket, action, payload = {}) {
  const policy = normalizeTicketAgentGovernance(ticket?.agentGovernance);
  if (!policy.enabled) return;
  if (action === 'reply' && policy.requireHumanReview && !payload.isInternal) {
    const error = new Error('Agent reply requires a human review in the support inbox.');
    error.status = 409;
    throw error;
  }
  if (action === 'update' && policy.preventAutomaticClosure && ['resolved', 'closed'].includes(String(payload.status || '').toLowerCase())) {
    const error = new Error('Only a human support agent may resolve or close this governed ticket.');
    error.status = 409;
    throw error;
  }
}
module.exports = { RECOMMENDED, DISABLED, normalizeTicketAgentGovernance, redactTicketForAgent, validateAutomatedTicketAction };
