import { useEffect, useState } from 'react';

export default function HelpCenterSearch({ organizationSlug }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, available: true, results: [] });

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) {
      setState({ loading: false, available: true, results: [] });
      return undefined;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setState((current) => ({ ...current, loading: true }));
      try {
        const response = await fetch(`/api/public/knowledge-search?organizationSlug=${encodeURIComponent(organizationSlug)}&q=${encodeURIComponent(normalized)}`, { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        setState({ loading: false, available: payload.available !== false, results: Array.isArray(payload.results) ? payload.results : [] });
      } catch (error) {
        if (error.name !== 'AbortError') setState({ loading: false, available: false, results: [] });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [organizationSlug, query]);

  return (
    <section className="help-search" aria-label="Search help articles">
      <label htmlFor="help-search-input">How can we help?</label>
      <input id="help-search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help articles" autoComplete="off" />
      {state.loading ? <p className="help-muted">Searching…</p> : null}
      {!state.loading && !state.available ? <p className="help-unavailable">Help search is temporarily unavailable. You can still contact support.</p> : null}
      {!state.loading && state.available && query.trim().length >= 2 && !state.results.length ? <p className="help-muted">No matching articles.</p> : null}
      {state.results.length ? (
        <div className="help-search-results">
          {state.results.map((item) => (
            <a href={item.url} key={`${item.publicationId || item.documentId}:${item.pageId || ''}`}>
              <strong>{item.title}</strong>
              {item.snippet ? <span>{item.snippet}</span> : null}
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
