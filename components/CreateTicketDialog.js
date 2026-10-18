import { useEffect, useState } from 'react';
import TicketAgentGovernance, { DISABLED_TICKET_GOVERNANCE } from './TicketAgentGovernance';

const EMPTY = {
  requesterName: '', requesterEmail: '', subject: '', description: '', priority: 'normal',
  agentGovernance: DISABLED_TICKET_GOVERNANCE,
};

export default function CreateTicketDialog({ onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const closeOnEscape = event => { if (event.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose, busy]);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, channel: 'manual' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Could not create ticket.');
      onCreated(payload.ticket);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create ticket.');
    } finally { setBusy(false); }
  }

  return <div className="ticket-create-modal" role="presentation" onMouseDown={e => { if(e.target === e.currentTarget && !busy) onClose(); }}>
    <div className="ticket-create-modal-panel" role="dialog" aria-modal="true" aria-labelledby="ticket-create-title">
      <div className="ticket-create-modal-header">
        <h2 id="ticket-create-title">Create ticket</h2>
        <button aria-label="Close create ticket" type="button" disabled={busy} onClick={onClose}>×</button>
      </div>
      <form className="ticket-create-form" onSubmit={submit}>
        <div className="form-grid">
          <label>Requester name<input required maxLength={160} value={form.requesterName} onChange={e => setForm({ ...form, requesterName: e.target.value })}/></label>
          <label>Requester email<input required type="email" maxLength={320} value={form.requesterEmail} onChange={e => setForm({ ...form, requesterEmail: e.target.value })}/></label>
        </div>
        <label>Subject<input autoFocus required maxLength={240} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })}/></label>
        <label>Description<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
        <label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
        </select></label>
        <TicketAgentGovernance value={form.agentGovernance} disabled={busy} onChange={value => setForm(current => ({ ...current, agentGovernance:value }))}/>
        {error ? <div className="ticket-create-error" role="alert">{error}</div> : null}
        <div className="ticket-create-submit">
          <button type="button" className="secondary-button" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={busy}>{busy ? 'Creating…' : 'Create ticket'}</button>
        </div>
      </form>
    </div>
  </div>;
}
