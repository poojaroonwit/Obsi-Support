const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DISABLED, RECOMMENDED, normalizeTicketAgentGovernance,
  redactTicketForAgent, validateAutomatedTicketAction,
} = require('../lib/ticket-agent-governance');

test('switching Agent Governance off disables every optional control', () => {
  assert.deepEqual(normalizeTicketAgentGovernance({enabled:false,...RECOMMENDED}), DISABLED);
  assert.deepEqual(normalizeTicketAgentGovernance(undefined), DISABLED);
});
test('switching on recommends controls, but each can be customized', () => {
  assert.deepEqual(normalizeTicketAgentGovernance({enabled:true}), {enabled:true,...RECOMMENDED});
  assert.equal(normalizeTicketAgentGovernance({enabled:true,requireHumanReview:false}).requireHumanReview,false);
});
test('automated reply is blocked but internal note and human path remain available', () => {
  const ticket = {agentGovernance:{enabled:true,...RECOMMENDED}};
  assert.throws(()=>validateAutomatedTicketAction(ticket,'reply',{isInternal:false}), /human review/);
  assert.doesNotThrow(()=>validateAutomatedTicketAction(ticket,'reply',{isInternal:true}));
});
test('automated close is blocked while ordinary updates are allowed', () => {
  const ticket = {agentGovernance:{enabled:true,...RECOMMENDED}};
  assert.throws(()=>validateAutomatedTicketAction(ticket,'update',{status:'resolved'}),/Only a human/);
  assert.doesNotThrow(()=>validateAutomatedTicketAction(ticket,'update',{priority:'high'}));
});
test('Agent Connect reads hide requester identity without hiding it from the ticket object', () => {
  const ticket={id:'t',requesterName:'Alice',requesterEmail:'alice@example.com',agentGovernance:{enabled:true,...RECOMMENDED},messages:[{authorType:'customer',authorName:'Alice',authorEmail:'alice@example.com'}]};
  const safe=redactTicketForAgent(ticket);
  assert.equal(safe.requesterEmail,'');
  assert.equal(safe.messages[0].authorEmail,'');
  assert.equal(ticket.requesterEmail,'alice@example.com');
  assert.equal(redactTicketForAgent({...ticket,agentGovernance:DISABLED}).requesterEmail,'alice@example.com');
});
