const { requireAgent } = require('../../../../../lib/auth');
const { prepareMacro } = require('../../../../../lib/macro-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({success:false,message:'Method not allowed'});}
  try{
    const prepared=await prepareMacro({organizationId:session.organizationId,ticketId:req.query.id,macroId:req.query.macroId,session});
    if(!prepared) return res.status(404).json({success:false,message:'Macro or ticket not found'});
    return res.json({success:true,...prepared});
  }catch(error){return res.status(400).json({success:false,message:error.message||'Unable to prepare macro.'});}
}
