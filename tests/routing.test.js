const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRoutingConditions,
  ruleMatchesTicket,
  selectRoutingRule,
  chooseLeastLoadMember,
  normalizeCapacity,
} = require('../lib/routing-domain');

test('normalizes supported routing conditions', () => {
  assert.deepEqual(normalizeRoutingConditions({ channels: ['EMAIL', 'portal'], priorities: ['URGENT', 'high'] }), {
    channels: ['email', 'portal'], priorities: ['urgent', 'high'],
  });
});

test('rejects unknown routing condition keys', () => {
  assert.throws(() => normalizeRoutingConditions({ language: ['th'] }), /unsupported routing condition/i);
});

test('routing rule matches channel and priority and empty conditions match all', () => {
  assert.equal(ruleMatchesTicket({ channel: 'email', priority: 'urgent' }, { channels: ['email'], priorities: ['urgent', 'high'] }), true);
  assert.equal(ruleMatchesTicket({ channel: 'portal', priority: 'urgent' }, { channels: ['email'] }), false);
  assert.equal(ruleMatchesTicket({ channel: 'portal', priority: 'normal' }, {}), true);
});

test('selects the first enabled matching rule by sort order', () => {
  const rules = [
    { id: 'r3', enabled: true, sortOrder: 30, conditions: {}, teamId: 'general' },
    { id: 'r1', enabled: true, sortOrder: 10, conditions: { channels: ['email'] }, teamId: 'email' },
    { id: 'r0', enabled: false, sortOrder: 1, conditions: {}, teamId: 'disabled' },
  ];
  assert.equal(selectRoutingRule({ channel: 'email', priority: 'normal' }, rules).id, 'r1');
  assert.equal(selectRoutingRule({ channel: 'portal', priority: 'normal' }, rules).id, 'r3');
});

test('normalizes capacity and excludes inactive or zero-capacity members', () => {
  assert.equal(normalizeCapacity('5'), 5);
  assert.equal(normalizeCapacity(0), 0);
  const chosen = chooseLeastLoadMember([
    { id: 'inactive', active: false, capacity: 10, load: 0 },
    { id: 'zero', active: true, capacity: 0, load: 0 },
    { id: 'ok', active: true, capacity: 3, load: 2 },
  ]);
  assert.equal(chosen.id, 'ok');
});

test('least-load selection uses load ratio, then raw load, then stable id', () => {
  const chosen = chooseLeastLoadMember([
    { id: 'c', active: true, capacity: 10, load: 5 },
    { id: 'b', active: true, capacity: 4, load: 1 },
    { id: 'a', active: true, capacity: 8, load: 2 },
  ]);
  assert.equal(chosen.id, 'b');
  const tie = chooseLeastLoadMember([
    { id: 'b', active: true, capacity: 4, load: 1 },
    { id: 'a', active: true, capacity: 4, load: 1 },
  ]);
  assert.equal(tie.id, 'a');
});

test('returns null when no member is eligible', () => {
  assert.equal(chooseLeastLoadMember([{ id: 'x', active: false, capacity: 10, load: 0 }]), null);
});

test('members at or above capacity are not eligible for automatic assignment', () => {
  const chosen = chooseLeastLoadMember([
    { id: 'full', active: true, capacity: 2, load: 2 },
    { id: 'available', active: true, capacity: 4, load: 3 },
  ]);
  assert.equal(chosen.id, 'available');
  assert.equal(chooseLeastLoadMember([{ id: 'full', active: true, capacity: 1, load: 1 }]), null);
});
