const { createTicket, getTicket, resolveOrganizationBySlug } = require('../../../lib/repository');
const { routeTicket } = require('../../../lib/routing-repository');
const { recalculateTicketSla } = require('../../../lib/sla-service');
const { resolveAppBaseUrl } = require('../../../lib/outborn/user-oauth');

const tryRoute = async (organizationId, ticketId) => {
  try { await routeTicket({ organizationId, ticketId }); }
  catch (error) { console.error('Automatic public ticket routing failed:', error); }
};
const trySla = async (organizationId, ticketId) => {
  try { await recalculateTicketSla({ organizationId, ticketId }); }
  catch (error) { console.error('Public ticket SLA calculation failed:', error); }
};

export default async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({success:false,message:'Method not allowed'});
  try{
    const slug=String(req.body?.organizationSlug||'').trim();
    if(!slug)return res.status(400).json({success:false,message:'Organization is required.'});
    const organization=await resolveOrganizationBySlug(slug);
    if(!organization)return res.status(404).json({success:false,message:'Support workspace not found.'});
    const created=await createTicket({organizationId:organization.organization_id,organizationSlug:organization.slug,input:req.body});
    await trySla(organization.organization_id,created.ticket.id);
    await tryRoute(organization.organization_id,created.ticket.id);
    const base=resolveAppBaseUrl(req);
    return res.status(201).json({success:true,ticket:await getTicket(organization.organization_id,created.ticket.id),portalUrl:`${base}/portal/${created.portalToken}`});
  }catch(error){console.error(error);return res.status(400).json({success:false,message:error.message||'Unable to submit request.'});}
}
