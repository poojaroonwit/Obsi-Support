const { requireAgent } = require('../../../lib/auth');
const { readKnowledgebaseAccessToken } = require('../../../lib/outborn/knowledgebase-token');

const baseUrl=()=>{const value=String(process.env.OBSI_KNOWLEDGEBASE_BASE_URL||'').trim().replace(/\/+$/,'');if(!value)throw Object.assign(new Error('OBSI_KNOWLEDGEBASE_BASE_URL is not configured'),{statusCode:503});return value;};
const kbGet=async(path,token)=>{const response=await fetch(`${baseUrl()}${path}`,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(payload.message||`Knowledgebase request failed (${response.status})`),{statusCode:response.status,code:payload.code});return payload;};

export default async function handler(req,res){
  if(req.method!=='GET')return res.status(405).json({success:false,message:'Method not allowed'});
  const session=requireAgent(req,res);if(!session)return null;
  const token=readKnowledgebaseAccessToken(req);if(!token)return res.status(401).json({success:false,code:'KNOWLEDGEBASE_REAUTH_REQUIRED',message:'Reconnect Obsi Support to Outborn Account to search knowledge.'});
  const query=String(req.query.q||'').trim();if(!query)return res.status(200).json({success:true,articles:[]});
  try{
    const search=await kbGet(`/api/v1/search?q=${encodeURIComponent(query)}&visibility=support_public&limit=6`,token);
    const articles=[];const seen=new Set();
    for(const result of search.results||[]){
      if(seen.has(result.documentId))continue;seen.add(result.documentId);
      const detail=await kbGet(`/api/v1/documents/${encodeURIComponent(result.documentId)}`,token);
      const document=detail.document;if(!document?.slug)continue;
      articles.push({documentId:document.id,title:document.title,summary:document.summary||result.snippet||'',score:result.score||0,helpUrl:`${baseUrl()}/help/${encodeURIComponent(session.organizationSlug)}/${encodeURIComponent(document.slug)}`});
      if(articles.length>=4)break;
    }
    return res.status(200).json({success:true,articles});
  }catch(error){console.error('Knowledge suggestions failed:',error);return res.status(error.statusCode||502).json({success:false,code:error.code||'KNOWLEDGEBASE_SUGGESTIONS_FAILED',message:error.message||'Unable to search knowledge'});}
}
