import { useMemo, useState } from 'react';
import AppShell from '../components/AppShell';

const DAYS = [
  ['mon','Monday'],['tue','Tuesday'],['wed','Wednesday'],['thu','Thursday'],['fri','Friday'],['sat','Saturday'],['sun','Sunday'],
];
const PRIORITIES = ['urgent','high','normal','low'];

export async function getServerSideProps({ req }) {
  const { getSessionFromRequest } = require('../lib/auth');
  const { DEFAULT_SLA_POLICY } = require('../lib/sla');
  const { defaultSchedule, getSlaPolicy } = require('../lib/sla-repository');
  const session = getSessionFromRequest(req);
  if (!session) return { redirect: { destination: '/login', permanent: false } };
  try {
    const policy = await getSlaPolicy(session.organizationId);
    return { props: JSON.parse(JSON.stringify({ session, configured: Boolean(policy), initialPolicy: policy || { enabled:false, timezone:'UTC', schedule:defaultSchedule(), holidays:[], targets:DEFAULT_SLA_POLICY }, dataError:'' })) };
  } catch (error) {
    console.error('SLA policy load failed:', error);
    return { props: JSON.parse(JSON.stringify({ session, configured:false, initialPolicy:{ enabled:false, timezone:'UTC', schedule:defaultSchedule(), holidays:[], targets:DEFAULT_SLA_POLICY }, dataError:'Database is not ready. Run npm run db:migrate after deploying SLA policies.' })) };
  }
}

const api = async (method, body) => {
  const response = await fetch('/api/sla/policy', { method, headers: { 'Content-Type':'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || 'Unable to save SLA policy.');
  return payload;
};
const clone = (value) => JSON.parse(JSON.stringify(value));

export default function SlaPolicyPage({ session, configured: initialConfigured, initialPolicy, dataError }) {
  const [policy, setPolicy] = useState(initialPolicy);
  const [configured, setConfigured] = useState(initialConfigured);
  const [holidaysText, setHolidaysText] = useState((initialPolicy.holidays || []).join('\n'));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const activeDays = useMemo(() => DAYS.filter(([key]) => (policy.schedule?.[key] || []).length).length, [policy.schedule]);
  const setDayEnabled = (day, enabled) => setPolicy((current) => ({ ...current, schedule: { ...current.schedule, [day]: enabled ? (current.schedule?.[day]?.length ? current.schedule[day] : [{ start:'09:00', end:'18:00' }]) : [] } }));
  const setWindow = (day, field, value) => setPolicy((current) => {
    const next = clone(current); if (!next.schedule[day]?.length) next.schedule[day] = [{ start:'09:00', end:'18:00' }]; next.schedule[day][0][field] = value; return next;
  });
  const setTarget = (priority, field, value) => setPolicy((current) => ({ ...current, targets: { ...current.targets, [priority]: { ...current.targets[priority], [field]: Number(value) } } }));

  const save = async () => {
    setSaving(true); setError(''); setNotice('');
    try {
      const holidays = holidaysText.split(/[\n,]/).map((value) => value.trim()).filter(Boolean);
      const payload = await api('PUT', { ...policy, holidays });
      setPolicy(payload.policy); setHolidaysText((payload.policy.holidays || []).join('\n')); setConfigured(true);
      setNotice('SLA policy saved. New and reprioritized tickets will use this policy.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  const reset = async () => {
    setSaving(true); setError(''); setNotice('');
    try { const payload = await api('DELETE'); setPolicy(payload.policy); setHolidaysText(''); setConfigured(false); setNotice('Custom SLA policy removed. New tickets use platform 24×7 defaults.'); }
    catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  return <AppShell session={session}><section className="workspace-card sla-workspace"><header className="workspace-header"><div><span className="eyebrow">Support operations</span><h1>SLA policy</h1><p>Control when SLA clocks run and how quickly each priority must receive a response and resolution.</p></div><div className="sla-header-status"><span className={configured ? 'sla-state configured' : 'sla-state'}>{configured ? 'Custom policy' : 'Platform default'}</span></div></header>
    {dataError ? <div className="config-banner">{dataError}</div> : null}{error ? <div className="config-banner">{error}</div> : null}{notice ? <div className="sla-notice">{notice}</div> : null}
    <div className="sla-grid">
      <section className="sla-panel"><div className="sla-panel-heading"><div><h2>Business calendar</h2><p>When enabled, only minutes inside these windows count toward SLA deadlines.</p></div><label className="sla-switch"><input type="checkbox" checked={policy.enabled} onChange={(e)=>setPolicy({...policy,enabled:e.target.checked})}/><span>{policy.enabled ? 'Business time' : '24×7 time'}</span></label></div>
        <label className="sla-field"><span>Workspace timezone</span><input value={policy.timezone} onChange={(e)=>setPolicy({...policy,timezone:e.target.value})} placeholder="Asia/Bangkok"/><small>Use an IANA timezone such as Asia/Bangkok, Asia/Singapore, Europe/London, or America/New_York.</small></label>
        <div className="sla-week"><div className="sla-week-summary"><strong>{activeDays} active days</strong><span>One working window per day in this UI.</span></div>{DAYS.map(([key,label])=>{const window=policy.schedule?.[key]?.[0];const enabled=Boolean(window);return <div className="sla-day" key={key}><label className="sla-day-toggle"><input type="checkbox" checked={enabled} onChange={(e)=>setDayEnabled(key,e.target.checked)}/><span>{label}</span></label><input type="time" disabled={!enabled} value={window?.start || '09:00'} onChange={(e)=>setWindow(key,'start',e.target.value)}/><span>to</span><input type="time" disabled={!enabled} value={window?.end || '18:00'} onChange={(e)=>setWindow(key,'end',e.target.value)}/></div>})}</div>
        <label className="sla-field"><span>Holidays</span><textarea rows={5} value={holidaysText} onChange={(e)=>setHolidaysText(e.target.value)} placeholder={'2026-12-05\n2026-12-31'}/><small>Enter YYYY-MM-DD dates separated by new lines or commas. Holidays use the workspace timezone.</small></label>
      </section>
      <section className="sla-panel"><div className="sla-panel-heading"><div><h2>Priority targets</h2><p>Targets are minutes. Resolution must be equal to or longer than first response.</p></div></div>
        <div className="sla-target-table"><div className="sla-target-row header"><span>Priority</span><span>First response</span><span>Resolution</span></div>{PRIORITIES.map((priority)=><div className="sla-target-row" key={priority}><strong>{priority}</strong><label><input type="number" min="1" value={policy.targets?.[priority]?.firstResponseMinutes || ''} onChange={(e)=>setTarget(priority,'firstResponseMinutes',e.target.value)}/><small>min</small></label><label><input type="number" min="1" value={policy.targets?.[priority]?.resolutionMinutes || ''} onChange={(e)=>setTarget(priority,'resolutionMinutes',e.target.value)}/><small>min</small></label></div>)}</div>
        <div className="sla-behavior"><strong>Deadline behavior</strong><p>Saving does not rewrite deadlines on existing tickets. The policy applies to newly created tickets and when an agent changes a ticket priority.</p></div>
      </section>
    </div>
    <footer className="sla-actions"><button className="secondary-button" onClick={reset} disabled={saving || !configured}>Reset to platform default</button><button className="primary-button" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save SLA policy'}</button></footer>
  </section></AppShell>;
}
