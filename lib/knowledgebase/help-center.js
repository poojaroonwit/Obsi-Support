const { publicKnowledgeCollections, publicKnowledgeDocument } = require('./client');

const normalizePublishedDocument = (document) => {
  if (!document || !document.publicationId) return null;
  return {
    id: document.id,
    slug: document.slug,
    title: document.title || 'Untitled article',
    summary: document.summary || '',
    publicationId: document.publicationId,
    publishedAt: document.publishedAt || '',
    pages: Array.isArray(document.pages) ? document.pages : [],
  };
};

const supportHelpUrl = ({ organizationSlug, sourceUrl, documentSlug }) => {
  const org = encodeURIComponent(String(organizationSlug || '').trim());
  let slug = String(documentSlug || '').trim();
  let hash = '';
  const source = String(sourceUrl || '').trim();
  const match = source.match(/^\/knowledge\/([^#?]+)(#[^?]*)?$/);
  if (match) {
    slug = decodeURIComponent(match[1]);
    hash = match[2] || '';
  }
  if (!org || !slug) return '';
  return `/help/${org}/${encodeURIComponent(slug)}${hash}`;
};

const normalizeSearchResult = (organizationSlug, item) => ({
  documentId: item.documentId,
  pageId: item.pageId || null,
  title: item.title || 'Knowledge article',
  snippet: item.snippet || '',
  score: Number(item.score || 0),
  publicationId: item.publicationId || null,
  revisionId: item.revisionId || '',
  url: supportHelpUrl({ organizationSlug, sourceUrl: item.sourceUrl }),
  visibility: item.visibility || 'support_public',
});

const getHelpCenterHome = async ({ organizationSlug, publicClient = publicKnowledgeCollections, env, fetchImpl } = {}) => {
  const result = await publicClient({ organizationSlug, env, fetchImpl });
  if (!result.available) return { available: false, organization: null, collections: [], errorCode: result.errorCode || 'KNOWLEDGE_UNAVAILABLE' };
  const value = Array.isArray(result.collections) ? result.collections : [];
  return { available: true, organization: result.organization || null, collections: value, errorCode: '' };
};

const getHelpCenterArticle = async ({ organizationSlug, documentSlug, publicClient = publicKnowledgeDocument, env, fetchImpl } = {}) => {
  const result = await publicClient({ organizationSlug, documentSlug, env, fetchImpl });
  if (!result.available) return { available: false, organization: null, document: null, errorCode: result.errorCode || 'KNOWLEDGE_UNAVAILABLE' };
  return { available: true, organization: result.organization || null, document: normalizePublishedDocument(result.document), errorCode: '' };
};

module.exports = { getHelpCenterArticle, getHelpCenterHome, normalizePublishedDocument, normalizeSearchResult, supportHelpUrl };
