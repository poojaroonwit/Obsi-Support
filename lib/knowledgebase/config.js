const normalizeKnowledgebaseUrl = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';
  let url;
  try { url = new URL(input); } catch { throw new Error('Knowledgebase URL must be a valid http/https URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Knowledgebase URL must use http or https');
  if (url.username || url.password) throw new Error('Knowledgebase URL must not contain credentials');
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/$/, '');
};

const knowledgebaseEnabled = (env = process.env) => {
  const enabled = String(env.OBSI_KNOWLEDGEBASE_ENABLED || '').trim().toLowerCase() === 'true';
  return enabled && Boolean(normalizeKnowledgebaseUrl(env.OBSI_KNOWLEDGEBASE_URL));
};

module.exports = { knowledgebaseEnabled, normalizeKnowledgebaseUrl };
