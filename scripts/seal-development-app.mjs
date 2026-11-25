// Ad-hoc sealing fixes the bundle's integrity signature. It is NOT Developer ID signing or notarization.
import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
const codeMagic=new Set(['cffaedfe','cefaedfe','feedfacf','feedface','cafebabe','bebafeca','cafebabf','bfbafeca']);
export async function sealDevelopmentApp(app){
 app=path.resolve(app);if(!app.endsWith('.app'))throw Error('Expected app bundle');
 // Finder decoration/resource forks cannot be part of a signature. Do not remove quarantine attributes.
 for(const attr of ['com.apple.FinderInfo','com.apple.ResourceFork'])try{execFileSync('/usr/bin/xattr',['-dr',attr,app],{stdio:'pipe'})}catch(e){if(!String(e.stderr).includes('No such xattr'))throw e}
 let signed=0;
 const sign=p=>{execFileSync('/usr/bin/codesign',['--force','--sign','-','--timestamp=none',p],{stdio:'pipe'});signed++};
 async function walk(p){
  const stat=await fs.lstat(p);if(stat.isSymbolicLink())return;
  if(stat.isDirectory()){
   if(p!==app&&p.endsWith('.app')){try{await fs.access(path.join(p,'Contents/embedded.provisionprofile'));execFileSync('/usr/bin/codesign',['--verify','--deep','--strict',p],{stdio:'pipe'});return}catch(e){if(e.code!=='ENOENT')throw e}}
   for(const name of await fs.readdir(p))await walk(path.join(p,name));
   if(p.endsWith('.app')||p.endsWith('.framework')||p.endsWith('.xpc'))sign(p);
  }else if(stat.isFile()&&stat.size>=4){const f=await fs.open(p,'r');let magic;try{const bytes=Buffer.alloc(4);await f.read(bytes,0,4,0);magic=bytes.toString('hex')}finally{await f.close()}if(codeMagic.has(magic))sign(p)}
 }
 await walk(app);
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',app],{stdio:'inherit'});
 console.log(`Ad-hoc integrity signatures verified (${signed} code objects). Developer ID / notarization still required for trusted distribution.`);
}
