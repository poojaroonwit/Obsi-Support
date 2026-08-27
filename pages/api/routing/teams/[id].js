const { requireAgent } = require('../../../../lib/auth');
const { updateTeam } = require('../../../../lib/routing-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  if(req.method!=='PATCH'){res.setHeader('Allow','PATCH');return res.status(405).json({success:false,message:'Method not allowed'});}
  try{
    const team=await updateTeam({organizationId:session.organizationId,teamId:req.query.id,patch:req.body||{}});
    if(!team) return res.status(404).json({success:false,message:'Team not found'});
    return res.json({success:true,team});
  }catch(error){return res.status(400).json({success:false,message:error.message||'Unable to update team.'});}
}
