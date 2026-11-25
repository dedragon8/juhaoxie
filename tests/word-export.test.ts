import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {exportWord,wordDocumentXml} from '../src/core/word-export';import {zipStore} from '../src/core/zip-store';import type {Script} from '../src/core/model';
const script:Script={schemaVersion:1,title:'导出 <测试>',author:'编剧',contact:'',characters:{},includeStoryInfo:true,characterDescriptions:{琳娜:'人物简介'},storySynopsis:'故事梗概正文',scenes:[{id:'a',order:'a0',setting:'内景',location:'客厅',time:'夜',notes:'秘密创作笔记',summary:'内部梗概',deleted:false,blocks:[{kind:'character',text:'琳娜'},{kind:'parenthetical',text:'低声'},{kind:'dialogue',text:'不要关灯。\n等我回来。',runs:[{text:'不要关灯。',fontFamily:'Songti SC'},{text:'\n等我回来。'}]}]},{id:'b',order:'a1',setting:'外景',location:'隐藏场景',time:'日',notes:'',summary:'',deleted:true,blocks:[{kind:'action',text:'隐藏内容'}]}]};
test('editable A4 Word ZIP is readable by an independent parser, excludes hidden/private content, retains font and structure',()=>{
 const folder=mkdtempSync(join(tmpdir(),'juhao-word-'));try{for(const layout of ['hollywood','commonChinese','chinese','shortDrama'] as const){const file=join(folder,layout+'.docx');writeFileSync(file,exportWord({...script,layout}));
 const result=execFileSync('/usr/bin/python3',['-c',`import sys, zipfile, xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 for n in z.namelist(): E.fromstring(z.read(n))
 root=E.fromstring(z.read('word/document.xml')); ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
 text=''.join(root.itertext()); assert '隐藏内容' not in text and '秘密创作笔记' not in text and '内部梗概' not in text
 assert '不要关灯。' in text and '等我回来。' in text and '人物简介' in text and '故事梗概正文' in text
 assert root.find('.//w:pgSz',ns).attrib['{'+ns['w']+'}w']=='11906'
 assert len(root.findall('.//w:pageBreakBefore',ns))==2
 assert root.find('.//w:br',ns) is not None
 print(text)`,file],{encoding:'utf8'});assert.ok(result.includes('导出 <测试>'))}
 }finally{rmSync(folder,{recursive:true,force:true})}
});
test('Word dialogue indents and Chinese bold cues differ from short-drama inline names',()=>{const cn=wordDocumentXml({...script,layout:'chinese'});assert.ok(cn.includes('w:left="2529"'));const short=wordDocumentXml({...script,layout:'shortDrama'});assert.ok(short.includes('人物：琳娜'));assert.ok(short.includes('（'));assert.ok(short.includes('）'));assert.ok(short.includes('：'));assert.ok(!wordDocumentXml({...script,includeStoryInfo:false}).includes('人物简介'))});
test('individual UTF-8 prompt text files remain exact inside ZIP',()=>{const folder=mkdtempSync(join(tmpdir(),'juhao-prompts-'));try{const file=join(folder,'bundle.zip');writeFileSync(file,zipStore({'镜头-001.txt':'【人物】琳娜\n\n【内容】抬头。','镜头-002.txt':'第二个完整 prompt。'}));execFileSync('/usr/bin/python3',['-c',`import sys,zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 assert z.read('镜头-001.txt').decode()=='【人物】琳娜\\n\\n【内容】抬头。'
 assert len(z.namelist())==2`,file])}finally{rmSync(folder,{recursive:true,force:true})}});
