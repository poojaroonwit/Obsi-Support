const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateSlaTargets, evaluateSla } = require('../lib/sla');
const { normalizeTicketInput, applyCustomerReplyState } = require('../lib/ticket-domain');
const { createPortalToken, hashPortalToken } = require('../lib/portal-token');
const { normalizeReturnPath, buildAuthorizeUrl } = require('../lib/outborn/user-oauth');

test('urgent tickets get 15 minute first response and 4 hour resolution targets', () => {
  const targets = calculateSlaTargets(new Date('2026-08-27T10:00:00.000Z'), 'urgent');
  assert.equal(targets.firstResponseDueAt.toISOString(), '2026-08-27T10:15:00.000Z');
  assert.equal(targets.resolutionDueAt.toISOString(), '2026-08-27T14:00:00.000Z');
});
test('SLA reports first response breach independently', () => {
  const result = evaluateSla({ firstResponseDueAt:'2026-08-27T10:15:00.000Z', resolutionDueAt:'2026-08-27T14:00:00.000Z', firstRespondedAt:null, resolvedAt:null }, new Date('2026-08-27T10:30:00.000Z'));
  assert.equal(result.firstResponse,'breached'); assert.equal(result.resolution,'running'); assert.equal(result.overall,'breached');
});
test('ticket input is normalized and customer replies reopen tickets', () => {
  const result = normalizeTicketInput({ subject:'  Cannot sign in  ', description:'  MFA fails  ', requesterName:' Ada ', requesterEmail:' ADA@EXAMPLE.COM ', priority:'URGENT' });
  assert.equal(result.subject,'Cannot sign in'); assert.equal(result.requesterEmail,'ada@example.com'); assert.equal(result.priority,'urgent'); assert.equal(applyCustomerReplyState('resolved'),'open');
});
test('invalid requester email is rejected', () => assert.throws(() => normalizeTicketInput({ subject:'Help', requesterEmail:'invalid' }), /valid requester email/i));
test('portal tokens are random and stored only as hashes', () => { const first=createPortalToken(); const second=createPortalToken(); assert.notEqual(first,second); assert.equal(hashPortalToken(first).length,64); assert.notEqual(hashPortalToken(first),first); });
test('Outborn return path blocks open redirects and authorization uses PKCE', () => {
  assert.equal(normalizeReturnPath('https://evil.example/path'),'/inbox'); assert.equal(normalizeReturnPath('/tickets?status=open'),'/tickets?status=open');
  const url=new URL(buildAuthorizeUrl({issuer:'https://account.example.com',clientId:'outborn-obsi-support-web',redirectUri:'https://support.example.com/api/auth/account/callback',state:'state',nonce:'nonce',codeChallenge:'challenge'}));
  assert.equal(url.pathname,'/api/auth/oauth2/authorize'); assert.equal(url.searchParams.get('code_challenge_method'),'S256');
});
