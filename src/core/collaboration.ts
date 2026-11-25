import {HocuspocusProvider} from '@hocuspocus/provider';
import * as Y from 'yjs';
import type {ProjectEntry} from './model';
export type Remote=NonNullable<ProjectEntry['remote']>;
export async function api(url:string,path:string,body?:unknown,token?:string){
 const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
 try{const r=await fetch(url.replace(/\/$/,'')+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined,signal:controller.signal});const data=await r.json();if(!r.ok)throw Error(data.error||'协作服务暂时不可用');return data;}finally{clearTimeout(timeout)}
}
export function connect(doc:Y.Doc,remote:Remote,onState:(s:string)=>void,onPeople:(p:any[])=>void,user:{name:string;color:string}) {
 let connected=false,dirty=true,requestId=0;
 const provider=new HocuspocusProvider({url:remote.url.replace(/^http/,'ws')+'/collaboration',name:remote.room,document:doc,token:remote.token,
 onStatus:({status})=>{connected=status==='connected';onState(connected?'正在同步':'离线 · 本地保存');},
 onSynced:()=>{provider.sendStateless(JSON.stringify({type:'persist',requestId:++requestId}));},
 onAuthenticationFailed:()=>{onState('访问已失效');provider.disconnect();},
 onStateless:({payload})=>{try{const message=JSON.parse(payload);if(message.type==='persisted'&&message.requestId===requestId){dirty=false;onState('已同步');}}catch{}},
 onAwarenessUpdate:({states})=>onPeople(states.filter((s:any)=>s.user).map((s:any)=>s.user))});
 provider.setAwarenessField('user',user);
 let timer:ReturnType<typeof setTimeout>;
 const changed=(_u:Uint8Array,origin:unknown)=>{if(origin===provider)return;dirty=true;if(connected)onState('正在同步');clearTimeout(timer);timer=setTimeout(()=>{if(connected)provider.sendStateless(JSON.stringify({type:'persist',requestId:++requestId}));},450)};
 doc.on('update',changed);
 return {provider,close:()=>{clearTimeout(timer);doc.off('update',changed);provider.destroy();},isDirty:()=>dirty};
}
