import { useEffect, useMemo, useState } from 'react';
import AppShell from '../components/AppShell';
import TicketList from '../components/TicketList';
import TicketDetail from '../components/TicketDetail';

export async function getServerSideProps({ req, query }) {
  const { getSessionFromRequest } = require('../lib/auth');
  const { listTickets } = require('../lib/repository');
  const { listMacros } = require('../lib/macro-repository');
  const session = getSessionFromRequest(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  try {
    const tickets = await listTickets(session.organizationId);
    let macros=[];
    try { macros=await listMacros(session.organizationId,{activeOnly:true}); }
    catch(error){ if(error?.code!=='42P01') console.error('Macro load failed:',error); }
    return { props: JSON.parse(JSON.stringify({ session, tickets, macros, dataError: '', initialFilter: String(query.status || 'all') })) };
  }
  catch (error) { console.error('Inbox load failed:', error); return { props: JSON.parse(JSON.stringify({ session, tickets: [], macros: [], dataError: 'Database is not ready. Run npm run db:migrate after configuring DATABASE_URL.', initialFilter: String(query.status || 'all') })) }; }
}

export default function Inbox({ session, tickets: initialTickets, macros, dataError, initialFilter }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState(['all','new','open','pending','resolved'].includes(initialFilter) ? initialFilter : 'all');
  const [search, setSearch] = useState('');
  const [routing, setRouting] = useState({ teams: [], rules: [], assignments: [] });
  const [teamFilter, setTeamFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  const refreshRouting = async () => { const response=await fetch('/api/routing/snapshot'); if(response.ok){const payload=await response.json();setRouting({teams:payload.teams||[],rules:payload.rules||[],assignments:payload.assignments||[]});} };
  useEffect(() => { refreshRouting(); }, []);

  const assignmentByTicket = useMemo(() => Object.fromEntries((routing.assignments || []).map((item) => [item.ticketId, item])), [routing.assignments]);
  const members = useMemo(() => (routing.teams || []).flatMap((team) => (team.members || []).map((member) => ({ ...member, teamName: team.name }))), [routing.teams]);
  const visible = useMemo(() => tickets.filter((ticket) => {
    const assignment=assignmentByTicket[ticket.id]||{};
    if(filter !== 'all' && ticket.status !== filter) return false;
    if(search && !`${ticket.subject} ${ticket.requesterName} ${ticket.requesterEmail} ${ticket.key}`.toLowerCase().includes(search.toLowerCase())) return false;
    if(teamFilter==='unassigned' && assignment.teamId) return false;
    if(teamFilter!=='all' && teamFilter!=='unassigned' && assignment.teamId!==teamFilter) return false;
    if(assigneeFilter==='unassigned' && assignment.assigneeId) return false;
    if(assigneeFilter!=='all' && assigneeFilter!=='unassigned' && assignment.memberId!==assigneeFilter) return false;
    return true;
  }).map((ticket)=>({...ticket,routingAssignment:assignmentByTicket[ticket.id]||{}})), [tickets, filter, search, teamFilter, assigneeFilter, assignmentByTicket]);

  const loadTicket = async (ticketOrId) => {
    const id = typeof ticketOrId === 'string' ? ticketOrId : ticketOrId.id;
    const response = await fetch(`/api/tickets/${id}`); if (!response.ok) return;
    const payload = await response.json(); setSelected(payload.ticket);
    const listResponse = await fetch('/api/tickets'); if (listResponse.ok) setTickets((await listResponse.json()).tickets);
    await refreshRouting();
  };

  const selectedAssignment=selected?assignmentByTicket[selected.id]||{}:{};
  return <AppShell session={session}><section className="workspace-card"><header className="workspace-header"><div><span className="eyebrow">Support workspace</span><h1>Inbox</h1></div><div className="header-actions routing-toolbar"><label className="search-box"><span>⌕</span><input aria-label="Search tickets" placeholder="Search tickets" value={search} onChange={(e) => setSearch(e.target.value)}/></label><select className="routing-filter-select" aria-label="Filter by team" value={teamFilter} onChange={(e)=>setTeamFilter(e.target.value)}><option value="all">All teams</option><option value="unassigned">No team</option>{routing.teams.map((team)=><option key={team.id} value={team.id}>{team.name}</option>)}</select><select className="routing-filter-select" aria-label="Filter by assignee" value={assigneeFilter} onChange={(e)=>setAssigneeFilter(e.target.value)}><option value="all">All assignees</option><option value="unassigned">Unassigned</option>{members.filter(m=>m.active).map((member)=><option key={member.id} value={member.id}>{member.name} · {member.teamName}</option>)}</select><a className="secondary-button" href={`/request/${session.organizationSlug || ''}`} target="_blank" rel="noreferrer">New request ↗</a></div></header>{dataError ? <div className="config-banner">{dataError}</div> : null}<div className="queue-tabs"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All <b>{tickets.length}</b></button><button className={filter === 'new' ? 'active' : ''} onClick={() => setFilter('new')}>New <b>{tickets.filter(t => t.status === 'new').length}</b></button><button className={filter === 'open' ? 'active' : ''} onClick={() => setFilter('open')}>Open <b>{tickets.filter(t => t.status === 'open').length}</b></button><button className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>Pending <b>{tickets.filter(t => t.status === 'pending').length}</b></button></div><div className="inbox-grid"><section className="queue-panel"><div className="queue-heading"><strong>{filter === 'all' ? 'All conversations' : `${filter[0].toUpperCase()}${filter.slice(1)}`}</strong><span>{visible.length}</span></div><TicketList tickets={visible} selectedId={selected?.id} onSelect={loadTicket}/></section><TicketDetail ticket={selected} macros={macros} routing={routing} assignment={selectedAssignment} onRoutingRefresh={refreshRouting} onRefresh={loadTicket} onClose={() => setSelected(null)}/></div></section></AppShell>;
}
