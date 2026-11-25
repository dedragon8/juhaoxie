import fs from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),seen=new Set(),records=[];
async function locate(name,from){
 for(let dir=from;;dir=path.dirname(dir)){
  try{return await fs.realpath(path.join(dir,'node_modules',name))}catch{}
  if(path.dirname(dir)===dir)return;
 }
}
async function visit(name,from,optional=false){
 const folder=await locate(name,from);
 if(!folder){if(optional)return;throw Error(`Required dependency not installed: ${name}`)}
 if(seen.has(folder))return;seen.add(folder);
 const pkg=JSON.parse(await fs.readFile(path.join(folder,'package.json'),'utf8'));
 const names=await fs.readdir(folder),texts=[];
 for(const name of names.filter(n=>/^(licen[sc]e|copying|notice)([.-]|$)/i.test(n))){
  const file=path.join(folder,name);if((await fs.stat(file)).isFile())texts.push(name+'\n'+await fs.readFile(file,'utf8'));
 }
 if(!texts.length&&pkg.name.startsWith('@hocuspocus/')&&pkg.version==='3.4.4'){
  texts.push('Upstream v3.4.4: https://github.com/ueberdosis/hocuspocus/blob/v3.4.4/LICENSE.md\n'+await fs.readFile('assets/licenses/hocuspocus-3.4.4.txt','utf8'));
 }
 if(!texts.length&&names.includes('README.md')){
  const readme=await fs.readFile(path.join(folder,'README.md'),'utf8'),at=readme.search(/(?:^##\s+License\b|The MIT License)/im);
  if(at>=0)texts.push('README.md\n'+readme.slice(at));
 }
 if(!texts.length)throw Error(`License text missing: ${pkg.name}@${pkg.version}. Review upstream before distributing.`);
 if(pkg.name==='lucide-react')texts.push('Feather-derived portions: https://github.com/feathericons/feather/blob/v4.29.2/LICENSE\n'+await fs.readFile('assets/licenses/feather-4.29.2.txt','utf8'));
 records.push({name:pkg.name,version:pkg.version,license:pkg.license||'见上游许可',text:texts.join('\n\n')});
 for(const dep of Object.keys(pkg.dependencies||{}))await visit(dep,folder,!!pkg.optionalDependencies?.[dep]);
 for(const dep of Object.keys({...pkg.optionalDependencies,...pkg.peerDependencies}))await visit(dep,folder,true);
}
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
for(const dep of Object.keys(pkg.dependencies))await visit(dep,root);
records.sort((a,b)=>a.name.localeCompare(b.name));
await fs.writeFile('第三方组件许可.txt','剧好写第三方组件许可\n\n以下保留安装依赖中的上游版权及许可原文，含运行依赖及其依赖，部分仅用于开发或协作实验。Electron、Chromium 的许可另见应用内 Contents/Resources/licenses，亦随安装包保留。付俊皓（Fu Junhao）的软件版权声明不替代、缩减第三方许可授予的权利。第三方原始代码不作为付俊皓的原创代码申报。\n\n'+records.map(r=>`${r.name} ${r.version} (${r.license})\n${'='.repeat(64)}\n${r.text}`).join('\n\n'));
console.log(`Collected complete notices for ${records.length} components.`);

await fs.appendFile('第三方组件许可.txt','\n\n内置分镜 SKILL 参考许可\n'+await fs.readFile('public/skills/juhaoxie-film-prompts/THIRD_PARTY_LICENSES.txt','utf8'));

await fs.appendFile('第三方组件许可.txt','\n\nAgent 图标来源\n'+await fs.readFile('public/agent-icons/NOTICE.txt','utf8'));
