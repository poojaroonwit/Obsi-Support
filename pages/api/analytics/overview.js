const { requireAgent } = require('../../../lib/auth');
const { getSupportAnalytics } = require('../../../lib/analytics-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res);if(!session)return;
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({success:false,message:'Method not allowed'});}
  try{return res.json({success:true,analytics:await getSupportAnalytics({organizationId:session.organizationId,days:req.query.days})});}
  catch(error){console.error('Analytics load failed:',error);return res.status(400).json({success:false,message:error.message||'Unable to load support analytics.'});}
}
