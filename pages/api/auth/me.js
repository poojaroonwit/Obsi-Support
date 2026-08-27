const { requireAgent } = require('../../../lib/auth');
export default function handler(req,res){ const session=requireAgent(req,res); if(!session) return; return res.json({success:true,session}); }
