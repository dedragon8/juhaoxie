import test from 'node:test';import assert from 'node:assert/strict';import * as Y from 'yjs';
import {fromSnapshot,snapshot,addScene,fragment,listScenes,moveScene} from '../src/core/model';
import {promptSources,saveVideoPrompt,videoPrompts,promptHistory,sourceStatus} from '../src/core/video-prompts';
import {emptyPromptFields,type PromptSpan} from '../src/core/prompt-types';
import {executeAssistant} from '../src/core/assistant';import {encodeDrg,decodeDrg} from '../src/core/drg';
function setup(){const doc=new Y.Doc(),id=addScene(doc,undefined,{blocks:[{kind:'action',text:'她放下手机，望向门口。门外响起脚步声。'},{kind:'dialogue',text:'是谁？'}]});const p=promptSources(doc)[0].paragraphs;const source:PromptSpan[]=p.map((b,i)=>({sceneId:id,paragraphId:b.paragraphId,paragraphIndex:i,start:i?0:2,end:b.text.length,text:b.text.slice(i?0:2),paragraphText:b.text}));return {doc,id,source}}
test('arbitrary cross-paragraph source, multiple shots, stale guards and history',()=>{const {doc,id,source}=setup();const input={expectedRevision:null,source,fields:emptyPromptFields(),prompt:'中近景，缓慢推进。'};const a=saveVideoPrompt(doc,input),b=saveVideoPrompt(doc,input);assert.equal(videoPrompts(doc).length,2);assert.equal(sourceStatus(doc,source),'current');const next=saveVideoPrompt(doc,{...input,id:a.id,expectedRevision:a.revision,prompt:'固定镜头。'});assert.throws(()=>saveVideoPrompt(doc,{...input,id:a.id,expectedRevision:a.revision}),/已被修改/);assert.equal(promptHistory(doc,a.id).length,2);const text=(fragment(doc,id).get(0) as Y.XmlElement).get(0) as Y.XmlText;text.insert(0,'清晨，');assert.equal(sourceStatus(doc,source),'changed');assert.throws(()=>saveVideoPrompt(doc,{...input,id:a.id,expectedRevision:next.revision}),/原文已改变/);assert.equal(videoPrompts(doc).find(p=>p.id===b.id)!.prompt,input.prompt)});
test('jhwrite and version copies remap prompt references without losing history or screenplay',async()=>{const {doc,id,source}=setup();const a=saveVideoPrompt(doc,{expectedRevision:null,source,prompt:'第一版'});saveVideoPrompt(doc,{id:a.id,expectedRevision:a.revision,source,prompt:'第二版'});const other=addScene(doc,id);moveScene(doc,other,id);const file=await decodeDrg(await encodeDrg(snapshot(doc),{documentId:'test',protected:false}));const copy=fromSnapshot(file.script);assert.equal(promptHistory(copy).length,2);assert.equal(sourceStatus(copy,videoPrompts(copy)[0].source),'current');assert.notEqual(videoPrompts(copy)[0].source[0].sceneId,id);assert.deepEqual(listScenes(copy).map(s=>s.blocks.map(b=>b.text)),listScenes(doc).map(s=>s.blocks.map(b=>b.text)))});
test('concurrent prompt edits both survive, AI writes are idempotent and do not modify screenplay',()=>{const {doc,source}=setup();const a=saveVideoPrompt(doc,{expectedRevision:null,source,prompt:'基础'});const peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(doc));saveVideoPrompt(doc,{id:a.id,expectedRevision:a.revision,source,prompt:'甲'});saveVideoPrompt(peer,{id:a.id,expectedRevision:a.revision,source,prompt:'乙'});const u=Y.encodeStateAsUpdate(doc),v=Y.encodeStateAsUpdate(peer);Y.applyUpdate(doc,v);Y.applyUpdate(peer,u);assert.deepEqual(promptHistory(doc).map(p=>p.prompt).sort(),['乙','基础','甲'].sort());assert.deepEqual(snapshot(doc),snapshot(peer));const before=listScenes(doc);const request={projectId:'test',write:true,name:'save_video_prompt',args:{request_id:'video-1',expected_revision:null,source,prompt:'AI 镜头'}};executeAssistant(doc,request,()=>{});executeAssistant(doc,request,()=>{});assert.equal(videoPrompts(doc).length,2);assert.deepEqual(listScenes(doc),before);assert.throws(()=>executeAssistant(doc,{...request,write:false},()=>{}),/未授权/)});

