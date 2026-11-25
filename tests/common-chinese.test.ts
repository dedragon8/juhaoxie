import test from 'node:test';import assert from 'node:assert/strict';
import {type Script,fromSnapshot,snapshot} from '../src/core/model';
import {commonChineseBlocks,commonChineseHeading} from '../src/core/common-chinese';
import {paginate,PAGE,printHtml} from '../src/core/pagination';
import {wordDocumentXml} from '../src/core/word-export';
import {documentClipboard} from '../src/core/document-copy';
import {parseSceneClipboard} from '../src/core/clipboard';
import {encodeDrg,decodeDrg} from '../src/core/drg';
import {codexConnectionConfig,codexSetupInstruction} from '../src/core/agent-setup';
const script:Script={schemaVersion:1,title:'电影格式',author:'测试',contact:'',characters:{},layout:'commonChinese',scenes:[{id:'s1',order:'a0',setting:'内景',location:'餐馆',time:'日',summary:'私密梗概',notes:'私密笔记',deleted:false,blocks:[{kind:'action',text:'咖啡凉了。'},{kind:'character',text:'白先生'},{kind:'parenthetical',text:'轻声'},{kind:'dialogue',text:'我们走吧。',runs:[{text:'我们走吧。',fontFamily:'Songti SC'}]}]}]};
test('common film layout has inline speech, no short drama marks, and preserves structured data and portable format',async()=>{
 const before=structuredClone(script),scene=script.scenes[0];assert.equal(commonChineseHeading(scene,0),'1　餐馆　日　内景');assert.deepEqual(commonChineseBlocks(scene.blocks).map(b=>b.text),['咖啡凉了。','白先生（轻声）：我们走吧。']);
 const doc=fromSnapshot(script);assert.equal(snapshot(doc).layout,'commonChinese');doc.destroy();
 const encoded=await encodeDrg(script,{documentId:'test',protected:false});assert.deepEqual((await decodeDrg(encoded)).script,script);
 const copy=documentClipboard(script);assert.ok(copy.text.includes('　　白先生（轻声）：我们走吧。'));assert.ok(!copy.text.includes('△'));assert.ok(!copy.text.includes('私密'));assert.deepEqual(parseSceneClipboard(copy.internal)![0].blocks.map(({kind,text})=>({kind,text})),scene.blocks.map(({kind,text})=>({kind,text})));assert.equal(parseSceneClipboard(copy.internal)![0].blocks[3].runs?.[0].fontFamily,'Songti SC');assert.deepEqual(script,before);
 const xml=wordDocumentXml(script);assert.ok(xml.includes('w:firstLine="480"'));assert.ok(xml.includes('footerReference'));assert.ok(!xml.includes('第 1 集'));assert.ok(!xml.includes('△'));
});
test('common film pagination keeps long mixed-font speech and A4 bounds',()=>{
 const speech='明天还会再来。'.repeat(1200),s:Script={...script,scenes:[{...script.scenes[0],blocks:[{kind:'character',text:'白先生'},{kind:'dialogue',text:speech,runs:[{text:speech,fontFamily:'Songti SC'}]}]}]};
 const pages=paginate(s,t=>Array.from(t).length*12);assert.ok(pages.length>2);
 for(const line of pages.flatMap(p=>p.lines)){assert.ok(line.y+line.height<=PAGE.height-72+.01);assert.ok(line.x>=0&&line.x+line.width<=PAGE.width);if(line.runs)assert.equal(line.runs.map(r=>r.text).join(''),line.text)}
 assert.equal(pages.flatMap(p=>p.lines).filter(l=>l.kind==='dialogue').map(l=>l.text).join(''),'　　白先生：'+speech);
 assert.ok(printHtml(s,pages).includes('Songti SC'));
});
test('copied agent instruction carries exact local paths, preserves authorization and requires a real read check',()=>{
 const config={command:'/Applications/剧好写.app/Contents/MacOS/剧好写',args:['/path with spaces/mcp.cjs'],env:{ELECTRON_RUN_AS_NODE:'1',JUHAO_CONNECTION_FILE:'/path with spaces/connection.json'}};
 const text=codexSetupInstruction(config);assert.ok(text.includes(codexConnectionConfig(config)));assert.ok(text.includes('read_script'));assert.ok(text.includes('不自动开启写入'));assert.ok(text.includes('配置已完成，连接尚待验证'));assert.ok(text.includes('保留其他服务'));assert.ok(text.includes('先备份'));
});
