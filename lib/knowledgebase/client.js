const { knowledgebaseEnabled, normalizeKnowledgebaseUrl } = require('./config');

const timeoutAfter = (ms) => new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('Knowledgebase request timed out'), { code: 'KNOWLEDGE_TIMEOUT' })), ms));
const errorCode = (error) => String(error?.code || (error?.name === 'AbortError' ? 'KNOWLEDGE_TIMEOUT' : 'KNOWLEDGE_UNAVAILABLE'));

const safeKnowledgeCall = async (fn, timeoutMs = 1800) => {
  try {
    const value = await Promise.race([Promise.resolve().then(fn), timeoutAfter(timeoutMs)]);
    return { available: true, value, errorCode: '' };
  } catch (error) {
    return { available: false, value: null, errorCode: errorCode(error) };
  }
};

const requestJson = async (path, { env = process.env, fetchImpl = globalThis.fetch, timeoutMs = 1800 } = {}) => {
  if (!knowledgebaseEnabled(env)) return { available: false, value: null, errorCode: 'KNOWLEDGE_DISABLED' };
  const baseUrl = normalizeKnowledgebaseUrl(env.OBSI_KNOWLEDGEBASE_URL);
  return safeKnowledgeCall(async () => {
    if (typeof fetchImpl !== 'function') throw Object.assign(new Error('fetch unavailable'), { code: 'FETCH_UNAVAILABLE' });
    const response = await fetchImpl(`${baseUrl}${path}`, { headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(payload?.message || `Knowledgebase request failed (${response.status})`), { code: payload?.code || `HTTP_${response.status}` });
    return payload;
  }, timeoutMs);
};

const publicKnowledgeSearch = async ({ organizationSlug, query, env, fetchImpl, timeoutMs } = {}) => {
  const slug = String(organizationSlug || '').trim();
  const q = String(query || '').trim();
  if (!slug || !q) return { available: true, items: [] };
  const result = await requestJson(`/api/v1/public/${encodeURIComponent(slug)}/search?q=${encodeURIComponent(q)}`, { env, fetchImpl, timeoutMs });
  return result.available ? { available: true, items: Array.isArray(result.value?.results) ? result.value.results : [] } : { available: false, items: [], errorCode: result.errorCode };
};

const publicKnowledgeDocument = async ({ organizationSlug, documentSlug, env, fetchImpl, timeoutMs } = {}) => {
  const slug = String(organizationSlug || '').trim();
  const doc = String(documentSlug || '').trim();
  if (!slug || !doc) return { available: true, document: null };
  const result = await requestJson(`/api/v1/public/${encodeURIComponent(slug)}/documents/${encodeURIComponent(doc)}`, { env, fetchImpl, timeoutMs });
  return result.available ? { available: true, document: result.value?.document || null, organization: result.value?.organization || null } : { available: false, document: null, organization: null, errorCode: result.errorCode };
};

const publicKnowledgeCollections = async ({ organizationSlug, env, fetchImpl, timeoutMs } = {}) => {
  const slug = String(organizationSlug || '').trim();
  if (!slug) return { available: true, collections: [], organization: null };
  const result = await requestJson(`/api/v1/public/${encodeURIComponent(slug)}/collections`, { env, fetchImpl, timeoutMs });
  return result.available
    ? { available: true, collections: Array.isArray(result.value?.collections) ? result.value.collections : [], organization: result.value?.organization || null }
    : { available: false, collections: [], organization: null, errorCode: result.errorCode };
};

module.exports = { errorCode, publicKnowledgeCollections, publicKnowledgeDocument, publicKnowledgeSearch, requestJson, safeKnowledgeCall, timeoutAfter };
