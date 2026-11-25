import * as Y from 'yjs';
import {fragment,listScenes,sceneMap,readBlocks,newId,LOCAL} from './model';
import {emptyPromptFields,PROMPT_FIELDS,validateVideoPrompts,type PromptSpan,type PromptFields,type VideoPrompt} from './prompt-types';
export const paragraphId=(node:Y.XmlElement|Y.XmlText|Y.XmlHook)=>node._item?`${node._item.id.client}:${node._item.id.clock}`:'';
export function promptSources(doc:Y.Doc){return listScenes(doc).map(scene=>({...scene,paragraphs:fragment(doc,scene.id).toArray().map((node,index)=>({paragraphId:paragraphId(node),paragraphIndex:index,...scene.blocks[index]}))}))}
export function promptHistory(doc:Y.Doc,id?:string){return [...doc.getMap<VideoPrompt>('videoPrompts').values()].filter(p=>!id||p.id===id).sort((a,b)=>a.updatedAt-b.updatedAt||a.revision.localeCompare(b.revision))}
export function videoPrompts(doc:Y.Doc,includeHidden=false){
 const latest=new Map<string,VideoPrompt>();for(const p of promptHistory(doc))latest.set(p.id,p);
 // Resolve live paragraph IDs: saved paragraph indexes become stale after manuscript edits.
 const positions=new Map<string,Map<string,[number,number]>>();
 listScenes(doc,true).forEach((scene,i)=>positions.set(scene.id,new Map(fragment(doc,scene.id).toArray().map((node,j)=>[paragraphId(node),[i,j] as [number,number]]))));
 const compare=(a:number[],b:number[])=>a[0]-b[0]||a[1]-b[1]||a[2]-b[2];
 const keyed=[...latest.values()].filter(p=>!p.deleted&&(includeHidden||!p.hidden)).map(p=>({p,position:p.source.map(s=>{const at=positions.get(s.sceneId)?.get(s.paragraphId);return at?[...at,s.start]:[Number.MAX_SAFE_INTEGER,0,0]}).sort(compare)[0]||[Number.MAX_SAFE_INTEGER,0,0]}));
 return keyed.sort((a,b)=>compare(a.position,b.position)||a.p.createdAt-b.p.createdAt||a.p.id.localeCompare(b.p.id)).map(({p})=>p);
}
export function sourceStatus(doc:Y.Doc,source:PromptSpan[]){
 const cache=new Map<string,{ids:string[];texts:string[]}>();
 for(const s of source){const scene=sceneMap(doc,s.sceneId);if(!scene||scene.get('deleted'))return 'missing';let content=cache.get(s.sceneId);if(!content){content={ids:fragment(doc,s.sceneId).toArray().map(paragraphId),texts:readBlocks(doc,s.sceneId).map(b=>b.text)};cache.set(s.sceneId,content)}const index=content.ids.indexOf(s.paragraphId);if(index<0)return 'missing';if(content.texts[index]!==s.paragraphText)return 'changed'}return 'current';
}
export function saveVideoPrompt(doc:Y.Doc,input:{id?:string;expectedRevision:string|null;source:PromptSpan[];referenceImageIds?:string[];fields?:Partial<PromptFields>;prompt:string;deleted?:boolean},origin:unknown=LOCAL){
 const old=input.id?promptHistory(doc,input.id).at(-1):undefined;
 if(input.id&&(!old||old.deleted))throw Error('Prompt 已不存在，请刷新');
 if((old?.revision||null)!==input.expectedRevision)throw Error('Prompt 已被修改，请保留当前草稿并刷新后重试');
 const record:VideoPrompt={id:old?.id||newId(),revision:newId(),parentRevision:old?.revision||null,source:input.source,...(input.referenceImageIds!==undefined?{referenceImageIds:input.referenceImageIds}:old?.referenceImageIds?{referenceImageIds:old.referenceImageIds}:{}),fields:{...emptyPromptFields(),...input.fields},prompt:input.prompt,createdAt:old?.createdAt||Date.now(),updatedAt:Math.max(Date.now(),(old?.updatedAt||0)+1),...(input.deleted?{deleted:true}:{}),...(old?.hidden?{hidden:true}:{})};
 validateVideoPrompts([record]);
 if(record.referenceImageIds?.some(id=>!doc.getMap('promptImages').has(id)))throw Error('参考图已不存在，请重新上传');
 if(!input.deleted&&sourceStatus(doc,input.source)!=='current')throw Error('关联原文已改变，请重新框选后保存；原有 Prompt 未被覆盖');
 doc.transact(()=>doc.getMap<VideoPrompt>('videoPrompts').set(record.revision,record),origin);return record;
}
export type PromptCompositionContext={characterDescriptions?:Record<string,string>;referenceNames?:string[]};
export function composeVideoPrompt(fields:PromptFields,context:PromptCompositionContext={}){
 const value=(key:keyof PromptFields)=>{const text=(fields[key]||'').trim().replace(/[（(](?:建议|原文指定|全画幅等效建议)[）)]/g,'').trim();return /^(?:待确定|待确认|待补充|未知|未提供|未指定|无|暂无)[。.]?$/.test(text)?'':text};
 const section=(title:string,text:string)=>text?`【${title}】${text}`:'';
 const camera=([['shotSize','景别'],['focalLength','焦段'],['camera','机位'],['movement','运镜']] as const).map(([key,label])=>value(key)?`${label}：${value(key)}`:'').filter(Boolean).join('；');
 const parts=[section('人物',fields.characterAppearance===undefined?value('characters'):value('characterAppearance')),section('画面',value('content')),section(value('shotSequence')?'共同镜头设定':'镜头',camera),section('镜头组',value('shotSequence')),section('光线与色调',value('lighting')),section('声音/对话',value('sound')),section('时长',value('duration')),section('连续性与避免项',value('continuity'))].filter(Boolean);
 // The model and historical aspect ratio are metadata, never generation prose.
 const full=parts.join('\n\n');
 const references=(context.referenceNames||[]).filter(name=>!new RegExp('@'+name+'(?![\\d])').test(full)).map(name=>'@'+name);
 if(references.length)parts.push(section('参考图',references.join('、')));
 return parts.join('\n\n');
}
// Snapshot export keeps current paragraph indexes solely for remapping into a new document.
export function exportPromptRecords(doc:Y.Doc){return promptHistory(doc).map(p=>({...p,source:p.source.map(s=>({...s,paragraphIndex:fragment(doc,s.sceneId).toArray().findIndex(n=>paragraphId(n)===s.paragraphId)}))}))}

