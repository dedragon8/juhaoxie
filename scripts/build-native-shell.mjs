import fs from 'node:fs/promises';import path from 'node:path';import {execFileSync} from 'node:child_process';
if(process.platform!=='darwin')throw Error('AppKit requires macOS');
execFileSync('xcodebuild',['-checkFirstLaunchStatus'],{stdio:'inherit'});
const sdk=execFileSync('xcrun',['--sdk','macosx','--show-sdk-path'],{encoding:'utf8'}).trim();
const headers=path.resolve(process.env.JUHAO_NODE_HEADERS||'.local/native-shell-headers/include/node');await fs.access(path.join(headers,'node_api.h'));
await fs.mkdir('native/build',{recursive:true});
execFileSync('xcrun',['--sdk','macosx','clang++','-std=c++17','-fobjc-arc','-fblocks','-DNAPI_VERSION=8','-O2','-mmacosx-version-min=26.0','-isysroot',sdk,'-I',headers,'-bundle','-undefined','dynamic_lookup','native/AppShell/AppShell.mm','-framework','AppKit','-o','native/build/juhao-appkit.node'],{stdio:'inherit'});
console.log('Built native/build/juhao-appkit.node (real AppKit / NSGlassEffectView)');

execFileSync('xcrun',['--sdk','macosx','clang','-fobjc-arc','-O2','-mmacosx-version-min=12.0','-isysroot',sdk,'native/SystemFonts.m','-framework','AppKit','-o','native/build/juhao-fonts'],{stdio:'inherit'});
