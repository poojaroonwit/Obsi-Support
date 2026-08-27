const { requireAgent } = require('../../../lib/auth');
const { DEFAULT_SLA_POLICY } = require('../../../lib/sla');
const { defaultSchedule, deleteSlaPolicy, getSlaPolicy, saveSlaPolicy } = require('../../../lib/sla-repository');

const defaultDraft = () => ({
  enabled: false,
  timezone: 'UTC',
  schedule: defaultSchedule(),
  holidays: [],
  targets: DEFAULT_SLA_POLICY,
});

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  try{
    if(req.method==='GET'){
      const policy=await getSlaPolicy(session.organizationId);
      return res.json({success:true,configured:Boolean(policy),policy:policy||defaultDraft()});
    }
    if(req.method==='PUT'){
      const policy=await saveSlaPolicy({organizationId:session.organizationId,policy:req.body||{}});
      return res.json({success:true,configured:true,policy});
    }
    if(req.method==='DELETE'){
      await deleteSlaPolicy(session.organizationId);
      return res.json({success:true,configured:false,policy:defaultDraft()});
    }
    res.setHeader('Allow','GET, PUT, DELETE');
    return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){
    return res.status(400).json({success:false,message:error.message||'Unable to update SLA policy.'});
  }
}
