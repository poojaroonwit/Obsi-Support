import Head from 'next/head';
import ArticleFeedback from '../../../components/help/ArticleFeedback';
const { publicKnowledgeDocument } = require('../../../lib/knowledgebase/client.cjs');

export default function HelpCenterArticlePage({ organizationSlug, document, available }) {
  if (!available) return <main className="help-center-page"><section className="help-center-content"><div className="help-unavailable"><h1>Article temporarily unavailable</h1><p>You can still contact support.</p><a className="primary-button" href={`/request/${encodeURIComponent(organizationSlug)}`}>Contact support</a></div></section></main>;
  if (!document) return <main className="help-center-page"><section className="help-center-content"><div className="help-empty"><h1>Article not found</h1><a href={`/help/${encodeURIComponent(organizationSlug)}`}>Back to Help Center</a></div></section></main>;
  return <>
    <Head><title>{document.title} · Help Center</title><meta name="description" content={document.summary || document.title}/><meta name="robots" content="index,follow"/></Head>
    <main className="help-center-page">
      <header className="help-article-header"><a href={`/help/${encodeURIComponent(organizationSlug)}`}>← Help Center</a><small>Published {new Date(document.publishedAt).toLocaleDateString()}</small></header>
      <article className="help-article"><div className="help-article-title"><span className="eyebrow">Knowledge article</span><h1>{document.title}</h1>{document.summary ? <p>{document.summary}</p> : null}</div>{(document.pages || []).map((page) => <section key={`${page.pageId || page.id}:${page.revisionId}`} className="help-article-section"><h2>{page.title}</h2><div className="help-article-html" dangerouslySetInnerHTML={{ __html: page.contentHtml || '' }}/></section>)}<ArticleFeedback organizationSlug={organizationSlug} documentId={document.id} publicationId={document.publicationId}/></article>
      <footer className="help-article-footer"><span>Still need help?</span><a className="primary-button" href={`/request/${encodeURIComponent(organizationSlug)}`}>Contact support</a></footer>
    </main>
  </>;
}

export async function getServerSideProps({ params, res }) {
  const organizationSlug = String(params.organizationSlug || '');
  const documentSlug = String(params.documentSlug || '');
  const result = await publicKnowledgeDocument(organizationSlug, documentSlug);
  if (result.available && !result.document) res.statusCode = 404;
  return { props: { organizationSlug, document: result.document || null, available: result.available } };
}
