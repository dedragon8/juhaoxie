import {validateScript,type Script} from './model';
// .jhwrite uses the existing v1 container; retain its magic and JSON identifier for compatibility.
export const DRG_MAGIC='JUHAODRG',DRG_VERSION=1,DRG_MAX_FILE=32*1024*1024,DRG_MAX_CONTENT=64*1024*1024;
const HEADER=48,encoder=new TextEncoder();
export type DrgDocument={format:'studio.changjing.writer.drg';version:1;documentId:string;savedAt:string;protected:boolean;script:Script};
const digest=async(bytes:Uint8Array)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new Uint8Array(bytes).buffer));
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function transform(bytes:Uint8Array,decompress:boolean){
 const stream=new Blob([new Uint8Array(bytes).buffer]).stream().pipeThrough(decompress?new DecompressionStream('gzip'):new CompressionStream('gzip'));
 const reader=stream.getReader(),chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>(decompress?DRG_MAX_CONTENT:DRG_MAX_FILE-HEADER))throw Error('剧本文件过大，无法打开或保存');chunks.push(value)}}catch(e){await reader.cancel().catch(()=>{});throw e}
 const result=new Uint8Array(size);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length}return result;
}
function checkScript(script:unknown):asserts script is Script{
 validateScript(script);
 if(typeof script.author!=='string'||typeof script.contact!=='string'||!script.characters||Array.isArray(script.characters)||typeof script.characters!=='object'||Object.values(script.characters).some(v=>typeof v!=='string'))throw Error('剧本人信息无效');
 const ids=new Set<string>();for(const scene of script.scenes){if(!scene||typeof scene.id!=='string'||!scene.id||ids.has(scene.id)||typeof scene.order!=='string'||typeof scene.summary!=='string'||typeof scene.notes!=='string'||typeof scene.deleted!=='boolean'||(scene.actId!==undefined&&typeof scene.actId!=='string'))throw Error('场景标识或内容无效');ids.add(scene.id)}
}
export async function encodeDrg(script:Script,options:{documentId:string;protected:boolean}):Promise<Uint8Array>{
 checkScript(script);
 const envelope:DrgDocument={format:'studio.changjing.writer.drg',version:1,documentId:options.documentId,savedAt:new Date().toISOString(),protected:options.protected,script};
 const raw=encoder.encode(JSON.stringify(envelope));if(raw.length>DRG_MAX_CONTENT)throw Error('剧本内容过大，无法保存');
 const payload=await transform(raw,false),result=new Uint8Array(HEADER+payload.length),view=new DataView(result.buffer);
 result.set(encoder.encode(DRG_MAGIC));view.setUint16(8,DRG_VERSION);view.setUint16(10,0);view.setUint32(12,payload.length);result.set(await digest(payload),16);result.set(payload,HEADER);return result;
}
export async function decodeDrg(bytes:Uint8Array):Promise<DrgDocument&{digest:string}>{
 if(bytes.length>DRG_MAX_FILE)throw Error('剧本文件过大，无法打开');
 if(bytes.length<HEADER||new TextDecoder().decode(bytes.subarray(0,8))!==DRG_MAGIC)throw Error('这不是剧好写的剧本文件，可能属于其他软件');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 if(view.getUint16(8)!==DRG_VERSION||view.getUint16(10)!==0)throw Error('此剧本文件版本不受支持，请更新剧好写');
 if(view.getUint32(12)!==bytes.length-HEADER)throw Error('剧本文件不完整，请重新传输');
 const payload=bytes.subarray(HEADER),hash=await digest(payload);if(!hash.every((b,i)=>b===bytes[16+i]))throw Error('剧本文件校验失败，请重新传输原文件');
 let value:DrgDocument;try{value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await transform(payload,true)))}catch{throw Error('无法读取剧本内容，文件可能已损坏')}
 if(!value||value.format!=='studio.changjing.writer.drg'||value.version!==1||typeof value.documentId!=='string'||!value.documentId||value.documentId.length>200||typeof value.savedAt!=='string'||typeof value.protected!=='boolean')throw Error('剧本文件信息无效');
 checkScript(value.script);return {...value,digest:hex(hash)};
}
export function drgFilename(title:string){return (title.replace(/[\x00-\x1f\\/:]/g,'_').replace(/^\.+/,'').slice(0,100).trim()||'剧本')+'.jhwrite'}
