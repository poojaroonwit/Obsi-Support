const { requireAgentConnect } = require('../../../lib/outborn/agent-connect-auth');
const { addAgentMessage, createTicket, getTicket, listTickets, updateTicket } = require('../../../lib/repository');
const { routeTicket } = require('../../../lib/routing-repository');
const { recalculateTicketSla } = require('../../../lib/sla-service');

const tryRoute = async (organizationId, ticketId) => {
  try { await routeTicket({ organizationId, ticketId }); }
  catch (error) { console.error('Agent Connect automatic ticket routing failed:', error); }
};
const trySla = async (organizationId, ticketId) => {
  try { await recalculateTicketSla({ organizationId, ticketId }); }
  catch (error) { console.error('Agent Connect SLA calculation failed:', error); }
};

export default async function handler(req, res) {
  const session = await requireAgentConnect(req, res);
  if (!session) return;

  try {
    if (req.method === 'GET') {
      const id = String(req.query.id || '').trim();
      if (id) {
        const ticket = await getTicket(session.organizationId, id);
        if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
        return res.json({ success: true, ticket });
      }
      const tickets = await listTickets(session.organizationId, { status: req.query.status, search: req.query.search });
      return res.json({ success: true, tickets });
    }

    if (req.method === 'POST') {
      const operation = String(req.body?.operation || '').trim().toLowerCase();
      if (operation === 'reply') {
        const ticketId = String(req.body?.id || '').trim();
        if (!ticketId) return res.status(400).json({ success: false, message: 'Ticket id is required.' });
        const inserted = await addAgentMessage({
          organizationId: session.organizationId,
          ticketId,
          session,
          body: req.body?.body,
          isInternal: Boolean(req.body?.isInternal),
          deliveryChannel: 'portal',
        });
        if (!inserted) return res.status(404).json({ success: false, message: 'Ticket not found.' });
        return res.json({ success: true, ticket: await getTicket(session.organizationId, ticketId) });
      }

      const created = await createTicket({
        organizationId: session.organizationId,
        organizationSlug: session.organizationSlug,
        input: { ...req.body, channel: 'manual' },
      });
      await trySla(session.organizationId, created.ticket.id);
      await tryRoute(session.organizationId, created.ticket.id);
      return res.status(201).json({ success: true, ticket: await getTicket(session.organizationId, created.ticket.id) });
    }

    if (req.method === 'PATCH') {
      const ticketId = String(req.body?.id || '').trim();
      if (!ticketId) return res.status(400).json({ success: false, message: 'Ticket id is required.' });
      const ticket = await updateTicket({
        organizationId: session.organizationId,
        ticketId,
        patch: {
          status: req.body?.status,
          priority: req.body?.priority,
          assigneeId: req.body?.assigneeId,
          assigneeName: req.body?.assigneeName,
          assigneeEmail: req.body?.assigneeEmail,
        },
      });
      if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });
      return res.json({ success: true, ticket });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (error) {
    console.error('Agent Connect ticket operation failed:', error);
    return res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Ticket operation failed.' });
  }
}
