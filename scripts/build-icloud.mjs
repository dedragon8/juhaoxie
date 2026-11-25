import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const root=path.resolve('native/build/JuhaoCloudBridge.app');
const container=process.env.JUHAO_ICLOUD_CONTAINER||'';
const bundleID=process.env.JUHAO_CLOUD_BUNDLE_ID||'studio.changjing.writer.cloudbridge';
if(container&&!/^iCloud\.[A-Za-z0-9.-]+$/.test(container))throw Error('Invalid CloudKit container');
if(!/^[A-Za-z0-9.-]+$/.test(bundleID))throw Error('Invalid bundle ID');
await fs.mkdir(path.join(root,'Contents/MacOS'),{recursive:true});
await fs.mkdir('.local/swift-cache',{recursive:true});
execFileSync('xcrun',['swiftc','-parse-as-library','-swift-version','5',...(process.env.JUHAO_MACOS_SDK?['-sdk',process.env.JUHAO_MACOS_SDK]:[]),'-O','-target',`${process.arch==='arm64'?'arm64':'x86_64'}-apple-macosx13.0`,'-module-cache-path','.local/swift-cache','native/CloudBridge/CloudBridge.swift','-o',path.join(root,'Contents/MacOS/JuhaoCloudBridge'),'-framework','CloudKit','-framework','Foundation'],{stdio:'inherit'});
const info={CFBundleIdentifier:bundleID,CFBundleExecutable:'JuhaoCloudBridge',CFBundleName:'JuhaoCloudBridge',CFBundlePackageType:'APPL',CFBundleVersion:'1',CFBundleShortVersionString:'0.5.0',LSMinimumSystemVersion:'13.0',LSUIElement:true,...(container?{JWCloudContainer:container}:{})};
await fs.writeFile(path.join(root,'Contents/Info.plist'),JSON.stringify(info));
execFileSync('/usr/bin/plutil',['-convert','xml1',path.join(root,'Contents/Info.plist')]);
// A config change must never leave an old profile/signature looking usable.
await fs.rm(path.join(root,'Contents/embedded.provisionprofile'),{force:true});
console.log(`Built native CloudKit bridge (${container||'not configured; no cloud access'}).`);
