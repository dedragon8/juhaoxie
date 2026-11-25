const {app,BrowserWindow,ipcMain,dialog,Menu,shell,nativeTheme,systemPreferences}=require('electron');
const path=require('node:path');const fs=require('node:fs/promises');const {pathToFileURL}=require('node:url');
let mainWindow;
const {listSystemFonts}=require('./system-fonts.cjs');
ipcMain.handle('system-fonts',event=>{assertSender(event);return listSystemFonts()});
const nativeShell=require('./native-shell.cjs');
if(process.env.JUHAO_NATIVE_SELF_TEST==='1')globalThis.__juhaoNativeShell=nativeShell;
ipcMain.handle('native-shell-status',event=>{assertSender(event);return nativeShell.inspect()});
ipcMain.handle('native-shell-update',(event,state)=>{assertSender(event);return nativeShell.update(state)});
const {readDocument,writeDocument}=require('./documents.cjs');
const pendingDocuments=[];
app.on('open-file',(event,file)=>{event.preventDefault();if(pendingDocuments.length>=20)return;pendingDocuments.push({id:require('node:crypto').randomUUID(),file});if(app.isReady()){if(!mainWindow||mainWindow.isDestroyed())createWindow();mainWindow.show();mainWindow.focus();if(!mainWindow.webContents.isLoadingMainFrame())mainWindow.webContents.send('document-files-available')}});
ipcMain.handle('take-document-files',async event=>{assertSender(event);if(event.sender.isLoadingMainFrame())return [];return Promise.all([...pendingDocuments].map(async({id,file})=>{try{return {id,...await readDocument(file)}}catch(error){return {id,name:path.basename(file),error:error.message}}}))});
ipcMain.handle('ack-document-file',(event,id)=>{assertSender(event);if(event.sender.isLoadingMainFrame())return;const index=pendingDocuments.findIndex(item=>item.id===id);if(index>=0)pendingDocuments.splice(index,1)});
ipcMain.handle('reveal-project-file',async(event,id,data,name)=>{
 assertSender(event);if(typeof id!=='string'||!/^[-a-zA-Z0-9]{1,100}$/.test(id)||typeof name!=='string')throw Error('无效剧本');
 const dir=path.join(app.getPath('userData'),'Manuscripts',id);await fs.mkdir(dir,{recursive:true,mode:0o700});
 let filename=path.basename(name).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,150).replace(/\.jhwrite$/i,'')+'.jhwrite';
 while(Buffer.byteLength(filename)>220)filename=Array.from(filename.slice(0,-8)).slice(0,-1).join('')+'.jhwrite';
 const target=path.join(dir,filename);await writeDocument(target,data);shell.showItemInFolder(target);return target;
});
ipcMain.handle('save-drg',async(event,data,name)=>{assertSender(event);const {filePath,canceled}=await dialog.showSaveDialog(mainWindow,{defaultPath:path.basename(name),filters:[{name:'剧好写剧本',extensions:['jhwrite']}]});if(canceled||!filePath)return null;await writeDocument(filePath,data);return filePath});

