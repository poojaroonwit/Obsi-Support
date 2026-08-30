import HelpCenterArticle from '../../../components/help/HelpCenterArticle';
import { getHelpCenterArticle } from '../../../lib/knowledgebase/help-center';

export default function HelpCenterArticlePage({ organizationSlug, available, document }) {
  if (!available) {
    return (
      <main className="help-center-shell">
        <section className="help-state-card">
          <h1>Help article temporarily unavailable</h1>
          <p>You can still contact support.</p>
          <a href={`/request/${encodeURIComponent(organizationSlug)}`}>Create support request</a>
        </section>
      </main>
    );
  }
  return (
    <main className="help-center-shell">
      <HelpCenterArticle organizationSlug={organizationSlug} document={document} />
    </main>
  );
}

export async function getServerSideProps({ params, res }) {
  const organizationSlug = String(params?.organizationSlug || '').trim();
  const documentSlug = String(params?.documentSlug || '').trim();
  const state = await getHelpCenterArticle({ organizationSlug, documentSlug });
  if (state.available && !state.document) {
    res.statusCode = 404;
  }
  return {
    props: {
      organizationSlug,
      available: state.available,
      document: state.document || null,
    },
  };
}
