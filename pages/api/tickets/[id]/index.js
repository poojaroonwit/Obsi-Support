const { requireAgent } = require('../../../../lib/auth');
const { getTicket, updateTicket } = require('../../../../lib/repository');
const { manualAssignTicket } = require('../../../../lib/routing-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session)return;
  try{
    if(req.method==='GET'){
      const ticket=await getTicket(session.organizationId,req.query.id);
      if(!ticket)return res.status(404).json({success:false,message:'Ticket not found'});
      return res.json({success:true,ticket});
    }
    if(req.method==='PATCH'){
      const patch=req.body||{};
      if(Object.prototype.hasOwnProperty.call(patch,'teamId') || Object.prototype.hasOwnProperty.call(patch,'assigneeMemberId')){
        const assignment=await manualAssignTicket({
          organizationId:session.organizationId,
          ticketId:req.query.id,
          teamId:String(patch.teamId||''),
          assigneeMemberId:String(patch.assigneeMemberId||''),
          actor:{id:session.sub,name:session.name||session.email},
        });
        if(!assignment)return res.status(404).json({success:false,message:'Ticket not found'});
      }
      const remaining={...patch}; delete remaining.teamId; delete remaining.assigneeMemberId;
      let ticket;
      if(Object.keys(remaining).length) ticket=await updateTicket({organizationId:session.organizationId,ticketId:req.query.id,patch:remaining});
      else ticket=await getTicket(session.organizationId,req.query.id);
      if(!ticket)return res.status(404).json({success:false,message:'Ticket not found'});
      return res.json({success:true,ticket});
    }
    res.setHeader('Allow','GET, PATCH'); return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){console.error(error);return res.status(400).json({success:false,message:error.message||'Ticket operation failed.'});}
}
