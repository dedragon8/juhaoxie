import {displayBlock,type Block,type Scene,type TextRun} from './model';

export const SHORT_MARKERS=[['os','内心独白 OS'],['vo','画外音 VO'],['subtitle','字幕'],['emptyShot','空镜'],['flashback','闪回'],['flashbackEnd','闪回结束']] as const;
export type ShortMarker=typeof SHORT_MARKERS[number][0];
export function episodeOf(scene:Scene){return scene.episode||1;}
export function shortSceneNumber(scenes:Scene[],scene:Scene){return `${episodeOf(scene)}-${scenes.filter(s=>!s.deleted&&episodeOf(s)===episodeOf(scene)).findIndex(s=>s.id===scene.id)+1}`;}
export function shortHeading(scenes:Scene[],scene:Scene){return `${shortSceneNumber(scenes,scene)}  ${scene.time}  ${scene.setting.replace(/景/g,'')}  ${scene.location||'场景地点'}`;}
export function sceneCast(scene:Scene){return scene.cast?.trim()||[...new Set(scene.blocks.filter(b=>b.kind==='character').map(b=>b.text.replace(/[（(].*$/,'').replace(/[:：]\s*$/,'').trim()).filter(Boolean))].join('、');}
export function isSpecialAction(text:string){return /^(?:[△Δ]|【|闪回(?:结束)?$|闪出$|回到现实$)/.test(text.trimStart());}
const runsOf=(b:Block):TextRun[]=>b.runs?.map(r=>({...r}))||[{text:b.text}];
function bracketRuns(block:Block):TextRun[]{return /^[（(]/.test(block.text)?runsOf(block):[{text:'（'},...runsOf(block),{text:'）'}];}
// Presentation only: never rewrite the collaborative character/parenthetical/dialogue nodes.
export function shortDramaBlocks(blocks:Block[],actionMarker=true):Block[]{
 const result:Block[]=[];
 for(let i=0;i<blocks.length;i++){
  const block=blocks[i];let runs:TextRun[];
  if(block.kind==='character'){
   runs=runsOf(block);let j=i+1;
   while(blocks[j]?.kind==='parenthetical'){runs.push(...bracketRuns(blocks[j++]));}
   if(blocks[j]?.kind==='dialogue'){
    if(!/[:：]\s*$/.test(runs.map(r=>r.text).join('')))runs.push({text:'：'});
    runs.push(...runsOf(blocks[j]));result.push({kind:'dialogue',text:runs.map(r=>r.text).join(''),runs});i=j;continue;
   }
  }
  if(block.kind==='action')runs=[...(actionMarker&&block.text&&!isSpecialAction(block.text)?[{text:'△'}]:[]),...runsOf(block)];
  else if(block.kind==='parenthetical')runs=bracketRuns(block);
  else {const display=displayBlock(block),prefix=display.slice(0,display.length-block.text.length);runs=[...(prefix?[{text:prefix}]:[]),...runsOf(block)];}
  // Keep the kind for pagination but mark text as already formatted using ordinary action/dialogue kinds.
  result.push({kind:block.kind==='dialogue'?'dialogue':'action',text:runs.map(r=>r.text).join(''),runs});
 }
 return result;
}


// Shared by the editable manuscript and the selectable Prompt source view.
export function shortParagraphClasses(blocks:Pick<Block,'kind'|'text'>[],index:number){
 const node=blocks[index],next=blocks[index+1],prev=blocks[index-1],kind=node.kind,classes:string[]=[];
 if(kind==='parenthetical'&&node.text&&!/^[（(]/.test(node.text))classes.push('short-unwrapped');
 if(kind==='action'&&node.text&&!isSpecialAction(node.text))classes.push('short-action');
 if(kind==='character'){
  if(next&&['dialogue','parenthetical'].includes(next.kind))classes.push('short-cue');
  if(next?.kind==='dialogue'&&!/[:：]\s*$/.test(node.text))classes.push('short-colon');
 }
 if(kind==='parenthetical'&&prev&&['character','parenthetical'].includes(prev.kind)&&next&&['dialogue','parenthetical'].includes(next.kind)){
  classes.push('short-parenthetical');if(next.kind==='dialogue')classes.push('short-colon');
 }
 return classes;
}
