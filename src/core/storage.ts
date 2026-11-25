import type {LayoutStyle} from './layout';
import * as Y from 'yjs';
import { IndexeddbPersistence,storeState } from 'y-indexeddb';
import {toBase64,fromBase64} from './icloud-types';
import { listActs,addAct,assignAct,listScenes,LOCAL,ensureSceneNames,newId,seedDocument,meta,fromSnapshot,snapshot,type ProjectEntry,type Script } from './model';
const KEY='changjing-projects-v1';
export const entries=(includeDeleted=false):ProjectEntry[]=>{try{return (JSON.parse(localStorage.getItem(KEY)||'[]') as ProjectEntry[]).filter(e=>includeDeleted||!e.deletedAt)}catch{return []}};
export function saveEntry(entry:ProjectEntry){const list=entries(true).filter(x=>x.id!==entry.id);localStorage.setItem(KEY,JSON.stringify([entry,...list]));}
const recoveryKeys=new WeakMap<IndexeddbPersistence,string>();
type RecoveryItem={id:string;data:string};
function recoveryItems(key:string):RecoveryItem[]{const text=localStorage.getItem(key);return text?JSON.parse(text):[]}
// IndexedDB transactions can still be in flight when a window reloads. A small
// synchronous journal covers that interval; only committed entries are removed.
export async function persistProject(persistence:IndexeddbPersistence){
 const key=recoveryKeys.get(persistence);const committed=new Set(key?recoveryItems(key).map(x=>x.id):[]);
 await storeState(persistence,true);
 if(key){const remaining=recoveryItems(key).filter(x=>!committed.has(x.id));if(remaining.length)localStorage.setItem(key,JSON.stringify(remaining));else localStorage.removeItem(key)}
}
export async function openProject(entry:ProjectEntry,initial?:Script,defaultLayout:LayoutStyle='hollywood'){
 const doc=new Y.Doc();const persistence=new IndexeddbPersistence(`changjing:${entry.id}`,doc);
 await persistence.whenSynced;
 const recoveryKey=`changjing-recovery:${entry.id}`;recoveryKeys.set(persistence,recoveryKey);
 for(const item of recoveryItems(recoveryKey))Y.applyUpdate(doc,fromBase64(item.data),'local-recovery');
 const journal=(update:Uint8Array)=>{try{localStorage.setItem(recoveryKey,JSON.stringify([...recoveryItems(recoveryKey),{id:newId(),data:toBase64(update)}]))}catch{/* IndexedDB still persists; save confirmation comes only after its commit. */}};
 doc.on('update',journal);doc.on('destroy',()=>doc.off('update',journal));
 // A cloud project must start empty; seeding on each device creates duplicate scenes.
 if(!meta(doc).has('title')&&!entry.remote&&!entry.cloud){if(initial){const seed=fromSnapshot(initial);Y.applyUpdate(doc,Y.encodeStateAsUpdate(seed));seed.destroy();}else{seedDocument(doc,entry.title);meta(doc).set('layout',defaultLayout);}}
 if(!entry.remote&&!entry.cloud){ensureSceneNames(doc);if(!meta(doc).has('actFoldersVersion'))doc.transact(()=>{if(!listActs(doc).length&&initial?.acts===undefined){const first=addAct(doc,'第一幕');addAct(doc,'第二幕');addAct(doc,'第三幕');for(const scene of listScenes(doc,true))assignAct(doc,scene.id,first)}meta(doc).set('actFoldersVersion','1')},LOCAL);}
 await persistProject(persistence);
 return {doc,persistence};
}
export function newEntry(title='未命名剧本'):ProjectEntry{return {id:newId(),title,updatedAt:Date.now()};}
export type Version={id:string;name:string;at:number;script:Script};
export function versions(id:string):Version[]{try{return JSON.parse(localStorage.getItem(`versions:${id}`)||'[]')}catch{return []}}
export function saveVersion(id:string,name:string,doc:Y.Doc){const v={id:newId(),name,at:Date.now(),script:snapshot(doc)};localStorage.setItem(`versions:${id}`,JSON.stringify([v,...versions(id)].slice(0,20)));return v;}
function editVersion(projectId:string,versionId:string,name?:string){
 const key=`versions:${projectId}`;
 const list:Version[]=JSON.parse(localStorage.getItem(key)||'[]');
 const index=list.findIndex(v=>v.id===versionId);
 if(index<0)throw Error('版本已不存在');
 if(name===undefined)list.splice(index,1);
 else{if(!name.trim())throw Error('请输入版本名称');list[index]={...list[index],name:name.trim()}}
 localStorage.setItem(key,JSON.stringify(list));
}
export const renameVersion=(projectId:string,id:string,name:string)=>editVersion(projectId,id,name);
export const deleteVersion=(projectId:string,id:string)=>editVersion(projectId,id);
export function download(name:string,data:string,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function trashProject(id:string){const entry=entries(true).find(e=>e.id===id);if(entry)saveEntry({...entry,deletedAt:Date.now()});}
export function restoreProject(id:string){const entry=entries(true).find(e=>e.id===id);if(entry){delete entry.deletedAt;saveEntry(entry)}}
