const { clearSession } = require('../../../lib/auth');
const { clearKnowledgebaseAccessToken } = require('../../../lib/outborn/knowledgebase-token');
const append = (res, value) => { const existing = res.getHeader('Set-Cookie'); res.setHeader('Set-Cookie', existing ? [...(Array.isArray(existing) ? existing : [existing]), value] : value); };
export default function handler(req,res){ clearSession(res); append(res,clearKnowledgebaseAccessToken()); return res.redirect(302,'/login'); }
