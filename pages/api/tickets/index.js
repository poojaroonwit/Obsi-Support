const { requireAgent } = require('../../../lib/auth');
const { createTicket, listTickets } = require('../../../lib/repository');
const { routeTicket } = require('../../../lib/routing-repository');

export default async function handler(req,res){
  const session=requireAgent(req,res);
  if(!session) return;
  try{
    if(req.method==='GET'){
      const tickets=await listTickets(session.organizationId,{status:req.query.status,search:req.query.search});
      return res.json({success:true,tickets});
    }
    if(req.method==='POST'){
      const created=await createTicket({organizationId:session.organizationId,organizationSlug:session.organizationSlug,input:{...req.body,channel:req.body?.channel||'manual'}});
      await routeTicket({organizationId:session.organizationId,ticketId:created.ticket.id});
      return res.status(201).json({success:true,ticket:created.ticket});
    }
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){
    console.error(error);
    return res.status(400).json({success:false,message:error.message||'Ticket operation failed.'});
  }
}
