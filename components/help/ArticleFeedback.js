import { useState } from 'react';

export default function ArticleFeedback({ organizationSlug, documentId, publicationId }) {
  const [state, setState] = useState({ sending: false, value: '', error: '' });
  const send = async (value) => {
    if (state.sending || state.value) return;
    setState({ sending: true, value: '', error: '' });
    try {
      const response = await fetch('/api/public/knowledge-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationSlug, documentId, publicationId, value }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.available === false) throw new Error('Feedback is temporarily unavailable');
      setState({ sending: false, value, error: '' });
    } catch (error) {
      setState({ sending: false, value: '', error: error.message || 'Unable to send feedback' });
    }
  };
  if (state.value) return <div className="article-feedback is-complete">Thanks for the feedback.</div>;
  return <div className="article-feedback"><span>Was this article helpful?</span><div><button type="button" disabled={state.sending} onClick={() => send('helpful')}>Yes</button><button type="button" disabled={state.sending} onClick={() => send('not_helpful')}>No</button></div>{state.error ? <small>{state.error}</small> : null}</div>;
}
