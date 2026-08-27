const crypto = require('crypto');
const { query, withTransaction } = require('./db');
const { calculateSlaTargets, evaluateSla, normalizePriority } = require('./sla');
const { applyCustomerReplyState, normalizeStatus, normalizeTicketInput } = require('./ticket-domain');
const { createPortalToken, hashPortalToken } = require('./portal-token');
const { parseMailbox } = require('./email-domain');

const ticketKey = (number) => `SUP-${String(number).padStart(6, '0')}`;
const ticketNumberFromKey = (key) => {
  const match = String(key || '').toUpperCase().match(/^SUP-(\d+)$/);
  return match ? Number(match[1]) : null;
};
const mapTicket = (row) => row && ({
  id: row.id, key: ticketKey(row.ticket_number), organizationId: row.organization_id, organizationSlug: row.organization_slug,
  subject: row.subject, description: row.description || '', status: row.status, priority: row.priority, channel: row.channel,
  requesterName: row.requester_name, requesterEmail: row.requester_email,
  assigneeId: row.assignee_id || '', assigneeName: row.assignee_name || '', assigneeEmail: row.assignee_email || '',
  firstResponseDueAt: row.first_response_due_at, resolutionDueAt: row.resolution_due_at, firstRespondedAt: row.first_responded_at,
  resolvedAt: row.resolved_at, createdAt: row.created_at, updatedAt: row.updated_at,
  sla: evaluateSla({ firstResponseDueAt: row.first_response_due_at, resolutionDueAt: row.resolution_due_at, firstRespondedAt: row.first_responded_at, resolvedAt: row.resolved_at }),
});
const mapMessage = (row) => ({
  id: row.id, authorType: row.author_type, authorName: row.author_name, authorEmail: row.author_email, body: row.body,
  isInternal: row.is_internal, channel: row.channel || 'portal', providerEmailId: row.provider_email_id || '', externalMessageId: row.external_message_id || '',
  deliveryStatus: row.delivery_status || '', deliveryError: row.delivery_error || '', attachments: Array.isArray(row.attachments) ? row.attachments : [], createdAt: row.created_at,
});

