const crypto = require('crypto');
const { query } = require('./db');
const { normalizeMacroInput, renderMacroBody } = require('./macro-domain');

const mapMacro = (row) => row && ({
  id: row.id,
  organizationId: row.organization_id,
  name: row.name,
  shortcut: row.shortcut || '',
  body: row.body,
  actions: row.actions || {},
  active: row.active !== false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const listMacros = async (organizationId, { activeOnly = false, search = '' } = {}) => {
  const params = [organizationId];
  const where = ['organization_id=$1'];
  if (activeOnly) where.push('active=true');
  if (search) { params.push(`%${String(search).trim()}%`); where.push(`(name ILIKE $${params.length} OR COALESCE(shortcut,'') ILIKE $${params.length})`); }
  const result = await query(`SELECT * FROM support_macros WHERE ${where.join(' AND ')} ORDER BY active DESC,name ASC`, params);
  return result.rows.map(mapMacro);
};

const getMacro = async (organizationId, macroId) => {
  const result = await query('SELECT * FROM support_macros WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, macroId]);
  return mapMacro(result.rows[0]);
};

const createMacro = async ({ organizationId, input }) => {
  const normalized = normalizeMacroInput(input);
  const id = crypto.randomUUID();
  const result = await query(`INSERT INTO support_macros (id,organization_id,name,shortcut,body,actions,active)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7) RETURNING *`, [id, organizationId, normalized.name, normalized.shortcut || null, normalized.body, JSON.stringify(normalized.actions), normalized.active]);
  return mapMacro(result.rows[0]);
};

const updateMacro = async ({ organizationId, macroId, patch = {} }) => {
  const current = await getMacro(organizationId, macroId);
  if (!current) return null;
  const normalized = normalizeMacroInput({
    name: patch.name === undefined ? current.name : patch.name,
    shortcut: patch.shortcut === undefined ? current.shortcut : patch.shortcut,
    body: patch.body === undefined ? current.body : patch.body,
    actions: patch.actions === undefined ? current.actions : patch.actions,
    active: patch.active === undefined ? current.active : patch.active,
  });
  const result = await query(`UPDATE support_macros SET name=$3,shortcut=$4,body=$5,actions=$6::jsonb,active=$7,updated_at=NOW()
    WHERE organization_id=$1 AND id=$2 RETURNING *`, [organizationId, macroId, normalized.name, normalized.shortcut || null, normalized.body, JSON.stringify(normalized.actions), normalized.active]);
  return mapMacro(result.rows[0]);
};

const deleteMacro = async ({ organizationId, macroId }) => {
  const result = await query('DELETE FROM support_macros WHERE organization_id=$1 AND id=$2 RETURNING id', [organizationId, macroId]);
  return Boolean(result.rows[0]);
};

const validatePreparedActions = async (organizationId, actions = {}) => {
  if (!actions.teamId) return { ...actions, actionLabels: [] };
  const teamResult = await query('SELECT id,name,active FROM support_teams WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, actions.teamId]);
  const team = teamResult.rows[0];
  if (!team || !team.active) throw new Error('Macro support team is no longer active');
  let member = null;
  if (actions.assigneeMemberId) {
    const memberResult = await query('SELECT id,name,email,active FROM support_team_members WHERE organization_id=$1 AND team_id=$2 AND id=$3 LIMIT 1', [organizationId, actions.teamId, actions.assigneeMemberId]);
    member = memberResult.rows[0];
    if (!member || !member.active) throw new Error('Macro assignee is no longer an active member of this team');
  }
  const actionLabels = [`Team: ${team.name}`];
  if (member) actionLabels.push(`Assignee: ${member.name}`);
  return { ...actions, actionLabels };
};

const prepareMacro = async ({ organizationId, ticketId, macroId, session }) => {
  const [macro, ticketResult] = await Promise.all([
    getMacro(organizationId, macroId),
    query('SELECT id,ticket_number,subject,requester_name,requester_email FROM support_tickets WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, ticketId]),
  ]);
  if (!macro || !macro.active) return null;
  const ticket = ticketResult.rows[0];
  if (!ticket) return null;
  const actions = await validatePreparedActions(organizationId, macro.actions || {});
  const body = renderMacroBody(macro.body, {
    requester: { name: ticket.requester_name || '', email: ticket.requester_email || '' },
    ticket: { key: `SUP-${String(ticket.ticket_number).padStart(6,'0')}`, subject: ticket.subject || '' },
    agent: { name: session?.name || session?.email || '', email: session?.email || '' },
  });
  return { macro, body, actions };
};

module.exports = { createMacro, deleteMacro, getMacro, listMacros, prepareMacro, updateMacro, validatePreparedActions };
