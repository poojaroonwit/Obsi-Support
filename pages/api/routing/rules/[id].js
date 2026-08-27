const { requireAgent } = require('../../../../lib/auth');
const { updateRoutingRule } = require('../../../../lib/routing-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  if(req.method!=='PATCH'){res.setHeader('Allow','PATCH');return res.status(405).json({success:false,message:'Method not allowed'});}
  try{
    const rule=await updateRoutingRule({organizationId:session.organizationId,ruleId:req.query.id,patch:req.body||{}});
    if(!rule) return res.status(404).json({success:false,message:'Routing rule not found'});
    return res.json({success:true,rule});
  }catch(error){return res.status(400).json({success:false,message:error.message||'Unable to update routing rule.'});}
}