const upsertOrganization = async ({ id, slug, name, supportEmailAddress }) => {
  if (!id) return;
  const normalizedSlug = String(slug || id).trim().toLowerCase();
  const domain = String(process.env.SUPPORT_EMAIL_DOMAIN || '').trim().toLowerCase();
  const email = String(supportEmailAddress || (domain ? `${normalizedSlug}@${domain}` : '')).trim().toLowerCase() || null;
  await query(`INSERT INTO support_organizations (organization_id, slug, name, support_email_address) VALUES ($1,$2,$3,$4)
    ON CONFLICT (organization_id) DO UPDATE SET slug=EXCLUDED.slug, name=EXCLUDED.name,
      support_email_address=COALESCE(EXCLUDED.support_email_address,support_organizations.support_email_address), updated_at=NOW()`, [id, normalizedSlug, name || slug || id, email]);
};
const resolveOrganizationBySlug = async (slug) => {
  const result = await query('SELECT organization_id, slug, name, support_email_address FROM support_organizations WHERE slug=$1 LIMIT 1', [String(slug || '').trim().toLowerCase()]);
  return result.rows[0] || null;
};
const resolveOrganizationForInbound = async (addresses = [], supportDomain = '') => {
  const normalized = addresses.map((value) => parseMailbox(value).email).filter(Boolean);
  if (!normalized.length) return null;
  const domain = String(supportDomain || '').trim().toLowerCase();
  const slugs = normalized
    .map((address) => address.split('@'))
    .filter(([local, addressDomain]) => local && domain && addressDomain === domain)
    .map(([local]) => local.toLowerCase());
  const result = await query(`SELECT organization_id, slug, name, support_email_address FROM support_organizations
    WHERE lower(COALESCE(support_email_address,''))=ANY($1::text[]) OR lower(slug)=ANY($2::text[])
    ORDER BY CASE WHEN lower(COALESCE(support_email_address,''))=ANY($1::text[]) THEN 0 ELSE 1 END LIMIT 1`, [normalized, slugs]);
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
    if (normalized.description) await client.query(`INSERT INTO support_messages (id,ticket_id,author_type,author_name,author_email,body,is_internal,channel) VALUES ($1,$2,'customer',$3,$4,$5,false,$6)`, [crypto.randomUUID(), id, normalized.requesterName, normalized.requesterEmail, normalized.description, normalized.channel]);
    await client.query(`INSERT INTO support_portal_tokens (token_hash,ticket_id,requester_email,expires_at) VALUES ($1,$2,$3,NOW()+($4 || ' hours')::interval)`, [tokenHash, id, normalized.requesterEmail, String(portalTtlHours)]);
  });
  return { ticket: await getTicket(organizationId, id), portalToken };
};
const addAgentMessage = async ({ organizationId, ticketId, session, body, isInternal = false, deliveryChannel = 'portal' }) => {
  const text = String(body || '').trim().slice(0, 20_000); if (!text) throw new Error('Reply cannot be empty.');
  const messageId = crypto.randomUUID();
  const channel = isInternal ? 'manual' : (deliveryChannel === 'email' ? 'email' : 'portal');
  const deliveryStatus = channel === 'email' ? 'pending' : null;
  const inserted = await withTransaction(async (client) => {
    const found = await client.query('SELECT * FROM support_tickets WHERE organization_id=$1 AND id=$2 FOR UPDATE', [organizationId, ticketId]); if (!found.rows[0]) return null;
    await client.query(`INSERT INTO support_messages (id,ticket_id,author_type,author_id,author_name,author_email,body,is_internal,channel,delivery_status)
      VALUES ($1,$2,'agent',$3,$4,$5,$6,$7,$8,$9)`, [messageId, ticketId, session.sub, session.name || session.email, session.email, text, Boolean(isInternal), channel, deliveryStatus]);
    const shouldCountResponse = !isInternal && channel !== 'email';
    await client.query(`UPDATE support_tickets SET status=CASE WHEN status='new' THEN 'open' ELSE status END,
      first_responded_at=CASE WHEN $3=true AND first_responded_at IS NULL THEN NOW() ELSE first_responded_at END, updated_at=NOW()
      WHERE organization_id=$1 AND id=$2`, [organizationId, ticketId, shouldCountResponse]);
    return { messageId };
  });
  return inserted;
};
const updateMessageDelivery = async ({ ticketId, messageId, providerEmailId = '', status, error = '' }) => {
  const success = ['sent', 'delivered'].includes(status);
  const result = await query(`UPDATE support_messages SET provider_email_id=COALESCE(NULLIF($3,''),provider_email_id), delivery_status=$4, delivery_error=NULLIF($5,'')
    WHERE ticket_id=$1 AND id=$2 RETURNING ticket_id`, [ticketId, messageId, providerEmailId, status, String(error || '').slice(0, 2000)]);
  if (success && result.rows[0]) await query('UPDATE support_tickets SET first_responded_at=COALESCE(first_responded_at,NOW()), updated_at=NOW() WHERE id=$1', [ticketId]);
  return Boolean(result.rows[0]);
};
const updateEmailDelivery = async ({ providerEmailId, externalMessageId = '', status, error = '' }) => {
  if (!providerEmailId) return false;
  const result = await query(`UPDATE support_messages SET external_message_id=COALESCE(NULLIF($2,''),external_message_id), delivery_status=$3, delivery_error=NULLIF($4,'')
    WHERE provider_email_id=$1 RETURNING ticket_id`, [providerEmailId, externalMessageId, status, String(error || '').slice(0, 2000)]);
  return Boolean(result.rows[0]);
};
const findInboundTicket = async (client, { organizationId, senderEmail, ticketKey: key, referenceMessageIds = [] }) => {
  if (referenceMessageIds.length) {
    const referenced = await client.query(`SELECT t.* FROM support_messages m JOIN support_tickets t ON t.id=m.ticket_id
      WHERE t.organization_id=$1 AND lower(t.requester_email)=lower($2) AND m.external_message_id=ANY($3::text[])
      ORDER BY m.created_at DESC LIMIT 1`, [organizationId, senderEmail, referenceMessageIds]);
    if (referenced.rows[0]) return referenced.rows[0];
  }
  const number = ticketNumberFromKey(key);
  if (!number) return null;
  const keyed = await client.query(`SELECT * FROM support_tickets WHERE organization_id=$1 AND ticket_number=$2 AND lower(requester_email)=lower($3) LIMIT 1`, [organizationId, number, senderEmail]);
  return keyed.rows[0] || null;
};
const ingestInboundEmail = async ({ organizationId, organizationSlug, email }) => {
  if (!organizationId) throw new Error('Organization context is required.');
  if (!email?.senderEmail) throw new Error('Inbound sender email is required.');
  const result = await withTransaction(async (client) => {
    if (email.providerEmailId || email.messageId) {
      const duplicate = await client.query(`SELECT ticket_id FROM support_messages WHERE
        ($1<>'' AND provider_email_id=$1) OR ($2<>'' AND external_message_id=$2) LIMIT 1`, [email.providerEmailId || '', email.messageId || '']);
      if (duplicate.rows[0]) return { ticketId: duplicate.rows[0].ticket_id, created: false, duplicate: true };
    }
    const existing = await findInboundTicket(client, { organizationId, senderEmail: email.senderEmail, ticketKey: email.ticketKey, referenceMessageIds: email.referenceMessageIds || [] });
    let ticketId = existing?.id; let created = false;
    if (!ticketId) {
      ticketId = crypto.randomUUID(); created = true;
      const createdAt = new Date(); const targets = calculateSlaTargets(createdAt, 'normal');
      await client.query(`INSERT INTO support_tickets
        (id,organization_id,organization_slug,subject,description,status,priority,channel,requester_name,requester_email,first_response_due_at,resolution_due_at,created_at,updated_at)
        VALUES ($1,$2,$3,$4,$5,'new','normal','email',$6,$7,$8,$9,$10,$10)`, [ticketId, organizationId, organizationSlug, email.subject, email.body || '', email.senderName, email.senderEmail, targets.firstResponseDueAt, targets.resolutionDueAt, createdAt]);
    }
    await client.query(`INSERT INTO support_messages
      (id,ticket_id,author_type,author_name,author_email,body,is_internal,channel,provider_email_id,external_message_id,attachments)
      VALUES ($1,$2,'customer',$3,$4,$5,false,'email',$6,$7,$8::jsonb)`, [crypto.randomUUID(), ticketId, email.senderName, email.senderEmail, email.body || '', email.providerEmailId || null, email.messageId || null, JSON.stringify(email.attachments || [])]);
    if (existing) await client.query(`UPDATE support_tickets SET status=$2,resolved_at=NULL,updated_at=NOW() WHERE id=$1`, [ticketId, applyCustomerReplyState(existing.status)]);
    return { ticketId, created, duplicate: false };
  });
  return { ...result, ticket: await getTicket(organizationId, result.ticketId) };
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
    await client.query(`INSERT INTO support_messages (id,ticket_id,author_type,author_name,author_email,body,is_internal,channel) VALUES ($1,$2,'customer',$3,$4,$5,false,'portal')`, [crypto.randomUUID(), row.id, row.requester_name, row.requester_email, text]);
    await client.query(`UPDATE support_tickets SET status=$2, resolved_at=NULL, updated_at=NOW() WHERE id=$1`, [row.id, applyCustomerReplyState(row.status)]);
    return row.id;
  });
};
module.exports = {
  addAgentMessage, addCustomerMessage, createTicket, getPortalTicket, getTicket, ingestInboundEmail, listTickets,
  resolveOrganizationBySlug, resolveOrganizationForInbound, ticketKey, ticketNumberFromKey, updateEmailDelivery, updateMessageDelivery, updateTicket, upsertOrganization,
};
