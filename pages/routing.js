import { useState } from 'react';
import AppShell from '../components/AppShell';

export async function getServerSideProps({ req }) {
  const { getSessionFromRequest } = require('../lib/auth');
  const { getRoutingSnapshot } = require('../lib/routing-repository');
  const session = getSessionFromRequest(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  try {
    const snapshot = await getRoutingSnapshot(session.organizationId);
    return { props: JSON.parse(JSON.stringify({ session, snapshot, dataError: '' })) };
  } catch (error) {
    console.error('Routing load failed:', error);
    return { props: JSON.parse(JSON.stringify({ session, snapshot: { teams: [], rules: [] }, dataError: 'Database is not ready. Run npm run db:migrate after deploying routing.' })) };
  }
}

const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Routing operation failed.');
  return payload;
};

const ruleSummary = (rule) => {
  const channels = rule.conditions?.channels?.length ? rule.conditions.channels.join(', ') : 'Any channel';
  const priorities = rule.conditions?.priorities?.length ? rule.conditions.priorities.join(', ') : 'Any priority';
  return [channels, priorities];
};

export default function Routing({ session, snapshot: initialSnapshot, dataError }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [error, setError] = useState('');
  const [teamDraft, setTeamDraft] = useState({ name: '', defaultCapacity: 10 });
  const [memberDrafts, setMemberDrafts] = useState({});
  const [ruleDraft, setRuleDraft] = useState({ name: '', sortOrder: 100, channel: '', priority: '', teamId: '' });

  const refresh = async () => {
    const payload = await request('/api/routing/snapshot');
    setSnapshot({ teams: payload.teams || [], rules: payload.rules || [] });
  };
  const run = async (fn) => { setError(''); try { await fn(); await refresh(); } catch (e) { setError(e.message); } };

  const createTeam = () => run(async () => {
    await request('/api/routing/teams', { method: 'POST', body: JSON.stringify(teamDraft) });
    setTeamDraft({ name: '', defaultCapacity: 10 });
  });
  const patchTeam = (teamId, patch) => run(() => request(`/api/routing/teams/${teamId}`, { method: 'PATCH', body: JSON.stringify(patch) }));
  const addMember = (teamId) => run(async () => {
    const draft = memberDrafts[teamId] || {};
    await request(`/api/routing/teams/${teamId}/members`, { method: 'POST', body: JSON.stringify(draft) });
    setMemberDrafts((current) => ({ ...current, [teamId]: { name: '', email: '', capacity: 10 } }));
  });
  const patchMember = (memberId, patch) => run(() => request(`/api/routing/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(patch) }));
  const createRule = () => run(async () => {
    const conditions = {};
    if (ruleDraft.channel) conditions.channels = [ruleDraft.channel];
    if (ruleDraft.priority) conditions.priorities = [ruleDraft.priority];
    await request('/api/routing/rules', { method: 'POST', body: JSON.stringify({ name: ruleDraft.name, sortOrder: ruleDraft.sortOrder, teamId: ruleDraft.teamId, conditions }) });
    setRuleDraft({ name: '', sortOrder: 100, channel: '', priority: '', teamId: '' });
  });
  const patchRule = (ruleId, patch) => run(() => request(`/api/routing/rules/${ruleId}`, { method: 'PATCH', body: JSON.stringify(patch) }));

  return <AppShell session={session}><section className="workspace-card"><header className="workspace-header"><div><span className="eyebrow">Support operations</span><h1>Routing</h1><p>Route new conversations to the right team and balance work by agent capacity.</p></div></header>{dataError ? <div className="config-banner">{dataError}</div> : null}{error ? <div className="config-banner">{error}</div> : null}
    <div className="routing-grid">
      <section className="routing-section"><div className="routing-section-header"><div><h2>Teams & capacity</h2><p>Active members with capacity above zero are eligible for automatic assignment.</p></div></div>
        <div className="routing-form"><input placeholder="Team name" value={teamDraft.name} onChange={(e) => setTeamDraft({ ...teamDraft, name: e.target.value })}/><input type="number" min="0" placeholder="Default capacity" value={teamDraft.defaultCapacity} onChange={(e) => setTeamDraft({ ...teamDraft, defaultCapacity: e.target.value })}/><span/><button onClick={createTeam} disabled={!teamDraft.name.trim()}>Create team</button></div>
        {!snapshot.teams.length ? <div className="routing-empty">Create a team to start routing support conversations.</div> : snapshot.teams.map((team) => {
          const draft = memberDrafts[team.id] || { name: '', email: '', capacity: team.defaultCapacity };
          return <article className="team-card" key={team.id}><div className="team-card-header"><div><strong>{team.name}</strong><small> · {team.key}</small></div><div className="routing-toolbar"><label className="toggle-label"><input type="checkbox" checked={team.active} onChange={(e) => patchTeam(team.id, { active: e.target.checked })}/> Active</label><label className="toggle-label">Default <input style={{width:70}} type="number" min="0" value={team.defaultCapacity} onChange={(e) => patchTeam(team.id, { defaultCapacity: e.target.value })}/></label></div></div>
            <div className="member-list">{team.members?.length ? team.members.map((member) => <div className="member-row" key={member.id}><div><strong>{member.name}</strong><small>{member.email}</small></div><div className="member-load"><b>{member.load}</b> / {member.capacity}</div><input aria-label={`Capacity for ${member.name}`} type="number" min="0" value={member.capacity} onChange={(e) => patchMember(member.id, { capacity: e.target.value })}/><label className="toggle-label"><input type="checkbox" checked={member.active} onChange={(e) => patchMember(member.id, { active: e.target.checked })}/> Active</label></div>) : <div className="routing-empty">No agents in this team yet.</div>}</div>
            <div className="routing-inline"><input placeholder="Agent name" value={draft.name || ''} onChange={(e) => setMemberDrafts({ ...memberDrafts, [team.id]: { ...draft, name: e.target.value } })}/><input type="email" placeholder="agent@company.com" value={draft.email || ''} onChange={(e) => setMemberDrafts({ ...memberDrafts, [team.id]: { ...draft, email: e.target.value } })}/><input type="number" min="0" placeholder="Capacity" value={draft.capacity ?? team.defaultCapacity} onChange={(e) => setMemberDrafts({ ...memberDrafts, [team.id]: { ...draft, capacity: e.target.value } })}/><button onClick={() => addMember(team.id)} disabled={!draft.name?.trim() || !draft.email?.trim()}>Add agent</button></div>
          </article>;
        })}
      </section>
      <section className="routing-section"><div className="routing-section-header"><div><h2>Routing rules</h2><p>The first enabled matching rule wins.</p></div></div>
        <div className="routing-form compact"><input placeholder="Rule name" value={ruleDraft.name} onChange={(e) => setRuleDraft({ ...ruleDraft, name: e.target.value })}/><select value={ruleDraft.teamId} onChange={(e) => setRuleDraft({ ...ruleDraft, teamId: e.target.value })}><option value="">Choose team</option>{snapshot.teams.filter(t=>t.active).map((team)=><option key={team.id} value={team.id}>{team.name}</option>)}</select><input type="number" value={ruleDraft.sortOrder} onChange={(e)=>setRuleDraft({...ruleDraft,sortOrder:e.target.value})}/><button onClick={createRule} disabled={!ruleDraft.name.trim() || !ruleDraft.teamId}>Add rule</button></div>
        <div className="routing-form" style={{gridTemplateColumns:'1fr 1fr'}}><select value={ruleDraft.channel} onChange={(e)=>setRuleDraft({...ruleDraft,channel:e.target.value})}><option value="">Any channel</option><option value="email">Email</option><option value="portal">Portal</option><option value="api">API</option><option value="manual">Manual</option><option value="chat">Chat</option></select><select value={ruleDraft.priority} onChange={(e)=>setRuleDraft({...ruleDraft,priority:e.target.value})}><option value="">Any priority</option><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></div>
        {!snapshot.rules.length ? <div className="routing-empty">No rules yet. New tickets stay unassigned until a rule matches.</div> : snapshot.rules.map((rule) => <article className="rule-card" key={rule.id}><div className="rule-card-header"><div><strong>{rule.sortOrder}. {rule.name}</strong><small> → {rule.teamName}</small></div><label className="toggle-label"><input type="checkbox" checked={rule.enabled} onChange={(e)=>patchRule(rule.id,{enabled:e.target.checked})}/> Enabled</label></div><div className="rule-conditions">{ruleSummary(rule).map((label)=><span className="condition-chip" key={label}>{label}</span>)}</div><div className="routing-inline"><input aria-label="Rule order" type="number" value={rule.sortOrder} onChange={(e)=>patchRule(rule.id,{sortOrder:e.target.value})}/><select value={rule.teamId} onChange={(e)=>patchRule(rule.id,{teamId:e.target.value})}>{snapshot.teams.map((team)=><option key={team.id} value={team.id}>{team.name}</option>)}</select></div></article>)}
      </section>
    </div>
  </section></AppShell>;
}
