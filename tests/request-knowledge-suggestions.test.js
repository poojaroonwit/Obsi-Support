const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSuggestionQuery } = require('../lib/knowledgebase/suggestion-query');

test('query combines bounded subject and description without empty noise', () => {
  assert.equal(buildSuggestionQuery({ subject: 'Cannot reset password', description: 'Reset link expired' }), 'Cannot reset password\nReset link expired');
});

test('query excludes requester identity fields and caps length', () => {
  const result = buildSuggestionQuery({ subject: 'Login', description: 'x'.repeat(1000), requesterEmail: 'ada@example.com', requesterName: 'Ada' });
  assert.equal(result.includes('ada@example.com'), false);
  assert.ok(result.length <= 600);
});

test('empty/short noise returns empty query', () => {
  assert.equal(buildSuggestionQuery({ subject: ' a ', description: ' b ' }), '');
});
