import { useEffect, useState } from 'react';

export const RECOMMENDED_TICKET_GOVERNANCE = {
  enabled: true,
  requireHumanReview: true,
  maskRequesterForAgents: true,
  preventAutomaticClosure: true,
};
export const DISABLED_TICKET_GOVERNANCE = {
  enabled: false,
  requireHumanReview: false,
  maskRequesterForAgents: false,
  preventAutomaticClosure: false,
};
const OPTIONS = [
  { key: 'requireHumanReview', title: 'Human review before AI replies', detail: 'Automated replies must be handled by a human support agent.' },
  { key: 'maskRequesterForAgents', title: 'Mask requester identity for agents', detail: 'Hide the requester name and email from Agent Connect reads.' },
  { key: 'preventAutomaticClosure', title: 'Prevent automatic closure', detail: 'Only signed-in support staff may resolve or close this ticket.' },
];
export default function TicketAgentGovernance({ value, onChange, disabled = false }) {
  const enabled = value?.enabled === true;
  const toggle = (next) => onChange(next ? { ...RECOMMENDED_TICKET_GOVERNANCE } : { ...DISABLED_TICKET_GOVERNANCE });
  return <section className="ticket-agent-governance" aria-label="Agent Governance configuration">
    <label className="ticket-governance-switch">
      <span className="ticket-governance-copy"><strong>Agent Governance</strong>
        <small>Add ticket-specific safeguards when Agent Connect handles this request.</small>
      </span>
      <input type="checkbox" role="switch" checked={enabled} disabled={disabled} onChange={e => toggle(e.target.checked)}/>
    </label>
    {enabled ? <div className="ticket-governance-options">
      <p>Recommended configuration · customize each control</p>
      {OPTIONS.map(option => <label className="ticket-governance-switch" key={option.key}>
        <span className="ticket-governance-copy"><strong>{option.title}</strong><small>{option.detail}</small></span>
        <input type="checkbox" role="switch" checked={value[option.key] === true} disabled={disabled}
          onChange={e => onChange({ ...value, [option.key]: e.target.checked })}/>
      </label>)}
    </div> : <p className="ticket-governance-disabled">Optional ticket Agent Governance controls are off. Organization policies and access checks remain enforced.</p>}
  </section>;
}
