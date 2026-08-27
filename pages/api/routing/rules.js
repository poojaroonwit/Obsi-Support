const { requireAgent } = require('../../../lib/auth');
const { createRoutingRule, listRoutingRules } = require('../../../lib/routing-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  try{
    if(req.method==='GET') return res.json({success:true,rules:await listRoutingRules(session.organizationId)});
    if(req.method==='POST'){
      const rule=await createRoutingRule({organizationId:session.organizationId,name:req.body?.name,sortOrder:req.body?.sortOrder,enabled:req.body?.enabled,conditions:req.body?.conditions||{},teamId:req.body?.teamId});
      return res.status(201).json({success:true,rule});
    }
    res.setHeader('Allow','GET, POST'); return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){return res.status(400).json({success:false,message:error.message||'Routing rule operation failed.'});}
}
