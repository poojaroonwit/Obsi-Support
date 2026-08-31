'use strict';

const crypto = require('crypto');
const cookie = require('cookie');

const DELEGATED_TOKEN_COOKIE = 'obsi_support_outborn_delegated';

function encryptionKey(env = process.env) {
  const secret = String(env.SESSION_SECRET || env.JWT_SECRET || '').trim();
  if (secret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters for delegated token encryption');
  return crypto.createHash('sha256').update(`obsi-support:delegated-token:${secret}`).digest();
}

function sealAccessToken(accessToken, env = process.env) {
  const token = String(accessToken || '').trim();
  if (!token) throw new Error('Delegated access token is required');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(env), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

function unsealAccessToken(value, env = process.env) {
  try {
    const [ivRaw, tagRaw, encryptedRaw] = String(value || '').split('.');
    if (!ivRaw || !tagRaw || !encryptedRaw) return '';
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(env), Buffer.from(ivRaw, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(encryptedRaw, 'base64url')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

function cookieOptions(maxAge, env = process.env) {
  return { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', maxAge, path: '/' };
}

function appendCookie(res, value) {
  const existing = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', existing ? [...(Array.isArray(existing) ? existing : [existing]), value] : value);
}

function setDelegatedAccessToken(res, accessToken, maxAge = 3600, env = process.env) {
  appendCookie(res, cookie.serialize(DELEGATED_TOKEN_COOKIE, sealAccessToken(accessToken, env), cookieOptions(maxAge, env)));
}

function clearDelegatedAccessToken(res, env = process.env) {
  appendCookie(res, cookie.serialize(DELEGATED_TOKEN_COOKIE, '', cookieOptions(0, env)));
}

function getDelegatedAccessToken(req, env = process.env) {
  const parsed = cookie.parse(req?.headers?.cookie || '');
  return unsealAccessToken(parsed[DELEGATED_TOKEN_COOKIE], env);
}

module.exports = { DELEGATED_TOKEN_COOKIE, sealAccessToken, unsealAccessToken, setDelegatedAccessToken, clearDelegatedAccessToken, getDelegatedAccessToken };
