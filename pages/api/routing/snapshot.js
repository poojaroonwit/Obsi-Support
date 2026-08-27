const { requireAgent } = require('../../../lib/auth');
const { getRoutingSnapshot } = require('../../../lib/routing-repository');
const { query } = require('../../../lib/db');

const listAssignments = async (organizationId) => {
  const result = await query(`SELECT t.id AS ticket_id,t.team_id,t.team_name,t.assignee_id,t.assignee_name,t.assignee_email,m.id AS member_id
    FROM support_tickets t
    LEFT JOIN support_team_members m ON m.organization_id=t.organization_id AND m.team_id=t.team_id
      AND COALESCE(NULLIF(m.user_id,''),m.id::text)=t.assignee_id
    WHERE t.organization_id=$1`, [organizationId]);
  return result.rows.map((row) => ({
    ticketId: row.ticket_id,
    teamId: row.team_id || '',
    teamName: row.team_name || '',
    memberId: row.member_id || '',
    assigneeId: row.assignee_id || '',
    assigneeName: row.assignee_name || '',
    assigneeEmail: row.assignee_email || '',
  }));
};

export default async function handler(req,res){
  const session=requireAgent(req,res); if(!session) return;
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({success:false,message:'Method not allowed'});}
  try{
    const snapshot=await getRoutingSnapshot(session.organizationId);
    return res.json({success:true,...snapshot,assignments:await listAssignments(session.organizationId)});
  }catch(error){console.error(error);return res.status(400).json({success:false,message:error.message||'Unable to load routing configuration.'});}
}
