const { requireAgent } = require('../../../lib/auth');
const { deleteMacro, getMacro, updateMacro } = require('../../../lib/macro-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  try{
    if(req.method==='GET'){
      const macro=await getMacro(session.organizationId,req.query.id);
      if(!macro) return res.status(404).json({success:false,message:'Macro not found'});
      return res.json({success:true,macro});
    }
    if(req.method==='PATCH'){
      const macro=await updateMacro({organizationId:session.organizationId,macroId:req.query.id,patch:req.body||{}});
      if(!macro) return res.status(404).json({success:false,message:'Macro not found'});
      return res.json({success:true,macro});
    }
    if(req.method==='DELETE'){
      const deleted=await deleteMacro({organizationId:session.organizationId,macroId:req.query.id});
      if(!deleted) return res.status(404).json({success:false,message:'Macro not found'});
      return res.json({success:true});
    }
    res.setHeader('Allow','GET, PATCH, DELETE'); return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){
    if(error?.code==='23505') return res.status(409).json({success:false,message:'That macro shortcut is already in use.'});
    return res.status(400).json({success:false,message:error.message||'Macro operation failed.'});
  }
}
