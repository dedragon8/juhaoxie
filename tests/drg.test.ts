import test from 'node:test';import assert from 'node:assert/strict';
import {encodeDrg,decodeDrg,drgFilename} from '../src/core/drg';
import {type Script} from '../src/core/model';
const script:Script={schemaVersion:1,title:'夜车',author:'作者',contact:'',layout:'shortDrama',fontFamily:'Songti SC',acts:[{id:'act',name:'第一幕',order:'a0'}],characters:{a:'林舟'},scenes:[{id:'scene',order:'a0',name:'开场',actId:'act',episode:2,cast:'林舟、乘客',setting:'外景',location:'车站',time:'夜',summary:'梗概',notes:'笔记',deleted:true,blocks:[{kind:'character',text:'林舟',runs:[{text:'林舟',fontFamily:'Kaiti SC'}]},{kind:'parenthetical',text:'（OS）'},{kind:'dialogue',text:'出发。'}]}]};
test('DRG preserves complete screenplay and protection without cloud credentials',async()=>{
 const encoded=await encodeDrg(script,{documentId:'doc-a',protected:true});assert.equal(new TextDecoder().decode(encoded.slice(0,8)),'JUHAODRG');assert.ok(!new TextDecoder().decode(encoded).includes('出发。'));
 const decoded=await decodeDrg(Buffer.from(encoded));assert.deepEqual(decoded.script,script);assert.equal(decoded.protected,true);assert.equal(decoded.documentId,'doc-a');assert.match(decoded.digest,/^[a-f0-9]{64}$/);assert.equal('cloud' in decoded,false);assert.equal('remote' in decoded,false);
});
test('DRG rejects unrelated extensions, damaged payloads, truncation, and newer versions',async()=>{
 const data=await encodeDrg(script,{documentId:'doc',protected:false});await assert.rejects(()=>decodeDrg(new TextEncoder().encode(JSON.stringify(script))),/不是剧好写/);
 await assert.rejects(()=>decodeDrg(data.slice(0,-1)),/不完整/);const corrupt=data.slice();corrupt[50]^=1;await assert.rejects(()=>decodeDrg(corrupt),/校验失败/);
 const future=data.slice();future[9]=2;await assert.rejects(()=>decodeDrg(future),/版本不受支持/);
 await assert.rejects(()=>encodeDrg({...script,scenes:[script.scenes[0],script.scenes[0]]},{documentId:'doc',protected:false}),/场景标识/);
 assert.equal(drgFilename('../剧本/夜车'),'_剧本_夜车.jhwrite');
});
