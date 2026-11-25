import test from 'node:test';import assert from 'node:assert/strict';
import * as Y from 'yjs';
import {fromSnapshot,snapshot,renameCharacter,type Script,validateScript} from '../src/core/model';
import {paginate,printHtml,PAGE} from '../src/core/pagination';
import {encodeDrg,decodeDrg} from '../src/core/drg';
const script:Script={schemaVersion:1,title:'资料页',author:'作者',contact:'',characters:{},includeStoryInfo:true,storySynopsis:'一段故事。',characterDescriptions:{林舟:'带着秘密回乡的人。'},scenes:[{id:'a',order:'a0',setting:'外景',location:'车站',time:'日',summary:'私密场景梗概',notes:'私密笔记',deleted:false,blocks:[{kind:'character',text:'林舟'},{kind:'dialogue',text:'你好。'}]},{id:'b',order:'a1',setting:'内景',location:'家',time:'夜',summary:'',notes:'',deleted:true,blocks:[{kind:'character',text:'林舟（OS）'}]}]};
test('story info survives document, file, collaboration and rename including hidden character cues',async()=>{
 const doc=fromSnapshot(script);renameCharacter(doc,'林舟','林川');const s=snapshot(doc);assert.equal(s.characterDescriptions?.林川,script.characterDescriptions?.林舟);assert.equal(s.characterDescriptions?.林舟,undefined);assert.equal(s.scenes[1].blocks[0].text,'林川（OS）');
 const peer=new Y.Doc();Y.applyUpdate(peer,Y.encodeStateAsUpdate(doc));assert.deepEqual(snapshot(peer),s);
 const file=await decodeDrg(await encodeDrg(s,{documentId:'story-info',protected:true}));assert.deepEqual(file.script,JSON.parse(JSON.stringify(s)));assert.equal(file.protected,true);
 doc.destroy();peer.destroy();
});
test('optional front matter precedes manuscript, keeps private notes out and never clips long introductions',()=>{
 const s={...script,storySynopsis:'故事'.repeat(3000),characterDescriptions:{林舟:'背景'.repeat(1800)}};
 const pages=paginate(s,t=>Array.from(t).length*12),info=pages.filter(p=>p.section==='storyInfo');assert.ok(info.length>2);assert.equal(pages[0].section,'storyInfo');assert.equal(pages.at(-1)?.section,undefined);
 const text=info.flatMap(p=>p.lines).map(l=>l.text).join('');assert.ok(text.includes(s.storySynopsis));assert.ok(text.includes(s.characterDescriptions.林舟));
 for(const p of info)for(const l of p.lines){assert.ok(l.y+l.height<=PAGE.height-72+.001);assert.ok(l.x+l.width<=PAGE.width-72+.001)}
 const html=printHtml(s,pages);assert.ok(html.indexOf('cover-title')<html.indexOf('data-section="storyInfo"'));assert.ok(html.indexOf('data-section="storyInfo"')<html.indexOf('data-section="manuscript"'));assert.ok(!html.includes('私密笔记'));assert.ok(!html.includes('私密场景梗概'));
 assert.ok(paginate({...s,includeStoryInfo:false},t=>t.length*12).every(p=>!p.section));assert.throws(()=>validateScript({...s,characterDescriptions:{林舟:2}}),/人物介绍/);
});
test('short drama uses equal spacing for wrapped, consecutive and different-type body lines',()=>{
 const blocks:Script['scenes'][number]['blocks']=[{kind:'action',text:'一行\n二行'},{kind:'action',text:'三行'},{kind:'character',text:'林舟'},{kind:'parenthetical',text:'（OS）'},{kind:'dialogue',text:'对白'},{kind:'action',text:'结束'}];
 const lines=paginate({...script,includeStoryInfo:false,layout:'shortDrama',scenes:[{...script.scenes[0],blocks}]},t=>t.length*12).flatMap(p=>p.lines);
 const first=lines.find(l=>l.text==='△一行')!,second=lines.find(l=>l.text==='二行')!,third=lines.find(l=>l.text==='△三行')!,speech=lines.find(l=>l.kind==='dialogue')!,last=lines.find(l=>l.text==='△结束')!;
 assert.equal(second.y-first.y,18);assert.equal(third.y-second.y,18);assert.equal(speech.y-third.y,18);assert.equal(last.y-speech.y,18);
});
