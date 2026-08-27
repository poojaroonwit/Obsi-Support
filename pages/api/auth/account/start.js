const cookie = require('cookie');
const { ACCOUNT_OAUTH_NONCE_COOKIE, ACCOUNT_OAUTH_RETURN_COOKIE, ACCOUNT_OAUTH_STATE_COOKIE, ACCOUNT_OAUTH_VERIFIER_COOKIE, buildAuthorizeUrl, createPkcePair, getAccountOAuthConfig, normalizeReturnPath, oauthCookieOptions, randomUrlSafe } = require('../../../../lib/outborn/user-oauth');
const append = (res, value) => { const existing = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', existing ? [...(Array.isArray(existing) ? existing : [existing]), value] : value); };
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });
  try {
    const config = getAccountOAuthConfig(req); const { verifier, challenge } = createPkcePair(); const state = randomUrlSafe(); const nonce = randomUrlSafe(); const returnTo = normalizeReturnPath(req.query.returnTo);
    const target = buildAuthorizeUrl({ issuer: config.accountBaseUrl, clientId: config.clientId, redirectUri: config.redirectUri, state, nonce, codeChallenge: challenge }); const options = oauthCookieOptions();
    append(res, cookie.serialize(ACCOUNT_OAUTH_STATE_COOKIE, state, options)); append(res, cookie.serialize(ACCOUNT_OAUTH_NONCE_COOKIE, nonce, options)); append(res, cookie.serialize(ACCOUNT_OAUTH_VERIFIER_COOKIE, verifier, options)); append(res, cookie.serialize(ACCOUNT_OAUTH_RETURN_COOKIE, returnTo, options));
    return res.redirect(302, target);
  } catch (error) { console.error(error); return res.status(503).json({ success: false, code: 'ACCOUNT_AUTH_UNAVAILABLE', message: 'Outborn sign-in is temporarily unavailable.' }); }
}
