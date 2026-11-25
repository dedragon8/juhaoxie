const path=require('node:path');
const fs=require('node:fs');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const run=promisify(execFile);
let pending;
async function listSystemFonts(){
 if(process.platform!=='darwin')throw Error('系统字体读取仅适用于 macOS');
 if(pending)return pending;
 const local=path.join(__dirname,'../native/build/juhao-fonts');
 const binary=fs.existsSync(local)?local:path.join(process.resourcesPath,'juhao-fonts');
 pending=run(binary,[],{timeout:15000,maxBuffer:4*1024*1024,encoding:'utf8'}).then(({stdout})=>{
  const fonts=JSON.parse(stdout);
  if(!Array.isArray(fonts)||!fonts.length||fonts.some(f=>typeof f.family!=='string'||typeof f.label!=='string'))throw Error('系统字体列表无效');
  return fonts;
 }).finally(()=>{pending=undefined});
 return pending;
}
module.exports={listSystemFonts};
