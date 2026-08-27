import { useState } from 'react';
import SLAChip from './SLAChip';

const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';
const deliveryLabel = (message) => message.deliveryStatus ? `Email ${message.deliveryStatus}` : '';

export default function TicketDetail({ ticket, routing = { teams: [] }, assignment = {}, onRoutingRefresh, onRefresh, onClose }) {
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  if (!ticket) return <div className="detail-empty"><div className="empty-orb">S</div><h2>Select a ticket</h2><p>Choose a conversation from the queue to review context, SLA and replies.</p></div>;

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true); setError('');
    const response = await fetch(`/api/tickets/${ticket.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: reply, isInternal: internal }) });
    const payload = await response.json().catch(() => ({})); setSending(false);
    if (!response.ok) { if (payload.ticket) await onRefresh(ticket.id); return setError(payload.message || 'Unable to send reply.'); }
    setReply(''); await onRefresh(ticket.id);
  };

  const patch = async (field, value) => {
    setError('');
    const response = await fetch(`/api/tickets/${ticket.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [field]: value }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setError(payload.message || 'Unable to update ticket.');
    if (onRoutingRefresh) await onRoutingRefresh();
    await onRefresh(ticket.id);
  };

  const patchAssignment = async (teamId, assigneeMemberId = '') => {
    setError('');
    const response=await fetch(`/api/tickets/${ticket.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({teamId,assigneeMemberId})});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) return setError(payload.message||'Unable to update assignment.');
    if(onRoutingRefresh) await onRoutingRefresh();
    await onRefresh(ticket.id);
  };

  const selectedTeam=(routing.teams||[]).find((team)=>team.id===assignment.teamId);
  const eligibleMembers=(selectedTeam?.members||[]).filter((member)=>member.active);

  return <section className="ticket-detail">
    <header className="detail-header"><div><button className="mobile-close" onClick={onClose} aria-label="Back to inbox">←</button><div className="detail-kicker"><span>{ticket.key}</span><span>·</span><span>{ticket.channel}</span></div><h2>{ticket.subject}</h2><p>{ticket.requesterName} · {ticket.requesterEmail}</p></div><SLAChip value={ticket.sla?.overall} /></header>
    <div className="detail-body"><div className="conversation"><div className="conversation-heading"><strong>Conversation</strong><span>{ticket.messages?.length || 0} messages</span></div>
      {(ticket.messages || []).map((message) => <article className={`message ${message.authorType === 'agent' ? 'agent-message' : 'customer-message'} ${message.isInternal ? 'internal-message' : ''}`} key={message.id}>
        <div className="message-meta"><strong>{message.authorName || message.authorEmail || message.authorType}</strong><span>{message.isInternal ? 'Internal note · ' : ''}{formatDate(message.createdAt)}{deliveryLabel(message) ? ` · ${deliveryLabel(message)}` : ''}</span></div>
        <p>{message.body}</p>{message.deliveryError ? <small className="error-text">{message.deliveryError}</small> : null}
      </article>)}
      <div className="composer"><div className="composer-tabs"><button className={!internal ? 'active' : ''} onClick={() => setInternal(false)}>Reply</button><button className={internal ? 'active' : ''} onClick={() => setInternal(true)}>Internal note</button></div><textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={internal ? 'Add a note only your team can see…' : `Reply to ${ticket.requesterName}…`} rows={5}/><div className="composer-actions">{error ? <span className="error-text">{error}</span> : <span className="hint">{internal ? 'Visible to agents only' : 'Customer-visible reply · delivered by email when configured'}</span>}<button className="primary-button small" onClick={send} disabled={sending || !reply.trim()}>{sending ? 'Sending…' : internal ? 'Add note' : 'Send reply'}</button></div></div>
    </div><aside className="properties"><h3>Ticket</h3><label>Status<select value={ticket.status} onChange={(e) => patch('status', e.target.value)}><option value="new">New</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label>Priority<select value={ticket.priority} onChange={(e) => patch('priority', e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Team<select value={assignment.teamId||''} onChange={(e)=>patchAssignment(e.target.value,'')}><option value="">No team</option>{(routing.teams||[]).filter((team)=>team.active||team.id===assignment.teamId).map((team)=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>Assignee<select value={assignment.memberId||''} disabled={!assignment.teamId} onChange={(e)=>patchAssignment(assignment.teamId,e.target.value)}><option value="">Unassigned</option>{eligibleMembers.map((member)=><option key={member.id} value={member.id}>{member.name} · {member.load}/{member.capacity}</option>)}</select></label><div className="property-assignment-note">Automatic routing uses least load ÷ capacity. Manual changes stay until changed again.</div><div className="property-row"><span>First response</span><strong>{ticket.sla?.firstResponse}</strong><small>{formatDate(ticket.firstResponseDueAt)}</small></div><div className="property-row"><span>Resolution</span><strong>{ticket.sla?.resolution}</strong><small>{formatDate(ticket.resolutionDueAt)}</small></div><div className="property-row"><span>Created</span><strong>{formatDate(ticket.createdAt)}</strong></div></aside></div>
  </section>;
}
