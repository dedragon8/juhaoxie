import {commonChineseBlocks,commonChineseHeading} from './common-chinese';
import {displayBlock,sceneHeading,type Script,type TextRun} from './model';
import {layoutFor} from './layout';
import {episodeOf,sceneCast,shortHeading,shortDramaBlocks} from './short-drama';
import {zipStore} from './zip-store';
const esc=(s:string)=>s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const twips=(points:number)=>Math.round(points*20);
// Editable paragraphs using the same A4 layout metrics as the screenplay preview.
// Word controls its own line wrapping, rather than receiving absolutely positioned PDF lines.
export function wordDocumentXml(script:Script){
 const layout=layoutFor(script.layout),font=script.fontFamily||'PingFang SC',width=595.2756;
 type Options={firstLine?:number;bold?:boolean;size?:number;x?:number;width?:number;before?:number;line?:number;align?:string;keep?:boolean;page?:boolean};
 const paragraph=(runs:string|TextRun[],o:Options={})=>{
  const x=o.x??72,right=width-x-(o.width??width-144),r=typeof runs==='string'?[{text:runs}]:runs;
  return `<w:p><w:pPr>${o.keep?'<w:keepNext/>':''}${o.page?'<w:pageBreakBefore/>':''}<w:widowControl/><w:spacing w:before="${twips(o.before||0)}" w:after="0" w:line="${twips(o.line||layout.line)}" w:lineRule="atLeast"/><w:ind w:left="${twips(x-72)}" w:right="${twips(right-72)}"${o.firstLine?` w:firstLine="${twips(o.firstLine)}"`:""}/>${o.align?`<w:jc w:val="${o.align}"/>`:''}</w:pPr>${r.map(run=>`<w:r><w:rPr><w:rFonts w:ascii="${esc(run.fontFamily||font)}" w:hAnsi="${esc(run.fontFamily||font)}" w:eastAsia="${esc(run.fontFamily||font)}"/>${o.bold?'<w:b/>':''}<w:color w:val="111111"/><w:sz w:val="${(o.size||12)*2}"/></w:rPr>${run.text.split('\n').map(t=>`<w:t xml:space="preserve">${esc(t)}</w:t>`).join('<w:br/>')}</w:r>`).join('')}</w:p>`;
 };
 const body=[paragraph(script.title,{size:24,align:'center',before:188,line:44}),paragraph(`编剧\n\n${script.author}`,{align:'center',before:22}),paragraph(script.contact||'',{before:90})];
 let nextPage=true;
 const put=(text:string|TextRun[],options:Options={})=>{body.push(paragraph(text,{...options,page:nextPage}));nextPage=false};
 const scenes=script.scenes.filter(s=>!s.deleted);
 if(script.includeStoryInfo){
  put('人物设定与故事梗概',{bold:true,size:16,keep:true});put('人物设定',{bold:true,before:20,keep:true});
  const names=[...new Set([...scenes.flatMap(s=>s.blocks.filter(b=>b.kind==='character').map(b=>b.text.replace(/（.*?）|\(.*?\)/g,'').trim())),...Object.keys(script.characterDescriptions||{})].filter(Boolean))];
  for(const name of names){put(name,{bold:true,before:12,keep:!!script.characterDescriptions?.[name]});if(script.characterDescriptions?.[name])put(script.characterDescriptions[name])}
  put('故事梗概',{bold:true,before:20,keep:!!script.storySynopsis});if(script.storySynopsis)put(script.storySynopsis);nextPage=true;
 }
 scenes.forEach((scene,i)=>{
  if(script.layout==='commonChinese'){
   put(commonChineseHeading(scene,i),{...layout.metrics.scene,bold:true,keep:true,before:i?layout.gap:0});
   commonChineseBlocks(scene.blocks).forEach((block,index)=>put(block.runs||block.text,{...layout.metrics.action,firstLine:24,before:index===0?8:0}));return;
  }
  if(script.layout==='shortDrama'){
   if(i===0||episodeOf(scenes[i-1])!==episodeOf(scene))put(`第 ${episodeOf(scene)} 集`,{bold:true,keep:true,before:i?layout.gap:0});
   put(shortHeading(scenes,scene),{bold:true,keep:true,before:i?layout.gap:0});put(`人物：${sceneCast(scene)||'—'}`,{bold:true,keep:true});
   for(const block of shortDramaBlocks(scene.blocks))put(block.runs||block.text,{before:0});return;
  }
  const heading=layout.metrics.scene;put(`${i+1}　${sceneHeading(scene)}`,{...heading,bold:true,keep:true,before:i?layout.gap:0});
  let previous='scene';for(const block of scene.blocks){
   const m=layout.metrics[block.kind],speech=['character','dialogue','parenthetical'].includes(block.kind),formatted=displayBlock(block);
   const text=block.kind==='parenthetical'&&!/^[（(]/.test(block.text)?`（${block.text}）`:formatted;
   let runs:TextRun[]=block.runs||[{text:block.text}];if(text!==block.text){const start=text.indexOf(block.text);runs=start>=0?[{text:text.slice(0,start)},...runs,{text:text.slice(start+block.text.length)}]:[{text}]}
   const gap=block.kind==='character'||!speech&&!(previous==='action'&&block.kind==='action');
   put(runs,{...m,bold:script.layout==='chinese'&&block.kind==='character',line:speech?layout.speechLine:layout.line,before:gap?layout.gap:0,keep:['character','parenthetical','montage','sequence'].includes(block.kind)});previous=block.kind;
  }
 });
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body.join('')}<w:sectPr>${script.layout==='commonChinese'?'<w:footerReference w:type="default" r:id="footer1"/>':''}<w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="${twips(layout.top)}" w:right="1440" w:bottom="${twips(layout.bottom)}" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>${script.layout==='commonChinese'?'<w:pgNumType w:start="0"/><w:titlePg/>':''}</w:sectPr></w:body></w:document>`;
}
export function exportWord(script:Script){return zipStore({
 '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>',
 '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
 'word/_rels/document.xml.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="footer1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>',
 'word/footer1.xml':'<?xml version="1.0" encoding="UTF-8"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:fldSimple w:instr="PAGE"><w:r><w:t>1</w:t></w:r></w:fldSimple></w:p></w:ftr>',
 'word/document.xml':wordDocumentXml(script)
})}