import {inferPromptCharacters,mergeCharacters,removeCharacter,normalizePromptFields} from '../src/core/prompt-composition';
import {composeVideoPrompt} from '../src/core/video-prompts';
test('selection infers off-screen speaker and action mentions without leaking speakers across scene/action boundaries',()=>{
 const doc=new Y.Doc();addScene(doc,undefined,{blocks:[{kind:'character',text:'琳娜'},{kind:'parenthetical',text:'（画外）'},{kind:'dialogue',text:'薇薇站在江边。'},{kind:'action',text:'大王看着琳娜，随后转身。'},{kind:'dialogue',text:'谁？'},{kind:'character',text:'大王'},{kind:'character',text:'王'}]});
 const scene=promptSources(doc)[0];const select=(index:number)=>{const p=scene.paragraphs[index];return [{sceneId:scene.id,paragraphId:p.paragraphId,paragraphIndex:index,start:0,end:p.text.length,text:p.text,paragraphText:p.text}]};doc.getMap('characterDescriptions').set('薇薇','红裙');
 assert.deepEqual(inferPromptCharacters(doc,select(2)),['琳娜','薇薇']);assert.deepEqual(inferPromptCharacters(doc,select(3)),['琳娜','大王']);assert.deepEqual(inferPromptCharacters(doc,select(4)),[]);
 const other=addScene(doc,scene.id,{blocks:[{kind:'dialogue',text:'谁在那？'}]});const p=promptSources(doc).find(s=>s.id===other)!.paragraphs[0];assert.deepEqual(inferPromptCharacters(doc,[{sceneId:other,paragraphId:p.paragraphId,paragraphIndex:0,start:0,end:p.text.length,text:p.text,paragraphText:p.text}]),[]);
 assert.equal(removeCharacter('大王、王、琳娜','王'),'大王、琳娜');assert.equal(mergeCharacters('琳娜（画外音）',['琳娜','大王']),'琳娜（画外音）、大王');
});
test('complete prompt omits absent sections',()=>{const text=composeVideoPrompt({...emptyPromptFields(),characters:'琳娜',content:'放下手机。',shotSize:'中近景',focalLength:'50mm',camera:'平视',sound:'手机轻响'});for(const label of ['人物','画面','镜头','声音/对话'])assert.ok(text.includes(`【${label}】`));assert.ok(!text.includes('待确定'));assert.ok(!text.includes('【光线与色调】'));assert.equal(composeVideoPrompt(emptyPromptFields()),'')});

import {changeVideoPromptState} from '../src/core/video-prompts';
test('hide, show and delete preserve screenplay and history, reject stale operations and survive file copies',()=>{
 const {doc,id,source}=setup(),before=listScenes(doc);const p=saveVideoPrompt(doc,{expectedRevision:null,source,prompt:'镜头不覆盖正文'});
 const hidden=changeVideoPromptState(doc,p.id,p.revision,'hide');assert.equal(videoPrompts(doc).length,0);assert.equal(videoPrompts(doc,true).length,1);assert.equal(videoPrompts(fromSnapshot(snapshot(doc)),true)[0].hidden,true);assert.deepEqual(listScenes(doc),before);
 assert.throws(()=>changeVideoPromptState(doc,p.id,p.revision,'delete'),/已被修改/);const shown=changeVideoPromptState(doc,p.id,hidden.revision,'show');assert.equal(videoPrompts(doc).length,1);
 const text=(fragment(doc,id).get(0) as Y.XmlElement).get(0) as Y.XmlText;text.insert(0,'修改后的原文');changeVideoPromptState(doc,p.id,shown.revision,'delete');assert.equal(videoPrompts(doc,true).length,0);assert.equal(promptHistory(doc,p.id).length,4);assert.ok(listScenes(doc)[0].blocks[0].text.startsWith('修改后的原文'));assert.throws(()=>changeVideoPromptState(doc,p.id,shown.revision,'show'),/已不存在/);
});

