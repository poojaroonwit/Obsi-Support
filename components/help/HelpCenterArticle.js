export default function HelpCenterArticle({ document, organizationSlug }) {
  if (!document) return <div className="help-empty">Article not found.</div>;
  return (
    <article className="help-article" data-publication-id={document.publicationId}>
      <a className="help-back" href={`/help/${encodeURIComponent(organizationSlug)}`}>← Help Center</a>
      <header>
        <h1>{document.title}</h1>
        {document.summary ? <p>{document.summary}</p> : null}
      </header>
      <div className="help-article-pages">
        {document.pages.map((page) => (
          <section id={page.slug || page.pageId} key={`${document.publicationId}:${page.pageId}:${page.revisionId}`}>
            <h2>{page.title}</h2>
            <div className="help-rich-text" dangerouslySetInnerHTML={{ __html: page.contentHtml || '' }} />
          </section>
        ))}
      </div>
      <footer>
        <span>Published knowledge</span>
        <a href={`/request/${encodeURIComponent(organizationSlug)}`}>Still need help? Contact support</a>
      </footer>
    </article>
  );
}
