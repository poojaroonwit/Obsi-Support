const cookie = require('cookie');

const KNOWLEDGEBASE_ACCESS_TOKEN_COOKIE = 'obsi_support_knowledge_access';
const tokenCookieOptions = (maxAgeSeconds = 3600, env = process.env) => ({ httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge: Math.max(60, Math.min(Number(maxAgeSeconds) || 3600, 3600)), path: '/api/knowledgebase' });
const serializeKnowledgebaseAccessToken = (token, maxAgeSeconds, env = process.env) => cookie.serialize(KNOWLEDGEBASE_ACCESS_TOKEN_COOKIE, String(token || ''), tokenCookieOptions(maxAgeSeconds, env));
const clearKnowledgebaseAccessToken = (env = process.env) => cookie.serialize(KNOWLEDGEBASE_ACCESS_TOKEN_COOKIE, '', { ...tokenCookieOptions(60, env), maxAge: 0 });
const readKnowledgebaseAccessToken = (req) => String(cookie.parse(req?.headers?.cookie || '')[KNOWLEDGEBASE_ACCESS_TOKEN_COOKIE] || '').trim();
module.exports = { KNOWLEDGEBASE_ACCESS_TOKEN_COOKIE, clearKnowledgebaseAccessToken, readKnowledgebaseAccessToken, serializeKnowledgebaseAccessToken, tokenCookieOptions };
