const { clearSession } = require('../../../lib/auth');
const { clearDelegatedAccessToken } = require('../../../lib/outborn/delegated-token');
export default function handler(req,res){ clearSession(res); clearDelegatedAccessToken(res); return res.redirect(302,'/login'); }
