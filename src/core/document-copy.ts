import {commonChineseBlocks,commonChineseHeading} from './common-chinese';
import {episodeOf,sceneCast,shortHeading,shortDramaBlocks} from './short-drama';
import {displayBlock,sceneHeading,type Script,type Block} from './model';
import {sceneClipboard} from './clipboard';
import {fontStack} from './fonts';
import {layoutFor} from './layout';
const escape=(text:string)=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const textOf=(block:Block)=>block.kind==='parenthetical'&&!/^[（(]/.test(block.text)?`（${block.text}）`:displayBlock(block);
export function documentClipboard(script:Script){
 const scenes=script.scenes.filter(s=>!s.deleted),metrics=layoutFor(script.layout).metrics;
 const short=script.layout==='shortDrama',common=script.layout==='commonChinese';
 const blocksOf=(scene:typeof scenes[number])=>common?commonChineseBlocks(scene.blocks):short?shortDramaBlocks(scene.blocks):scene.blocks;
 const headers=(scene:typeof scenes[number],i:number)=>common?[commonChineseHeading(scene,i)]:short?[...(i===0||episodeOf(scenes[i-1])!==episodeOf(scene)?[`第 ${episodeOf(scene)} 集`]:[]),shortHeading(scenes,scene),`人物：${sceneCast(scene)||'—'}`]:[`${i+1}. ${sceneHeading(scene)}`];
 const text=[script.title,script.author,...scenes.flatMap((scene,i)=>['',...headers(scene,i),...blocksOf(scene).map(b=>(common?'　　':'')+textOf(b))])].filter((s,i)=>i!==1||s).join('\n');
 const html=`<html><meta charset="utf-8"><body style="font-family:${escape(fontStack(script.fontFamily))};font-size:12pt"><h1>${escape(script.title)}</h1>${script.author?`<p>${escape(script.author)}</p>`:''}${scenes.map((scene,i)=>`${headers(scene,i).map(h=>`<h2 style="font-size:12pt">${escape(h)}</h2>`).join('')}${blocksOf(scene).map(block=>{const value=textOf(block),prefix=value===block.text?0:block.kind==='parenthetical'?1:value.length-block.text.length;const body=block.runs?escape(value.slice(0,prefix))+block.runs.map(run=>`<span style="font-family:${escape(fontStack(run.fontFamily||script.fontFamily))}">${escape(run.text)}</span>`).join('')+escape(value.slice(prefix+block.text.length)):escape(value);return `<p style="${common?'text-indent:24pt;':''}${common||short?`margin-top:0;margin-bottom:0;line-height:${layoutFor(script.layout).line}pt;`:''}margin-left:${Number((metrics[block.kind].x-metrics.action.x).toFixed(4))}pt;${script.layout==='chinese'&&block.kind==='character'?'font-weight:700;':''}white-space:pre-wrap">${body}</p>`}).join('')}`).join('')}</body></html>`;
 const internal=sceneClipboard(script);
 return {text,html:html.replace('<h1>',`<div data-juhaoxie-scenes="${escape(encodeURIComponent(internal))}"><h1>`).replace('</body>','</div></body>'),internal};
}