const icloud=require('./icloud.cjs');
// iCloud collaboration is disabled in this release, including legacy renderer calls.
ipcMain.handle('icloud-request',event=>{assertSender(event);return {ok:false,error:{code:'feature-disabled',message:'iCloud 协作已关闭'}}});
ipcMain.handle('icloud-settings',event=>{assertSender(event);throw Error('iCloud 协作已关闭')});
app.on('before-quit',()=>icloud.shutdown());
const selfTest=process.env.CHANGJING_SELF_TEST;
let selfTestTimer;if(selfTest)selfTestTimer=setTimeout(()=>{console.error('Native self-test timed out');app.exit(1)},30000);
app.setName('剧好写');
// Keep the original profile directory so renamed releases retain every local script.
app.setPath('userData',process.env.CHANGJING_USER_DATA||path.join(app.getPath('appData'),'场景'));
const {createSecurity}=require('./security.cjs');const security=createSecurity(app.getPath('userData'));
ipcMain.handle('security-status',event=>{assertSender(event);return security.state()});
ipcMain.handle('security-set',async(event,options)=>{assertSender(event);let result;try{result=security.set(options)}finally{if(options?.protected){icloud.shutdown();await assistant.protectionChanged(options.id)}}return result});
const {createMcp}=require('./mcp.cjs');
const assistantPending=new Map();
const assistant=createMcp({isProtected:id=>security.isProtected(id),userData:app.getPath('userData'),executable:process.execPath,bridge:path.join(__dirname,'mcp-stdio.cjs'),call:request=>new Promise((resolve,reject)=>{
 if(!mainWindow||mainWindow.isDestroyed())return reject(Error('请打开剧好写'));
 const id=require('node:crypto').randomUUID();const timer=setTimeout(()=>{assistantPending.delete(id);reject(Error('文稿未响应；请保持剧好写打开，重试时使用原 request_id'))},15000);
 assistantPending.set(id,{resolve,reject,timer});mainWindow.webContents.send('assistant-request',{id,request});
})});
ipcMain.handle('assistant-status',event=>{assertSender(event);return assistant.state()});
ipcMain.handle('assistant-activate',(event,id)=>{assertSender(event);return assistant.activate(id)});
ipcMain.handle('assistant-configure',(event,options)=>{assertSender(event);return assistant.configure(options)});
ipcMain.on('assistant-response',(event,message)=>{assertSender(event);const p=assistantPending.get(message.id);if(!p)return;clearTimeout(p.timer);assistantPending.delete(message.id);if(message.error)p.reject(Error(message.error));else p.resolve(message.result)});
app.on('before-quit',()=>{void assistant.stop()});
function createWindow(){
 mainWindow=new BrowserWindow({show:!selfTest,width:1390,height:940,minWidth:900,minHeight:650,title:'剧好写',titleBarStyle:nativeShell.available?'default':'hiddenInset',...(nativeShell.available?{}:{trafficLightPosition:{x:18,y:25}}),backgroundColor:'#ffffff',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 if(nativeShell.available&&!nativeShell.attach(mainWindow))throw Error('无法初始化 AppKit 界面');
 mainWindow.on('closed',()=>nativeShell.detach());
 mainWindow.webContents.on('did-finish-load',()=>{if(pendingDocuments.length)mainWindow.webContents.send('document-files-available')});
 mainWindow.webContents.on('did-start-loading',()=>void assistant.stop());
 mainWindow.on('closed',()=>void assistant.stop());
 mainWindow.webContents.setWindowOpenHandler(({url})=>{if(/^https?:\/\//.test(url))shell.openExternal(url);return {action:'deny'}});
 mainWindow.webContents.on('will-navigate',(e,url)=>{if(url!==mainWindow.webContents.getURL())e.preventDefault()});
 if(process.env.VITE_DEV_SERVER_URL)mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);else mainWindow.loadFile(path.join(__dirname,'../dist/index.html'));
 const send=command=>mainWindow.webContents.send('app-command',command);
 Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'剧好写',submenu:[{role:'about'},{label:'设置…',accelerator:'CmdOrCtrl+,',click:()=>send('settings')},{type:'separator'},{role:'hide'},{role:'hideOthers'},{type:'separator'},{role:'quit'}]},{label:'文件',submenu:[{label:'新建剧本',click:()=>send('new')},{label:'打开剧本文件…',click:()=>send('import')},{label:'保存剧本文件…',click:()=>send('save-drg')},{label:'保存旧版项目备份…',click:()=>send('legacy-backup')},{type:'separator'},{label:'分页预览与导出 PDF',click:()=>send('preview')}]},{label:'编辑',submenu:[{role:'undo'},{role:'redo'},{type:'separator'},{role:'cut'},{role:'copy'},{role:'paste'},{label:'全选',accelerator:'CmdOrCtrl+A',click:()=>{if(nativeShell.available&&!mainWindow.webContents.isFocused())Menu.sendActionToFirstResponder('selectAll:');else send('select-all')}},{type:'separator'},{label:'查找与替换',click:()=>send('search')}]},{label:'视图',submenu:[{role:'togglefullscreen'},{role:'reload'}]},{label:'窗口',submenu:[{role:'minimize'},{role:'zoom'},{role:'front'}]}]));
}
function accentColor(){return '#'+systemPreferences.getAccentColor().slice(0,6)}
function sendAccent(){if(mainWindow&&!mainWindow.isDestroyed())mainWindow.webContents.send('system-accent',accentColor())}
function assertSender(event){if(event.sender!==mainWindow?.webContents)throw Error('不允许的请求来源');}
async function renderPdf(html){if(typeof html!=='string'||html.length>30_000_000)throw Error('文稿过大');const renderer=new BrowserWindow({show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true}});let file;try{
 const dir=await fs.mkdtemp(path.join(app.getPath('temp'),'changjing-print-'));file=path.join(dir,'print.html');await fs.writeFile(file,html);
 renderer.webContents.setWindowOpenHandler(()=>({action:'deny'}));await renderer.loadFile(file);await renderer.webContents.executeJavaScript('document.fonts.ready.then(()=>true)');const pdf=await renderer.webContents.printToPDF({printBackground:true,pageSize:'A4',preferCSSPageSize:true,margins:{top:0,bottom:0,left:0,right:0}});return pdf.toString('base64');
 }finally{renderer.destroy();if(file)await fs.rm(path.dirname(file),{recursive:true,force:true});}}
