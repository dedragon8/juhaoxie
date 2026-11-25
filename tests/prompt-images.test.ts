import test from 'node:test';import assert from 'node:assert/strict';import * as Y from 'yjs';
import {addScene,snapshot,fromSnapshot,validateScript} from '../src/core/model';
import {saveVideoPrompt,promptSources,videoPrompts} from '../src/core/video-prompts';
import {emptyPromptFields,validateVideoPrompts} from '../src/core/prompt-types';
import {validatePromptImages,type PromptImage} from '../src/core/prompt-images';
import {executeAssistant} from '../src/core/assistant';import {encodeDrg,decodeDrg} from '../src/core/drg';
const image:PromptImage={id:'image-1',name:'参考图1',filename:'test.png',width:1,height:1,dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJXcAAAAASUVORK5CYII='};
test('reference image survives project transfer, revision edits and authorized image reads',async()=>{
 const doc=new Y.Doc();addScene(doc,undefined,{blocks:[{kind:'action',text:'她走进房间。'}]});doc.getMap('promptImages').set(image.id,image);
 const scene=promptSources(doc)[0],p=scene.paragraphs[0],source=[{sceneId:scene.id,paragraphId:p.paragraphId,paragraphIndex:0,start:0,end:p.text.length,text:p.text,paragraphText:p.text}];
 const first=saveVideoPrompt(doc,{expectedRevision:null,source,fields:{characters:'@参考图1 人物',movement:'缓慢推进'},referenceImageIds:[image.id],prompt:'参考 @参考图1'});
 const next=saveVideoPrompt(doc,{id:first.id,expectedRevision:first.revision,source,fields:{content:'新画面'},prompt:'已更新'});assert.deepEqual(next.referenceImageIds,[image.id]);
 const data=await decodeDrg(await encodeDrg(snapshot(doc),{documentId:'image-test',protected:false})),copy=fromSnapshot(data.script);assert.deepEqual(snapshot(copy).promptImages,[image]);assert.deepEqual(videoPrompts(copy)[0].referenceImageIds,[image.id]);
 const call=(name:string,args={})=>executeAssistant(copy,{name,args,projectId:'test',write:false},()=>{});
 assert.deepEqual((call('read_prompt_sources') as any).referenceImages,[{id:image.id,name:image.name,filename:image.filename,width:1,height:1}]);assert.equal((call('read_prompt_image',{image_id:image.id}) as any).mimeType,'image/png');assert.equal((call('read_prompt_image',{image_id:image.id}) as any).data,image.dataUrl.split(',')[1]);assert.throws(()=>call('read_prompt_image',{image_id:'other'}),/找不到/);
 assert.throws(()=>validateScript({...data.script,promptImages:[]}),/参考图缺失/);
 const legacy={...first,fields:{...emptyPromptFields()}};delete legacy.fields.movement;validateVideoPrompts([legacy]);
 doc.destroy();copy.destroy();
});
test('reference storage rejects remote images, SVG, oversized input and conflicting identifiers',()=>{
 validatePromptImages([image]);for(const dataUrl of ['https://example.com/image.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,'+'A'.repeat(1500000)])assert.throws(()=>validatePromptImages([{...image,dataUrl}]),/参考图/);
 assert.throws(()=>validatePromptImages([image,image]),/参考图/);assert.throws(()=>validatePromptImages([{...image,width:100000}]),/参考图/);
});
