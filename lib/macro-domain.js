const STATUSES = new Set(['new','open','pending','resolved','closed']);
const PRIORITIES = new Set(['low','normal','high','urgent']);
const ALLOWED_ACTIONS = new Set(['status','priority','teamId','assigneeMemberId']);
const ALLOWED_VARIABLES = new Set([
  'requester.name','requester.email','ticket.key','ticket.subject','agent.name','agent.email',
]);

const normalizeShortcut = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const withoutSlash = raw.replace(/^\/+/, '');
  const slug = withoutSlash.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64);
  return slug ? `/${slug}` : '';
};
const templateVariables = (body) => [...String(body || '').matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)].map((match) => match[1]);
const validateTemplateVariables = (body) => {
  for (const variable of templateVariables(body)) if (!ALLOWED_VARIABLES.has(variable)) throw new Error(`Unsupported macro variable: ${variable}`);
  return true;
};
const readPath = (context, path) => path.split('.').reduce((value, key) => value == null ? '' : value[key], context);
const renderMacroBody = (body, context = {}) => {
  validateTemplateVariables(body);
  return String(body || '').replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, variable) => String(readPath(context, variable) ?? ''));
};
const normalizeMacroActions = (actions = {}) => {
  if (!actions || typeof actions !== 'object' || Array.isArray(actions)) throw new Error('Macro actions must be an object');
  for (const key of Object.keys(actions)) if (!ALLOWED_ACTIONS.has(key)) throw new Error(`Unsupported macro action: ${key}`);
  const normalized = {};
  if (actions.status != null && String(actions.status).trim()) {
    const status = String(actions.status).trim().toLowerCase();
    if (!STATUSES.has(status)) throw new Error(`Unsupported macro status: ${actions.status}`);
    normalized.status = status;
  }
  if (actions.priority != null && String(actions.priority).trim()) {
    const priority = String(actions.priority).trim().toLowerCase();
    if (!PRIORITIES.has(priority)) throw new Error(`Unsupported macro priority: ${actions.priority}`);
    normalized.priority = priority;
  }
  if (actions.teamId != null && String(actions.teamId).trim()) normalized.teamId = String(actions.teamId).trim();
  if (actions.assigneeMemberId != null && String(actions.assigneeMemberId).trim()) normalized.assigneeMemberId = String(actions.assigneeMemberId).trim();
  if (normalized.assigneeMemberId && !normalized.teamId) throw new Error('teamId is required when macro sets assigneeMemberId');
  return normalized;
};
const normalizeMacroInput = (input = {}) => {
  const name = String(input.name || '').trim().slice(0, 160);
  if (!name) throw new Error('Macro name is required');
  const body = String(input.body || '').trim().slice(0, 20000);
  if (!body) throw new Error('Macro body is required');
  validateTemplateVariables(body);
  return { name, shortcut: normalizeShortcut(input.shortcut), body, actions: normalizeMacroActions(input.actions || {}), active: input.active !== false };
};
module.exports = { ALLOWED_VARIABLES, normalizeMacroActions, normalizeMacroInput, normalizeShortcut, renderMacroBody, templateVariables, validateTemplateVariables };
