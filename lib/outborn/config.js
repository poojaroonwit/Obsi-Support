const trim = (value) => String(value || '').trim();
const normalizeBaseUrl = (value) => {
  const normalized = trim(value).replace(/\/+$/, '');
  if (!normalized) return '';
  const parsed = new URL(normalized);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Unsupported URL protocol: ${parsed.protocol}`);
  return normalized;
};
const getOutbornPlatformConfig = (env = process.env) => ({
  accountBaseUrl: normalizeBaseUrl(env.OUTBORN_ACCOUNT_BASE_URL || env.OUTBORN_ACCOUNT_URL || env.OUTBORN_ACCOUNT_AUTH_URL),
  coreBaseUrl: normalizeBaseUrl(env.OUTBORN_CORE_BASE_URL || env.OUTBORN_CORE_URL),
  appkitBaseUrl: normalizeBaseUrl(env.APPKIT_BASE_URL),
});
const requireBaseUrl = (value, name) => { if (!value) throw new Error(`${name} is not configured`); return value; };
module.exports = { getOutbornPlatformConfig, normalizeBaseUrl, requireBaseUrl };
