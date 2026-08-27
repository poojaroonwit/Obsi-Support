const crypto = require('crypto');
const createPortalToken = () => crypto.randomBytes(32).toString('base64url');
const hashPortalToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');
module.exports = { createPortalToken, hashPortalToken };
