const crypto = require('crypto');
const { getOutbornPlatformConfig, normalizeBaseUrl, requireBaseUrl } = require('./config');
const ACCOUNT_OAUTH_CLIENT_ID = 'outborn-obsi-support-web';
const SUPPORT_ACCOUNT_SCOPES = Object.freeze(['openid', 'email', 'profile', 'organizations', 'knowledge.read', 'knowledge.search', 'knowledge.public.read']);
const ACCOUNT_OAUTH_STATE_COOKIE = 'obsi_support_account_oauth_state';
const ACCOUNT_OAUTH_NONCE_COOKIE = 'obsi_support_account_oauth_nonce';
const ACCOUNT_OAUTH_VERIFIER_COOKIE = 'obsi_support_account_oauth_verifier';
const ACCOUNT_OAUTH_RETURN_COOKIE = 'obsi_support_account_oauth_return';
const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;
const randomUrlSafe = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const createPkcePair = () => { const verifier = randomUrlSafe(48); const challenge = crypto.createHash('sha256').update(verifier).digest('base64url'); return { verifier, challenge }; };
const normalizeReturnPath = (value, fallback = '/inbox') => {
  const candidate = String(value || '').trim();
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return fallback;
  try { const parsed = new URL(candidate, 'https://obsi.local'); if (parsed.origin !== 'https://obsi.local') return fallback; return `${parsed.pathname}${parsed.search}${parsed.hash}`; } catch { return fallback; }
};
const buildAuthorizeUrl = ({ issuer, clientId = ACCOUNT_OAUTH_CLIENT_ID, redirectUri, state, nonce, codeChallenge, scopes = SUPPORT_ACCOUNT_SCOPES }) => {
  const url = new URL('/api/auth/oauth2/authorize', requireBaseUrl(normalizeBaseUrl(issuer), 'OUTBORN_ACCOUNT_AUTH_URL'));
  url.searchParams.set('client_id', clientId); url.searchParams.set('redirect_uri', redirectUri); url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', [...new Set(scopes)].join(' ')); url.searchParams.set('state', state); url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge); url.searchParams.set('code_challenge_method', 'S256'); return url.toString();
};
const resolveAppBaseUrl = (req, env = process.env) => {
  const configured = normalizeBaseUrl(env.APP_PUBLIC_URL || env.NEXT_PUBLIC_APP_URL || ''); if (configured) return configured;
  const forwardedHost = String(req?.headers?.['x-forwarded-host'] || '').split(',')[0].trim(); const host = forwardedHost || String(req?.headers?.host || '').trim();
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim(); const protocol = forwardedProto || (env.NODE_ENV === 'production' ? 'https' : 'http');
  if (!host) throw new Error('APP_PUBLIC_URL is not configured and request host is unavailable'); return normalizeBaseUrl(`${protocol}://${host}`);
};
const getAccountOAuthConfig = (req, env = process.env) => {
  const platform = getOutbornPlatformConfig(env); const appBaseUrl = resolveAppBaseUrl(req, env); const accountBaseUrl = normalizeBaseUrl(env.OUTBORN_ACCOUNT_AUTH_URL || platform.accountBaseUrl);
  return { accountBaseUrl: requireBaseUrl(accountBaseUrl, 'OUTBORN_ACCOUNT_AUTH_URL'), appBaseUrl, clientId: String(env.OUTBORN_ACCOUNT_OAUTH_CLIENT_ID || env.OUTBORN_OBSI_SUPPORT_WEB_CLIENT_ID || ACCOUNT_OAUTH_CLIENT_ID).trim(), redirectUri: `${appBaseUrl}/api/auth/account/callback`, scopes: [...SUPPORT_ACCOUNT_SCOPES] };
};
const oauthCookieOptions = (env = process.env) => ({ httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS, path: '/' });
const exchangeAuthorizationCode = async ({ accountBaseUrl, clientId, redirectUri, code, verifier, fetchImpl = globalThis.fetch }) => {
  const response = await fetchImpl(`${accountBaseUrl}/api/auth/oauth2/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code, code_verifier: verifier }) });
  const payload = await response.json().catch(() => ({})); if (!response.ok || !payload?.access_token) throw new Error(payload?.error_description || payload?.error || `Token exchange failed (${response.status})`); return payload;
};
const fetchAccountUserInfo = async ({ accountBaseUrl, accessToken, fetchImpl = globalThis.fetch }) => {
  const response = await fetchImpl(`${accountBaseUrl}/api/auth/oauth2/userinfo`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  const payload = await response.json().catch(() => ({})); if (!response.ok || !payload?.sub || !payload?.email) throw new Error(payload?.error || `Userinfo failed (${response.status})`); return payload;
};
module.exports = { ACCOUNT_OAUTH_CLIENT_ID, SUPPORT_ACCOUNT_SCOPES, ACCOUNT_OAUTH_NONCE_COOKIE, ACCOUNT_OAUTH_RETURN_COOKIE, ACCOUNT_OAUTH_STATE_COOKIE, ACCOUNT_OAUTH_VERIFIER_COOKIE, buildAuthorizeUrl, createPkcePair, exchangeAuthorizationCode, fetchAccountUserInfo, getAccountOAuthConfig, normalizeReturnPath, oauthCookieOptions, randomUrlSafe, resolveAppBaseUrl };
