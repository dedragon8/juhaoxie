import {execFileSync} from 'node:child_process';
import documentTypes from '../electron/document-types.cjs';
import {sealDevelopmentApp} from './seal-development-app.mjs';
import packager from '@electron/packager';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
const pkg=JSON.parse(await fs.readFile('node_modules/electron/package.json','utf8'));
const cache=path.join(os.homedir(),'Library/Caches/electron');let electronZipDir;
try{for(const name of await fs.readdir(cache)){const folder=path.join(cache,name);try{await fs.access(path.join(folder,`electron-v${pkg.version}-darwin-arm64.zip`));electronZipDir=folder;break}catch{}}}catch{}
execFileSync(process.execPath,['--import','tsx','scripts/build-demo.ts'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/make-icon.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/build-native-shell.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/build-prompt-skill.mjs'],{stdio:'inherit'});
execFileSync(process.execPath,['scripts/third-party-notices.mjs'],{stdio:'inherit'});
const destination=path.resolve(process.env.JUHAO_RELEASE_DIR||'release');
const staging=await fs.mkdtemp(path.join(os.tmpdir(),'juhao-package-'));
try{
const out=await packager({dir:'.',name:'剧好写',platform:'darwin',arch:'arm64',electronVersion:pkg.version,electronZipDir,appBundleId:'studio.changjing.writer',extendInfo:{...documentTypes,CFBundleIconFile:'Juhao',CFBundleIconName:'Juhao'},appCopyright:'© 2026 Fu Junhao',appVersion:JSON.parse(await fs.readFile('package.json','utf8')).version,out:staging,overwrite:true,prune:false,icon:'assets/icon.icns',extraResource:['native/build/JuhaoCloudBridge.app','native/build/juhao-appkit.node','native/build/juhao-fonts'],ignore:[/^\/(release|tests|server|native|docs|data|tmp|output|node_modules|src|\.git|\.local|\.pnpm-store|artifacts|assets|scripts|public)(\/|$)/,/^\/.*\.ts$/,/^\/pnpm/,/^\/tsconfig/,/^\/playwright/],osxSign:undefined});for(const folder of out){
 for(const name of ['Assets.car','Juhao.icns'])await fs.copyFile(path.join('native/build/app-icon',name),path.join(folder,'剧好写.app','Contents','Resources',name));
 const legalDir=path.join(folder,'剧好写.app','Contents','Resources','licenses');
 await fs.mkdir(legalDir,{recursive:true});
 for(const name of ['LICENSE','LICENSES.chromium.html'])await fs.copyFile(path.join('node_modules/electron/dist',name),path.join(legalDir,name));
 await sealDevelopmentApp(path.join(folder,'剧好写.app'));
 // Build the archive before moving anything into Documents/FileProvider storage.
 // Never mutate the app after sealing. Human-readable notices live beside it.
 for(const name of ['使用说明.txt','版权说明.txt','第三方组件许可.txt','LICENSE','THIRD_PARTY.md'])await fs.copyFile(name,path.join(folder,name));
 await fs.copyFile('artifacts/落水狗-节选演示.jhwrite',path.join(folder,'落水狗-节选演示.jhwrite'));
 const version=JSON.parse(await fs.readFile('package.json','utf8')).version;
 const archiveName=`剧好写-${version}-Mac-AppleSilicon.zip`;
 const archive=path.join(staging,archiveName);
 execFileSync('/usr/bin/ditto',['-c','-k','--norsrc','--noextattr','--noacl','--keepParent',folder,archive]);
 execFileSync('/usr/bin/unzip',['-tq',archive],{stdio:'inherit'});
 const extracted=path.join(staging,'extracted');
 execFileSync('/usr/bin/ditto',['-x','-k',archive,extracted]);
 execFileSync('/usr/bin/codesign',['--verify','--deep','--strict','--verbose=2',path.join(extracted,path.basename(folder),'剧好写.app')],{stdio:'inherit'});
 await fs.mkdir(destination,{recursive:true});const target=path.join(destination,archiveName);await fs.copyFile(archive,target);
 const {createHash}=await import('node:crypto');
 const digest=createHash('sha256').update(await fs.readFile(archive)).digest('hex');
 if(createHash('sha256').update(await fs.readFile(target)).digest('hex')!==digest)throw Error('Copied archive checksum mismatch');
 await fs.writeFile(`${target}.sha256`,`${digest}  ${archiveName}\n`);
 console.log(`Verified archive: ${target}\nSHA-256: ${digest}`);
}
}finally{await fs.rm(staging,{recursive:true,force:true})}
