'use strict';

const { knowledgebaseConfig } = require('./config.cjs');

class KnowledgeUnavailableError extends Error {
  constructor(code, message, status = 503) {
    super(message);
    this.name = 'KnowledgeUnavailableError';
    this.code = code;
    this.status = status;
  }
}

async function requestKnowledge(path, { method = 'GET', body, headers = {}, accessToken, env = process.env } = {}) {
  const config = knowledgebaseConfig(env);
  if (!config.enabled) throw new KnowledgeUnavailableError('KNOWLEDGE_DISABLED', 'Knowledgebase integration is disabled');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new KnowledgeUnavailableError(String(payload.code || `KNOWLEDGE_${response.status}`), String(payload.message || 'Knowledgebase request failed'), response.status);
    }
    return payload;
  } catch (error) {
    if (error?.name === 'AbortError') throw new KnowledgeUnavailableError('KNOWLEDGE_TIMEOUT', 'Knowledgebase request timed out', 504);
    if (error instanceof KnowledgeUnavailableError) throw error;
    throw new KnowledgeUnavailableError('KNOWLEDGE_UNAVAILABLE', 'Knowledgebase is unavailable');
  } finally {
    clearTimeout(timeout);
  }
}

async function safeKnowledgeCall(fn) {
  try {
    return { available: true, data: await fn(), errorCode: null };
  } catch (error) {
    return { available: false, data: null, errorCode: error?.code || 'KNOWLEDGE_UNAVAILABLE' };
  }
}

async function publicKnowledgeCollections(organizationSlug, options = {}) {
  const result = await safeKnowledgeCall(() => requestKnowledge(`/api/v1/public/${encodeURIComponent(organizationSlug)}/collections`, options));
  return { available: result.available, collections: result.data?.collections || [], organization: result.data?.organization || null, errorCode: result.errorCode };
}

async function publicKnowledgeSearch(organizationSlug, query, options = {}) {
  const q = String(query || '').trim();
  if (!q) return { available: true, items: [], errorCode: null };
  const result = await safeKnowledgeCall(() => requestKnowledge(`/api/v1/public/${encodeURIComponent(organizationSlug)}/search?q=${encodeURIComponent(q)}`, options));
  return { available: result.available, items: result.data?.results || [], errorCode: result.errorCode };
}

async function publicKnowledgeDocument(organizationSlug, documentSlug, options = {}) {
  const result = await safeKnowledgeCall(() => requestKnowledge(`/api/v1/public/${encodeURIComponent(organizationSlug)}/documents/${encodeURIComponent(documentSlug)}`, options));
  return { available: result.available, document: result.data?.document || null, errorCode: result.errorCode };
}

async function agentKnowledgeSearch({ organizationId, query, accessToken, env = process.env }) {
  if (!organizationId) return { available: false, items: [], errorCode: 'MISSING_ORGANIZATION' };
  const q = String(query || '').trim();
  if (!q) return { available: true, items: [], errorCode: null };
  const result = await safeKnowledgeCall(() => requestKnowledge(`/api/v1/search?q=${encodeURIComponent(q)}&limit=8`, { accessToken, env }));
  return { available: result.available, items: result.data?.results || [], errorCode: result.errorCode };
}

module.exports = {
  KnowledgeUnavailableError,
  requestKnowledge,
  safeKnowledgeCall,
  publicKnowledgeCollections,
  publicKnowledgeSearch,
  publicKnowledgeDocument,
  agentKnowledgeSearch,
};
