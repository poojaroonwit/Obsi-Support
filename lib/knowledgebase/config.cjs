'use strict';

function normalizeKnowledgebaseUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parsed = new URL(raw);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('OBSI_KNOWLEDGEBASE_URL must use http or https');
  }
  return parsed.toString().replace(/\/$/, '');
}

function isKnowledgebaseEnabled(env = process.env) {
  return String(env.OBSI_KNOWLEDGEBASE_ENABLED || '').toLowerCase() === 'true' && Boolean(normalizeKnowledgebaseUrl(env.OBSI_KNOWLEDGEBASE_URL));
}

function knowledgebaseConfig(env = process.env) {
  return {
    enabled: isKnowledgebaseEnabled(env),
    baseUrl: normalizeKnowledgebaseUrl(env.OBSI_KNOWLEDGEBASE_URL),
    timeoutMs: Math.max(250, Math.min(Number(env.OBSI_KNOWLEDGEBASE_TIMEOUT_MS || 1800), 10000)),
  };
}

module.exports = { normalizeKnowledgebaseUrl, isKnowledgebaseEnabled, knowledgebaseConfig };
