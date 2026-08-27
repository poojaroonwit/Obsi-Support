const { requireAgent } = require('../../../../../lib/auth');
const { addTeamMember } = require('../../../../../lib/routing-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({success:false,message:'Method not allowed'});}
  try{
    const member=await addTeamMember({organizationId:session.organizationId,teamId:req.query.id,name:req.body?.name,email:req.body?.email,userId:req.body?.userId,capacity:req.body?.capacity});
    if(!member) return res.status(404).json({success:false,message:'Team not found'});
    return res.status(201).json({success:true,member});
  }catch(error){return res.status(400).json({success:false,message:error.message||'Unable to add team member.'});}
}
