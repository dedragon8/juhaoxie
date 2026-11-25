import {useSyncExternalStore} from 'react';
import {cloudProjectKey,type CloudReference} from './icloud-types';
import type {ProjectEntry} from './model';
export type ProtectedProject={id:string;cloud?:CloudReference};
export type SecurityState={projects:ProtectedProject[];locked:boolean;ready:boolean;error?:string};
declare global{interface Window{securityBridge?:{status:()=>Promise<Omit<SecurityState,'ready'>>;set:(options:{id:string;protected:boolean;cloud?:CloudReference})=>Promise<Omit<SecurityState,'ready'>>}}}
const KEY='juhaoxie-security-zone-v1',listeners=new Set<()=>void>();
let state:SecurityState={projects:[],locked:false,ready:false};
try{const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);if(!Array.isArray(saved.projects)||saved.projects.some((p:any)=>!p||typeof p.id!=='string'))throw Error();state.projects=saved.projects;state.locked=!!saved.locked}}catch{state.locked=true;state.error='安全区配置无法读取，已暂停联网接入'}
const emit=()=>listeners.forEach(fn=>fn());
const persist=()=>localStorage.setItem(KEY,JSON.stringify({projects:state.projects,locked:state.locked}));
export function useSecurity(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>{listeners.delete(fn)}},()=>state)}
export function protectedProject(id?:string,ref?:CloudReference){return state.locked||!!id&&state.projects.some(p=>p.id===id)||!!ref&&state.projects.some(p=>p.cloud&&cloudProjectKey(p.cloud)===cloudProjectKey(ref))}
export function assertProjectAccess(id?:string,ref?:CloudReference){if(!state.ready||protectedProject(id,ref))throw Error('此剧本位于安全区，禁止 iCloud 和 AI 接入')}
export function assertCloudAccess(method:string,args:Record<string,any>={}){if(['account','projects'].includes(method))return;assertProjectAccess(args.projectId,args.ref)}
let initialization:Promise<void>|undefined;
export function initializeSecurity(){return initialization??=(async()=>{try{if(window.securityBridge){let native=await window.securityBridge.status();if(state.locked||native.locked){state={...state,locked:true};throw Error('安全区配置无法读取，已暂停联网接入')}for(const p of state.projects)if(!native.projects.some(n=>n.id===p.id))native=await window.securityBridge.set({...p,protected:true});state={...native,ready:true}}else state={...state,ready:true};persist()}catch(e){state={...state,locked:true,ready:true,error:String(e)}}emit()})()}
export async function setProjectProtection(entry:ProjectEntry,enabled:boolean){
 if(!state.ready||state.locked)throw Error(state.error||'安全区尚未就绪');
 if(enabled){state={...state,projects:[...state.projects.filter(p=>p.id!==entry.id),{id:entry.id,...(entry.cloud?{cloud:entry.cloud}:{})}]};emit();}
 // Persist the renderer guard first; native guard independently persists and checks every request.
 if(enabled)persist();
 const next=window.securityBridge?await window.securityBridge.set({id:entry.id,protected:enabled,cloud:entry.cloud}):{...state,projects:enabled?state.projects:state.projects.filter(p=>p.id!==entry.id)};
 state={...next,ready:true};persist();emit();
}
