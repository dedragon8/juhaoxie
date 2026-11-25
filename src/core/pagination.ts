import {commonChineseBlocks,commonChineseHeading} from './common-chinese';
import {layoutFor} from './layout';
import {episodeOf,sceneCast,shortHeading,shortDramaBlocks} from './short-drama';
import {fontStack} from './fonts';
import {displayBlock,sceneHeading,type Script,type Kind,type Block,type TextRun} from './model';
export const PAGE={width:595.2756,height:841.8898,left:108,right:72,top:72,bottom:72,line:16,font:12};
export type PrintKind=Kind|'scene'|'more';
export type PrintLine={text:string;kind:PrintKind;x:number;y:number;width:number;height:number;bold?:boolean;sceneNumber?:number;runs?:TextRun[]};
export type Page={lines:PrintLine[];section?:'storyInfo'};
export const METRICS=layoutFor('hollywood').metrics;
const CLOSING=/^[，。！？、；：）》」』】〕〉…”’,.!?;:)\]}]/u;
const OPENING=/[（《「『【〔〈“‘(\[{]$/u;
export function wrapText(text:string,width:number,measure:(s:string,offset?:number)=>number):string[]{
 const lines:string[]=[];let paragraphOffset=0;
 for(const paragraph of text.split('\n')){
  if(!paragraph){lines.push('');paragraphOffset++;continue;}
  let line='';let lineOffset=paragraphOffset;
  for(const char of Array.from(paragraph)){
   if(line&&measure(line+char,lineOffset)>width){
    if(CLOSING.test(char)) { // move the preceding glyph as well; never overflow the column
      const chars=Array.from(line);const prev=chars.pop()!;const head=chars.join('');lines.push(head);lineOffset+=head.length;line=prev+char;
    }else if(OPENING.test(line)) {const chars=Array.from(line);const prev=chars.pop()!;const head=chars.join('');lines.push(head);lineOffset+=head.length;line=prev+char;}
    else{lines.push(line);lineOffset+=line.length;line=char;}
   }else line+=char;
  }
  if(line)lines.push(line);paragraphOffset+=paragraph.length+1;
 }
 return lines.length?lines:[''];
}
function styledLines(block:Block,width:number,defaultFont:string|undefined,measure:(s:string,font?:string)=>number){
 const raw=block.kind==='parenthetical'&&!/^[（(]/.test(block.text)?`（${block.text}）`:displayBlock(block);
 const prefix=raw===block.text?0:block.kind==='parenthetical'?1:raw.length-block.text.length,source:TextRun[]=[];
 if(prefix>0)source.push({text:raw.slice(0,prefix)});
 source.push(...(block.runs||[{text:block.text}]));
 if(prefix+block.text.length<raw.length)source.push({text:raw.slice(prefix+block.text.length)});
 const slice=(start:number,length:number)=>{let at=0;const result:TextRun[]=[];for(const run of source){const end=at+run.text.length,a=Math.max(at,start),b=Math.min(end,start+length);if(b>a)result.push({...run,text:run.text.slice(a-at,b-at)});at=end;if(at>=start+length)break;}return result;};
 const texts=wrapText(raw,width,(text,offset=0)=>slice(offset,text.length).reduce((sum,run)=>sum+measure(run.text,run.fontFamily||defaultFont),0));
 let offset=0;return texts.map(text=>{const runs=slice(offset,text.length);offset+=text.length;if(raw[offset]==='\n')offset++;return {text,runs};});
}
export function paginate(script:Script,measure:(s:string,font?:string,bold?:boolean)=>number):Page[]{
 return [...paginateStoryInfo(script,measure),...paginateManuscript(script,measure)];
}
export function paginateStoryInfo(script:Script,measure:(s:string,font?:string,bold?:boolean)=>number):Page[]{
 if(!script.includeStoryInfo)return [];
 const pages:Page[]=[{lines:[],section:'storyInfo'}];let page=pages[0],y=72;
 const bottom=PAGE.height-72,width=PAGE.width-144,line=20;
 const next=()=>{page={lines:[],section:'storyInfo'};pages.push(page);y=72};
 const put=(text:string,bold=false,keepNext=false)=>{
  const lines=wrapText(text,width,t=>measure(t,script.fontFamily,bold));
  if(keepNext&&y+(lines.length+1)*line>bottom&&y>72)next();
  for(const text of lines){if(y+line>bottom)next();page.lines.push({kind:'action',text,x:72,y,width,height:line,bold});y+=line}
 };
 const gap=()=>{if(y>72)y+=12};
 put('人物设定与故事梗概',true,true);gap();put('人物设定',true,true);
 const names=[...new Set([...script.scenes.filter(s=>!s.deleted).flatMap(s=>s.blocks.filter(b=>b.kind==='character').map(b=>b.text.replace(/（.*?）|\(.*?\)/g,'').trim())),...Object.keys(script.characterDescriptions||{})].filter(Boolean))];
 for(const name of names){gap();put(name,true,!!script.characterDescriptions?.[name]);if(script.characterDescriptions?.[name])put(script.characterDescriptions[name]);}
 gap();put('故事梗概',true,!!script.storySynopsis);if(script.storySynopsis)put(script.storySynopsis);
 return pages;
}
function paginateManuscript(script:Script,measure:(s:string,font?:string,bold?:boolean)=>number):Page[]{
 if(script.layout==='commonChinese')return paginateCommonChinese(script,measure);
 if(script.layout==='shortDrama')return paginateShortDrama(script,measure);
 const layout=layoutFor(script.layout),metrics=layout.metrics;const height=(kind:PrintKind)=>['character','dialogue','parenthetical','more'].includes(kind)?layout.speechLine:layout.line;
 const styledBlock=(block:Block)=>styledLines(block,metrics[block.kind].width,script.fontFamily,(text,font)=>measure(text,font,script.layout==='chinese'&&block.kind==='character'));
 const pages:Page[]=[{lines:[]}];let y=layout.top;let page=pages[0];let speaker='';
 const bottom=PAGE.height-layout.bottom;
 const newPage=()=>{page={lines:[]};pages.push(page);y=layout.top;};
 const space=(h:number)=>{if(y+h>bottom)newPage();};
 const put=(kind:PrintKind,text:string,sceneNumber?:number,runs?:TextRun[])=>{const m=metrics[kind];page.lines.push({text,kind,x:m.x,y,width:m.width,height:height(kind),bold:kind==='scene'||script.layout==='chinese'&&kind==='character',sceneNumber,runs});y+=height(kind);};
 const gap=()=>{if(y>layout.top)y+=layout.gap;};
 script.scenes.filter(s=>!s.deleted).forEach((scene,index)=>{
  if(index)gap();
  const headings=wrapText(sceneHeading(scene),metrics.scene.width,s=>measure(s,script.fontFamily,true));
  space((headings.length+3)*layout.line);
  headings.forEach((t,i)=>put('scene',t,i===0?index+1:undefined));if(script.layout!=='chinese')gap();
  const blocks=scene.blocks.filter(b=>b.text.trim()||['montage','sequence','sequenceEnd'].includes(b.kind));
  blocks.forEach((b,bi)=>{
   const prev=blocks[bi-1];const following=blocks[bi+1];
   if(b.kind==='character'){
    if(prev)gap();speaker=b.text;
    let needed=styledBlock(b).length;
    let j=bi+1;
    while(blocks[j]?.kind==='parenthetical'){needed+=styledBlock(blocks[j]).length;j++;}
    if(blocks[j]?.kind==='dialogue')needed+=Math.min(3,styledBlock(blocks[j]).length);
    space(Math.min(needed*layout.speechLine,bottom-layout.top));
   }else if(['action','transition','montage','sequence','sequenceEnd','shot'].includes(b.kind)){if(prev&&!(prev.kind==='action'&&b.kind==='action'))gap();}
   const styled=styledBlock(b),lines=styled.map(l=>l.text);
   const putLine=(index:number)=>put(b.kind,lines[index],undefined,styled[index].runs);
   if(b.kind==='montage'||b.kind==='sequence')space(Math.min((lines.length+2)*height(b.kind),bottom-layout.top));
   if(b.kind==='parenthetical')space(Math.min((lines.length+(following?.kind==='dialogue'?Math.min(3,styledBlock(following).length):0))*height(b.kind),bottom-layout.top));
   let cursor=0;
   while(cursor<lines.length){
    let available=Math.floor((bottom-y)/height(b.kind));
    if(available<1){newPage();available=Math.floor((bottom-y)/height(b.kind));}
    const remaining=lines.length-cursor;
    if(remaining<=available){for(;cursor<lines.length;cursor++)putLine(cursor);break;}
    if(b.kind==='dialogue'){
      if(available<3){newPage();if(speaker)put('character',`${speaker}（续）`);continue;}
      let take=available-1;
      if(remaining-take===1)take--;
      for(let i=0;i<take;i++)putLine(cursor++);
      put('more','（下页续）');newPage();if(speaker)put('character',`${speaker}（续）`);
    }else{
      if(available<2&&remaining>1){newPage();continue;}
      let take=available;if(remaining-take===1&&take>1)take--;
      for(let i=0;i<take;i++)putLine(cursor++);newPage();
    }
   }
  });
 });
 return pages;
}
function paginateCommonChinese(script:Script,measure:(s:string,font?:string,bold?:boolean)=>number):Page[]{
 const layout=layoutFor('commonChinese'),m=layout.metrics.action,bottom=PAGE.height-layout.bottom;
 const pages:Page[]=[{lines:[]}];let page=pages[0],y=layout.top;
 const next=()=>{page={lines:[]};pages.push(page);y=layout.top};
 const space=(count:number)=>{if(y+Math.min(count,Math.floor((bottom-layout.top)/layout.line))*layout.line>bottom)next()};
 const put=(kind:PrintKind,text:string,runs?:TextRun[],bold=false)=>{space(1);page.lines.push({kind,text,runs,x:m.x,width:m.width,y,height:layout.line,bold});y+=layout.line};
 script.scenes.filter(s=>!s.deleted).forEach((scene,index)=>{
  if(index)y+=layout.gap;
  const heading=wrapText(commonChineseHeading(scene,index),m.width,t=>measure(t,script.fontFamily,true));space(heading.length+2);
  heading.forEach(t=>put('scene',t,undefined,true));y+=8;
  for(const block of commonChineseBlocks(scene.blocks).filter(b=>b.text.trim())){
   const b={...block,text:'　　'+block.text,runs:[{text:'　　'},...(block.runs||[{text:block.text}])]};
   const lines=styledLines(b,m.width,script.fontFamily,measure);space(Math.min(2,lines.length));
   for(const line of lines)put(block.kind,line.text,line.runs);
  }
 });return pages;
}
function paginateShortDrama(script:Script,measure:(s:string,font?:string,bold?:boolean)=>number):Page[]{
 const layout=layoutFor('shortDrama'),m=layout.metrics.action,bottom=PAGE.height-layout.bottom;
 const pages:Page[]=[{lines:[]}];let page=pages[0],y=layout.top;
 const next=()=>{page={lines:[]};pages.push(page);y=layout.top;};
 const space=(lines:number)=>{if(y+Math.min(lines,Math.floor((bottom-layout.top)/layout.line))*layout.line>bottom)next();};
 const put=(kind:PrintKind,text:string,runs?:TextRun[],bold=false)=>{space(1);page.lines.push({kind,text,runs,x:m.x,width:m.width,y,height:layout.line,bold});y+=layout.line;};
 const header=(text:string)=>wrapText(text,m.width,t=>measure(t,script.fontFamily,true)).forEach(t=>put('scene',t,undefined,true));
 const scenes=script.scenes.filter(s=>!s.deleted);
 scenes.forEach((scene,index)=>{
  const episodeStart=index===0||episodeOf(scenes[index-1])!==episodeOf(scene);
  const heading=shortHeading(scenes,scene),cast=`人物：${sceneCast(scene)||'—'}`;
  const headingLines=wrapText(heading,m.width,t=>measure(t,script.fontFamily,true));
  const castLines=wrapText(cast,m.width,t=>measure(t,script.fontFamily,true));
  if(index)y+=layout.gap;
  space((episodeStart?1:0)+headingLines.length+castLines.length+2);
  if(episodeStart)header(`第 ${episodeOf(scene)} 集`);
  headingLines.forEach(t=>put('scene',t,undefined,true));castLines.forEach(t=>put('action',t,undefined,true));
  for(const b of shortDramaBlocks(scene.blocks).filter(b=>b.text.trim())){
   const lines=styledLines(b,m.width,script.fontFamily,measure);space(Math.min(2,lines.length));
   lines.forEach(line=>put(b.kind,line.text,line.runs));
  }
 });
 return pages;
}
export const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function printHtml(script:Script,pages:Page[],_fontBase?:string){
 const esc=escapeHtml,infoCount=pages.filter(p=>p.section==='storyInfo').length;
 return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${esc(script.title)}</title><style>
 @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:white;color:#111;font-family:${fontStack(script.fontFamily)};font-size:12pt;font-synthesis:none}.page{position:relative;width:${PAGE.width}pt;height:${PAGE.height}pt;break-after:page;overflow:hidden}.page:last-child{break-after:auto}.line{position:absolute;white-space:pre;line-height:${PAGE.line}pt;height:${PAGE.line}pt}.num{position:absolute;right:72pt;top:36pt}.cover-title{position:absolute;top:260pt;left:90pt;right:90pt;text-align:center;font-size:24pt;line-height:1.8}.cover-author{position:absolute;top:345pt;left:90pt;right:90pt;text-align:center;white-space:pre-wrap}.contact{position:absolute;left:108pt;bottom:72pt;white-space:pre-wrap;max-width:415pt}.common-page-number{position:absolute;bottom:36pt;left:0;right:0;text-align:center}.scene-no{position:absolute;font-family:inherit;font-size:12pt}
 @media print{body{background:white!important}.page{margin:0!important;box-shadow:none!important}}
 </style></head><body><section class="page"><div class="cover-title">${esc(script.title)}</div><div class="cover-author">编剧<br><br>${esc(script.author||'')}</div><div class="contact">${esc(script.contact||'')}</div></section>${pages.map((p,i)=>`<section class="page" data-section="${p.section||'manuscript'}">${script.layout==='commonChinese'?`<div class="common-page-number">${i+1}</div>`:p.section!=='storyInfo'&&i-infoCount>0?`<div class="num">${i-infoCount+1}.</div>`:''}${p.lines.map(l=>`<div class="line" style="left:${l.x}pt;top:${l.y}pt;width:${l.width}pt;height:${l.height}pt;line-height:${l.height}pt;${l.bold?'font-weight:700;font-synthesis:weight;':''}${l.kind==='transition'?'text-align:right':''}">${l.runs?l.runs.map(r=>`<span${r.fontFamily?` style="font-family:${esc(fontStack(r.fontFamily))}"`:""}>${esc(r.text)}</span>`).join(''):esc(l.text)}</div>${l.sceneNumber?`<span class="scene-no" style="left:${script.layout==='chinese'?85.0394:63}pt;top:${l.y}pt">${l.sceneNumber}</span>${script.layout==='chinese'?'':`<span class="scene-no" style="right:36pt;top:${l.y}pt">${l.sceneNumber}</span>`}`:''}`).join('')}</section>`).join('')}</body></html>`;
}
