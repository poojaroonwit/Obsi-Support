const { upsertOrganization } = require('../repository');
const { getOutbornPlatformConfig, requireBaseUrl } = require('./config');
const { fetchAccountUserInfo } = require('./user-oauth');

const bearerFromRequest = (req) => {
  const header = String(req?.headers?.authorization || '').trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const organizationFromUserInfo = (userinfo) => {
  const candidate = (Array.isArray(userinfo?.organizations) ? userinfo.organizations : [])[0] || userinfo?.organization || {};
  const id = String(candidate.organizationId || candidate.id || userinfo?.organization_id || '').trim();
  if (!id) return null;
  return {
    id,
    slug: String(candidate.slug || candidate.organizationSlug || id).trim(),
    name: String(candidate.name || candidate.organizationName || candidate.slug || 'Organization').trim(),
  };
};

const sessionFromUserInfo = (userinfo) => {
  const organization = organizationFromUserInfo(userinfo);
  if (!organization) return null;
  return {
    sub: String(userinfo.sub || '').trim(),
    email: String(userinfo.email || '').trim(),
    name: String(userinfo.name || userinfo.preferred_username || userinfo.email || '').trim(),
    organizationId: organization.id,
    organizationSlug: organization.slug,
    organizationName: organization.name,
  };
};

const requireAgentConnect = async (req, res, { fetchImpl = globalThis.fetch } = {}) => {
  const accessToken = bearerFromRequest(req);
  if (!accessToken) {
    res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Outborn Account bearer token is required.' });
    return null;
  }

  try {
    const platform = getOutbornPlatformConfig(process.env);
    const accountBaseUrl = requireBaseUrl(platform.accountBaseUrl, 'OUTBORN_ACCOUNT_AUTH_URL');
    const userinfo = await fetchAccountUserInfo({ accountBaseUrl, accessToken, fetchImpl });
    const session = sessionFromUserInfo(userinfo);
    if (!session?.sub || !session.organizationId) {
      res.status(403).json({ success: false, code: 'ORGANIZATION_REQUIRED', message: 'An Outborn organization membership is required for Obsi Support.' });
      return null;
    }
    await upsertOrganization({ id: session.organizationId, slug: session.organizationSlug, name: session.organizationName });
    return session;
  } catch (error) {
    console.error('Agent Connect authentication failed:', error instanceof Error ? error.message : 'unknown error');
    res.status(401).json({ success: false, code: 'UNAUTHENTICATED', message: 'Outborn Account access could not be verified.' });
    return null;
  }
};

module.exports = { bearerFromRequest, organizationFromUserInfo, requireAgentConnect, sessionFromUserInfo };
