import HelpCenterSearch from '../../../components/help/HelpCenterSearch';
import { getHelpCenterHome } from '../../../lib/knowledgebase/help-center';

export default function HelpCenterHome({ organizationSlug, organization, available, collections }) {
  return (
    <main className="help-center-shell">
      <header className="help-center-hero">
        <div>
          <span className="help-eyebrow">Obsi Support</span>
          <h1>{organization?.name ? `${organization.name} Help Center` : 'Help Center'}</h1>
          <p>Find published answers or contact support if you still need help.</p>
        </div>
        <a className="help-contact-button" href={`/request/${encodeURIComponent(organizationSlug)}`}>Contact support</a>
      </header>

      <HelpCenterSearch organizationSlug={organizationSlug} />

      {!available ? (
        <section className="help-state-card">
          <h2>Help articles are temporarily unavailable</h2>
          <p>You can still create a support request.</p>
          <a href={`/request/${encodeURIComponent(organizationSlug)}`}>Create support request</a>
        </section>
      ) : collections.length ? (
        <section className="help-collections" aria-label="Help categories">
          <div className="help-section-head">
            <h2>Browse categories</h2>
            <span>{collections.length} categories</span>
          </div>
          <div className="help-collection-grid">
            {collections.map((collection) => (
              <div className="help-collection-card" key={collection.id}>
                <strong>{collection.name}</strong>
                {collection.description ? <p>{collection.description}</p> : <p>Search this Help Center for published articles in this category.</p>}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="help-state-card">
          <h2>No published help articles yet</h2>
          <p>Support is still available whenever you need it.</p>
        </section>
      )}
    </main>
  );
}

export async function getServerSideProps({ params }) {
  const organizationSlug = String(params?.organizationSlug || '').trim();
  const state = await getHelpCenterHome({ organizationSlug });
  return {
    props: {
      organizationSlug,
      organization: state.organization || null,
      available: state.available,
      collections: state.collections || [],
    },
  };
}
