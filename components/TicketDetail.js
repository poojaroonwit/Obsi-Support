import { useMemo, useState } from 'react';
import SLAChip from './SLAChip';

const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';
const deliveryLabel = (message) => message.deliveryStatus ? `Email ${message.deliveryStatus}` : '';
const stagedLabels = (actions = {}) => {
  const labels=[];
  if(actions.status) labels.push(`Status: ${actions.status}`);
  if(actions.priority) labels.push(`Priority: ${actions.priority}`);
  for(const label of actions.actionLabels||[]) labels.push(label);
  return labels;
};

export default function TicketDetail({ ticket, macros = [], routing = { teams: [] }, assignment = {}, onRoutingRefresh, onRefresh, onClose }) {
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [macroError, setMacroError] = useState('');
  const [macroLoading, setMacroLoading] = useState(false);
  const [selectedMacroId, setSelectedMacroId] = useState('');
  const [stagedActions, setStagedActions] = useState(null);

  const labels=useMemo(()=>stagedLabels(stagedActions||{}),[stagedActions]);
  if (!ticket) return <div className="detail-empty"><div className="empty-orb">S</div><h2>Select a ticket</h2><p>Choose a conversation from the queue to review context, SLA and replies.</p></div>;

  const setMode=(isInternal)=>{setInternal(isInternal);if(isInternal){setSelectedMacroId('');setStagedActions(null);setMacroError('');}};
  const prepareMacro=async(macroId)=>{
    setSelectedMacroId(macroId);setMacroError('');setStagedActions(null);
    if(!macroId)return;
    setMacroLoading(true);
    try{
      const response=await fetch(`/api/tickets/${ticket.id}/macros/${macroId}`);
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.message||'Unable to prepare macro.');
      setReply(payload.body||'');setInternal(false);
      const actionKeys=Object.keys(payload.actions||{}).filter((key)=>key!=='actionLabels'&&payload.actions[key]);
      setStagedActions(actionKeys.length?payload.actions:null);
    }catch(e){setMacroError(e.message);setSelectedMacroId('');}
    finally{setMacroLoading(false);}
  };
  const applyStagedActions=async()=>{
    if(!stagedActions)return;
    setMacroError('');
    const patchBody=Object.fromEntries(Object.entries(stagedActions).filter(([key,value])=>key!=='actionLabels'&&value));
    const response=await fetch(`/api/tickets/${ticket.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(patchBody)});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)return setMacroError(payload.message||'Unable to apply macro actions.');
    setStagedActions(null);
    if(onRoutingRefresh)await onRoutingRefresh();
    await onRefresh(ticket.id);
  };

  const send = async () => {
    if (!reply.trim()) return;
    setSending(true); setError('');
    const response = await fetch(`/api/tickets/${ticket.id}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: reply, isInternal: internal }) });
    const payload = await response.json().catch(() => ({})); setSending(false);
    if (!response.ok) { if (payload.ticket) await onRefresh(ticket.id); return setError(payload.message || 'Unable to send reply.'); }
    setReply(''); setSelectedMacroId(''); await onRefresh(ticket.id);
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
      <div className="composer"><div className="composer-tabs"><button className={!internal ? 'active' : ''} onClick={() => setMode(false)}>Reply</button><button className={internal ? 'active' : ''} onClick={() => setMode(true)}>Internal note</button></div>{!internal&&macros.length?<div className="macro-composer-bar"><strong>Macro</strong><select value={selectedMacroId} disabled={macroLoading} onChange={(e)=>prepareMacro(e.target.value)}><option value="">Choose a canned reply…</option>{macros.map((macro)=><option key={macro.id} value={macro.id}>{macro.shortcut?`${macro.shortcut} · `:''}{macro.name}</option>)}</select>{macroLoading?<span className="hint">Preparing…</span>:null}{macroError?<span className="macro-error">{macroError}</span>:null}</div>:null}{stagedActions?<div className="macro-staged">{labels.map((label)=><span key={label}>{label}</span>)}<button onClick={()=>{setStagedActions(null);setMacroError('');}}>Clear actions</button><button className="apply-actions" onClick={applyStagedActions}>Apply actions</button></div>:null}<textarea value={reply} onChange={(e) => setReply(e.target.value)} placeholder={internal ? 'Add a note only your team can see…' : `Reply to ${ticket.requesterName}…`} rows={5}/><div className="composer-actions">{error ? <span className="error-text">{error}</span> : <span className="hint">{internal ? 'Visible to agents only' : stagedActions?'Macro actions are staged, not automatic':'Customer-visible reply · delivered by email when configured'}</span>}<button className="primary-button small" onClick={send} disabled={sending || !reply.trim()}>{sending ? 'Sending…' : internal ? 'Add note' : 'Send reply'}</button></div></div>
    </div><aside className="properties"><h3>Ticket</h3><label>Status<select value={ticket.status} onChange={(e) => patch('status', e.target.value)}><option value="new">New</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label>Priority<select value={ticket.priority} onChange={(e) => patch('priority', e.target.value)}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label>Team<select value={assignment.teamId||''} onChange={(e)=>patchAssignment(e.target.value,'')}><option value="">No team</option>{(routing.teams||[]).filter((team)=>team.active||team.id===assignment.teamId).map((team)=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label>Assignee<select value={assignment.memberId||''} disabled={!assignment.teamId} onChange={(e)=>patchAssignment(assignment.teamId,e.target.value)}><option value="">Unassigned</option>{eligibleMembers.map((member)=><option key={member.id} value={member.id}>{member.name} · {member.load}/{member.capacity}</option>)}</select></label><div className="property-assignment-note">Automatic routing uses least load ÷ capacity. Manual changes stay until changed again.</div><div className="property-row"><span>First response</span><strong>{ticket.sla?.firstResponse}</strong><small>{formatDate(ticket.firstResponseDueAt)}</small></div><div className="property-row"><span>Resolution</span><strong>{ticket.sla?.resolution}</strong><small>{formatDate(ticket.resolutionDueAt)}</small></div><div className="property-row"><span>Created</span><strong>{formatDate(ticket.createdAt)}</strong></div></aside></div>
  </section>;
}