ipcMain.handle('system-accent',event=>{assertSender(event);return accentColor()});
ipcMain.handle('set-theme',(event,theme)=>{assertSender(event);if(!['system','light','dark'].includes(theme))throw Error('无效外观');nativeTheme.themeSource=theme;sendAccent();});
ipcMain.handle('render-pdf',async(event,html)=>{assertSender(event);return renderPdf(html)});
ipcMain.handle('export-pdf',async(event,data,name)=>{assertSender(event);const {filePath,canceled}=await dialog.showSaveDialog(mainWindow,{defaultPath:path.basename(name),filters:[{name:'PDF 剧本',extensions:['pdf']}]});if(canceled||!filePath)return null;await fs.writeFile(filePath,Buffer.from(data,'base64'));return filePath});
ipcMain.handle('export-document',async(event,data,name,format)=>{assertSender(event);if(!['docx','zip'].includes(format)||typeof name!=='string'||!(data instanceof Uint8Array)||data.length>64000000||data[0]!==0x50||data[1]!==0x4b)throw Error('无效的导出文件');const {filePath,canceled}=await dialog.showSaveDialog(mainWindow,{defaultPath:path.basename(name),filters:[{name:format==='docx'?'Word 文档':'逐条 Prompt 文本',extensions:[format]}]});if(canceled||!filePath)return null;await fs.writeFile(filePath,Buffer.from(data));return filePath});
ipcMain.handle('export-prompt-text',async(event,data,name)=>{assertSender(event);if(typeof data!=='string'||data.length>10000000||typeof name!=='string')throw Error('无效的文本导出');const {filePath,canceled}=await dialog.showSaveDialog(mainWindow,{defaultPath:path.basename(name),filters:[{name:'prompt 文本',extensions:['txt']}]});if(canceled||!filePath)return null;await fs.writeFile(filePath,data,'utf8');return filePath});
ipcMain.handle('save-backup',async(event,data,name)=>{assertSender(event);const {filePath,canceled}=await dialog.showSaveDialog(mainWindow,{defaultPath:path.basename(name),filters:[{name:'剧好写项目',extensions:['changjing']}]});if(canceled||!filePath)return null;await fs.writeFile(filePath,data);return filePath});
ipcMain.handle('open-external',async(event,url)=>{assertSender(event);if(!/^https?:\/\//.test(url))throw Error('不支持的链接');await shell.openExternal(url)});
app.whenReady().then(async()=>{app.setAboutPanelOptions({applicationName:'剧好写',applicationVersion:app.getVersion(),copyright:'© 2026 Fu Junhao'});createWindow();mainWindow.on('focus',sendAccent);nativeTheme.on('updated',sendAccent);if(process.platform==='darwin')systemPreferences.subscribeNotification('AppleColorPreferencesChangedNotification',sendAccent);if(selfTest){try{
 await new Promise((resolve,reject)=>{mainWindow.webContents.once('did-finish-load',resolve);mainWindow.webContents.once('did-fail-load',(_e,code,description)=>reject(Error(description)))});
 await mainWindow.webContents.executeJavaScript('document.fonts.ready.then(()=>true)');
 const rendererErrors=[];mainWindow.webContents.on('console-message',(_e,level,message)=>{if(level===3)rendererErrors.push(message)});
 const output=path.resolve(selfTest);await fs.mkdir(output,{recursive:true});
 const html=await fs.readFile(path.join(output,'pdf-fixture.html'),'utf8');const data=await renderPdf(html);await fs.writeFile(path.join(output,'native-print.pdf'),Buffer.from(data,'base64'));
 const result=await mainWindow.webContents.executeJavaScript('({title:document.title,desktop:!!window.desktop,accent:getComputedStyle(document.documentElement).getPropertyValue(\"--system-accent\"),fontFamily:getComputedStyle(document.body).fontFamily,body:document.body.innerText.slice(0,500)})');
 await fs.writeFile(path.join(output,'native-smoke.json'),JSON.stringify({...result,rendererErrors},null,2));
 await fs.writeFile(path.join(output,'native-window.png'),(await mainWindow.webContents.capturePage()).toPNG());
 if(!result.desktop||!result.body.includes('剧本库'))throw Error('Local app did not mount');
 console.log('Native app loaded successfully; offline fonts and A4 PDF rendered.');clearTimeout(selfTestTimer);app.exit(0);
 }catch(error){console.error(error);clearTimeout(selfTestTimer);app.exit(1)}}});app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit()});app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});
