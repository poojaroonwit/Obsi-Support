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

const getHelpCenterHome = async ({ organizationSlug, publicClient = publicKnowledgeCollections, env, fetchImpl } = {}) => {
  const result = await publicClient({ organizationSlug, env, fetchImpl });
  if (!result.available) return { available: false, organization: null, collections: [], errorCode: result.errorCode || 'KNOWLEDGE_UNAVAILABLE' };
  const value = Array.isArray(result.collections) ? result.collections : [];
  return { available: true, organization: result.organization || null, collections: value, errorCode: '' };
};

const getHelpCenterArticle = async ({ organizationSlug, documentSlug, publicClient = publicKnowledgeDocument, env, fetchImpl } = {}) => {
  const result = await publicClient({ organizationSlug, documentSlug, env, fetchImpl });
  if (!result.available) return { available: false, document: null, errorCode: result.errorCode || 'KNOWLEDGE_UNAVAILABLE' };
  return { available: true, document: normalizePublishedDocument(result.document), errorCode: '' };
};

module.exports = { getHelpCenterArticle, getHelpCenterHome, normalizePublishedDocument };
