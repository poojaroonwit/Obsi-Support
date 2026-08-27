const { requireAgent } = require('../../../../lib/auth');
const { updateTeamMember } = require('../../../../lib/routing-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  if(req.method!=='PATCH'){res.setHeader('Allow','PATCH');return res.status(405).json({success:false,message:'Method not allowed'});}
  try{
    const member=await updateTeamMember({organizationId:session.organizationId,memberId:req.query.id,patch:req.body||{}});
    if(!member) return res.status(404).json({success:false,message:'Member not found'});
    return res.json({success:true,member});
  }catch(error){return res.status(400).json({success:false,message:error.message||'Unable to update member.'});}
}
