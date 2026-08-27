const crypto = require('crypto');
const { query, withTransaction } = require('./db');
const { calculateSlaTargets, evaluateSla, normalizePriority } = require('./sla');
const { applyCustomerReplyState, normalizeStatus, normalizeTicketInput } = require('./ticket-domain');
const { createPortalToken, hashPortalToken } = require('./portal-token');

const ticketKey = (number) => `SUP-${String(number).padStart(6, '0')}`;
const mapTicket = (row) => row && ({
  id: row.id, key: ticketKey(row.ticket_number), organizationId: row.organization_id, organizationSlug: row.organization_slug,
  subject: row.subject, description: row.description || '', status: row.status, priority: row.priority, channel: row.channel,
  requesterName: row.requester_name, requesterEmail: row.requester_email,
  assigneeId: row.assignee_id || '', assigneeName: row.assignee_name || '', assigneeEmail: row.assignee_email || '',
  firstResponseDueAt: row.first_response_due_at, resolutionDueAt: row.resolution_due_at, firstRespondedAt: row.first_responded_at,
  resolvedAt: row.resolved_at, createdAt: row.created_at, updatedAt: row.updated_at,
  sla: evaluateSla({ firstResponseDueAt: row.first_response_due_at, resolutionDueAt: row.resolution_due_at, firstRespondedAt: row.first_responded_at, resolvedAt: row.resolved_at }),
});
const mapMessage = (row) => ({ id: row.id, authorType: row.author_type, authorName: row.author_name, authorEmail: row.author_email, body: row.body, isInternal: row.is_internal, createdAt: row.created_at });

