import { useState } from 'react';
import RequestKnowledgeSuggestions from '../../components/help/RequestKnowledgeSuggestions';

export default function RequestPage({ organizationSlug }) {
  const [form, setForm] = useState({ requesterName: '', requesterEmail: '', subject: '', description: '', priority: 'normal' });
  const [state, setState] = useState({ loading: false, error: '', result: null });

  const submit = async (event) => {
    event.preventDefault();
    setState({ loading: true, error: '', result: null });
    const response = await fetch('/api/public/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationSlug, ...form, channel: 'portal' }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setState({ loading: false, error: payload.message || 'Unable to submit request.', result: null });
    setState({ loading: false, error: '', result: payload });
  };

  if (state.result) return <main className="portal-page"><section className="portal-card success-card"><div className="portal-logo">S</div><span className="eyebrow">Obsi Support</span><h1>Request received</h1><p>Your ticket <strong>{state.result.ticket.key}</strong> is in the support queue.</p><a className="primary-button" href={state.result.portalUrl}>View your request</a></section></main>;

  return <main className="portal-page"><section className="portal-card"><div className="portal-logo">S</div><span className="eyebrow">Obsi Support</span><h1>How can we help?</h1><p>Send a request to the support team. You’ll receive a private link to continue the conversation.</p><form onSubmit={submit} className="request-form"><div className="form-grid"><label>Your name<input required value={form.requesterName} onChange={(e) => setForm({ ...form, requesterName: e.target.value })}/></label><label>Email<input required type="email" value={form.requesterEmail} onChange={(e) => setForm({ ...form, requesterEmail: e.target.value })}/></label></div><label>Subject<input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}/></label><label>What happened?<textarea rows={7} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}/></label><RequestKnowledgeSuggestions organizationSlug={organizationSlug} subject={form.subject} description={form.description}/><label>Priority<select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>{state.error ? <div className="form-error">{state.error}</div> : null}<button className="primary-button" disabled={state.loading}>{state.loading ? 'Submitting…' : 'Submit request'}</button></form></section></main>;
}

export async function getServerSideProps({ params }) {
  return { props: { organizationSlug: String(params.organizationSlug || '') } };
}
