import test from 'node:test';import assert from 'node:assert/strict';
import {paginate,wrapText,PAGE,METRICS,printHtml} from '../src/core/pagination';import type {Script,Block} from '../src/core/model';
const measure=(s:string)=>Array.from(s).reduce((n,c)=>n+(/[\x00-\x7f]/.test(c)?7.2:12),0);
const script=(blocks:Block[]):Script=>({schemaVersion:1,title:'排版检查',author:'测试',contact:'',characters:{},scenes:[{id:'s',order:'a0',setting:'外景',location:'车站',time:'夜',summary:'',notes:'不应输出的秘密笔记',deleted:false,blocks}]});
test('A4 long dialogue continues with no content loss, no overflowing text',()=>{
 const text='夜晚的车站已经没有人了，我们仍然在等最后一班车。'.repeat(100);const pages=paginate(script([{kind:'character',text:'林'},{kind:'dialogue',text}]),measure);
 assert.ok(pages.length>2);const rendered=pages.flatMap(p=>p.lines).filter(l=>l.kind==='dialogue').map(l=>l.text).join('');assert.equal(rendered,text);assert.ok(pages[0].lines.some(l=>l.kind==='more'));assert.equal(pages[1].lines[0].text,'林（续）');for(const p of pages)for(const l of p.lines){assert.ok(l.y+PAGE.line<=PAGE.height-PAGE.bottom);assert.ok(measure(l.text)<=l.width+.1);}
});
test('a cue is never stranded at page bottom before long dialogue',()=>{
 for(let n=30;n<44;n++){const pages=paginate(script([{kind:'action',text:Array(n).fill('雨仍在下').join('\n')},{kind:'character',text:'林'},{kind:'dialogue',text:'我想说一件事情。'.repeat(80)}]),measure);for(const p of pages)assert.notEqual(p.lines.at(-1)?.kind,'character',`stranded at n=${n}`);}
});
test('CJK opening and closing punctuation stays attached',()=>{
 const text='他说：“这个故事（还没有结束），等我回来。”';const lines=wrapText(text,84,measure);assert.equal(lines.join(''),text);assert.ok(lines.every(l=>!/[（“「《]$/.test(l)));assert.ok(lines.every(l=>! /^[，。）》”」]/.test(l)));
});
test('export escapes authored HTML and excludes private planning notes',()=>{
 const s=script([{kind:'action',text:'<script>alert(1)</script>'}]);const html=printHtml(s,paginate(s,measure),'file:///fonts');assert.ok(!html.includes('不应输出的秘密笔记'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('@page{size:A4'));assert.ok(!html.includes('<script>alert'));
});
test('mixed fonts retain all runs across wrapping and page breaks',()=>{
 const a='等候。'.repeat(600),b='灯灭了。'.repeat(600);const s=script([{kind:'dialogue',text:a+'\n'+b,runs:[{text:a,fontFamily:'Songti SC'},{text:'\n'},{text:b,fontFamily:'Kaiti SC'}]}]);s.fontFamily='Heiti SC';
 const pages=paginate(s,(text,font)=>text.length*(font==='Songti SC'?10:12));const lines=pages.flatMap(p=>p.lines).filter(l=>l.kind==='dialogue');assert.equal(lines.map(l=>l.runs?.map(r=>r.text).join('')).join(''),a+b);
 for(const l of lines){assert.ok(l.runs?.every(r=>r.fontFamily==='Songti SC'||r.fontFamily==='Kaiti SC'));assert.ok(l.runs!.reduce((n,r)=>n+r.text.length*(r.fontFamily==='Songti SC'?10:12),0)<=l.width);}
 const html=printHtml(s,pages);assert.ok(html.includes('Heiti SC'));assert.ok(html.includes('Songti SC'));assert.ok(html.includes('Kaiti SC'));
});
