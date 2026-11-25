import type {CSSProperties,ReactNode} from 'react';
import {shortParagraphClasses,shortHeading,sceneCast} from '../core/short-drama';
import {commonChineseHeading} from '../core/common-chinese';
import {layoutVariables,type LayoutStyle} from '../core/layout';
import {fontStack} from '../core/fonts';
import type {PromptSpan} from '../core/prompt-types';
import type {promptSources} from '../core/video-prompts';
type Scenes=ReturnType<typeof promptSources>;
export function PromptSourceScene({scene,scenes,index,layout,font,source}:{scene:Scenes[number];scenes:Scenes;index:number;layout:LayoutStyle;font?:string;source:PromptSpan[]}){
 return <section className="prompt-source-scene prompt-source-manuscript manuscript" data-layout={layout} style={{...layoutVariables(layout),'--document-font':fontStack(font)} as CSSProperties}>
  <h3>{layout==='commonChinese'?commonChineseHeading(scene,index):layout==='shortDrama'?shortHeading(scenes,scene):`${String(index+1).padStart(2,'0')}　${scene.setting}　${scene.location}　${scene.time}`}</h3>
  {layout==='shortDrama'&&<div className="prompt-source-cast">人物：{sceneCast(scene)}</div>}
  <div className="script-editor prompt-readonly-editor">{scene.paragraphs.map((p,i)=>{
   const ranges=source.filter(s=>s.sceneId===scene.id&&s.paragraphId===p.paragraphId&&s.paragraphText===p.text);
   const cuts=new Set([0,p.text.length]);ranges.forEach(s=>{cuts.add(s.start);cuts.add(s.end)});let offset=0;const runs=(p.runs||[{text:p.text}]).map(run=>{const start=offset;offset+=run.text.length;cuts.add(start);cuts.add(offset);return {...run,start,end:offset}});
   const positions=[...cuts].sort((a,b)=>a-b),parts:ReactNode[]=positions.slice(0,-1).map((start,j)=>{const end=positions[j+1],run=runs.find(r=>r.start<=start&&r.end>=end),text=p.text.slice(start,end),content=run?.fontFamily?<span key={start} style={{fontFamily:fontStack(run.fontFamily)}}>{text}</span>:text;return ranges.some(s=>s.start<=start&&s.end>=end)?<mark key={start}>{content}</mark>:<span key={start}>{content}</span>});
   return <p data-kind={p.kind} className={shortParagraphClasses(scene.paragraphs,i).join(' ')} data-prompt-paragraph={p.paragraphId} data-scene-id={scene.id} data-index={p.paragraphIndex} key={p.paragraphId}>{parts.length?parts:<br/>}</p>;
  })}</div>
 </section>;
}
