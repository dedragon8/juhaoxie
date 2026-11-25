import * as Y from 'yjs';
import {Awareness,applyAwarenessUpdate,encodeAwarenessUpdate,removeAwarenessStates} from 'y-protocols/awareness';
import {CloudFailure,fromBase64,toBase64,type CloudBridge,type CloudPage,type CloudRecord,type CloudReference,type CloudRole} from './icloud-types';

// Never use LOCAL/null: remote transactions must not enter a writer's undo stack.
export const ICLOUD_REMOTE=Symbol('icloud-remote');
export type CloudSyncState={message:string;role:CloudRole;blocked:boolean;pending:boolean};
export interface CloudSyncOptions {
 doc:Y.Doc;ref:CloudReference;bridge:CloudBridge;
 persist:()=>Promise<void>;
 onState:(state:CloudSyncState)=>void;
 onVersions?:(records:CloudRecord[])=>void;
 onPeople?:(users:{name:string;color:string}[])=>void;
}

/** Immutable Yjs updates are stored in CloudKit. The local Y.Doc is the durable
 * outbox: after a crash we pull the cloud state and send its missing operations.
 * Cloud tokens are deliberately session-only, so a crash cannot skip an update.
 */
export class ICloudSync {
 readonly awareness:Awareness;
 private cloud=new Y.Doc();private token:string|undefined;
 private dirty=true;private generation=0;private stopped=false;private busy?:Promise<void>;
 private timer?:ReturnType<typeof setTimeout>;private backoff=4000;private blocked=false;
 private role:CloudRole;private presenceDirty=true;private lastPresence=0;
 private presence=new Map<string,{clientID:number;at:number}>();
 private versionRecords=new Map<string,CloudRecord>();
 private onUpdate=(_u:Uint8Array,origin:unknown)=>{if(origin===ICLOUD_REMOTE)return;this.dirty=true;this.generation++;this.emit('本地修改待同步');this.schedule(1200)};
 private onAwareness=()=>{this.presenceDirty=true;this.people()};
 constructor(private options:CloudSyncOptions){
  this.role=options.ref.role;this.awareness=new Awareness(options.doc);
  options.doc.on('update',this.onUpdate);this.awareness.on('update',this.onAwareness);
 }
 private emit(message:string){if(!this.stopped)this.options.onState({message,role:this.role,blocked:this.blocked,pending:this.dirty})}
 private people(){this.options.onPeople?.([...this.awareness.getStates().values()].filter(s=>s.user).map(s=>s.user))}
 private async persist(){try{await this.options.persist()}catch{throw new CloudFailure('local-save','本地保存失败 · 请立即导出备份；尚未确认云端保存')}}
 setUser(user:{name:string;color:string}){this.awareness.setLocalStateField('user',user)}
 start(){this.emit('正在连接 iCloud');this.schedule(0)}
 private schedule(ms:number){if(this.stopped||this.blocked)return;clearTimeout(this.timer);this.timer=setTimeout(()=>{void this.syncOnce().finally(()=>this.schedule(this.backoff))},ms)}
 retry(){if(this.stopped)return;this.blocked=false;this.backoff=4000;this.schedule(0)}
 syncOnce():Promise<void>{
  if(this.stopped||this.blocked)return Promise.resolve();if(this.busy)return this.busy;
  this.busy=this.exchange().finally(()=>{this.busy=undefined});return this.busy;
 }
 private async exchange(){
  const {bridge,ref,doc}=this.options;
  try {
   const page=await bridge.request('pull',{ref,token:this.token}) as CloudPage;if(this.stopped)return;
   if(page.deleted.some(id=>id.startsWith('u-')))throw new CloudFailure('integrity','云端修改记录缺失；已保留本地文稿，请先打开独立副本');
   this.role=page.role;
   // Validate the entire batch before applying any of it to the live editor.
   const updates=page.records.filter(r=>r.kind==='update').map(r=>fromBase64(r.data));
   for(const update of updates)Y.decodeUpdate(update);
   doc.transact(()=>{for(const update of updates){Y.applyUpdate(this.cloud,update,ICLOUD_REMOTE);Y.applyUpdate(doc,update,ICLOUD_REMOTE)}},ICLOUD_REMOTE);
   await this.persist();if(this.stopped)return;
   this.token=page.token; // Advance only after local durable storage succeeds.
   for(const record of page.records){
    if(record.kind==='version')this.versionRecords.set(record.id,record);
    if(record.kind==='presence'&&record.clientID!==doc.clientID&&record.clientID!==undefined){
     this.presence.set(record.id,{clientID:record.clientID,at:record.at});
     if(Date.now()-record.at<25000){try{applyAwarenessUpdate(this.awareness,fromBase64(record.data),ICLOUD_REMOTE)}catch{/* Presence is disposable; document updates are not. */}}
    }
   }
   for(const id of page.deleted){const p=this.presence.get(id);if(p)removeAwarenessStates(this.awareness,[p.clientID],ICLOUD_REMOTE);this.presence.delete(id);this.versionRecords.delete(id)}
   for(const [id,p] of this.presence)if(Date.now()-p.at>25000){removeAwarenessStates(this.awareness,[p.clientID],ICLOUD_REMOTE);this.presence.delete(id)}
   this.options.onVersions?.([...this.versionRecords.values()].sort((a,b)=>b.at-a.at));this.people();
   if(this.role==='viewer'){
    // Keep pre-existing offline edits locally, but never upload them as a viewer.
    this.blocked=false;this.emit('iCloud · 只读');this.backoff=4000;return;
   }
   if(this.dirty){
    const update=Y.encodeStateAsUpdate(doc,Y.encodeStateVector(this.cloud));
    const version=this.generation;
    await this.persist();if(this.stopped)return;
    const decoded=Y.decodeUpdate(update);
    if(decoded.structs.length||decoded.ds.clients.size)await bridge.request('push',{ref,data:toBase64(update)});
    if(this.stopped)return;
    Y.applyUpdate(this.cloud,update,ICLOUD_REMOTE);
    if(version===this.generation)this.dirty=false;
   }
   this.emit(this.dirty?'本地修改待同步':'iCloud 已保存');this.backoff=4000;
   // Presence failure must never change the document's durable-save result.
   if(this.presenceDirty||Date.now()-this.lastPresence>10000){
    this.presenceDirty=false;this.lastPresence=Date.now();
    try{await bridge.request('presence',{ref,clientID:doc.clientID,data:toBase64(encodeAwarenessUpdate(this.awareness,[doc.clientID]))})}catch{this.presenceDirty=true}
   }
  } catch(error){
   if(this.stopped)return;
   const e=error as CloudFailure;
   if(e.code==='token-expired'){this.token=undefined;this.backoff=1000;this.emit('正在重新核对云端文稿');return}
   this.blocked=['permission','account-changed','no-account','not-configured','integrity','security-zone'].includes(e.code);
   this.backoff=Math.max(Math.min(this.backoff*2,60000),(e.retryAfter||0)*1000);
   this.emit(this.blocked||e.code==='local-save'?e.message:`iCloud 待重试${e.code==='quota'?'（空间不足）':''} · 请查看本地保存状态`);
  }
 }
 async close(){
  this.stopped=true;clearTimeout(this.timer);this.options.doc.off('update',this.onUpdate);
  this.awareness.off('update',this.onAwareness);this.awareness.destroy();
  await this.busy;this.cloud.destroy();
 }
}
