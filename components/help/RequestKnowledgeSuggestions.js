import { useEffect, useMemo, useState } from 'react';

export default function RequestKnowledgeSuggestions({ organizationSlug, subject, description }) {
  const [state, setState] = useState({ loading: false, available: true, suggestions: [] });
  const key = useMemo(() => `${subject || ''}\n${description || ''}`.trim(), [subject, description]);

  useEffect(() => {
    if (key.length < 8) {
      setState({ loading: false, available: true, suggestions: [] });
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true }));
      try {
        const response = await fetch('/api/public/knowledge-suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizationSlug, subject, description }),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        setState({ loading: false, available: payload.available !== false, suggestions: payload.suggestions || [] });
      } catch (error) {
        if (error?.name !== 'AbortError') setState({ loading: false, available: false, suggestions: [] });
      }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [organizationSlug, key, subject, description]);

  if (!state.loading && !state.suggestions.length && state.available) return null;
  return <aside className="knowledge-suggestions" aria-live="polite">
    <div className="knowledge-suggestions-heading">
      <div><span className="eyebrow">Suggested answers</span><strong>These articles may help before you submit</strong></div>
      {state.loading ? <span className="knowledge-muted">Searching…</span> : null}
    </div>
    {!state.available ? <p className="knowledge-muted">Knowledge suggestions are temporarily unavailable. You can still submit your request.</p> : null}
    {state.suggestions.length ? <div className="knowledge-suggestion-list">{state.suggestions.map((item) => <a key={`${item.documentId}:${item.publicationId}:${item.url}`} className="knowledge-suggestion" href={item.url || `/help/${encodeURIComponent(organizationSlug)}`} target="_blank" rel="noreferrer"><strong>{item.title}</strong>{item.snippet ? <span>{item.snippet}</span> : null}<small>Open article ↗</small></a>)}</div> : null}
  </aside>;
}
