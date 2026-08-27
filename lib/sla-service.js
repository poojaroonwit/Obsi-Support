const { query } = require('./db');
const { calculateSlaTargets } = require('./sla');
const { getSlaPolicy } = require('./sla-repository');

const recalculateTicketSla = async ({ organizationId, ticketId }) => {
  const ticketResult = await query('SELECT id,priority,created_at FROM support_tickets WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, ticketId]);
  const ticket = ticketResult.rows[0];
  if (!ticket) return null;
  const policy = await getSlaPolicy(organizationId);
  if (!policy) return { applied: false, reason: 'default-24x7' };
  const targets = calculateSlaTargets(new Date(ticket.created_at), ticket.priority, policy);
  await query('UPDATE support_tickets SET first_response_due_at=$3,resolution_due_at=$4,updated_at=NOW() WHERE organization_id=$1 AND id=$2', [organizationId, ticketId, targets.firstResponseDueAt, targets.resolutionDueAt]);
  return { applied: true, policy, ...targets };
};

module.exports = { recalculateTicketSla };
