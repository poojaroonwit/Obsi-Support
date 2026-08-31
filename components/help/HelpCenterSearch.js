import { useEffect, useState } from 'react';

export default function HelpCenterSearch({ organizationSlug }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, available: true, results: [] });

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setState({ loading: false, available: true, results: [] });
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true }));
      try {
        const response = await fetch(`/api/public/knowledge-search?organizationSlug=${encodeURIComponent(organizationSlug)}&q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        setState({ loading: false, available: payload.available !== false, results: payload.results || [] });
      } catch (error) {
        if (error?.name !== 'AbortError') setState({ loading: false, available: false, results: [] });
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [organizationSlug, query]);

  return <div className="help-search">
    <div className="help-search-box"><span aria-hidden>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help articles" aria-label="Search help articles"/>{state.loading ? <small>Searching…</small> : null}</div>
    {!state.available ? <div className="help-search-state">Search is temporarily unavailable.</div> : null}
    {state.results.length ? <div className="help-search-results">{state.results.map((item) => <a key={`${item.documentId || ''}:${item.pageId || ''}:${item.sourceUrl || item.url || ''}`} href={item.sourceUrl || item.url || `/help/${encodeURIComponent(organizationSlug)}`}><strong>{item.title || item.documentTitle || 'Article'}</strong>{item.snippet ? <span>{item.snippet}</span> : null}</a>)}</div> : null}
  </div>;
}
