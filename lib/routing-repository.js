const crypto = require('crypto');
const { query, withTransaction } = require('./db');
const { chooseLeastLoadMember, normalizeCapacity, normalizeRoutingConditions, selectRoutingRule } = require('./routing-domain');

const normalizeTeamKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const normalizeName = (value, label = 'Name') => {
  const result = String(value || '').trim().slice(0, 160);
  if (!result) throw new Error(`${label} is required`);
  return result;
};
const normalizeEmail = (value) => {
  const email = String(value || '').trim().toLowerCase().slice(0, 320);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('A valid member email is required');
  return email;
};
const mapMember = (row) => ({
  id: row.id,
  teamId: row.team_id,
  userId: row.user_id || '',
  assignmentId: row.user_id || row.id,
  name: row.name,
  email: row.email,
  capacity: Number(row.capacity || 0),
  active: row.active !== false,
  load: Number(row.load || 0),
});
const mapTeam = (row) => ({
  id: row.id,
  key: row.team_key,
  name: row.name,
  active: row.active !== false,
  defaultCapacity: Number(row.default_capacity || 0),
});
const mapRule = (row) => ({
  id: row.id,
  name: row.name,
  sortOrder: Number(row.sort_order || 0),
  enabled: row.enabled !== false,
  conditions: row.conditions || {},
  teamId: row.team_id,
  teamName: row.team_name || '',
  strategy: row.strategy || 'least_load',
});

const listTeams = async (organizationId) => {
  const teams = await query('SELECT * FROM support_teams WHERE organization_id=$1 ORDER BY active DESC, name ASC', [organizationId]);
  return teams.rows.map(mapTeam);
};

const createTeam = async ({ organizationId, name, key, defaultCapacity = 10 }) => {
  const id = crypto.randomUUID();
  const normalizedName = normalizeName(name, 'Team name');
  const normalizedKey = normalizeTeamKey(key || normalizedName);
  if (!normalizedKey) throw new Error('Team key is required');
  const capacity = normalizeCapacity(defaultCapacity, 10);
  await query(`INSERT INTO support_teams (id,organization_id,team_key,name,default_capacity) VALUES ($1,$2,$3,$4,$5)`, [id, organizationId, normalizedKey, normalizedName, capacity]);
  return (await query('SELECT * FROM support_teams WHERE organization_id=$1 AND id=$2', [organizationId, id])).rows[0] ? mapTeam((await query('SELECT * FROM support_teams WHERE organization_id=$1 AND id=$2', [organizationId, id])).rows[0]) : null;
};

