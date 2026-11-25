import type * as Y from 'yjs';
import {characterNames,listScenes} from './model';
import {promptSources} from './video-prompts';
import {emptyPromptFields,type PromptSpan,type PromptFields} from './prompt-types';

const cleanName=(name:string)=>name.replace(/[（(].*$/,'').replace(/[:：]\s*$/,'').trim();
export function promptCharacterNames(doc:Y.Doc){
 return [...new Set([...characterNames(doc),...doc.getMap<string>('characters').values(),...listScenes(doc).flatMap(s=>(s.cast||'').split(/[、，,；;\n]/))].map(cleanName).filter(Boolean))];
}
// A dialogue inherits its speaker only within the same speech, never across an action or scene.
export function inferPromptCharacters(doc:Y.Doc,source:PromptSpan[]):string[]{
 const scenes=promptSources(doc),known=promptCharacterNames(doc).sort((a,b)=>b.length-a.length),found=new Set<string>();
 for(const span of source){
  const scene=scenes.find(s=>s.id===span.sceneId);if(!scene)continue;
  const index=scene.paragraphs.findIndex(p=>p.paragraphId===span.paragraphId);if(index<0)continue;
  const p=scene.paragraphs[index];
  if(p.kind==='character'){const name=cleanName(p.text);if(name)found.add(name)}
  if(p.kind==='dialogue'||p.kind==='parenthetical'){
   const inline=p.text.match(/^\s*([^：:\n（）()]{1,20})(?:[（(][^）)]*[）)])?\s*[:：]/);
   const explicit=inline&&known.find(n=>n===cleanName(inline[1]));
   if(explicit)found.add(explicit);
   else for(let i=index-1;i>=0;i--){const before=scene.paragraphs[i];if(before.kind==='character'){const name=cleanName(before.text);if(name)found.add(name);break}if(!['dialogue','parenthetical'].includes(before.kind))break}
  }
  // Match longer names first, so “王” isn't inferred from “大王”. Single-character names
  // need a word boundary or action verb, avoiding e.g. “白色” and “对白”. No pronoun guesses.
  let remaining=span.text;
  for(const name of known){let start=0,at=-1,matched=false;while((at=remaining.indexOf(name,start))>=0){const before=remaining[at-1]||'',after=remaining.slice(at+name.length);if(name.length>1||(!before||/[\s，。！？、：；“”「」]/.test(before))&&!/^(色|天|云|话|字|光|衣|纸)/.test(after)||/^(说|问|看|走|站|坐|转|拿|放|望|笑|哭|的|向|从|把|在|和|与)/.test(after)){matched=true;break}start=at+name.length}if(matched){found.add(name);remaining=remaining.split(name).join(' '.repeat(name.length))}}
 }return [...found];
}
export const SHOT_SIZES=['大远景','远景','全景','中景','中近景','近景','特写','大特写'];
export const FOCAL_LENGTHS=['18mm','24mm','35mm','50mm','85mm','100mm'];
export const CAMERA_ANGLES=['平视','低机位仰拍','高机位俯拍','俯视','过肩','主观视角'];
export const CAMERA_MOVES=['固定镜头','缓慢推进','缓慢拉远','横移','跟拍','摇镜','环绕','手持'];
export function mergeCharacters(value:string,names:string[]){const entries=value.split(/[、，,；;\n]/).map(s=>s.trim()).filter(Boolean);for(const name of names)if(!entries.some(e=>e===name||e.startsWith(name+'（')||e.startsWith(name+'(')||e.startsWith(name+'：')||e.startsWith(name+':')))entries.push(name);return entries.join('、')}
export function removeCharacter(value:string,name:string){return value.split(/[、，,；;\n]/).map(s=>s.trim()).filter(e=>e&&e!==name&&!e.startsWith(name+'（')&&!e.startsWith(name+'(')&&!e.startsWith(name+'：')&&!e.startsWith(name+':')).join('、')}
export function hasCharacter(value:string,name:string){return mergeCharacters(value,[name])===value.split(/[、，,；;\n]/).map(s=>s.trim()).filter(Boolean).join('、')}

export function normalizePromptFields(fields:Partial<PromptFields>,known:string[]=[]):PromptFields{
 const next={...emptyPromptFields(),...fields};
 if(next.characterAppearance===undefined&&/@参考图\d+/.test(next.characters)){next.characterAppearance=next.characters;next.characters=charactersInAppearance(next.characters,known).join('、')}

 if(!next.movement){const parts=next.camera.split(/[、，,；;\n]/).map(s=>s.trim()).filter(Boolean),moves=parts.filter(s=>CAMERA_MOVES.includes(s));if(moves.length){next.movement=moves.join('，');next.camera=parts.filter(s=>!CAMERA_MOVES.includes(s)).join('，')}}
 return next;
}

// Descriptive sentences from old Agent output must never become character chips.
export function promptCharacterChips(value:string,known:string[]=[]){
 return [...new Set([...known,...value.split(/[、，,；;\n]/).map(s=>s.trim()).filter(s=>s.length<=24&&!/[。！？：:（）()@]/.test(s)&&!/待确定|待确认|未提供|外观|服装|学生|画外|仅|具体|的人物/.test(s))])].filter(Boolean);
}

// Keep known people distinct from clothing descriptions and image tokens.
export function charactersInAppearance(value:string,known:string[]):string[]{
 let remaining=value.replace(/@参考图\d+/g,' ');const found:string[]=[];
 for(const name of [...new Set(known)].filter(Boolean).sort((a,b)=>b.length-a.length)){
  let from=0,index=-1;
  while((index=remaining.indexOf(name,from))>=0){
   const before=remaining[index-1]||'',after=remaining[index+name.length]||'';
   if((!before||/[\s、，,；;：:。！？（(]/.test(before))&&(!after||/[\s、，,；;：:。！？（(@穿着的]/.test(after))){found.push(name);remaining=remaining.slice(0,index)+' '.repeat(name.length)+remaining.slice(index+name.length);break}
   from=index+name.length;
  }
 }return found;
}
