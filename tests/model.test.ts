import test from 'node:test';import assert from 'node:assert/strict';import * as Y from 'yjs';
import {seedDocument,listScenes,addScene,updateScene,moveScene,fragment,blockNode,snapshot,fromSnapshot,renameCharacter,nextKind} from '../src/core/model';
const clone=(doc:Y.Doc)=>{const b=new Y.Doc();Y.applyUpdate(b,Y.encodeStateAsUpdate(doc));return b};
test('offline concurrent text edits and scene reordering preserve every scene and converge',()=>{
 const a=new Y.Doc();seedDocument(a,'测试');const first=listScenes(a)[0].id;const second=addScene(a,first,{location:'车站',blocks:[{kind:'action',text:'雨落在站台。'}]});const b=clone(a);
 moveScene(a,second,first);
 const text=(fragment(b,second).get(0) as Y.XmlElement).get(0) as Y.XmlText;text.insert(0,'深夜，');
 const sa=Y.encodeStateAsUpdate(a),sb=Y.encodeStateAsUpdate(b);Y.applyUpdate(a,sb);Y.applyUpdate(b,sa);
 assert.deepEqual(snapshot(a),snapshot(b));assert.equal(listScenes(a).length,2);assert.equal(listScenes(a)[0].blocks[0].text,'深夜，雨落在站台。');
});
test('simultaneous insertion and subsequent moves keep a deterministic order',()=>{
 const a=new Y.Doc();seedDocument(a);const first=listScenes(a)[0].id;const b=clone(a);addScene(a,first,{location:'A'});addScene(b,first,{location:'B'});const sa=Y.encodeStateAsUpdate(a),sb=Y.encodeStateAsUpdate(b);Y.applyUpdate(a,sb);Y.applyUpdate(b,sa);assert.deepEqual(listScenes(a),listScenes(b));const list=listScenes(a);moveScene(a,first,list[2].id);assert.equal(listScenes(a).length,3);assert.ok(listScenes(a).every(s=>s.id));
});
test('backup roundtrip preserves notes, types, deleted scenes and author',()=>{
 const doc=new Y.Doc();seedDocument(doc,'备份测试');const s=listScenes(doc)[0];updateScene(doc,s.id,{notes:'动机',summary:'决定离开'});addScene(doc,s.id,{location:'回忆',deleted:true,blocks:[{kind:'dialogue',text:'再见。'}]});const restored=fromSnapshot(snapshot(doc));const a=snapshot(doc),b=snapshot(restored);assert.equal(a.title,b.title);assert.deepEqual(a.scenes.map(({id,order,...rest})=>rest),b.scenes.map(({id,order,...rest})=>rest));
});
test('character rename updates cues, leaves body intact unless explicitly requested',()=>{
 const doc=new Y.Doc();seedDocument(doc);const s=listScenes(doc)[0].id;fragment(doc,s).delete(0,1);fragment(doc,s).insert(0,[blockNode({kind:'character',text:'小林（画外音）'}),blockNode({kind:'dialogue',text:'小林会回来。'})]);renameCharacter(doc,'小林','林');assert.equal(listScenes(doc)[0].blocks[0].text,'林（画外音）');assert.equal(listScenes(doc)[0].blocks[1].text,'小林会回来。');
});
test('screenplay Enter transitions implement the agreed writing flow',()=>{assert.equal(nextKind('character','林'),'dialogue');assert.equal(nextKind('character',''),'action');assert.equal(nextKind('dialogue','你好'),'character');assert.equal(nextKind('parenthetical','低声'),'dialogue');assert.equal(nextKind('transition','切至：'),'scene')});
