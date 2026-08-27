const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeMacroInput,
  normalizeMacroActions,
  normalizeShortcut,
  validateTemplateVariables,
  renderMacroBody,
} = require('../lib/macro-domain');

test('normalizes shortcut and macro input', () => {
  const macro = normalizeMacroInput({ name:'  Welcome  ', shortcut:' /Hello ', body:'Hi {{requester.name}}', active:true });
  assert.equal(macro.name, 'Welcome');
  assert.equal(macro.shortcut, '/hello');
  assert.equal(macro.body, 'Hi {{requester.name}}');
});
test('rejects unknown template variables', () => assert.throws(() => validateTemplateVariables('Hi {{customer.phone}}'), /unsupported macro variable/i));
test('renders allowlisted variables', () => {
  const body = renderMacroBody('Hi {{requester.name}} — {{ticket.key}} — {{agent.name}}', { requester:{name:'Ada',email:'ada@example.com'}, ticket:{key:'SUP-000042',subject:'Login'}, agent:{name:'Nora',email:'nora@example.com'} });
  assert.equal(body, 'Hi Ada — SUP-000042 — Nora');
});
test('normalizes supported status priority and assignment actions', () => {
  assert.deepEqual(normalizeMacroActions({ status:'PENDING', priority:'HIGH', teamId:' team-1 ', assigneeMemberId:' member-1 ' }), { status:'pending', priority:'high', teamId:'team-1', assigneeMemberId:'member-1' });
});
test('rejects unsupported actions and member without team', () => {
  assert.throws(() => normalizeMacroActions({ tag:'vip' }), /unsupported macro action/i);
  assert.throws(() => normalizeMacroActions({ assigneeMemberId:'m1' }), /teamId is required/i);
});
test('rejects empty macro name and body', () => {
  assert.throws(() => normalizeMacroInput({ name:' ', body:'Hello' }), /name is required/i);
  assert.throws(() => normalizeMacroInput({ name:'Hello', body:' ' }), /body is required/i);
});
test('shortcut is optional and normalized predictably', () => {
  assert.equal(normalizeShortcut(''), '');
  assert.equal(normalizeShortcut('Welcome Customer'), '/welcome-customer');
});
