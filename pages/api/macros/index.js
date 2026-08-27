const { requireAgent } = require('../../../lib/auth');
const { createMacro, listMacros } = require('../../../lib/macro-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  try{
    if(req.method==='GET') return res.json({success:true,macros:await listMacros(session.organizationId,{activeOnly:req.query.active==='1',search:req.query.search})});
    if(req.method==='POST'){
      const macro=await createMacro({organizationId:session.organizationId,input:req.body||{}});
      return res.status(201).json({success:true,macro});
    }
    res.setHeader('Allow','GET, POST'); return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){
    if(error?.code==='23505') return res.status(409).json({success:false,message:'That macro shortcut is already in use.'});
    return res.status(400).json({success:false,message:error.message||'Macro operation failed.'});
  }
}
