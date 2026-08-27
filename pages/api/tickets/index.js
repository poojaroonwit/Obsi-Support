const { requireAgent } = require('../../../lib/auth');
const { createTicket, getTicket, listTickets } = require('../../../lib/repository');
const { routeTicket } = require('../../../lib/routing-repository');
const { recalculateTicketSla } = require('../../../lib/sla-service');

const tryRoute = async (organizationId, ticketId) => {
  try { await routeTicket({ organizationId, ticketId }); }
  catch (error) { console.error('Automatic ticket routing failed:', error); }
};
const trySla = async (organizationId, ticketId) => {
  try { await recalculateTicketSla({ organizationId, ticketId }); }
  catch (error) { console.error('SLA policy calculation failed:', error); }
};

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
      await trySla(session.organizationId,created.ticket.id);
      await tryRoute(session.organizationId,created.ticket.id);
      return res.status(201).json({success:true,ticket:await getTicket(session.organizationId,created.ticket.id)});
    }
    res.setHeader('Allow','GET, POST');
    return res.status(405).json({success:false,message:'Method not allowed'});
  }catch(error){
    console.error(error);
    return res.status(400).json({success:false,message:error.message||'Ticket operation failed.'});
  }
}
