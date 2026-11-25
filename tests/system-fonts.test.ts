import test from 'node:test';import assert from 'node:assert/strict';
import {validFont,fontStack} from '../src/core/fonts';
import {fromSnapshot,snapshot,type Script,validateScript} from '../src/core/model';
import {encodeDrg,decodeDrg} from '../src/core/drg';
import {documentClipboard} from '../src/core/document-copy';
import {parseSceneClipboard} from '../src/core/clipboard';
import {paginate,printHtml} from '../src/core/pagination';
import {wordDocumentXml} from '../src/core/word-export';
const script:Script={schemaVersion:1,title:'字体',author:'',contact:'',characters:{},fontFamily:'Test Portable 未安装字体',layout:'commonChinese',scenes:[{id:'s',order:'a0',setting:'内景',location:'书房',time:'日',summary:'',notes:'',deleted:false,blocks:[{kind:'action',text:'第一行\n第二行'},{kind:'character',text:'小林'},{kind:'dialogue',text:'你好',runs:[{text:'你好',fontFamily:'Hiragino Sans GB'}]},{kind:'action',text:'结束'}]}]};
test('installed and missing font names survive save, copy, PDF HTML and Word without a static whitelist',async()=>{
 validateScript(script);const doc=fromSnapshot(script);assert.equal(snapshot(doc).fontFamily,script.fontFamily);assert.deepEqual(snapshot(doc).scenes[0].blocks[2].runs,script.scenes[0].blocks[2].runs);doc.destroy();
 assert.deepEqual((await decodeDrg(await encodeDrg(script,{documentId:'fonts',protected:false}))).script,script);
 const clipboard=documentClipboard(script);assert.equal(parseSceneClipboard(clipboard.internal)![0].blocks[2].runs![0].fontFamily,'Hiragino Sans GB');
 const html=printHtml(script,paginate(script,s=>s.length*12)),word=wordDocumentXml(script);
 for(const font of [script.fontFamily!,'Hiragino Sans GB']){assert.ok(html.includes(font));assert.ok(word.includes(font))}
 assert.ok(fontStack(script.fontFamily).includes('"PingFang SC"'));assert.ok(validFont("Writer's Font"));
 for(const name of ['', ' a', '</style><script>', 'x";color:red', 'x\\22', 'x\ny', 'x'.repeat(201)]){assert.equal(validFont(name),false);assert.throws(()=>validateScript({...script,fontFamily:name}))}
});
test('common Chinese and short drama share uniform body spacing through wrapping, type changes, Word and clipboard',()=>{
 for(const layout of ['commonChinese','shortDrama'] as const){
  const s={...script,layout},lines=paginate(s,t=>t.length*12).flatMap(p=>p.lines).filter(l=>l.kind!=='scene');
  for(let i=1;i<lines.length;i++)assert.equal(lines[i].y-lines[i-1].y,18);
  const xml=wordDocumentXml(s),paragraphs=xml.match(/<w:p>.*?<\/w:p>/g)!;
  const speech=paragraphs.find(p=>p.includes('你好'))!,last=paragraphs.find(p=>p.includes('结束'))!;
  for(const p of [speech,last]){assert.ok(p.includes('w:before="0"'));assert.ok(p.includes('w:line="360"'))}
  assert.ok(documentClipboard(s).html.includes('margin-top:0;margin-bottom:0;line-height:18pt;'));
 }
});
