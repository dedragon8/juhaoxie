import test from 'node:test';import assert from 'node:assert/strict';
import {shortDramaBlocks,shortSceneNumber,sceneCast} from '../src/core/short-drama';
import {snapshot,fromSnapshot,validateScript,addScene,listScenes,type Script,type Scene} from '../src/core/model';
import {documentClipboard} from '../src/core/document-copy';
import {parseSceneClipboard} from '../src/core/clipboard';
import {paginate,PAGE,printHtml} from '../src/core/pagination';
const scene:Scene={id:'s1',order:'a0',episode:2,setting:'外景',location:'车站',time:'夜',cast:'林舟、旅客若干',summary:'私密梗概',notes:'私密笔记',deleted:false,blocks:[{kind:'action',text:'末班车驶离。'},{kind:'character',text:'林舟',runs:[{text:'林舟',fontFamily:'Songti SC'}]},{kind:'parenthetical',text:'OS'},{kind:'dialogue',text:'原来你一直在这里。'},{kind:'action',text:'【字幕：十分钟前】'},{kind:'action',text:'闪回'},{kind:'action',text:'△车站里人来人往。'},{kind:'action',text:'闪回结束'}]};
const script:Script={schemaVersion:1,title:'夜车',author:'测试',contact:'',layout:'shortDrama',characters:{},scenes:[scene,{...scene,id:'hidden',deleted:true},{...scene,id:'s2',order:'a1',episode:2},{...scene,id:'s3',order:'a2',episode:3}]};
test('short drama numbers exclude hidden scenes and presentation does not mutate semantic blocks',()=>{
 const before=structuredClone(script);assert.equal(shortSceneNumber(script.scenes,script.scenes[2]),'2-2');assert.equal(shortSceneNumber(script.scenes,script.scenes[3]),'3-1');
 const rows=shortDramaBlocks(scene.blocks);assert.equal(rows[0].text,'△末班车驶离。');assert.equal(rows[1].text,'林舟（OS）：原来你一直在这里。');assert.equal(rows[1].runs?.[0].fontFamily,'Songti SC');assert.equal(rows[2].text,'【字幕：十分钟前】');assert.equal(rows[4].text,'△车站里人来人往。');assert.deepEqual(script,before);
 assert.equal(sceneCast({...scene,cast:''}),'林舟');
});
test('short drama survives backup, cross-project copying, and scene creation inherits the episode',()=>{
 const doc=fromSnapshot(script),saved=snapshot(doc);assert.equal(saved.layout,'shortDrama');assert.equal(saved.scenes[0].episode,2);assert.equal(saved.scenes[0].cast,scene.cast);assert.deepEqual(saved.scenes[0].blocks.map(b=>b.text),scene.blocks.map(b=>b.text));
 const id=addScene(doc,saved.scenes[0].id);assert.equal(listScenes(doc).find(s=>s.id===id)?.episode,2);doc.destroy();
 const copied=documentClipboard(script);assert.ok(copied.text.includes('2-2  夜  外  车站'));assert.ok(copied.text.includes('人物：林舟、旅客若干'));assert.ok(copied.text.includes('林舟（OS）：原来你一直在这里。'));assert.ok(!copied.text.includes('私密'));assert.ok(!copied.html.includes('私密'));
 const pasted=parseSceneClipboard(copied.internal)!;assert.equal(pasted.length,3);assert.equal(pasted[0].episode,2);assert.equal(pasted[0].cast,scene.cast);assert.equal(pasted[0].blocks[1].kind,'character');assert.equal(pasted[0].blocks[1].text,'林舟');assert.ok(copied.html.includes('Songti SC'));
 assert.throws(()=>validateScript({...script,scenes:[{...scene,episode:0}]}));
});
test('A4 short drama pagination preserves long speech including mixed fonts and escapes export',()=>{
 const speech='等到天亮，我们一起离开。'.repeat(1500),s:Script={...script,scenes:[{...scene,blocks:[{kind:'character',text:'林舟'},{kind:'parenthetical',text:'（轻声）'},{kind:'dialogue',text:speech,runs:[{text:speech,fontFamily:'Songti SC'}]},{kind:'action',text:'【字幕：<天亮>】'}]}]};
 const pages=paginate(s,t=>Array.from(t).length*12);assert.ok(pages.length>2);
 for(const line of pages.flatMap(p=>p.lines)){assert.ok(line.y+line.height<=PAGE.height-56.6929+.01);assert.ok(line.x>=0&&line.x+line.width<=PAGE.width);assert.ok(Array.from(line.text).length*12<=line.width+.01);if(line.runs)assert.equal(line.runs.map(r=>r.text).join(''),line.text)}
 assert.equal(pages.flatMap(p=>p.lines).filter(l=>l.kind==='dialogue').map(l=>l.text).join(''),'林舟（轻声）：'+speech);
 const html=printHtml(s,pages);assert.ok(html.includes('@page{size:A4'));assert.ok(html.includes('&lt;天亮&gt;'));assert.ok(html.includes('Songti SC'));
});