// Visibility operations retain the exact source and text, including stale references.
export function changeVideoPromptState(doc:Y.Doc,id:string,expectedRevision:string,action:'hide'|'show'|'delete'){
 const old=promptHistory(doc,id).at(-1);if(!old||old.deleted)throw Error('镜头已不存在');if(old.revision!==expectedRevision)throw Error('镜头已被修改，请重新打开后再操作');
 const next:VideoPrompt={...old,revision:newId(),parentRevision:old.revision,updatedAt:Math.max(Date.now(),old.updatedAt+1),...(action==='delete'?{deleted:true}:{hidden:action==='hide'})};validateVideoPrompts([next]);doc.transact(()=>doc.getMap<VideoPrompt>('videoPrompts').set(next.revision,next),LOCAL);return next;
}

// Validate the complete selection before writing any visibility changes.
export function changeVideoPromptStates(doc:Y.Doc,targets:{id:string;revision:string}[],action:'hide'|'show'|'delete'){
 const ids=new Set<string>();const next=targets.map(target=>{if(ids.has(target.id))throw Error('重复的镜头选择');ids.add(target.id);const old=promptHistory(doc,target.id).at(-1);if(!old||old.deleted)throw Error('选中的镜头已不存在，请重新选择');if(old.revision!==target.revision)throw Error('选中的镜头已被修改，请重新选择');return {...old,revision:newId(),parentRevision:old.revision,updatedAt:Math.max(Date.now(),old.updatedAt+1),...(action==='delete'?{deleted:true}:{hidden:action==='hide'})}});
 validateVideoPrompts(next);doc.transact(()=>{for(const p of next)doc.getMap<VideoPrompt>('videoPrompts').set(p.revision,p)},LOCAL);return next;
}
