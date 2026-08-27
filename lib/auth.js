const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const SESSION_COOKIE = 'obsi_support_session';
const sessionSecret = () => { const value = String(process.env.SESSION_SECRET || process.env.JWT_SECRET || '').trim(); if (!value) throw new Error('SESSION_SECRET is not configured'); return value; };
const sessionCookieOptions = (maxAge = 3600) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge, path: '/' });
const createSession = (res, payload, maxAge = 3600) => {
  const token = jwt.sign(payload, sessionSecret(), { expiresIn: maxAge, issuer: 'obsi-support', audience: 'obsi-support-web' });
  const value = cookie.serialize(SESSION_COOKIE, token, sessionCookieOptions(maxAge)); const existing = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', existing ? [...(Array.isArray(existing) ? existing : [existing]), value] : value); return token;
};
const clearSession = (res) => { const value = cookie.serialize(SESSION_COOKIE, '', { ...sessionCookieOptions(0), maxAge: 0 }); const existing = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', existing ? [...(Array.isArray(existing) ? existing : [existing]), value] : value); };
const getSessionFromRequest = (req) => { try { const parsed = cookie.parse(req?.headers?.cookie || ''); const token = parsed[SESSION_COOKIE]; if (!token) return null; return jwt.verify(token, sessionSecret(), { issuer: 'obsi-support', audience: 'obsi-support-web' }); } catch { return null; } };
const requireAgent = (req, res) => { const session = getSessionFromRequest(req); if (!session?.sub || !session?.organizationId) { res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Sign in with Outborn Account.' }); return null; } return session; };
module.exports = { SESSION_COOKIE, clearSession, createSession, getSessionFromRequest, requireAgent };
