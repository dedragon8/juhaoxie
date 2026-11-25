import {validatePromptImages,type PromptImage} from './prompt-images';
import {validateVideoPrompts,type VideoPrompt} from './prompt-types';
import {isLayout,type LayoutStyle} from './layout';
import {DEFAULT_FONT,validFont} from './fonts';
import * as Y from 'yjs';
import type {CloudReference} from './icloud-types';
import { generateKeyBetween } from 'fractional-indexing';

export const KINDS = ['action', 'character', 'dialogue', 'parenthetical', 'transition', 'montage', 'sequence', 'shot', 'sequenceEnd'] as const;
export type Kind = typeof KINDS[number];
export const LABELS: Record<Kind, string> = {action:'描述/动作',character:'人物',dialogue:'对白',parenthetical:'括注',transition:'转场',montage:'蒙太奇',sequence:'连续镜头',shot:'镜头内容',sequenceEnd:'段落结束'};
export const LOCAL = 'screenwriter-local';
export type TextRun={text:string;fontFamily?:string};
export type Block = {kind:Kind;text:string;characterId?:string;runs?:TextRun[]};
export type Act = {id:string;name:string;order:string};
export type Scene = {id:string;order:string;name?:string;actId?:string;episode?:number;cast?:string;setting:string;location:string;time:string;summary:string;notes:string;deleted:boolean;blocks:Block[]};
export type Script = {schemaVersion:1;promptStyle?:string;promptImages?:PromptImage[];videoPrompts?:VideoPrompt[];includeStoryInfo?:boolean;storySynopsis?:string;characterDescriptions?:Record<string,string>;acts?:Act[];layout?:LayoutStyle;fontFamily?:string;title:string;author:string;contact:string;scenes:Scene[];characters:Record<string,string>};
export type ProjectEntry = {deletedAt?:number;fileSource?:{documentId:string;digest:string};id:string;title:string;updatedAt:number;cloud?:CloudReference;remote?:{url:string;room:string;token:string;role:string}};
export const newId = () => crypto.randomUUID();
export function scenesMap(doc:Y.Doc) {return doc.getMap<Y.Map<unknown>>('scenes');}
export function meta(doc:Y.Doc) {return doc.getMap<string>('meta');}
export function sceneMap(doc:Y.Doc,id:string) {return scenesMap(doc).get(id);}
export function listActs(doc:Y.Doc):Act[]{return [...doc.getMap<Y.Map<string>>('acts')].map(([id,a])=>({id,name:a.get('name')||'未命名幕',order:a.get('order')||''})).sort((a,b)=>(a.order<b.order?-1:a.order>b.order?1:0)||a.id.localeCompare(b.id));}
export function addAct(doc:Y.Doc,name:string){const id=newId();doc.transact(()=>{const a=new Y.Map<string>();doc.getMap('acts').set(id,a);a.set('name',name.trim()||`第 ${listActs(doc).length} 幕`);a.set('order',generateKeyBetween(listActs(doc).filter(a=>a.id!==id).at(-1)?.order||null,null))},LOCAL);return id;}
export function renameAct(doc:Y.Doc,id:string,name:string){if(name.trim())doc.transact(()=>doc.getMap<Y.Map<string>>('acts').get(id)?.set('name',name.trim()),LOCAL);}
export function removeAct(doc:Y.Doc,id:string){doc.transact(()=>{doc.getMap('acts').delete(id);for(const s of scenesMap(doc).values())if(s.get('actId')===id)s.delete('actId')},LOCAL);}
export function assignAct(doc:Y.Doc,sceneId:string,actId:string,beforeId?:string){
 if(actId&&!doc.getMap('acts').has(actId))throw Error('这一幕已不存在');
 if(sceneId===beforeId||!sceneMap(doc,sceneId))return;
 const siblings=listScenes(doc,true).filter(s=>s.id!==sceneId&&(s.actId||'')===actId);
 const index=beforeId?siblings.findIndex(s=>s.id===beforeId):siblings.length;
 if(index<0)return;
 doc.transact(()=>updateScene(doc,sceneId,{actId,order:insertionKey(doc,siblings,index)}),LOCAL);
}
function insertionKey(doc:Y.Doc,siblings:Scene[],index:number):string{
 let left=siblings[index-1]?.order??null,right=siblings[index]?.order??null;
 if(left!==null&&left===right){
  let key:string|null=null;
  for(const [i,scene] of siblings.entries()){
   key=generateKeyBetween(key,null);sceneMap(doc,scene.id)!.set('order',key);
   if(i===index-1)left=key;
   if(i===index)right=key;
  }
 }
 return generateKeyBetween(left,right);
}
export function fragment(doc:Y.Doc,id:string) {return doc.getXmlFragment(`scene:${id}`);}
export function blockNode(block:Block) {
  const node = new Y.XmlElement('scriptBlock');
  node.setAttribute('kind',block.kind);
  if(block.characterId) node.setAttribute('characterId',block.characterId);
  if(block.text) {const text=new Y.XmlText();text.applyDelta((block.runs||[{text:block.text}]).map(run=>({insert:run.text,...(run.fontFamily?{attributes:{fontFamily:{family:run.fontFamily}}}:{})})));node.insert(0,[text]);}
  return node;
}
export function readBlocks(doc:Y.Doc,id:string):Block[] {
  return fragment(doc,id).toArray().filter(n=>n instanceof Y.XmlElement).map(n=>{
    const node=n as Y.XmlElement;
    const runs:TextRun[]=node.toArray().flatMap(child=>child instanceof Y.XmlText?child.toDelta().map((d:any)=>({text:typeof d.insert==='string'?d.insert:'',...(validFont(d.attributes?.fontFamily?.family)?{fontFamily:d.attributes.fontFamily.family}:{})})):[{text:'\n'}]);
    const text=runs.map(r=>r.text).join('');
    return {kind:(node.getAttribute('kind')||'action') as Kind,text,characterId:node.getAttribute('characterId'),...(runs.some(r=>r.fontFamily)?{runs}:{})};
  });
}
export function listScenes(doc:Y.Doc,includeDeleted=false):Scene[] {
  const ranks=new Map(listActs(doc).map((act,index)=>[act.id,index]));
  return [...scenesMap(doc).entries()].map(([id,s])=>({id,order:String(s.get('order')||''),...(doc.getMap('acts').has(String(s.get('actId')))?{actId:String(s.get('actId'))}:{}),...(s.get('name')?{name:String(s.get('name'))}:{}),episode:Number(s.get('episode'))||1,cast:String(s.get('cast')||''),setting:String(s.get('setting')||'内景'),location:String(s.get('location')||''),time:String(s.get('time')||'日'),summary:String(s.get('summary')||''),notes:String(s.get('notes')||''),deleted:!!s.get('deleted'),blocks:readBlocks(doc,id)})).filter(s=>includeDeleted||!s.deleted).sort((a,b)=>(ranks.get(a.actId||'')??ranks.size)-(ranks.get(b.actId||'')??ranks.size)||(a.order<b.order?-1:a.order>b.order?1:a.id.localeCompare(b.id)));
}
export function ensureSceneNames(doc:Y.Doc){
 const migrate=!meta(doc).has('plainSceneNamesVersion');
 doc.transact(()=>{for(const scene of listScenes(doc,true)){if(!scene.name||(migrate&&/^场景\d+$/.test(scene.name)))sceneMap(doc,scene.id)!.set('name','场景')}if(migrate)meta(doc).set('plainSceneNamesVersion','1')},LOCAL);
}
export function addScene(doc:Y.Doc,afterId?:string,seed:Partial<Scene>={}) {
  const scenes=listScenes(doc,true),anchor=afterId?scenes.find(s=>s.id===afterId):undefined;
  const actId=seed.actId??anchor?.actId??'';
  const siblings=scenes.filter(s=>(s.actId||'')===actId);
  const index=anchor&&(anchor.actId||'')===actId?siblings.findIndex(s=>s.id===afterId)+1:siblings.length;
  const id=newId(),defaultName='场景';
  doc.transact(()=>{
    const s=new Y.Map<unknown>();scenesMap(doc).set(id,s);
    s.set('order',insertionKey(doc,siblings,index));
    for(const [k,v] of Object.entries({name:defaultName,actId,episode:anchor?.episode||siblings[index-1]?.episode||1,cast:'',setting:'内景',location:'',time:'日',summary:'',notes:'',deleted:false,...seed})) {if(!['id','order','blocks'].includes(k)) s.set(k,v);}
    fragment(doc,id).insert(0,(seed.blocks?.length?seed.blocks:[{kind:'action' as Kind,text:''}]).map(blockNode));
  },LOCAL);
  return id;
}
export function updateScene(doc:Y.Doc,id:string,patch:Partial<Scene>) {
  const s=sceneMap(doc,id);if(!s)return;
  doc.transact(()=>{for(const [k,v] of Object.entries(patch)) if(!['id','blocks'].includes(k))s.set(k,v);},LOCAL);
}
export function deleteScene(doc:Y.Doc,id:string){
 if(!scenesMap(doc).has(id))return;
 doc.transact(()=>{scenesMap(doc).delete(id);const content=fragment(doc,id);content.delete(0,content.length)},LOCAL);
}
export function moveScene(doc:Y.Doc,id:string,targetId:string,before=true) {
  if(id===targetId)return;
  const scenes=listScenes(doc),target=scenes.find(s=>s.id===targetId);
  if(!target)return;
  const siblings=scenes.filter(s=>s.id!==id&&s.actId===target.actId);
  const next=siblings[siblings.findIndex(s=>s.id===targetId)+1];
  assignAct(doc,id,target.actId||'',before?targetId:next?.id);
}
export function seedDocument(doc:Y.Doc,title='未命名剧本') {
  doc.transact(()=>{meta(doc).set('title',title);meta(doc).set('author','');meta(doc).set('contact','');meta(doc).set('schemaVersion','1');},LOCAL);
  addScene(doc);
}
export function characterNames(doc:Y.Doc):string[] {
  return [...new Set([...listScenes(doc).flatMap(s=>s.blocks.filter(b=>b.kind==='character').map(b=>b.text.replace(/（.*?）|\(.*?\)/g,'').trim())),...doc.getMap<string>('characterDescriptions').keys()].filter(Boolean))];
}
export function registerCharacter(doc:Y.Doc,name:string) {
  const chars=doc.getMap<string>('characters');for(const [id,n] of chars)if(n===name)return id;
  const id=newId();doc.transact(()=>chars.set(id,name),LOCAL);return id;
}
export function renameCharacter(doc:Y.Doc,oldName:string,name:string,replaceBody=false) {
  name=name.trim();if(!name||name===oldName)return;
  doc.transact(()=>{
    const descriptions=doc.getMap<string>('characterDescriptions');if(descriptions.has(oldName)){const previous=descriptions.get(name);descriptions.set(name,[previous,descriptions.get(oldName)].filter(Boolean).join('\n'));descriptions.delete(oldName)}
    const chars=doc.getMap<string>('characters');for(const [id,n]of chars)if(n===oldName)chars.set(id,name);
    for(const s of listScenes(doc,true))for(const n of fragment(doc,s.id).toArray()){
      if(!(n instanceof Y.XmlElement))continue;
      const texts=n.toArray().filter(t=>t instanceof Y.XmlText) as Y.XmlText[];
      const content=texts.map(t=>t.toString()).join('');
      const isCharacter=n.getAttribute('kind')==='character' && (content===oldName||content.startsWith(oldName+'（')||content.startsWith(oldName+'('));
      if(isCharacter || (replaceBody&&content.includes(oldName))) {
        const next=isCharacter ? name+content.slice(oldName.length) : content.split(oldName).join(name);
        n.delete(0,n.length);const t=new Y.XmlText();t.insert(0,next);n.insert(0,[t]);
      }
    }
  },LOCAL);
}
export function snapshot(doc:Y.Doc):Script {
  return {schemaVersion:1,...(doc.getMap<PromptImage>('promptImages').size?{promptImages:[...doc.getMap<PromptImage>('promptImages').values()]}:{}),promptStyle:meta(doc).get('promptStyle')||'',...(doc.getMap<VideoPrompt>('videoPrompts').size?{videoPrompts:[...doc.getMap<VideoPrompt>('videoPrompts').values()].sort((a,b)=>a.revision.localeCompare(b.revision)).map(p=>({...p,source:p.source.map(s=>({...s,paragraphIndex:fragment(doc,s.sceneId).toArray().findIndex(n=>n._item&&`${n._item.id.client}:${n._item.id.clock}`===s.paragraphId)}))}))}:{}),includeStoryInfo:meta(doc).get('includeStoryInfo')==='true',storySynopsis:meta(doc).get('storySynopsis')||'',characterDescriptions:Object.fromEntries(doc.getMap<string>('characterDescriptions')),acts:listActs(doc),layout:isLayout(meta(doc).get('layout'))?meta(doc).get('layout') as LayoutStyle:'hollywood',fontFamily:meta(doc).get('fontFamily')||DEFAULT_FONT,title:meta(doc).get('title')||'未命名剧本',author:meta(doc).get('author')||'',contact:meta(doc).get('contact')||'',scenes:listScenes(doc,true),characters:Object.fromEntries(doc.getMap<string>('characters'))};
}
export function validateScript(value:unknown):asserts value is Script {
  const v=value as Script;
  validateVideoPrompts(v?.videoPrompts);validatePromptImages(v?.promptImages);
  if(v?.videoPrompts?.some(p=>p.referenceImageIds?.some(id=>!v.promptImages?.some(image=>image.id===id))))throw Error('镜头参考图缺失');
  if(v?.promptStyle!==undefined&&(typeof v.promptStyle!=='string'||v.promptStyle.length>100000))throw Error('全片镜头设定无效');
  if(!v||v.schemaVersion!==1||typeof v.title!=='string'||!Array.isArray(v.scenes)||v.scenes.length>5000)throw Error('不是受支持的场景项目文件（版本 1）。');
  if(v.acts!==undefined&&(!Array.isArray(v.acts)||v.acts.length>1000||v.acts.some(a=>!a||typeof a.id!=='string'||typeof a.name!=='string'||typeof a.order!=='string')||new Set(v.acts.map(a=>a.id)).size!==v.acts.length))throw Error('幕数据无效');
  if(v.includeStoryInfo!==undefined&&typeof v.includeStoryInfo!=='boolean')throw Error('资料页设置无效');
  if(v.storySynopsis!==undefined&&(typeof v.storySynopsis!=='string'||v.storySynopsis.length>200000))throw Error('故事梗概无效');
  if(v.characterDescriptions!==undefined&&(!v.characterDescriptions||typeof v.characterDescriptions!=='object'||Array.isArray(v.characterDescriptions)||Object.keys(v.characterDescriptions).length>5000||Object.entries(v.characterDescriptions).some(([name,description])=>!name.trim()||name.length>200||typeof description!=='string'||description.length>100000)))throw Error('人物介绍无效');
  if(v.layout!==undefined&&!isLayout(v.layout))throw Error('不支持的剧本排版');
  if(v.fontFamily!==undefined&&!validFont(v.fontFamily))throw Error('不支持的文稿字体');
  for(const scene of v.scenes)for(const block of scene.blocks||[])if(block.runs&&(!Array.isArray(block.runs)||block.runs.some(r=>typeof r.text!=='string'||(r.fontFamily!==undefined&&!validFont(r.fontFamily)))||block.runs.map(r=>r.text).join('')!==block.text))throw Error('文字字体数据无效');
  for(const s of v.scenes)if((s.episode!==undefined&&(!Number.isInteger(s.episode)||s.episode<1||s.episode>9999))||(s.cast!==undefined&&(typeof s.cast!=='string'||s.cast.length>10000))||(s.name!==undefined&&typeof s.name!=='string')||typeof s.location!=='string'||typeof s.setting!=='string'||typeof s.time!=='string'||!Array.isArray(s.blocks)||s.blocks.some(b=>!KINDS.includes(b.kind)||typeof b.text!=='string'||b.text.length>2_000_000))throw Error('项目中的场景或段落数据无效。');
}
export function fromSnapshot(script:Script):Y.Doc {
  validateScript(script);const doc=new Y.Doc();
  doc.transact(()=>{meta(doc).set('promptStyle',script.promptStyle||'');meta(doc).set('includeStoryInfo',String(!!script.includeStoryInfo));meta(doc).set('storySynopsis',script.storySynopsis||'');for(const [name,description]of Object.entries(script.characterDescriptions||{}))doc.getMap<string>('characterDescriptions').set(name,description);meta(doc).set('layout',script.layout||'hollywood');meta(doc).set('fontFamily',script.fontFamily||DEFAULT_FONT);meta(doc).set('title',script.title);meta(doc).set('author',script.author||'');meta(doc).set('contact',script.contact||'');meta(doc).set('schemaVersion','1');
  for(const act of script.acts||[]){const a=new Y.Map<string>();doc.getMap('acts').set(act.id,a);a.set('name',act.name);a.set('order',act.order)}
  const sceneIds=new Map<string,string>();for(const s of script.scenes)sceneIds.set(s.id,addScene(doc,undefined,s));
  for(const image of script.promptImages||[])doc.getMap<PromptImage>('promptImages').set(image.id,image);
  for(const p of script.videoPrompts||[]){const source=p.source.map(s=>{const sceneId=sceneIds.get(s.sceneId)||s.sceneId;const node=s.paragraphIndex>=0?fragment(doc,sceneId).get(s.paragraphIndex):undefined;return {...s,sceneId,paragraphId:node?._item?`${node._item.id.client}:${node._item.id.clock}`:s.paragraphId}});doc.getMap<VideoPrompt>('videoPrompts').set(p.revision,{...p,source})}
  for(const [id,name]of Object.entries(script.characters||{}))doc.getMap<string>('characters').set(id,name);
  },LOCAL);return doc;
}
export function sceneHeading(s:Pick<Scene,'setting'|'location'|'time'>){return `${s.setting} ${s.location||'未命名场景'} ${s.time}`;}
export function nextKind(kind:Kind,text:string):Kind|'scene' {
  if(kind==='montage'||kind==='sequence')return 'shot';
  if(kind==='shot')return text.trim()?'shot':'sequenceEnd';
  if(kind==='sequenceEnd')return 'action';
  if(kind==='character')return text.trim()?'dialogue':'action';
  if(kind==='dialogue')return 'character';
  if(kind==='parenthetical')return 'dialogue';
  if(kind==='transition')return 'scene';return 'action';
}
export function wordCount(script:Script){return script.scenes.filter(s=>!s.deleted).reduce((n,s)=>n+s.blocks.reduce((a,b)=>a+b.text.replace(/\s/g,'').length,0),0);}

export function displayBlock(block:Block){const prefix=block.kind==='montage'?'蒙太奇':block.kind==='sequence'?'连续镜头':block.kind==='sequenceEnd'?'结束':block.kind==='shot'?'—':'';return prefix?prefix+(block.text?(block.kind==='shot'?' ':'：')+block.text:''):block.text;}
