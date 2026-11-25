import test from 'node:test';import assert from 'node:assert/strict';import * as Y from 'yjs';
import {addAct,assignAct,removeAct,listActs,seedDocument,listScenes,fragment,blockNode,snapshot,fromSnapshot,moveScene,addScene} from '../src/core/model';
import {executeAssistant,ASSISTANT_ORIGIN} from '../src/core/assistant';
test('acts survive backups; assigning/removing a concurrent act never removes or duplicates scenes',()=>{
 const a=new Y.Doc();seedDocument(a);const id=listScenes(a)[0].id,act=addAct(a,'第一幕');assignAct(a,id,act);const other=addScene(a,id);const b=new Y.Doc();Y.applyUpdate(b,Y.encodeStateAsUpdate(a));
 removeAct(a,act);assignAct(b,other,act);fragment(b,id).insert(0,[blockNode({kind:'action',text:'另一人写下的雨。'})]);moveScene(b,other,id);
 const u=Y.encodeStateAsUpdate(a),v=Y.encodeStateAsUpdate(b);Y.applyUpdate(a,v);Y.applyUpdate(b,u);assert.deepEqual(snapshot(a),snapshot(b));assert.equal(listScenes(a).length,2);assert.equal(listActs(a).length,0);assert.ok(listScenes(a).every(s=>!s.actId));assert.equal(listScenes(a).find(s=>s.id===id)?.blocks[0].text,'另一人写下的雨。');
 const next=addAct(a,'结局');assignAct(a,id,next);const copy=snapshot(fromSnapshot(snapshot(a)));assert.deepEqual(copy.acts,snapshot(a).acts);assert.equal(copy.scenes.find(s=>s.blocks[0].text==='另一人写下的雨。')?.actId,next);
});
test('assistant preserves format, rejects stale paragraphs and retries idempotently across restart',()=>{
 const doc=new Y.Doc();seedDocument(doc);const id=listScenes(doc)[0].id;const f=fragment(doc,id);f.delete(0,1);f.insert(0,[blockNode({kind:'dialogue',text:'我们走吧。',runs:[{text:'我们走吧。',fontFamily:'PingFang SC'}]})]);
 const call=(name:string,args:any,write=true)=>executeAssistant(doc,{name,args,write,projectId:'test'},()=>{} ) as any;
 const paragraph=call('read_scene',{scene_id:id}).paragraphs[0];const request={request_id:'edit-1',scene_id:id,paragraph_id:paragraph.paragraph_id,paragraph_index:0,expected_text:paragraph.text,text:'我们明天走吧。'};
 call('replace_paragraph',request);assert.equal(listScenes(doc)[0].blocks[0].kind,'dialogue');assert.equal(listScenes(doc)[0].blocks[0].text,'我们明天走吧。');assert.ok(listScenes(doc)[0].blocks[0].runs?.some(r=>r.fontFamily==='PingFang SC'));
 assert.throws(()=>call('replace_paragraph',{...request,request_id:'stale'}),/已被修改/);assert.throws(()=>call('replace_paragraph',{...request,request_id:'different',paragraph_id:'wrong'}),/位置已改变/);assert.throws(()=>call('replace_paragraph',{...request,request_id:'no-access'},false),/未授权/);
 call('replace_paragraph',request);const create={request_id:'scene-1',blocks:[{kind:'action',text:'河面渐渐平静。'}]};const created=call('create_scene',create);call('create_scene',create);assert.equal(listScenes(doc).length,2);
 const restored=new Y.Doc();Y.applyUpdate(restored,Y.encodeStateAsUpdate(doc));assert.deepEqual(executeAssistant(restored,{name:'create_scene',args:create,projectId:'test',write:true},()=>{}),created);assert.equal(listScenes(restored).length,2);assert.throws(()=>call('create_scene',{...create,name:'不同操作'}),/不同操作/);
});
test('local undo does not undo assistant edits',()=>{
 const doc=new Y.Doc();seedDocument(doc);const id=listScenes(doc)[0].id,f=fragment(doc,id);f.delete(0,1);f.insert(0,[blockNode({kind:'action',text:'雨停了。'})]);const undo=new Y.UndoManager(f,{trackedOrigins:new Set(['writer'])});
 const t=(f.get(0) as Y.XmlElement).get(0) as Y.XmlText;doc.transact(()=>t.insert(0,'清晨，'),'writer');undo.stopCapturing();
 const paragraph=(executeAssistant(doc,{name:'read_scene',args:{scene_id:id},projectId:'x',write:false},()=>{}) as any).paragraphs[0];executeAssistant(doc,{name:'replace_paragraph',projectId:'x',write:true,args:{request_id:'a',scene_id:id,paragraph_id:paragraph.paragraph_id,paragraph_index:0,expected_text:paragraph.text,text:paragraph.text+'天亮了。'}},()=>{});undo.undo();assert.equal(t.toString(),'雨停了。天亮了。');assert.ok(!undo.trackedOrigins.has(ASSISTANT_ORIGIN));
});
