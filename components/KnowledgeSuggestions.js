import { useEffect, useState } from 'react';

export default function KnowledgeSuggestions({ ticket, onInsert }) {
  const [articles,setArticles]=useState([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{
    if(!ticket?.id||!ticket?.subject)return undefined;
    const controller=new AbortController();setLoading(true);setError('');
    fetch(`/api/knowledgebase/suggestions?q=${encodeURIComponent(ticket.subject)}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async(response)=>{const payload=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(payload.message||'Unable to search knowledge'),{status:response.status,code:payload.code});return payload;})
      .then(payload=>setArticles(payload.articles||[])).catch(cause=>{if(cause.name!=='AbortError')setError(cause.message||'Unable to search knowledge');}).finally(()=>setLoading(false));
    return()=>controller.abort();
  },[ticket?.id,ticket?.subject]);
  if(loading)return <div className="knowledge-suggestions"><span className="hint">Finding related knowledge…</span></div>;
  if(error)return <div className="knowledge-suggestions"><span className="hint">{error}</span>{error.toLowerCase().includes('reconnect')?<a href={`/api/auth/account/start?returnTo=${encodeURIComponent(`/inbox?ticket=${ticket.id}`)}`}>Reconnect</a>:null}</div>;
  if(!articles.length)return null;
  return <div className="knowledge-suggestions"><div className="knowledge-suggestions-head"><strong>Suggested knowledge</strong><span>Public articles only</span></div><div className="knowledge-suggestion-list">{articles.map(article=><div className="knowledge-suggestion" key={article.documentId}><div><strong>{article.title}</strong><p>{article.summary||'Published help article'}</p></div><div><a href={article.helpUrl} target="_blank" rel="noreferrer">Preview</a><button type="button" onClick={()=>onInsert?.(article)}>Insert link</button></div></div>)}</div></div>;
}