const updateTeam = async ({ organizationId, teamId, patch = {} }) => {
  const currentResult = await query('SELECT * FROM support_teams WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, teamId]);
  const current = currentResult.rows[0];
  if (!current) return null;
  const name = patch.name === undefined ? current.name : normalizeName(patch.name, 'Team name');
  const active = patch.active === undefined ? current.active : Boolean(patch.active);
  const capacity = patch.defaultCapacity === undefined ? current.default_capacity : normalizeCapacity(patch.defaultCapacity, current.default_capacity);
  await query('UPDATE support_teams SET name=$3,active=$4,default_capacity=$5,updated_at=NOW() WHERE organization_id=$1 AND id=$2', [organizationId, teamId, name, active, capacity]);
  const updated = await query('SELECT * FROM support_teams WHERE organization_id=$1 AND id=$2', [organizationId, teamId]);
  return mapTeam(updated.rows[0]);
};

const addTeamMember = async ({ organizationId, teamId, name, email, userId = '', capacity }) => {
  const teamResult = await query('SELECT * FROM support_teams WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, teamId]);
  const team = teamResult.rows[0];
  if (!team) return null;
  const id = crypto.randomUUID();
  const normalizedName = normalizeName(name, 'Member name');
  const normalizedEmail = normalizeEmail(email);
  const memberCapacity = capacity === undefined ? Number(team.default_capacity || 10) : normalizeCapacity(capacity, team.default_capacity);
  await query(`INSERT INTO support_team_members (id,organization_id,team_id,user_id,name,email,capacity) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, organizationId, teamId, String(userId || '').trim() || null, normalizedName, normalizedEmail, memberCapacity]);
  const created = await query('SELECT *,0::bigint AS load FROM support_team_members WHERE organization_id=$1 AND id=$2', [organizationId, id]);
  return mapMember(created.rows[0]);
};

const updateTeamMember = async ({ organizationId, memberId, patch = {} }) => {
  const currentResult = await query('SELECT * FROM support_team_members WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, memberId]);
  const current = currentResult.rows[0];
  if (!current) return null;
  const name = patch.name === undefined ? current.name : normalizeName(patch.name, 'Member name');
  const email = patch.email === undefined ? current.email : normalizeEmail(patch.email);
  const capacity = patch.capacity === undefined ? current.capacity : normalizeCapacity(patch.capacity, current.capacity);
  const active = patch.active === undefined ? current.active : Boolean(patch.active);
  const userId = patch.userId === undefined ? current.user_id : String(patch.userId || '').trim() || null;
  await query(`UPDATE support_team_members SET name=$3,email=$4,capacity=$5,active=$6,user_id=$7,updated_at=NOW() WHERE organization_id=$1 AND id=$2`, [organizationId, memberId, name, email, capacity, active, userId]);
  const updated = await query('SELECT *,0::bigint AS load FROM support_team_members WHERE organization_id=$1 AND id=$2', [organizationId, memberId]);
  return mapMember(updated.rows[0]);
};

const listRoutingRules = async (organizationId) => {
  const result = await query(`SELECT r.*,t.name AS team_name FROM support_routing_rules r JOIN support_teams t ON t.id=r.team_id
    WHERE r.organization_id=$1 ORDER BY r.sort_order ASC,r.created_at ASC`, [organizationId]);
  return result.rows.map(mapRule);
};

const createRoutingRule = async ({ organizationId, name, sortOrder = 100, enabled = true, conditions = {}, teamId }) => {
  const team = await query('SELECT id FROM support_teams WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, teamId]);
  if (!team.rows[0]) throw new Error('Routing team not found');
  const normalized = normalizeRoutingConditions(conditions);
  const id = crypto.randomUUID();
  await query(`INSERT INTO support_routing_rules (id,organization_id,name,sort_order,enabled,conditions,team_id,strategy)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'least_load')`, [id, organizationId, normalizeName(name, 'Rule name'), Math.trunc(Number(sortOrder) || 0), Boolean(enabled), JSON.stringify(normalized), teamId]);
  return (await listRoutingRules(organizationId)).find((rule) => rule.id === id) || null;
};

const updateRoutingRule = async ({ organizationId, ruleId, patch = {} }) => {
  const currentResult = await query('SELECT * FROM support_routing_rules WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, ruleId]);
  const current = currentResult.rows[0];
  if (!current) return null;
  const teamId = patch.teamId === undefined ? current.team_id : String(patch.teamId || '').trim();
  const team = await query('SELECT id FROM support_teams WHERE organization_id=$1 AND id=$2 LIMIT 1', [organizationId, teamId]);
  if (!team.rows[0]) throw new Error('Routing team not found');
  const name = patch.name === undefined ? current.name : normalizeName(patch.name, 'Rule name');
  const sortOrder = patch.sortOrder === undefined ? current.sort_order : Math.trunc(Number(patch.sortOrder) || 0);
  const enabled = patch.enabled === undefined ? current.enabled : Boolean(patch.enabled);
  const conditions = patch.conditions === undefined ? current.conditions : normalizeRoutingConditions(patch.conditions);
  await query(`UPDATE support_routing_rules SET name=$3,sort_order=$4,enabled=$5,conditions=$6::jsonb,team_id=$7,updated_at=NOW()
    WHERE organization_id=$1 AND id=$2`, [organizationId, ruleId, name, sortOrder, enabled, JSON.stringify(conditions), teamId]);
  return (await listRoutingRules(organizationId)).find((rule) => rule.id === ruleId) || null;
};

const memberRowsWithLoad = async (client, organizationId, teamId) => {
  const result = await client.query(`SELECT m.*,
    COUNT(t.id) FILTER (WHERE t.status IN ('new','open','pending'))::bigint AS load
    FROM support_team_members m
    LEFT JOIN support_tickets t ON t.organization_id=m.organization_id AND t.assignee_id=COALESCE(NULLIF(m.user_id,''),m.id::text)
      AND t.status IN ('new','open','pending')
    WHERE m.organization_id=$1 AND m.team_id=$2
    GROUP BY m.id ORDER BY m.name ASC`, [organizationId, teamId]);
  return result.rows.map(mapMember);
};

const writeAssignment = async (client, { organizationId, ticket, team, member, assignmentType, actor }) => {
  const assigneeId = member ? (member.userId || member.id) : null;
  await client.query(`UPDATE support_tickets SET team_id=$3,team_name=$4,assignee_id=$5,assignee_name=$6,assignee_email=$7,updated_at=NOW()
    WHERE organization_id=$1 AND id=$2`, [organizationId, ticket.id, team?.id || null, team?.name || null, assigneeId, member?.name || null, member?.email || null]);
  await client.query(`INSERT INTO support_assignment_events (id,organization_id,ticket_id,team_id,member_id,assignment_type,actor_id,actor_name)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, [crypto.randomUUID(), organizationId, ticket.id, team?.id || null, member?.id || null, assignmentType, actor?.id || null, actor?.name || null]);
  const description = team
    ? `${assignmentType === 'automatic' ? 'Automatically routed' : 'Assigned'} to ${team.name}${member ? ` · ${member.name}` : ' · Unassigned'}`
    : 'Assignment cleared';
  await client.query(`INSERT INTO support_messages (id,ticket_id,author_type,author_name,body,is_internal,channel)
    VALUES ($1,$2,'system','Obsi Support',$3,true,'manual')`, [crypto.randomUUID(), ticket.id, description]);
};

const routeTicket = async ({ organizationId, ticketId }) => withTransaction(async (client) => {
  const ticketResult = await client.query('SELECT * FROM support_tickets WHERE organization_id=$1 AND id=$2 FOR UPDATE', [organizationId, ticketId]);
  const ticket = ticketResult.rows[0];
  if (!ticket || ticket.team_id || ticket.assignee_id) return null;
  const rulesResult = await client.query(`SELECT r.*,t.name AS team_name,t.active AS team_active FROM support_routing_rules r JOIN support_teams t ON t.id=r.team_id
    WHERE r.organization_id=$1 AND r.enabled=true ORDER BY r.sort_order ASC,r.created_at ASC`, [organizationId]);
  const rules = rulesResult.rows.map(mapRule);
  const rule = selectRoutingRule({ channel: ticket.channel, priority: ticket.priority }, rules);
  if (!rule) return null;
  const teamRow = rulesResult.rows.find((row) => row.id === rule.id);
  if (!teamRow?.team_active) return null;
  const team = { id: rule.teamId, name: rule.teamName };
  const members = await memberRowsWithLoad(client, organizationId, team.id);
  const member = chooseLeastLoadMember(members);
  await writeAssignment(client, { organizationId, ticket, team, member, assignmentType: 'automatic', actor: { id: 'routing-engine', name: 'Routing engine' } });
  return { team, member, rule };
});

const manualAssignTicket = async ({ organizationId, ticketId, teamId = '', assigneeMemberId = '', actor = {} }) => withTransaction(async (client) => {
  const ticketResult = await client.query('SELECT * FROM support_tickets WHERE organization_id=$1 AND id=$2 FOR UPDATE', [organizationId, ticketId]);
  const ticket = ticketResult.rows[0];
  if (!ticket) return null;
  if (!teamId) {
    await writeAssignment(client, { organizationId, ticket, team: null, member: null, assignmentType: 'manual', actor });
    return { team: null, member: null };
  }
  const teamResult = await client.query('SELECT * FROM support_teams WHERE organization_id=$1 AND id=$2 AND active=true LIMIT 1', [organizationId, teamId]);
  const teamRow = teamResult.rows[0];
  if (!teamRow) throw new Error('Active support team not found');
  const team = mapTeam(teamRow);
  let member = null;
  if (assigneeMemberId) {
    const memberResult = await client.query(`SELECT *,0::bigint AS load FROM support_team_members WHERE organization_id=$1 AND team_id=$2 AND id=$3 AND active=true LIMIT 1`, [organizationId, teamId, assigneeMemberId]);
    if (!memberResult.rows[0]) throw new Error('Active assignee is not a member of this team');
    member = mapMember(memberResult.rows[0]);
  }
  await writeAssignment(client, { organizationId, ticket, team, member, assignmentType: 'manual', actor });
  return { team, member };
});

const getRoutingSnapshot = async (organizationId) => {
  const teams = await listTeams(organizationId);
  const memberResult = await query(`SELECT m.*,
    COUNT(t.id) FILTER (WHERE t.status IN ('new','open','pending'))::bigint AS load
    FROM support_team_members m
    LEFT JOIN support_tickets t ON t.organization_id=m.organization_id AND t.assignee_id=COALESCE(NULLIF(m.user_id,''),m.id::text)
      AND t.status IN ('new','open','pending')
    WHERE m.organization_id=$1 GROUP BY m.id ORDER BY m.name ASC`, [organizationId]);
  const members = memberResult.rows.map(mapMember);
  const rules = await listRoutingRules(organizationId);
  return { teams: teams.map((team) => ({ ...team, members: members.filter((member) => member.teamId === team.id) })), rules };
};

module.exports = {
  addTeamMember,
  createRoutingRule,
  createTeam,
  getRoutingSnapshot,
  listRoutingRules,
  listTeams,
  manualAssignTicket,
  routeTicket,
  updateRoutingRule,
  updateTeam,
  updateTeamMember,
};
