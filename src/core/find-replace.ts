import * as Y from 'yjs';
import {meta,listScenes,fragment,blockNode,type Block,type TextRun} from './model';
export type FindMatch={id:string;sceneId?:string;field:'title'|'author'|'setting'|'location'|'time'|'block';blockIndex?:number;from:number;to:number;text:string};
export const REPLACE_ORIGIN=Symbol('find-replace');
export function findMatches(doc:Y.Doc,query:string,matchCase=false):FindMatch[]{
 if(!query)return [];const result:FindMatch[]=[];const pattern=new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),matchCase?'gu':'giu');
 const scan=(text:string,field:FindMatch['field'],sceneId?:string,blockIndex?:number)=>{for(const m of text.matchAll(pattern))result.push({id:`${sceneId||'cover'}:${field}:${blockIndex??''}:${m.index}`,sceneId,field,blockIndex,from:m.index!,to:m.index!+m[0].length,text:m[0]});};
 scan(meta(doc).get('title')||'','title');scan(meta(doc).get('author')||'','author');
 for(const scene of listScenes(doc)){for(const field of ['setting','location','time'] as const)scan(scene[field],field,scene.id);scene.blocks.forEach((b,i)=>scan(b.text,'block',scene.id,i));}return result;
}
function replaceText(block:Block,from:number,to:number,value:string):Block{
 const runs=block.runs||[{text:block.text}];let at=0;const before:TextRun[]=[],after:TextRun[]=[];let font:string|undefined;
 for(const r of runs){const end=at+r.text.length;if(at<=from&&from<end)font=r.fontFamily;if(at<from)before.push({...r,text:r.text.slice(0,Math.max(0,from-at))});if(end>to)after.push({...r,text:r.text.slice(Math.max(0,to-at))});at=end;}
 const merged:TextRun[]=[];for(const run of [...before,{text:value,...(font?{fontFamily:font}:{})},...after]){if(!run.text)continue;const last=merged.at(-1);if(last&&last.fontFamily===run.fontFamily)last.text+=run.text;else merged.push({...run});}
 const {runs:_,...rest}=block;return {...rest,text:block.text.slice(0,from)+value+block.text.slice(to),...(merged.some(r=>r.fontFamily)?{runs:merged}:{})};
}
export function replaceMatches(doc:Y.Doc,matches:FindMatch[],replacement:string){
 const all=listScenes(doc),groups=new Map<string,FindMatch[]>();for(const match of matches){const key=`${match.sceneId||'cover'}:${match.field}:${match.blockIndex??''}`;groups.set(key,[...(groups.get(key)||[]),match]);}
 let count=0;doc.transact(()=>{for(const group of groups.values()){
  const first=group[0],ordered=group.sort((a,b)=>b.from-a.from);
  if(first.field==='block'){const scene=all.find(s=>s.id===first.sceneId);let block=scene?.blocks[first.blockIndex!];if(!block)continue;for(const hit of ordered){if(block.text.slice(hit.from,hit.to)!==hit.text)continue;block=replaceText(block,hit.from,hit.to,replacement);count++;}const f=fragment(doc,first.sceneId!);f.delete(first.blockIndex!,1);f.insert(first.blockIndex!,[blockNode(block)]);
  }else{const map=first.sceneId?doc.getMap<Y.Map<string>>('scenes').get(first.sceneId):meta(doc);if(!map)continue;let text=String(map.get(first.field)||'');for(const hit of ordered){if(text.slice(hit.from,hit.to)!==hit.text)continue;text=text.slice(0,hit.from)+replacement+text.slice(hit.to);count++;}map.set(first.field,text);}
 }},REPLACE_ORIGIN);return count;
}
export function replacementUndo(doc:Y.Doc){return new Y.UndoManager([meta(doc),doc.getMap('scenes'),...listScenes(doc).map(s=>fragment(doc,s.id))],{trackedOrigins:new Set([REPLACE_ORIGIN]),captureTimeout:0});}
