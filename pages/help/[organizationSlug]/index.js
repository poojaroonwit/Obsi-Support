import Head from 'next/head';
import HelpCenterSearch from '../../../components/help/HelpCenterSearch';
const { publicKnowledgeCollections } = require('../../../lib/knowledgebase/client.cjs');

export default function HelpCenterHome({ organizationSlug, organization, collections, available }) {
  const title = organization?.name ? `${organization.name} Help Center` : 'Help Center';
  return <>
    <Head><title>{title}</title><meta name="robots" content="index,follow"/></Head>
    <main className="help-center-page">
      <header className="help-center-hero"><a className="help-brand" href={`/help/${encodeURIComponent(organizationSlug)}`}><span className="portal-logo">S</span><span><small>Obsi Support</small><strong>{title}</strong></span></a><HelpCenterSearch organizationSlug={organizationSlug}/></header>
      <section className="help-center-content">
        {!available ? <div className="help-unavailable"><h1>Help Center temporarily unavailable</h1><p>You can still contact support while knowledge articles are unavailable.</p><a className="primary-button" href={`/request/${encodeURIComponent(organizationSlug)}`}>Contact support</a></div> : null}
        {available && !collections.length ? <div className="help-empty"><h1>No published articles yet</h1><p>Published support articles will appear here.</p></div> : null}
        {collections.map((collection) => <section className="help-collection" key={collection.id}><div className="help-collection-heading"><div><h2>{collection.name}</h2>{collection.description ? <p>{collection.description}</p> : null}</div><span>{collection.documents?.length || 0} articles</span></div><div className="help-article-grid">{(collection.documents || []).map((document) => <a className="help-article-card" key={document.id} href={`/help/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(document.slug)}`}><strong>{document.title}</strong>{document.summary ? <p>{document.summary}</p> : null}<small>Read article →</small></a>)}</div></section>)}
      </section>
    </main>
  </>;
}

export async function getServerSideProps({ params }) {
  const organizationSlug = String(params.organizationSlug || '');
  const result = await publicKnowledgeCollections(organizationSlug);
  return { props: { organizationSlug, organization: result.organization || null, collections: result.collections || [], available: result.available } };
}
