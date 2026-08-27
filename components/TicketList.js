import SLAChip from './SLAChip';
const age = (value) => { const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60000)); if (minutes < 60) return `${minutes}m`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h`; return `${Math.floor(hours / 24)}d`; };
export default function TicketList({ tickets, selectedId, onSelect }) {
  if (!tickets.length) return <div className="empty-list"><strong>No tickets here</strong><span>This queue is clear.</span></div>;
  return <div className="ticket-list">{tickets.map((ticket) => <button key={ticket.id} className={`ticket-row ${selectedId === ticket.id ? 'selected' : ''}`} onClick={() => onSelect(ticket)}><div className="ticket-row-top"><span className={`priority-dot priority-${ticket.priority}`} /><strong>{ticket.subject}</strong><time>{age(ticket.updatedAt)}</time></div><p>{ticket.requesterName} · {ticket.requesterEmail}</p><div className="ticket-row-bottom"><span>{ticket.key}</span><span className={`status-pill status-${ticket.status}`}>{ticket.status}</span><SLAChip value={ticket.sla?.overall} /></div></button>)}</div>;
}
