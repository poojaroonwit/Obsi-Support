const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeKnowledgebaseUrl, knowledgebaseEnabled } = require('../lib/knowledgebase/config');
const { safeKnowledgeCall } = require('../lib/knowledgebase/client');

test('empty Knowledgebase URL disables integration without throwing', () => {
  assert.equal(normalizeKnowledgebaseUrl(''), '');
  assert.equal(knowledgebaseEnabled({ OBSI_KNOWLEDGEBASE_ENABLED: 'true', OBSI_KNOWLEDGEBASE_URL: '' }), false);
});

test('only http and https Knowledgebase URLs are accepted', () => {
  assert.equal(normalizeKnowledgebaseUrl('https://kb.example.com/'), 'https://kb.example.com');
  assert.throws(() => normalizeKnowledgebaseUrl('file:///tmp/kb'), /http/i);
});

test('fail-open wrapper returns unavailable instead of throwing', async () => {
  const result = await safeKnowledgeCall(async () => { throw Object.assign(new Error('down'), { code: 'ECONNREFUSED' }); });
  assert.deepEqual(result, { available: false, value: null, errorCode: 'ECONNREFUSED' });
});
