const {spawn,execFile}=require('node:child_process');
const fs=require('node:fs/promises');
const path=require('node:path');
const {promisify}=require('node:util');
const run=promisify(execFile);
const METHODS=new Set(['account','projects','create','pull','push','presence','version','members','invite','permission','revoke','accept']);
const pending=new Set();
let configured;
function failure(code,message){return {ok:false,error:{code,message}}}
async function configuration(app){
 if(configured)return configured;
 const bundle=app.isPackaged?path.join(process.resourcesPath,'JuhaoCloudBridge.app'):path.join(__dirname,'../native/build/JuhaoCloudBridge.app');
 const plist=path.join(bundle,'Contents/Info.plist');
 try{
  const info=JSON.parse((await run('/usr/bin/plutil',['-convert','json','-o','-',plist])).stdout);
  if(!info.JWCloudContainer)return null;
  await fs.access(path.join(bundle,'Contents/embedded.provisionprofile'));
  await run('/usr/bin/codesign',['--verify','--strict',bundle]);
  const signature=await run('/usr/bin/codesign',['-d','--entitlements',':-',bundle]);
  if(!signature.stdout.includes(info.JWCloudContainer))return null;
  configured={bundle,container:info.JWCloudContainer};return configured;
 }catch{return null}
}
async function request(app,method,args={},guard=()=>{}){
 guard();
 if(!METHODS.has(method)||!args||typeof args!=='object'||Array.isArray(args))return failure('invalid','不支持的 iCloud 请求');
 const config=await configuration(app);guard();
 if(!config){
  if(method==='account')return {ok:true,value:{status:'not-configured',message:'此版本已包含 iCloud 接口；尚需 Apple Developer 账号、容器和签名后才能连接。'}};
  return failure('not-configured','尚未配置 Apple Developer 签名及 iCloud 容器');
 }
 const input=JSON.stringify({method,args});if(Buffer.byteLength(input)>36_000_000)return failure('invalid','请求过大，请先导出项目备份');
 return new Promise(resolve=>{
  const child=spawn(path.join(config.bundle,'Contents/MacOS/JuhaoCloudBridge'),[],{stdio:['pipe','pipe','pipe']});pending.add(child);
  let output='',size=0,done=false;
  const finish=value=>{if(done)return;done=true;clearTimeout(timer);pending.delete(child);resolve(value)};
  const timer=setTimeout(()=>{child.kill();finish(failure('retry','iCloud 响应超时，本地文稿保留，稍后重试'))},90000);
  child.stdout.on('data',data=>{size+=data.length;if(size>96_000_000){child.kill();finish(failure('integrity','云端数据过大，请联系支持并保留本地备份'))}else output+=data.toString()});
  // Native diagnostics may contain private record identifiers. Do not expose logs.
  child.stderr.resume();child.stdin.on('error',()=>{});
  child.on('error',()=>finish(failure('retry','无法启动 iCloud 连接，请重试')));
  child.on('close',()=>{try{const value=JSON.parse(output);finish(typeof value.ok==='boolean'?value:failure('retry','iCloud 返回无效响应'))}catch{finish(failure('retry','iCloud 连接中断，本地文稿仍保留'))}});
  child.stdin.end(input);
 });
}
function shutdown(){for(const child of pending)child.kill();pending.clear()}
module.exports={request,shutdown};