const upsertOrganization = async ({ id, slug, name }) => {
  if (!id) return;
  await query(`INSERT INTO support_organizations (organization_id, slug, name) VALUES ($1,$2,$3)
    ON CONFLICT (organization_id) DO UPDATE SET slug=EXCLUDED.slug, name=EXCLUDED.name, updated_at=NOW()`, [id, slug || id, name || slug || id]);
};
const resolveOrganizationBySlug = async (slug) => {
  const result = await query('SELECT organization_id, slug, name FROM support_organizations WHERE slug=$1 LIMIT 1', [String(slug || '').trim()]);
  return result.rows[0] || null;
};
const listTickets = async (organizationId, filters = {}) => {
  const params = [organizationId]; const where = ['organization_id=$1'];
  if (filters.status && filters.status !== 'all') { params.push(normalizeStatus(filters.status, 'open')); where.push(`status=$${params.length}`); }
  if (filters.search) { params.push(`%${String(filters.search).trim()}%`); where.push(`(subject ILIKE $${params.length} OR requester_email ILIKE $${params.length})`); }
  const result = await query(`SELECT * FROM support_tickets WHERE ${where.join(' AND ')} ORDER BY updated_at DESC LIMIT 200`, params);
  return result.rows.map(mapTicket);
};
const getTicket = async (organizationId, id) => {
  const ticketResult = await query('SELECT * FROM support_tickets WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, id]);
  const ticket = mapTicket(ticketResult.rows[0]); if (!ticket) return null;
  const messages = await query('SELECT * FROM support_messages WHERE ticket_id=$1 ORDER BY created_at ASC', [id]);
  return { ...ticket, messages: messages.rows.map(mapMessage) };
};
const createTicket = async ({ organizationId, organizationSlug, input, portalTtlHours = 24 * 30 }) => {
  const normalized = normalizeTicketInput(input); const createdAt = new Date(); const targets = calculateSlaTargets(createdAt, normalized.priority);
  const portalToken = createPortalToken(); const tokenHash = hashPortalToken(portalToken); const id = crypto.randomUUID();
  await withTransaction(async (client) => {
    await client.query(`INSERT INTO support_tickets
      (id, organization_id, organization_slug, subject, description, status, priority, channel, requester_name, requester_email, first_response_due_at, resolution_due_at, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,'new',$6,$7,$8,$9,$10,$11,$12,$12)`, [id, organizationId, organizationSlug, normalized.subject, normalized.description, normalized.priority, normalized.channel, normalized.requesterName, normalized.requesterEmail, targets.firstResponseDueAt, targets.resolutionDueAt, createdAt]);
    if (normalized.description) await client.query(`INSERT INTO support_messages (id,ticket_id,author_type,author_name,author_email,body,is_internal) VALUES ($1,$2,'customer',$3,$4,$5,false)`, [crypto.randomUUID(), id, normalized.requesterName, normalized.requesterEmail, normalized.description]);
    await client.query(`INSERT INTO support_portal_tokens (token_hash,ticket_id,requester_email,expires_at) VALUES ($1,$2,$3,NOW()+($4 || ' hours')::interval)`, [tokenHash, id, normalized.requesterEmail, String(portalTtlHours)]);
  });
  return { ticket: await getTicket(organizationId, id), portalToken };
};
const addAgentMessage = async ({ organizationId, ticketId, session, body, isInternal = false }) => {
  const text = String(body || '').trim().slice(0, 20_000); if (!text) throw new Error('Reply cannot be empty.');
  return withTransaction(async (client) => {
    const found = await client.query('SELECT * FROM support_tickets WHERE organization_id=$1 AND id=$2 FOR UPDATE', [organizationId, ticketId]); if (!found.rows[0]) return null;
    await client.query(`INSERT INTO support_messages (id,ticket_id,author_type,author_id,author_name,author_email,body,is_internal) VALUES ($1,$2,'agent',$3,$4,$5,$6,$7)`, [crypto.randomUUID(), ticketId, session.sub, session.name || session.email, session.email, text, Boolean(isInternal)]);
    await client.query(`UPDATE support_tickets SET status=CASE WHEN status='new' THEN 'open' ELSE status END, first_responded_at=CASE WHEN $3=false AND first_responded_at IS NULL THEN NOW() ELSE first_responded_at END, updated_at=NOW() WHERE organization_id=$1 AND id=$2`, [organizationId, ticketId, Boolean(isInternal)]);
    return true;
  });
};
const updateTicket = async ({ organizationId, ticketId, patch }) => {
  const current = await getTicket(organizationId, ticketId); if (!current) return null;
  const status = patch.status ? normalizeStatus(patch.status, current.status) : current.status;
  const priority = patch.priority ? normalizePriority(patch.priority) : current.priority;
  const assigneeId = patch.assigneeId === undefined ? current.assigneeId : String(patch.assigneeId || '').trim();
  const assigneeName = patch.assigneeName === undefined ? current.assigneeName : String(patch.assigneeName || '').trim().slice(0,160);
  const assigneeEmail = patch.assigneeEmail === undefined ? current.assigneeEmail : String(patch.assigneeEmail || '').trim().toLowerCase().slice(0,320);
  const targets = priority !== current.priority ? calculateSlaTargets(new Date(current.createdAt), priority) : { firstResponseDueAt: current.firstResponseDueAt, resolutionDueAt: current.resolutionDueAt };
  const resolvedAt = ['resolved','closed'].includes(status) ? (current.resolvedAt || new Date()) : null;
  await query(`UPDATE support_tickets SET status=$3, priority=$4, assignee_id=$5, assignee_name=$6, assignee_email=$7, first_response_due_at=$8, resolution_due_at=$9, resolved_at=$10, updated_at=NOW() WHERE organization_id=$1 AND id=$2`, [organizationId, ticketId, status, priority, assigneeId || null, assigneeName || null, assigneeEmail || null, targets.firstResponseDueAt, targets.resolutionDueAt, resolvedAt]);
  return getTicket(organizationId, ticketId);
};
const getPortalTicket = async (token) => {
  const result = await query(`SELECT t.* FROM support_portal_tokens p JOIN support_tickets t ON t.id=p.ticket_id WHERE p.token_hash=$1 AND p.expires_at>NOW() LIMIT 1`, [hashPortalToken(token)]);
  const ticket = mapTicket(result.rows[0]); if (!ticket) return null;
  const messages = await query(`SELECT * FROM support_messages WHERE ticket_id=$1 AND is_internal=false ORDER BY created_at ASC`, [ticket.id]);
  return { ...ticket, messages: messages.rows.map(mapMessage) };
};
const addCustomerMessage = async ({ token, body }) => {
  const text = String(body || '').trim().slice(0,20_000); if (!text) throw new Error('Reply cannot be empty.'); const tokenHash = hashPortalToken(token);
  return withTransaction(async (client) => {
    const found = await client.query(`SELECT t.* FROM support_portal_tokens p JOIN support_tickets t ON t.id=p.ticket_id WHERE p.token_hash=$1 AND p.expires_at>NOW() FOR UPDATE`, [tokenHash]);
    const row = found.rows[0]; if (!row) return null;
    await client.query(`INSERT INTO support_messages (id,ticket_id,author_type,author_name,author_email,body,is_internal) VALUES ($1,$2,'customer',$3,$4,$5,false)`, [crypto.randomUUID(), row.id, row.requester_name, row.requester_email, text]);
    await client.query(`UPDATE support_tickets SET status=$2, resolved_at=NULL, updated_at=NOW() WHERE id=$1`, [row.id, applyCustomerReplyState(row.status)]);
    return row.id;
  });
};
module.exports = { addAgentMessage, addCustomerMessage, createTicket, getPortalTicket, getTicket, listTickets, resolveOrganizationBySlug, ticketKey, updateTicket, upsertOrganization };
