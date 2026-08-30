const test = require('node:test');
const assert = require('node:assert/strict');
const { getHelpCenterArticle, getHelpCenterHome } = require('../lib/knowledgebase/help-center');

test('Help Center projects public collections from Knowledgebase only', async () => {
  const result = await getHelpCenterHome({
    organizationSlug: 'acme',
    publicClient: async () => ({ available: true, collections: [{ id: 'c1', name: 'Getting started' }] }),
  });
  assert.equal(result.available, true);
  assert.deepEqual(result.collections.map((item) => item.id), ['c1']);
});

test('Knowledgebase outage returns an unavailable Help Center state instead of throwing', async () => {
  const result = await getHelpCenterHome({
    organizationSlug: 'acme',
    publicClient: async () => ({ available: false, collections: [], errorCode: 'HTTP_503' }),
  });
  assert.deepEqual(result, { available: false, organization: null, collections: [], errorCode: 'HTTP_503' });
});

test('article projection requires immutable publication metadata', async () => {
  const result = await getHelpCenterArticle({
    organizationSlug: 'acme',
    documentSlug: 'reset-password',
    publicClient: async () => ({ available: true, document: { id: 'd1', slug: 'reset-password', title: 'Reset password', publicationId: 'pub-1', pages: [] } }),
  });
  assert.equal(result.document.publicationId, 'pub-1');
});
