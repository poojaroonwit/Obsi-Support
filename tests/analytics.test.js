const test = require('node:test');
const assert = require('node:assert/strict');
const { fillDailySeries, median, normalizeAnalyticsDays, safePercent } = require('../lib/analytics-domain');

test('normalizes supported analytics windows', () => {
  assert.equal(normalizeAnalyticsDays(7), 7);
  assert.equal(normalizeAnalyticsDays('90'), 90);
  assert.equal(normalizeAnalyticsDays(14), 30);
});

test('calculates stable percentages', () => {
  assert.equal(safePercent(8, 10), 80);
  assert.equal(safePercent(1, 3), 33.3);
  assert.equal(safePercent(4, 0), 0);
});

test('calculates median for odd even and empty samples', () => {
  assert.equal(median([9, 1, 5]), 5);
  assert.equal(median([1, 3, 7, 9]), 5);
  assert.equal(median([]), 0);
});

test('fills missing daily trend dates with zero values', () => {
  assert.deepEqual(fillDailySeries('2026-08-26', '2026-08-28', [{ date: '2026-08-27', created: 2, resolved: 1 }]), [
    { date: '2026-08-26', created: 0, resolved: 0 },
    { date: '2026-08-27', created: 2, resolved: 1 },
    { date: '2026-08-28', created: 0, resolved: 0 },
  ]);
});
