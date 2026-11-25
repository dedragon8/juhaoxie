// Render and compile the layered icon using Apple's Icon Composer / Xcode tools.
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const developer=execFileSync('/usr/bin/xcode-select',['-p'],{encoding:'utf8'}).trim();
const composer=path.resolve(developer,'../Applications/Icon Composer.app/Contents/Executables/ictool');
const source=path.resolve('assets/Juhao.icon');
const output=path.resolve('native/build/app-icon');
await fs.mkdir(output,{recursive:true});await fs.mkdir('artifacts',{recursive:true});
for(const rendition of ['Default','Dark','Mono']){
 const target=path.resolve(`artifacts/icon-${rendition.toLowerCase()}.png`);
 execFileSync(composer,[source,'--export-image','--output-file',target,'--platform','macOS','--rendition',rendition,'--width','1024','--height','1024','--scale','1','--design-generation','26'],{stdio:'inherit'});
}
execFileSync('/usr/bin/xcrun',['actool',source,'--compile',output,'--platform','macosx','--minimum-deployment-target','12.0','--app-icon','Juhao','--output-partial-info-plist',path.join(output,'Info.plist'),'--output-format','human-readable-text'],{stdio:'inherit'});
await fs.copyFile(path.join(output,'Juhao.icns'),'assets/icon.icns');
await fs.copyFile('artifacts/icon-default.png','artifacts/icon.png');
await fs.copyFile('artifacts/icon-default.png','public/mark.png');
