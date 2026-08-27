const { clearSession } = require('../../../lib/auth');
export default function handler(req,res){ clearSession(res); return res.redirect(302,'/login'); }