import {changeVideoPromptStates} from '../src/core/video-prompts';
test('batch visibility changes are atomic, keep revisions and original text, and reject stale or duplicate targets',()=>{
 const {doc,source}=setup(),original=listScenes(doc);const a=saveVideoPrompt(doc,{expectedRevision:null,source,prompt:'第一镜头'}),b=saveVideoPrompt(doc,{expectedRevision:null,source,prompt:'第二镜头'});
 const b2=saveVideoPrompt(doc,{id:b.id,expectedRevision:b.revision,source,prompt:'别人的更新'}),before=promptHistory(doc);
 assert.throws(()=>changeVideoPromptStates(doc,[a,b],'hide'),/已被修改/);assert.deepEqual(promptHistory(doc),before);assert.equal(videoPrompts(doc).length,2);
 assert.throws(()=>changeVideoPromptStates(doc,[a,a],'delete'),/重复/);assert.deepEqual(promptHistory(doc),before);
 const hidden=changeVideoPromptStates(doc,[a,b2],'hide');assert.equal(videoPrompts(doc).length,0);assert.equal(videoPrompts(doc,true).length,2);assert.deepEqual(listScenes(doc),original);
 const shown=changeVideoPromptStates(doc,hidden,'show');assert.equal(videoPrompts(doc).length,2);changeVideoPromptStates(doc,shown,'delete');assert.equal(videoPrompts(doc,true).length,0);assert.deepEqual(listScenes(doc),original);assert.ok(promptHistory(doc).some(p=>p.prompt==='别人的更新'));
});

test('shots follow current scene, paragraph and selection position; revision updates do not reorder them',()=>{
 const {doc,id,source}=setup();const later=saveVideoPrompt(doc,{expectedRevision:null,source:[source[1]],prompt:'后段'});
 const early=saveVideoPrompt(doc,{expectedRevision:null,source:[source[0]],prompt:'前段'});
 const earlier={...source[0],start:0,text:source[0].paragraphText};const first=saveVideoPrompt(doc,{expectedRevision:null,source:[earlier],prompt:'前段较早位置'});
 assert.deepEqual(videoPrompts(doc).map(p=>p.id),[first.id,early.id,later.id]);
 saveVideoPrompt(doc,{id:early.id,expectedRevision:early.revision,source:[source[0]],prompt:'前段修改'});assert.deepEqual(videoPrompts(doc).map(p=>p.id),[first.id,early.id,later.id]);
 const other=addScene(doc,id,{blocks:[{kind:'action',text:'下一场'}]});const p=promptSources(doc).find(s=>s.id===other)!.paragraphs[0];const final=saveVideoPrompt(doc,{expectedRevision:null,source:[{sceneId:other,paragraphId:p.paragraphId,paragraphIndex:0,start:0,end:p.text.length,text:p.text,paragraphText:p.text}],prompt:'另一场'});
 moveScene(doc,other,id,true);assert.deepEqual(videoPrompts(doc).map(p=>p.id),[final.id,first.id,early.id,later.id]);
 fragment(doc,id).delete(0,1);assert.deepEqual(videoPrompts(doc).slice(0,2).map(p=>p.id),[final.id,later.id]);assert.equal(sourceStatus(doc,source),'missing');
});

test('legacy combined camera field opens as separate editable camera and movement without discarding free text',()=>{
 const old={...emptyPromptFields(),camera:'平视、缓慢推进'};delete old.movement;const fields=normalizePromptFields(old);assert.equal(fields.camera,'平视');assert.equal(fields.movement,'缓慢推进');assert.equal(old.camera,'平视、缓慢推进');assert.equal(normalizePromptFields({...old,camera:'沿着走廊低机位缓缓移动'}).camera,'沿着走廊低机位缓缓移动');assert.equal(normalizePromptFields({...old,movement:'手持'}).camera,old.camera);
});
