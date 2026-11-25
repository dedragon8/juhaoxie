import test from 'node:test';import assert from 'node:assert/strict';import * as Y from 'yjs';
import {ICloudSync,ICLOUD_REMOTE,type CloudSyncState} from '../src/core/icloud-sync';
import {toBase64,fromBase64,type CloudReference,type CloudRecord} from '../src/core/icloud-types';
import {seedDocument,addScene,fragment,listScenes,moveScene,snapshot,fromSnapshot,newId} from '../src/core/model';
import {TestCloudStore} from './support/cloud-store';
function text(doc:Y.Doc,id:string){return (fragment(doc,id).get(0) as Y.XmlElement).get(0) as Y.XmlText}
async function setup(){
 const store=new TestCloudStore(),a=new Y.Doc();seedDocument(a,'协作验收');const first=listScenes(a)[0].id;
 const xml=new Y.XmlText();xml.insert(0,'雨落在江边。');(fragment(a,first).get(0) as Y.XmlElement).insert(0,[xml]);
 const second=addScene(a,first,{location:'车站',blocks:[{kind:'action',text:'车站关门了。'}]});
 const ref=await store.request('a','create',{projectId:newId(),title:'协作验收',data:toBase64(Y.encodeStateAsUpdate(a))}) as CloudReference;
 await store.request('a','invite',{ref,email:'b',role:'editor'});
 const b=new Y.Doc(),saved=new Map<string,Uint8Array>(),states=new Map<string,CloudSyncState>();
 const make=(id:string,doc:Y.Doc)=>new ICloudSync({doc,ref:store.ref(ref.zone,id),bridge:store.bridge(id),persist:async()=>{saved.set(id,Y.encodeStateAsUpdate(doc))},onState:s=>states.set(id,s)});
 const sa=make('a',a),sb=make('b',b);await sa.syncOnce();await sb.syncOnce();
 return {store,a,b,sa,sb,first,second,ref,saved,states,make,close:async()=>{await sa.close();await sb.close();a.destroy();b.destroy()}};
}
test('CloudKit transport: simultaneous edits in one paragraph converge without losing either insertion',async()=>{
 const t=await setup();try{t.a.transact(()=>text(t.a,t.first).insert(1,'【甲】'),'a');t.b.transact(()=>text(t.b,t.first).insert(1,'【乙】'),'b');
 await Promise.all([t.sa.syncOnce(),t.sb.syncOnce()]);await t.sa.syncOnce();await t.sb.syncOnce();
 assert.deepEqual(snapshot(t.a),snapshot(t.b));assert.match(text(t.a,t.first).toString(),/【甲】/);assert.match(text(t.a,t.first).toString(),/【乙】/);assert.equal(listScenes(t.a).length,2);
 }finally{await t.close()}
});
test('moving a scene while the other writer edits its body preserves stable scene IDs and content',async()=>{
 const t=await setup();try{moveScene(t.a,t.second,t.first);t.b.transact(()=>text(t.b,t.second).insert(0,'深夜，'),'b');await t.sa.syncOnce();await t.sb.syncOnce();await t.sa.syncOnce();
 assert.deepEqual(snapshot(t.a),snapshot(t.b));assert.equal(listScenes(t.a)[0].id,t.second);assert.equal(text(t.a,t.second).toString(),'深夜，车站关门了。');assert.equal(new Set(listScenes(t.a).map(s=>s.id)).size,2);
 }finally{await t.close()}
});
test('offline reconnect, uncertain acknowledgement, transport and client restart recover from durable local Yjs state',async()=>{
 const t=await setup();let restarted:ICloudSync|undefined;let doc:Y.Doc|undefined;
 try{t.store.offline.add('b');t.b.transact(()=>text(t.b,t.first).insert(0,'离线乙：'),'b');await t.sb.syncOnce();
 // IndexedDB independently persists offline local edits; simulate that durable image.
 const disk=Y.encodeStateAsUpdate(t.b);await t.sb.close();
 t.a.transact(()=>text(t.a,t.first).insert(0,'在线甲：'),'a');t.store.dropNextAck=true;await t.sa.syncOnce();assert.equal(t.states.get('a')!.pending,true);
 const serverDisk=t.store.snapshot();t.store.projects.clear();t.store.restore(serverDisk);t.store.offline.clear();
 doc=new Y.Doc();Y.applyUpdate(doc,disk,ICLOUD_REMOTE);restarted=t.make('b',doc);await restarted.syncOnce();await t.sa.syncOnce();await restarted.syncOnce();
 assert.deepEqual(snapshot(doc),snapshot(t.a));assert.match(text(doc,t.first).toString(),/离线乙：/);assert.match(text(doc,t.first).toString(),/在线甲：/);assert.equal(listScenes(doc).length,2);
 assert.equal(t.states.get('a')!.pending,false);assert.equal(t.states.get('b')!.pending,false);
 }finally{await restarted?.close();doc?.destroy();await t.close()}
});
test('undo tracks only the writer origin; remote text remains after local undo and synchronization',async()=>{
 const t=await setup();const local=Symbol('writer-a');const undo=new Y.UndoManager(fragment(t.a,t.first),{trackedOrigins:new Set([local]),captureTimeout:0});
 try{t.a.transact(()=>text(t.a,t.first).insert(0,'甲新增'),local);t.b.transact(()=>text(t.b,t.first).insert(0,'乙新增'),'writer-b');await t.sb.syncOnce();await t.sa.syncOnce();undo.undo();await t.sa.syncOnce();await t.sb.syncOnce();
 assert.match(text(t.a,t.first).toString(),/乙新增/);assert.doesNotMatch(text(t.a,t.first).toString(),/甲新增/);assert.deepEqual(snapshot(t.a),snapshot(t.b));
 }finally{undo.destroy();await t.close()}
});
test('permission downgrade/revocation never uploads pending offline edits, and cached copies survive',async()=>{
 const t=await setup();try{t.store.offline.add('b');t.b.transact(()=>text(t.b,t.first).insert(0,'私有待保存'),'b');await t.store.request('a','permission',{ref:t.ref,memberID:'b',role:'viewer'});t.store.offline.clear();await t.sb.syncOnce();await t.sa.syncOnce();
 assert.equal(t.states.get('b')!.role,'viewer');assert.doesNotMatch(text(t.a,t.first).toString(),/私有待保存/);assert.match(text(t.b,t.first).toString(),/私有待保存/);
 await assert.rejects(t.store.request('b','push',{ref:t.store.ref(t.ref.zone,'b'),data:toBase64(Y.encodeStateAsUpdate(t.b))}),/read only/);
 await t.store.request('a','revoke',{ref:t.ref,memberID:'b'});await t.sb.syncOnce();assert.equal(t.states.get('b')!.blocked,true);assert.match(text(t.b,t.first).toString(),/私有待保存/);
 }finally{await t.close()}
});
test('cloud version opens as a separate copy and cannot overwrite shared scene identities or text',async()=>{
 const t=await setup();try{const before=snapshot(t.a);await t.store.request('a','version',{ref:t.ref,id:newId(),name:'第一稿',data:toBase64(new TextEncoder().encode(JSON.stringify(before)))});
 const page=await t.store.request('b','pull',{ref:t.store.ref(t.ref.zone,'b')});const version=page.records.find((r:CloudRecord)=>r.kind==='version');const copy=fromSnapshot(JSON.parse(new TextDecoder().decode(fromBase64(version.data))));
 const id=listScenes(copy)[0].id;text(copy,id).insert(0,'副本修改');assert.deepEqual(snapshot(t.a),before);assert.notEqual(id,t.first);copy.destroy();
 }finally{await t.close()}
});
test('failed local persistence never advances cloud token or uploads an unpersisted operation',async()=>{
 const t=await setup();let sync:ICloudSync|undefined;const empty=new Y.Doc();try{let fail=true;const tokens:unknown[]=[];const bridge=t.store.bridge('b');let pushes=0;
 sync=new ICloudSync({doc:empty,ref:t.store.ref(t.ref.zone,'b'),bridge:{request:async(m,a)=>{if(m==='pull')tokens.push(a?.token);if(m==='push')pushes++;return bridge.request(m,a)}},persist:async()=>{if(fail)throw Error('disk full')},onState:()=>{}});
 await sync.syncOnce();assert.equal(pushes,0);fail=false;await sync.syncOnce();assert.deepEqual(tokens,[undefined,undefined]);assert.equal(listScenes(empty).length,2);
 }finally{await sync?.close();empty.destroy();await t.close()}
});
test('collaborator awareness is transported independently and points to the same relative text position',async()=>{
 const t=await setup();try{t.sa.setUser({name:'甲',color:'#ff3399'});t.sa.awareness.setLocalStateField('cursor',{anchor:Y.createRelativePositionFromTypeIndex(text(t.a,t.first),2),head:Y.createRelativePositionFromTypeIndex(text(t.a,t.first),2)});await t.sa.syncOnce();await t.sb.syncOnce();const remote=t.sb.awareness.getStates().get(t.a.clientID)!;
 assert.equal(remote.user.name,'甲');const absolute=Y.createAbsolutePositionFromRelativePosition(remote.cursor.anchor,t.b)!;assert.equal(absolute.index,2);assert.equal(absolute.type,text(t.b,t.first));
 }finally{await t.close()}
});
