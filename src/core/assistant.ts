import {validateAgentPrompt} from './prompt-policy';
import {promptImages} from './prompt-images';
import filmSkill from '../generated/prompt-skill.json';
import {promptSources,videoPrompts,sourceStatus,saveVideoPrompt} from './video-prompts';
import type {PromptSpan,PromptFields} from './prompt-types';
import * as Y from 'yjs';
import {KINDS,addScene,fragment,listScenes,snapshot,sceneMap,type Script} from './model';
export const ASSISTANT_ORIGIN='juhaoxie-assistant';
export type AssistantCall={epoch?:number;explicit?:boolean;projectId:string;name:string;args:Record<string,unknown>;write:boolean};
export type AssistantState={epoch?:number;appEnabled?:boolean;appWrite?:boolean;enabled:boolean;projectId:string;allowWrite:boolean;clients:string[];lastCall:string;lastError:string;config:{command:string;args:string[];env:Record<string,string>}};
declare global{interface Window{assistantBridge?:{activate:(projectId:string)=>Promise<AssistantState>;status:()=>Promise<AssistantState>;configure:(options:{enabled:boolean;projectId?:string;allowWrite?:boolean})=>Promise<AssistantState>;onRequest:(cb:(request:AssistantCall)=>Promise<unknown>)=>()=>void}}}
function text(value:unknown,label:string,max=200000){if(typeof value!=='string'||value.length>max)throw Error(`${label}无效`);return value}
export function executeAssistant(doc:Y.Doc,request:AssistantCall,saveVersion:(name:string,script:Script)=>void){
 const {name,args}=request;if(!args||typeof args!=='object'||Array.isArray(args))throw Error('参数无效');
 if(name==='get_video_prompt_skill')return filmSkill;
 if(name==='read_prompt_image'){const image=promptImages(doc).find(i=>i.id===args.image_id);if(!image)throw Error('找不到参考图');const [header,data]=image.dataUrl.split(',');return {name:image.name,mimeType:header.slice(5,-7),data}}
 if(name==='read_prompt_sources')return {promptSkill:filmSkill,referenceImages:promptImages(doc).map(({dataUrl,...image})=>image),project:{title:snapshot(doc).title,storySynopsis:snapshot(doc).storySynopsis,characterDescriptions:snapshot(doc).characterDescriptions,promptStyle:snapshot(doc).promptStyle},scenes:promptSources(doc),prompts:videoPrompts(doc).map(p=>({...p,status:sourceStatus(doc,p.source)}))};
 if(name==='read_script'){const script=snapshot(doc);return {...script,promptImages:script.promptImages?.map(({dataUrl,...image})=>image),scenes:script.scenes.filter(s=>args.include_hidden===true||!s.deleted)}}
 if(name==='read_scene'){const scene=listScenes(doc,true).find(s=>s.id===args.scene_id);if(!scene)throw Error('找不到场景');return {...scene,paragraphs:fragment(doc,scene.id).toArray().map((n,index)=>({index,paragraph_id:n._item?`${n._item.id.client}:${n._item.id.clock}`:'',...scene.blocks[index]}))}}
 if(!request.write)throw Error('未授权写入');
 const key=text(args.request_id,'request_id',128);if(!key.trim())throw Error('request_id 不能为空');
 const ledger=doc.getMap<{signature:string;result:unknown}>('assistantRequests');const signature=JSON.stringify({name,args});const previous=ledger.get(key);
 if(previous){if(previous.signature!==signature)throw Error('request_id 已用于不同操作');return previous.result}
 let result:unknown;
 if(name==='save_video_prompt'){
  const previous=args.id?videoPrompts(doc,true).find(p=>p.id===args.id):undefined;
  validateAgentPrompt(args.fields as Partial<PromptFields>|undefined,text(args.prompt,'Prompt'),promptImages(doc),(args.reference_image_ids as string[]|undefined)??previous?.referenceImageIds??[]);
  doc.transact(()=>{result=saveVideoPrompt(doc,{id:args.id as string|undefined,expectedRevision:args.expected_revision as string|null,source:args.source as PromptSpan[],fields:args.fields as Partial<PromptFields>,referenceImageIds:args.reference_image_ids as string[]|undefined,prompt:text(args.prompt,'Prompt')},ASSISTANT_ORIGIN);ledger.set(key,{signature,result})},ASSISTANT_ORIGIN);
 }else if(name==='create_scene'){
  if(args.after_scene_id!==undefined&&!sceneMap(doc,text(args.after_scene_id,'after_scene_id',128)))throw Error('目标场景已不存在');
  if(!Array.isArray(args.blocks)||args.blocks.length>1000)throw Error('段落无效');
  const blocks=args.blocks.map(b=>{if(!b||!KINDS.includes(b.kind))throw Error('段落格式无效');return {kind:b.kind as typeof KINDS[number],text:text(b.text,'段落文字')}});
  const patch={blocks,...(args.name!==undefined?{name:text(args.name,'场景名称',200)}:{}),location:args.location===undefined?'':text(args.location,'地点',500),summary:args.summary===undefined?'':text(args.summary,'梗概',10000)};
  doc.transact(()=>{const id=addScene(doc,args.after_scene_id as string|undefined,patch);result={scene_id:id};ledger.set(key,{signature,result})},ASSISTANT_ORIGIN);
 }else if(name==='replace_paragraph'){
  const id=text(args.scene_id,'scene_id',128);if(!sceneMap(doc,id))throw Error('场景已不存在');const index=args.paragraph_index;
  if(!Number.isInteger(index)||Number(index)<0)throw Error('段落序号无效');
  const expected=text(args.expected_text,'原文'),next=text(args.text,'新文字');
  const node=fragment(doc,id).get(Number(index));if(!(node instanceof Y.XmlElement))throw Error('段落已不存在，请重新读取');
  if(!node._item||args.paragraph_id!==`${node._item.id.client}:${node._item.id.clock}`)throw Error('段落位置已改变，请重新读取后提交');
  const children=node.toArray();if(children.some(c=>!(c instanceof Y.XmlText)))throw Error('这一段包含复杂换行，请在文稿中编辑');
  const actual=(children as Y.XmlText[]).map(c=>c.toDelta().map((d:{insert:unknown})=>typeof d.insert==='string'?d.insert:'').join('')).join('');if(actual!==expected)throw Error('这一段已被修改，请重新读取后再提交；本次未改动文稿');
  // Keep unchanged ranges and their font marks intact; the check and edit are synchronous.
  let start=0;while(start<actual.length&&start<next.length&&actual[start]===next[start])start++;
  let end=actual.length,nextEnd=next.length;while(end>start&&nextEnd>start&&actual[end-1]===next[nextEnd-1]){end--;nextEnd--}
  doc.transact(()=>{
   let offset=0;for(const child of children as Y.XmlText[]){const length=child.length,from=Math.max(0,start-offset),to=Math.min(length,end-offset);if(to>from)child.delete(from,to-from);offset+=length}
   let remaining=start,target=children[0] as Y.XmlText|undefined;
   if(!target){target=new Y.XmlText();node.insert(0,[target])}
   else for(const child of children as Y.XmlText[]){target=child;if(remaining<=child.length)break;remaining-=child.length}
   if(nextEnd>start)target.insert(remaining,next.slice(start,nextEnd));
   result={scene_id:id,paragraph_index:index,text:next};ledger.set(key,{signature,result});
  },ASSISTANT_ORIGIN);
 }else if(name==='save_version'){
  const versionName=text(args.name,'版本名称',200);saveVersion(versionName,snapshot(doc));result={saved:true,name:versionName};doc.transact(()=>ledger.set(key,{signature,result}),ASSISTANT_ORIGIN);
 }else throw Error('未知工具');
 return result;
}
