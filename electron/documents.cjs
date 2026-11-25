const fs=require('node:fs/promises'),path=require('node:path'),{randomUUID}=require('node:crypto');
const LIMIT=32*1024*1024;
async function readDocument(file){const stat=await fs.stat(file);if(!stat.isFile()||stat.size>LIMIT)throw Error('文件过大或不是有效的剧本文件');return {name:path.basename(file),data:new Uint8Array(await fs.readFile(file))}}
async function writeDocument(file,bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<48||bytes.length>LIMIT||Buffer.from(bytes.subarray(0,8)).toString()!=='JUHAODRG')throw Error('无效的剧好写文件');
 const temporary=path.join(path.dirname(file),`.juhaoxie-${randomUUID()}.tmp`);let handle;
 try{handle=await fs.open(temporary,'wx',0o600);await handle.writeFile(bytes);await handle.sync();await handle.close();handle=undefined;await fs.rename(temporary,file)}finally{await handle?.close();await fs.rm(temporary,{force:true})}
}
module.exports={readDocument,writeDocument};
