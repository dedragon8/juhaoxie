const fs=require('node:fs'),path=require('node:path');
const MESSAGE='此剧本位于安全区，禁止 iCloud 和 AI 接入';
const cloudKey=ref=>ref&&[ref.container,ref.accountID,ref.scope,ref.owner,ref.zone].map(x=>String(x||'')).join('\u0000');
function createSecurity(userData){
 const file=path.join(userData,'security-zone.json');let projects={},locked=false;
 try{const saved=JSON.parse(fs.readFileSync(file,'utf8'));if(saved.version!==1||!saved.projects||typeof saved.projects!=='object'||Array.isArray(saved.projects))throw Error();for(const [id,p] of Object.entries(saved.projects)){if(!p||p.id!==id||typeof id!=='string'||p.cloud&&['container','accountID','scope','owner','zone'].some(k=>typeof p.cloud[k]!=='string'))throw Error()}projects=saved.projects}catch(e){if(e.code!=='ENOENT')locked=true}
 const state=()=>({projects:Object.values(projects),locked});
 const isProtected=(id,ref)=>locked||!!projects[id]||!!ref&&Object.values(projects).some(p=>p.cloud&&cloudKey(p.cloud)===cloudKey(ref));
 const assertProject=(id,ref)=>{if(isProtected(id,ref))throw Error(MESSAGE)};
 const assertCloud=(method,args={})=>{if(['account','projects'].includes(method))return;if(locked)throw Error('安全区配置无法读取，已禁止所有 iCloud 和 AI 接入');assertProject(args.projectId,args.ref)};
 const set=({id,protected:enabled,cloud})=>{
  if(typeof id!=='string'||!id||id.length>200||typeof enabled!=='boolean')throw Error('安全区参数无效');if(locked)throw Error('安全区配置无法读取；请保留本地数据并联系支持');
  if(cloud&&['container','accountID','scope','owner','zone'].some(k=>typeof cloud[k]!=='string'))throw Error('云端标识无效');
  const next={...projects};if(enabled)next[id]={id,...(cloud?{cloud}:projects[id]?.cloud?{cloud:projects[id].cloud}:{})};else delete next[id];
  // Protection takes effect before disk IO. A failed enable stays blocked in memory.
  if(enabled)projects=next;
  fs.mkdirSync(userData,{recursive:true});const temp=file+'.tmp';fs.writeFileSync(temp,JSON.stringify({version:1,projects:next}),{mode:0o600});fs.renameSync(temp,file);projects=next;return state();
 };
 return {state,isProtected,assertProject,assertCloud,set};
}
module.exports={createSecurity};
