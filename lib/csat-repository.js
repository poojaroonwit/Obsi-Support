const crypto = require('node:crypto');
const { query, withTransaction } = require('./db');
const { createCsatToken, hashCsatToken, isCsatEligibleStatus, normalizeCsatSubmission } = require('./csat-domain');
const { hashPortalToken } = require('./portal-token');

const mapSurvey = (row) => row && ({
  id: row.id,
  ticketId: row.ticket_id,
  rating: row.rating == null ? null : Number(row.rating),
  comment: row.comment || '',
  submittedAt: row.submitted_at || null,
  invitationSentAt: row.invitation_sent_at || null,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
});

const ensureCsatSurvey = async ({ organizationId, ticketId, ttlHours = 24 * 30 }) => withTransaction(async (client) => {
  const ticketResult = await client.query('SELECT id,status FROM support_tickets WHERE organization_id=$1 AND id=$2 FOR UPDATE', [organizationId, ticketId]);
  const ticket = ticketResult.rows[0];
  if (!ticket || !isCsatEligibleStatus(ticket.status)) return null;
  const existingResult = await client.query('SELECT * FROM support_csat_surveys WHERE organization_id=$1 AND ticket_id=$2 FOR UPDATE', [organizationId, ticketId]);
  const existing = existingResult.rows[0];
  if (existing?.submitted_at || existing?.invitation_sent_at) return { survey: mapSurvey(existing), token: null, created: false };
  const token = createCsatToken();
  const tokenHash = hashCsatToken(token);
  if (existing) {
    const updated = await client.query(`UPDATE support_csat_surveys SET token_hash=$3,expires_at=NOW()+($4 || ' hours')::interval,updated_at=NOW()
      WHERE organization_id=$1 AND ticket_id=$2 RETURNING *`, [organizationId, ticketId, tokenHash, String(ttlHours)]);
    return { survey: mapSurvey(updated.rows[0]), token, created: false };
  }
  const id = crypto.randomUUID();
  const created = await client.query(`INSERT INTO support_csat_surveys (id,organization_id,ticket_id,token_hash,expires_at)
    VALUES ($1,$2,$3,$4,NOW()+($5 || ' hours')::interval) RETURNING *`, [id, organizationId, ticketId, tokenHash, String(ttlHours)]);
  return { survey: mapSurvey(created.rows[0]), token, created: true };
});

const markCsatInvitationSent = async ({ organizationId, surveyId, providerEmailId = '' }) => {
  const result = await query(`UPDATE support_csat_surveys SET invitation_sent_at=NOW(),provider_email_id=NULLIF($3,''),updated_at=NOW()
    WHERE organization_id=$1 AND id=$2 RETURNING *`, [organizationId, surveyId, providerEmailId]);
  return mapSurvey(result.rows[0]);
};

const getCsatByToken = async (token) => {
  const result = await query(`SELECT s.*,t.ticket_number,t.subject,t.status,o.name AS organization_name
    FROM support_csat_surveys s JOIN support_tickets t ON t.id=s.ticket_id JOIN support_organizations o ON o.organization_id=s.organization_id
    WHERE s.token_hash=$1 AND s.expires_at>NOW() LIMIT 1`, [hashCsatToken(token)]);
  const row = result.rows[0];
  if (!row || !isCsatEligibleStatus(row.status)) return null;
  return { ...mapSurvey(row), key: `SUP-${String(row.ticket_number).padStart(6,'0')}`, subject: row.subject, organizationName: row.organization_name };
};

const submitBySurveyRow = async (client, row, input) => {
  if (!row || !isCsatEligibleStatus(row.status)) return null;
  if (row.submitted_at) return { ...mapSurvey(row), alreadySubmitted: true };
  const normalized = normalizeCsatSubmission(input);
  const result = await client.query(`UPDATE support_csat_surveys SET rating=$2,comment=NULLIF($3,''),submitted_at=NOW(),updated_at=NOW()
    WHERE id=$1 AND submitted_at IS NULL RETURNING *`, [row.id, normalized.rating, normalized.comment]);
  return { ...mapSurvey(result.rows[0] || row), alreadySubmitted: false };
};

const submitCsatByToken = async ({ token, input }) => withTransaction(async (client) => {
  const result = await client.query(`SELECT s.*,t.status FROM support_csat_surveys s JOIN support_tickets t ON t.id=s.ticket_id
    WHERE s.token_hash=$1 AND s.expires_at>NOW() FOR UPDATE`, [hashCsatToken(token)]);
  return submitBySurveyRow(client, result.rows[0], input);
});

const portalTicket = async (portalToken) => {
  const result = await query(`SELECT t.id,t.organization_id,t.status FROM support_portal_tokens p JOIN support_tickets t ON t.id=p.ticket_id
    WHERE p.token_hash=$1 AND p.expires_at>NOW() LIMIT 1`, [hashPortalToken(portalToken)]);
  return result.rows[0] || null;
};

const getCsatForPortalToken = async (portalToken) => {
  const ticket = await portalTicket(portalToken);
  if (!ticket || !isCsatEligibleStatus(ticket.status)) return { eligible: false, submitted: false };
  await ensureCsatSurvey({ organizationId: ticket.organization_id, ticketId: ticket.id });
  const result = await query('SELECT * FROM support_csat_surveys WHERE organization_id=$1 AND ticket_id=$2 LIMIT 1', [ticket.organization_id, ticket.id]);
  const survey = mapSurvey(result.rows[0]);
  return { eligible: true, submitted: Boolean(survey?.submittedAt), rating: survey?.rating ?? null, comment: survey?.comment || '' };
};

const submitCsatByPortalToken = async ({ portalToken, input }) => {
  const ticket = await portalTicket(portalToken);
  if (!ticket || !isCsatEligibleStatus(ticket.status)) return null;
  await ensureCsatSurvey({ organizationId: ticket.organization_id, ticketId: ticket.id });
  return withTransaction(async (client) => {
    const result = await client.query(`SELECT s.*,t.status FROM support_csat_surveys s JOIN support_tickets t ON t.id=s.ticket_id
      WHERE s.organization_id=$1 AND s.ticket_id=$2 FOR UPDATE`, [ticket.organization_id, ticket.id]);
    return submitBySurveyRow(client, result.rows[0], input);
  });
};

module.exports = { ensureCsatSurvey, getCsatByToken, getCsatForPortalToken, markCsatInvitationSent, submitCsatByPortalToken, submitCsatByToken };
