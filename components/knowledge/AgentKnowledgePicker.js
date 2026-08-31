import { useEffect, useState } from 'react';

const boundedExcerpt = (item) => String(item.snippet || item.contentText || '').replace(/\s+/g, ' ').trim().slice(0, 320);
const sourceUrl = (item) => String(item.sourceUrl || item.url || '').trim();

export default function AgentKnowledgePicker({ ticketId, onInsert }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [state, setState] = useState({ loading: false, available: true, results: [] });

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setState({ loading: false, available: true, results: [] });
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true }));
      try {
        const response = await fetch(`/api/tickets/${encodeURIComponent(ticketId)}/knowledge-search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        setState({ loading: false, available: payload.available !== false, results: payload.results || [] });
      } catch (error) {
        if (error?.name !== 'AbortError') setState({ loading: false, available: false, results: [] });
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [open, query, ticketId]);

  const insert = (item, excerpt) => {
    const title = String(item.title || item.documentTitle || 'Knowledge article');
    const url = sourceUrl(item);
    const body = excerpt && boundedExcerpt(item)
      ? `${boundedExcerpt(item)}\n\n${title}${url ? ` — ${url}` : ''}`
      : `${title}${url ? ` — ${url}` : ''}`;
    onInsert(body);
    setOpen(false);
  };

  return <div className="agent-knowledge-picker">
    <button type="button" className="knowledge-picker-trigger" onClick={() => setOpen((value) => !value)}>Knowledge</button>
    {open ? <div className="knowledge-picker-panel">
      <div className="knowledge-picker-head"><strong>Insert knowledge</strong><button type="button" onClick={() => setOpen(false)} aria-label="Close knowledge picker">×</button></div>
      <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search articles" aria-label="Search knowledge articles"/>
      {state.loading ? <span className="knowledge-muted">Searching…</span> : null}
      {!state.available ? <p className="knowledge-muted">Knowledge search is unavailable. Replying still works normally.</p> : null}
      {state.results.length ? <div className="knowledge-picker-results">{state.results.map((item, index) => <article key={`${item.documentId || ''}:${item.pageId || ''}:${index}`}><strong>{item.title || item.documentTitle || 'Knowledge article'}</strong>{boundedExcerpt(item) ? <p>{boundedExcerpt(item)}</p> : null}<div><button type="button" onClick={() => insert(item, false)}>Insert link</button><button type="button" onClick={() => insert(item, true)}>Excerpt + link</button></div></article>)}</div> : null}
    </div> : null}
  </div>;
}
