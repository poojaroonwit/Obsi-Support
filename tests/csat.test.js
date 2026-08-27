const test = require('node:test');
const assert = require('node:assert/strict');
const { createCsatToken, hashCsatToken, normalizeCsatSubmission, isCsatEligibleStatus } = require('../lib/csat-domain');

test('creates strong opaque tokens and stable hashes', () => {
  const token = createCsatToken();
  assert.ok(token.length >= 40);
  assert.equal(hashCsatToken(token), hashCsatToken(token));
  assert.notEqual(hashCsatToken(token), token);
});

test('accepts ratings 1 through 5 with optional trimmed comment', () => {
  assert.deepEqual(normalizeCsatSubmission({ rating: 5, comment: '  Great help  ' }), { rating: 5, comment: 'Great help' });
  assert.deepEqual(normalizeCsatSubmission({ rating: '1' }), { rating: 1, comment: '' });
});

test('rejects invalid rating values', () => {
  for (const value of [0, 6, 2.5, 'bad', null]) assert.throws(() => normalizeCsatSubmission({ rating: value }), /rating/i);
});

test('limits comments', () => {
  assert.equal(normalizeCsatSubmission({ rating: 4, comment: 'x'.repeat(5000) }).comment.length, 2000);
});

test('surveys are eligible only for resolved or closed tickets', () => {
  assert.equal(isCsatEligibleStatus('resolved'), true);
  assert.equal(isCsatEligibleStatus('closed'), true);
  assert.equal(isCsatEligibleStatus('open'), false);
});
