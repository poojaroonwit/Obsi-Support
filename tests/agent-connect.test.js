const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { bearerFromRequest, organizationFromUserInfo, sessionFromUserInfo } = require('../lib/outborn/agent-connect-auth');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Agent Connect bearer parsing never accepts cookies or non-bearer authorization', () => {
  assert.equal(bearerFromRequest({ headers: { authorization: 'Bearer account-token' } }), 'account-token');
  assert.equal(bearerFromRequest({ headers: { authorization: 'Basic abc' } }), '');
  assert.equal(bearerFromRequest({ headers: { cookie: 'obsi_support_session=session-token' } }), '');
});

test('Account userinfo is narrowed to one organization-scoped Support identity', () => {
  const userinfo = {
    sub: 'user-1',
    email: 'agent@example.com',
    name: 'Support Agent',
    organizations: [{ id: 'org-1', slug: 'acme', name: 'Acme' }],
  };
  assert.deepEqual(organizationFromUserInfo(userinfo), { id: 'org-1', slug: 'acme', name: 'Acme' });
  assert.deepEqual(sessionFromUserInfo(userinfo), {
    sub: 'user-1',
    email: 'agent@example.com',
    name: 'Support Agent',
    organizationId: 'org-1',
    organizationSlug: 'acme',
    organizationName: 'Acme',
  });
  assert.equal(sessionFromUserInfo({ sub: 'user-1', email: 'agent@example.com' }), null);
});

test('Agent Connect endpoints use the bearer verifier and tenant-scoped repository operations', () => {
  const probe = read('pages/api/agent-connect/index.js');
  const tickets = read('pages/api/agent-connect/tickets.js');
  assert.match(probe, /requireAgentConnect/);
  assert.match(probe, /obsi-support/);
  assert.match(tickets, /requireAgentConnect/);
  assert.match(tickets, /session\.organizationId/);
  assert.match(tickets, /listTickets/);
  assert.match(tickets, /createTicket/);
  assert.match(tickets, /updateTicket/);
  assert.match(tickets, /addAgentMessage/);
  assert.doesNotMatch(probe, /requireAgent\(/);
  assert.doesNotMatch(tickets, /requireAgent\(/);
});
