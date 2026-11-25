import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_KEYS,shortcutError,keyFromEvent} from '../src/core/preferences';
import {nextKind,fromSnapshot,snapshot,type Script} from '../src/core/model';
import {paginate,PAGE} from '../src/core/pagination';
test('shortcuts protect basic typing, reserved keys and duplicate commands',()=>{
 assert.match(shortcutError('KeyA','action',DEFAULT_KEYS),/文字输入/);
 assert.match(shortcutError('Mod+KeyZ','action',DEFAULT_KEYS),/保留/);
 assert.match(shortcutError('Mod+Digit1','action',DEFAULT_KEYS),/人物/);
 assert.equal(shortcutError('Mod+Alt+KeyA','action',DEFAULT_KEYS),'');
 assert.equal(keyFromEvent({code:'Digit7',metaKey:true,altKey:true,ctrlKey:false,shiftKey:false}),'Mod+Alt+Digit7');
});
test('montage and continuous sequence types survive backup and paginate without stranded headings',()=>{
 assert.equal(nextKind('montage','等待'),'shot');assert.equal(nextKind('sequence','走廊'),'shot');assert.equal(nextKind('shot','画面'),'shot');assert.equal(nextKind('shot',''),'sequenceEnd');assert.equal(nextKind('sequenceEnd','蒙太奇'),'action');
 for(let n=32;n<44;n++){
 const script:Script={schemaVersion:1,title:'新格式',author:'',contact:'',characters:{},scenes:[{id:'a',order:'a0',location:'站台',setting:'外景',time:'日',summary:'',notes:'',deleted:false,blocks:[{kind:'action',text:Array(n).fill('雨').join('\n')},{kind:'montage',text:'时间流逝'},{kind:'shot',text:'叶子落下。'},{kind:'sequenceEnd',text:'蒙太奇'},{kind:'sequence',text:'穿过车站'},{kind:'shot',text:'脚步声。'},{kind:'sequenceEnd',text:'连续镜头'}]}]};
 const restored=snapshot(fromSnapshot(script));assert.deepEqual(restored.scenes[0].blocks,script.scenes[0].blocks.map(b=>({...b,characterId:undefined})));
 const pages=paginate(restored,s=>s.length*12);for(const p of pages){assert.ok(!['montage','sequence'].includes(p.lines.at(-1)?.kind||''));assert.ok(p.lines.every(l=>l.y+PAGE.line<=PAGE.height-PAGE.bottom));}assert.ok(pages.flatMap(p=>p.lines).some(l=>l.text==='连续镜头：穿过车站'));
 }
});
