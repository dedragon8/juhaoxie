import test from 'node:test';import assert from 'node:assert/strict';import {promptExportText,promptExportHtml,promptExportWord} from '../src/core/prompt-export';import {execFileSync} from 'node:child_process';import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
const items=[{number:1,text:'【人物】琳娜\n\n【内容】抬头 <转身> & 注视门口。'},{number:3,text:'【镜头】35mm\n\n【声音】你好。'.repeat(200)}];
test('Prompt TXT and print HTML retain full selected texts without interpreting screenplay content as markup',()=>{assert.equal(promptExportText([items[0]],true),items[0].text);const text=promptExportText(items);assert.ok(text.includes('镜头 3'));assert.ok(text.includes(items[1].text));const html=promptExportHtml('片名 <测试>',items);assert.ok(html.includes('size:A4'));assert.ok(html.includes('&lt;转身&gt; &amp;'));assert.ok(!html.includes('<转身>'));assert.equal((html.match(/<section>/g)||[]).length,2);assert.ok(html.includes('break-before:page'));assert.equal((html.match(/你好。/g)||[]).length,200)});
test('Prompt Word opens as OOXML and keeps long text, paragraph structure and shot numbering',()=>{const folder=mkdtempSync(join(tmpdir(),'juhao-prompt-word-'));try{const file=join(folder,'prompts.docx');writeFileSync(file,promptExportWord('片名 <测试>',items));execFileSync('/usr/bin/python3',['-c',`import sys,zipfile,xml.etree.ElementTree as E
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 for name in z.namelist(): E.fromstring(z.read(name))
 root=E.fromstring(z.read('word/document.xml')); ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
 text=''.join(root.itertext()); assert '片名 <测试> · 镜头 3' in text and '<转身> & 注视门口。' in text
 assert text.count('你好。')==200
 assert len(root.findall('.//w:pageBreakBefore',ns))==1
 assert root.find('.//w:pgSz',ns).attrib['{'+ns['w']+'}w']=='11906'`,file])}finally{rmSync(folder,{recursive:true,force:true})}});
