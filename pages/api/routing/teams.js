const { requireAgent } = require('../../../lib/auth');
const { createTeam, listTeams } = require('../../../lib/routing-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  try{
    if(req.method==='GET') return res.json({success:true,teams:await listTeams(session.organizationId)});
    if(req.method==='POST'){
      const team=await createTeam({organizationId:session.organizationId,name:req.body?.name,key:req.body?.key,defaultCapacity:req.body?.defaultCapacity});
      return res.status(201).json({success:true,team});
    }
    res.setHeader('Allow','GET, POST'); return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){return res.status(400).json({success:false,message:error.message||'Team operation failed.'});}
}
