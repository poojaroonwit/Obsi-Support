const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSuggestionQuery, shouldSuggest } = require('../lib/knowledgebase/suggestion-query.cjs');
const { normalizeKnowledgebaseUrl, isKnowledgebaseEnabled } = require('../lib/knowledgebase/config.cjs');
const { sealAccessToken, unsealAccessToken } = require('../lib/outborn/delegated-token');
const { SUPPORT_ACCOUNT_SCOPES, buildAuthorizeUrl } = require('../lib/outborn/user-oauth');

test('knowledge suggestions bound customer text before search', () => {
  const query = buildSuggestionQuery({ subject: ' Login problem ', description: 'x'.repeat(1200) });
  assert.match(query, /^Login problem\n/);
  assert.ok(query.length <= 800);
  assert.equal(shouldSuggest('tiny'), false);
  assert.equal(shouldSuggest('login error'), true);
});

test('knowledge integration is opt-in and validates URL protocol', () => {
  assert.equal(isKnowledgebaseEnabled({ OBSI_KNOWLEDGEBASE_ENABLED: 'false', OBSI_KNOWLEDGEBASE_URL: 'https://kb.example' }), false);
  assert.equal(isKnowledgebaseEnabled({ OBSI_KNOWLEDGEBASE_ENABLED: 'true', OBSI_KNOWLEDGEBASE_URL: 'https://kb.example/' }), true);
  assert.equal(normalizeKnowledgebaseUrl('https://kb.example/'), 'https://kb.example');
  assert.throws(() => normalizeKnowledgebaseUrl('file:///tmp/kb'));
});

test('delegated access token is encrypted at rest in the browser cookie', () => {
  const env = { SESSION_SECRET: 'a-secure-session-secret-that-is-over-32-characters' };
  const sealed = sealAccessToken('sensitive-access-token', env);
  assert.doesNotMatch(sealed, /sensitive-access-token/);
  assert.equal(unsealAccessToken(sealed, env), 'sensitive-access-token');
  assert.equal(unsealAccessToken(`${sealed}tampered`, env), '');
});

test('Support OAuth asks only for approved Knowledgebase scopes', () => {
  assert.match(SUPPORT_ACCOUNT_SCOPES, /knowledge\.read/);
  assert.match(SUPPORT_ACCOUNT_SCOPES, /knowledge\.search/);
  assert.match(SUPPORT_ACCOUNT_SCOPES, /knowledge\.public\.read/);
  assert.doesNotMatch(SUPPORT_ACCOUNT_SCOPES, /knowledge\.write/);
  assert.doesNotMatch(SUPPORT_ACCOUNT_SCOPES, /knowledge\.publish/);
  const url = buildAuthorizeUrl({ issuer: 'https://account.example.com', redirectUri: 'https://support.example.com/api/auth/account/callback', state: 's', nonce: 'n', codeChallenge: 'c' });
  assert.equal(new URL(url).searchParams.get('scope'), SUPPORT_ACCOUNT_SCOPES);
});
