const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBusinessHoursPolicy, isBusinessMinute, addBusinessMinutes } = require('../lib/business-hours');
const { calculateSlaTargets, DEFAULT_SLA_POLICY } = require('../lib/sla');

const bangkokPolicy = {
  enabled: true,
  timezone: 'Asia/Bangkok',
  schedule: {
    mon: [{ start: '09:00', end: '18:00' }],
    tue: [{ start: '09:00', end: '18:00' }],
    wed: [{ start: '09:00', end: '18:00' }],
    thu: [{ start: '09:00', end: '18:00' }],
    fri: [{ start: '09:00', end: '18:00' }],
    sat: [], sun: [],
  },
  holidays: [],
  targets: DEFAULT_SLA_POLICY,
};

test('normalizes timezone, schedule and targets', () => {
  const policy = normalizeBusinessHoursPolicy(bangkokPolicy);
  assert.equal(policy.timezone, 'Asia/Bangkok');
  assert.deepEqual(policy.schedule.sat, []);
  assert.equal(policy.targets.urgent.firstResponseMinutes, 15);
});

test('rejects invalid timezone and overlapping windows', () => {
  assert.throws(() => normalizeBusinessHoursPolicy({ ...bangkokPolicy, timezone: 'Mars/Olympus' }), /timezone/i);
  assert.throws(() => normalizeBusinessHoursPolicy({ ...bangkokPolicy, schedule: { ...bangkokPolicy.schedule, mon: [{ start:'09:00', end:'12:00' }, { start:'11:00', end:'13:00' }] } }), /overlap/i);
});

test('business minute is interpreted in workspace timezone', () => {
  const policy = normalizeBusinessHoursPolicy(bangkokPolicy);
  assert.equal(isBusinessMinute(new Date('2026-08-28T02:00:00.000Z'), policy), true);
  assert.equal(isBusinessMinute(new Date('2026-08-28T11:00:00.000Z'), policy), false);
});

test('business minutes carry over weekend', () => {
  const policy = normalizeBusinessHoursPolicy(bangkokPolicy);
  const due = addBusinessMinutes(new Date('2026-08-28T10:50:00.000Z'), 15, policy);
  assert.equal(due.toISOString(), '2026-08-31T02:05:00.000Z');
});

test('holidays are skipped', () => {
  const policy = normalizeBusinessHoursPolicy({ ...bangkokPolicy, holidays: ['2026-08-31'] });
  const due = addBusinessMinutes(new Date('2026-08-28T10:50:00.000Z'), 15, policy);
  assert.equal(due.toISOString(), '2026-09-01T02:05:00.000Z');
});

test('SLA targets use business time when enabled', () => {
  const policy = normalizeBusinessHoursPolicy(bangkokPolicy);
  const targets = calculateSlaTargets(new Date('2026-08-28T10:50:00.000Z'), 'urgent', policy);
  assert.equal(targets.firstResponseDueAt.toISOString(), '2026-08-31T02:05:00.000Z');
  assert.equal(targets.resolutionDueAt.toISOString(), '2026-08-31T05:50:00.000Z');
});

test('legacy policy remains elapsed-clock 24x7', () => {
  const targets = calculateSlaTargets(new Date('2026-08-28T10:50:00.000Z'), 'urgent', DEFAULT_SLA_POLICY);
  assert.equal(targets.firstResponseDueAt.toISOString(), '2026-08-28T11:05:00.000Z');
});
