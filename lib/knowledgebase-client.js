const API='/api/knowledgebase/v1';
export class SupportKnowledgebaseError extends Error{constructor(status,payload={}){super(payload.message||`Knowledgebase request failed (${status})`);this.status=status;this.code=payload.code||'KNOWLEDGEBASE_ERROR';}}
const get=async(path)=>{const response=await fetch(`${API}${path}`,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new SupportKnowledgebaseError(response.status,payload);return payload;};
export const supportKnowledgebase={
  search:(query,{visibility='',limit=10}={})=>get(`/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(limit)}${visibility?`&visibility=${encodeURIComponent(visibility)}`:''}`),
  document:(id)=>get(`/documents/${encodeURIComponent(id)}`),
  collections:()=>get('/collections'),
  documents:(collectionId='')=>get(`/documents${collectionId?`?collectionId=${encodeURIComponent(collectionId)}`:''}`),
};
export const publicHelpUrl=({knowledgebaseBaseUrl,organizationSlug,documentSlug})=>`${String(knowledgebaseBaseUrl||'').replace(/\/+$/,'')}/help/${encodeURIComponent(organizationSlug)}/${encodeURIComponent(documentSlug)}`;
