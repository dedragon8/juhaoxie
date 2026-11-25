// Small, uncompressed ZIP writer for locally generated OOXML and text bundles.
// UTF-8 names, CRC-32 and central-directory offsets are shared across both exports.
const encoder=new TextEncoder();
const table=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0});
function crc32(bytes:Uint8Array){let crc=0xffffffff;for(const b of bytes)crc=table[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0}
export function zipStore(files:Record<string,string>):Uint8Array{
 const locals:Uint8Array[]=[],central:Uint8Array[]=[];let offset=0;
 for(const [path,text] of Object.entries(files)){
  const name=encoder.encode(path),data=encoder.encode(text),crc=crc32(data);
  const local=new Uint8Array(30+name.length+data.length),v=new DataView(local.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint16(12,0x21,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);local.set(data,30+name.length);locals.push(local);
  const record=new Uint8Array(46+name.length),r=new DataView(record.buffer);r.setUint32(0,0x02014b50,true);r.setUint16(4,20,true);r.setUint16(6,20,true);r.setUint16(8,0x800,true);r.setUint16(14,0x21,true);r.setUint32(16,crc,true);r.setUint32(20,data.length,true);r.setUint32(24,data.length,true);r.setUint16(28,name.length,true);r.setUint32(42,offset,true);record.set(name,46);central.push(record);offset+=local.length;
 }
 const size=central.reduce((n,b)=>n+b.length,0),end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,offset,true);
 const result=new Uint8Array(offset+size+22);let at=0;for(const b of [...locals,...central,end]){result.set(b,at);at+=b.length}return result;
}
export function downloadBytes(name:string,bytes:Uint8Array,type:string){const url=URL.createObjectURL(new Blob([new Uint8Array(bytes).buffer],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
