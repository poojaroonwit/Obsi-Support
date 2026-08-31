const { requireAgent } = require('../../../lib/auth');
const { readKnowledgebaseAccessToken } = require('../../../lib/outborn/knowledgebase-token');

const baseUrl = () => {
  const value=String(process.env.OBSI_KNOWLEDGEBASE_BASE_URL||'').trim().replace(/\/+$/,'');
  if(!value) throw Object.assign(new Error('OBSI_KNOWLEDGEBASE_BASE_URL is not configured'),{statusCode:503});
  const url=new URL(value); if(process.env.NODE_ENV==='production'&&url.protocol!=='https:') throw Object.assign(new Error('Knowledgebase must use HTTPS'),{statusCode:500}); return value;
};
const allowedRoot=new Set(['search','documents','collections','public']);
export default async function handler(req,res){
  if(req.method!=='GET') return res.status(405).json({success:false,message:'Support Knowledgebase proxy is read-only'});
  const session=requireAgent(req,res); if(!session) return null;
  const token=readKnowledgebaseAccessToken(req); if(!token) return res.status(401).json({success:false,code:'KNOWLEDGEBASE_REAUTH_REQUIRED',message:'Reconnect Obsi Support to Outborn Account to enable Knowledgebase.'});
  const path=(Array.isArray(req.query.path)?req.query.path:[req.query.path]).map(value=>String(value||'').trim()).filter(Boolean);
  if(path[0]!=='v1'||!allowedRoot.has(path[1])||path.some(value=>value==='..'||value.includes('/')||value.includes('\\'))) return res.status(404).json({success:false,message:'Unsupported Knowledgebase route'});
  try{
    const target=new URL(`/api/${path.map(encodeURIComponent).join('/')}`,`${baseUrl()}/`);
    for(const [key,raw] of Object.entries(req.query)){if(key==='path')continue;for(const value of(Array.isArray(raw)?raw:[raw]))if(value!==undefined)target.searchParams.append(key,String(value));}
    const response=await fetch(target,{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'}});
    const text=await response.text(); res.status(response.status); res.setHeader('Content-Type',response.headers.get('content-type')||'application/json'); return res.send(text||'{}');
  }catch(error){console.error('Knowledgebase proxy failed:',error);return res.status(error.statusCode||502).json({success:false,code:'KNOWLEDGEBASE_PROXY_ERROR',message:error.message||'Knowledgebase request failed'});}
}
