const label = { breached: 'SLA breached', running: 'SLA running', met: 'SLA met', not_set: 'No SLA' };
export default function SLAChip({ value = 'running' }) { return <span className={`sla-chip sla-${value}`}>{label[value] || 'SLA running'}</span>; }
