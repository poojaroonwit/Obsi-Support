import { useMemo, useState } from 'react';
import AppShell from '../components/AppShell';

const VARIABLES=['{{requester.name}}','{{requester.email}}','{{ticket.key}}','{{ticket.subject}}','{{agent.name}}','{{agent.email}}'];
const blankMacro=()=>({id:'',name:'',shortcut:'',body:'',active:true,actions:{status:'',priority:'',teamId:'',assigneeMemberId:''}});
const toEditor=(macro)=>({id:macro.id,name:macro.name,shortcut:macro.shortcut||'',body:macro.body,active:macro.active!==false,actions:{status:macro.actions?.status||'',priority:macro.actions?.priority||'',teamId:macro.actions?.teamId||'',assigneeMemberId:macro.actions?.assigneeMemberId||''}});

export async function getServerSideProps({req}){
  const {getSessionFromRequest}=require('../lib/auth');
  const {listMacros}=require('../lib/macro-repository');
  const {getRoutingSnapshot}=require('../lib/routing-repository');
  const session=getSessionFromRequest(req);
  if(!session)return{redirect:{destination:'/login',permanent:false}};
  try{
    const [macros,routing]=await Promise.all([listMacros(session.organizationId),getRoutingSnapshot(session.organizationId)]);
    return{props:JSON.parse(JSON.stringify({session,initialMacros:macros,routing,dataError:''}))};
  }catch(error){
    console.error('Macro workspace load failed:',error);
    return{props:JSON.parse(JSON.stringify({session,initialMacros:[],routing:{teams:[],rules:[]},dataError:'Database is not ready. Run npm run db:migrate after deploying macros.'}))};
  }
}

const request=async(url,options={})=>{const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.message||'Macro operation failed.');return payload;};

export default function Macros({session,initialMacros,routing,dataError}){
  const [macros,setMacros]=useState(initialMacros);
  const [editor,setEditor]=useState(initialMacros[0]?toEditor(initialMacros[0]):blankMacro());
  const [search,setSearch]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [saving,setSaving]=useState(false);
  const visible=useMemo(()=>macros.filter((macro)=>!search||`${macro.name} ${macro.shortcut}`.toLowerCase().includes(search.toLowerCase())),[macros,search]);
  const selectedTeam=(routing.teams||[]).find((team)=>team.id===editor.actions.teamId);
  const members=(selectedTeam?.members||[]).filter((member)=>member.active);
  const refresh=async(id)=>{const payload=await request('/api/macros');setMacros(payload.macros||[]);if(id){const found=(payload.macros||[]).find((macro)=>macro.id===id);if(found)setEditor(toEditor(found));}};
  const updateAction=(key,value)=>setEditor((current)=>({...current,actions:{...current.actions,[key]:value,...(key==='teamId'?{assigneeMemberId:''}:{})}}));
  const insertVariable=(value)=>setEditor((current)=>({...current,body:`${current.body}${current.body?' ':''}${value}`}));
  const save=async()=>{setSaving(true);setError('');setNotice('');try{const actions=Object.fromEntries(Object.entries(editor.actions).filter(([,value])=>String(value||'').trim()));const body={name:editor.name,shortcut:editor.shortcut,body:editor.body,active:editor.active,actions};const payload=editor.id?await request(`/api/macros/${editor.id}`,{method:'PATCH',body:JSON.stringify(body)}):await request('/api/macros',{method:'POST',body:JSON.stringify(body)});await refresh(payload.macro.id);setNotice('Macro saved.');}catch(e){setError(e.message);}finally{setSaving(false);}};
  const remove=async()=>{if(!editor.id||!window.confirm('Delete this macro?'))return;setSaving(true);setError('');try{await request(`/api/macros/${editor.id}`,{method:'DELETE'});await refresh();setEditor(blankMacro());setNotice('Macro deleted.');}catch(e){setError(e.message);}finally{setSaving(false);}};
  return <AppShell session={session}><section className="workspace-card macro-workspace"><header className="workspace-header"><div><span className="eyebrow">Agent productivity</span><h1>Macros</h1><p>Build reusable replies and optional ticket actions. Macros never send or change a ticket automatically.</p></div><button className="secondary-button" onClick={()=>setEditor(blankMacro())}>New macro</button></header>{dataError?<div className="config-banner">{dataError}</div>:null}{error?<div className="config-banner">{error}</div>:null}{notice?<div className="macro-notice">{notice}</div>:null}<div className="macro-grid"><aside className="macro-library"><label className="search-box macro-search"><span>⌕</span><input placeholder="Search macros" value={search} onChange={(e)=>setSearch(e.target.value)}/></label><div className="macro-list">{visible.length?visible.map((macro)=><button key={macro.id} className={`macro-list-item ${editor.id===macro.id?'selected':''}`} onClick={()=>setEditor(toEditor(macro))}><div><strong>{macro.name}</strong>{macro.shortcut?<code>{macro.shortcut}</code>:null}</div><span className={macro.active?'macro-active':'macro-inactive'}>{macro.active?'Active':'Off'}</span></button>):<div className="routing-empty">No macros yet.</div>}</div></aside><section className="macro-editor"><div className="macro-editor-row"><label><span>Name</span><input value={editor.name} onChange={(e)=>setEditor({...editor,name:e.target.value})} placeholder="Welcome response"/></label><label><span>Shortcut</span><input value={editor.shortcut} onChange={(e)=>setEditor({...editor,shortcut:e.target.value})} placeholder="/welcome"/></label><label className="macro-active-toggle"><input type="checkbox" checked={editor.active} onChange={(e)=>setEditor({...editor,active:e.target.checked})}/><span>Active</span></label></div><label className="macro-body-field"><span>Reply body</span><textarea rows={10} value={editor.body} onChange={(e)=>setEditor({...editor,body:e.target.value})} placeholder="Hi {{requester.name}}, ..."/></label><div className="macro-variables"><strong>Variables</strong>{VARIABLES.map((variable)=><button key={variable} type="button" onClick={()=>insertVariable(variable)}>{variable}</button>)}</div><div className="macro-actions-panel"><div><h3>Suggested ticket actions</h3><p>These are staged in the composer. The agent must explicitly apply them.</p></div><div className="macro-action-grid"><label><span>Status</span><select value={editor.actions.status} onChange={(e)=>updateAction('status',e.target.value)}><option value="">No change</option><option value="new">New</option><option value="open">Open</option><option value="pending">Pending</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select></label><label><span>Priority</span><select value={editor.actions.priority} onChange={(e)=>updateAction('priority',e.target.value)}><option value="">No change</option><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label><span>Team</span><select value={editor.actions.teamId} onChange={(e)=>updateAction('teamId',e.target.value)}><option value="">No change</option>{(routing.teams||[]).filter((team)=>team.active||team.id===editor.actions.teamId).map((team)=><option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label><span>Assignee</span><select disabled={!editor.actions.teamId} value={editor.actions.assigneeMemberId} onChange={(e)=>updateAction('assigneeMemberId',e.target.value)}><option value="">Unassigned / no change</option>{members.map((member)=><option key={member.id} value={member.id}>{member.name}</option>)}</select></label></div></div><footer className="macro-editor-actions">{editor.id?<button className="danger-ghost" onClick={remove} disabled={saving}>Delete</button>:<span/>}<button className="primary-button" onClick={save} disabled={saving||!editor.name.trim()||!editor.body.trim()}>{saving?'Saving…':'Save macro'}</button></footer></section></div></section></AppShell>;
}
