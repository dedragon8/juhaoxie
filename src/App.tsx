import {VersionsPanel} from './components/VersionsPanel';
import {AgentConnections,useAgentConnections} from './components/AgentConnections';
import {ensureWelcomeDemo,addWelcomeDemo} from './core/welcome-demo';
import {exportWord} from './core/word-export';
import {downloadBytes} from './core/zip-store';
import {useNativeShell} from './components/useNativeShell';
import {PromptWorkspace} from './components/PromptWorkspace';
import type {PromptSpan} from './core/prompt-types';
import {StoryInfo} from './components/StoryInfo';
import {encodeDrg,decodeDrg,drgFilename,DRG_MAX_FILE} from './core/drg';
import {episodeOf,shortSceneNumber} from './core/short-drama';
import {initializeSecurity,useSecurity,protectedProject,assertProjectAccess,setProjectProtection} from './core/security';
import {GlassNavigation} from './components/GlassNavigation';
import {ActFolders} from './components/ActFolders';
import {executeAssistant,type AssistantCall} from './core/assistant';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Editor} from '@tiptap/core';
import * as Y from 'yjs';
import {type IndexeddbPersistence} from 'y-indexeddb';
import type {Awareness} from 'y-protocols/awareness';
import {EyeOff,PanelLeft,PanelRight,Plus,ChevronDown,Search,FileText,LayoutGrid,Eye,Share2,ArrowUpRight,Check,Cloud,CloudOff,MoreHorizontal,Command,Maximize2,Minimize2,Download,FolderOpen,History,Trash2,RotateCcw,BookOpen,Users,ArrowLeft,GripVertical,Copy,Settings2,X,Film,Type,CornerDownLeft,ArrowDown,ArrowUp,ExternalLink} from 'lucide-react';
import {validateScript,meta,listActs,assignAct,addAct,renameAct,removeAct,listScenes,addScene,updateScene,deleteScene,moveScene,snapshot,wordCount,sceneHeading,characterNames,renameCharacter,newId,fragment,blockNode,LOCAL,type ProjectEntry,type Script,type Scene,type Kind,LABELS} from './core/model';
import {entries,trashProject,restoreProject,newEntry,saveEntry,openProject,persistProject,saveVersion,download} from './core/storage';
import {api,connect} from './core/collaboration';
import {paginate,printHtml} from './core/pagination';
import {FindReplace} from './components/FindReplace';
import type {FindMatch} from './core/find-replace';
import {useManuscriptZoom} from './components/useManuscriptZoom';
import {ZoomControls} from './components/ZoomControls';
import {SceneMenu,type SceneAction} from './components/SceneMenu';
import {SceneActionDialog} from './components/SceneActionDialog';
import {SceneEditor} from './components/SceneEditor';
import {Modal} from './components/Modal';
import {Library} from './components/Library';
import {DEFAULT_FONT,fontStack} from './core/fonts';
import {DocumentFonts} from './components/DocumentFonts';
import {changeBlockKind,setTextFont} from './core/editor-format';
import {useDocumentSelection} from './components/useDocumentSelection';
import {layoutVariables,type LayoutStyle} from './core/layout';
import {ActsPanel} from './components/ActsPanel';
import {SceneBoard} from './components/SceneBoard';
import {Settings} from './components/Settings';
import {GettingStarted,GUIDE_KEY,needsGuide} from './components/GettingStarted';
import {COMMANDS,SETTINGS_KEY,readPreferences,keyFromEvent,isFormat,shortcutLabel} from './core/preferences';

declare global {interface Window {desktop?:{platform:string;listFonts:()=>Promise<import('./core/fonts').SystemFont[]>;revealProjectFile:(id:string,data:Uint8Array,name:string)=>Promise<string>;saveDrg:(data:Uint8Array,name:string)=>Promise<string|null>;ackDocumentFile:(id:string)=>Promise<void>;takeDocumentFiles:()=>Promise<{id:string;name:string;data?:Uint8Array;error?:string}[]>;onDocumentFiles:(cb:()=>void)=>()=>void;systemAccent:()=>Promise<string>;onAccent:(cb:(color:string)=>void)=>()=>void;setTheme:(theme:string)=>Promise<void>;pdf:(html:string)=>Promise<string>;exportPdf:(data:string,name:string)=>Promise<string|null>;exportDocument:(data:Uint8Array,name:string,format:'docx'|'zip')=>Promise<string|null>;saveBackup:(data:string,name:string)=>Promise<string|null>;exportPromptText:(data:string,name:string)=>Promise<string|null>;onCommand:(cb:(command:string)=>void)=>()=>void;openExternal:(url:string)=>Promise<void>};}}
const USER_KEY='changjing-user';
function initUser(){try{return JSON.parse(localStorage.getItem(USER_KEY)||'null')||{name:'编剧',color:'#2c6954'}}catch{return {name:'编剧',color:'#2c6954'}}}
function initialEntry(){const hash=new URLSearchParams('');const join=hash.get('join');if(join){try{const remote=JSON.parse(decodeURIComponent(escape(atob(join))));if(!/^https?:\/\//.test(remote.url)||!remote.room||!remote.token)throw Error();const old=entries().find(e=>e.remote?.room===remote.room&&e.remote?.url===remote.url);const entry={...newEntry('共享剧本'),...old,remote};saveEntry(entry);history.replaceState(null,'',location.pathname+location.search);return entry;}catch{}}
 const last=localStorage.getItem('changjing-current');return entries().find(e=>e.id===last&&!e.remote)||entries().find(e=>!e.remote)||newEntry();}
export function App(){
 const security=useSecurity();useEffect(()=>{void initializeSecurity()},[]);
 const [opened,setOpened]=useState(false),[selectedFont,setSelectedFont]=useState('');
 const [preferences,setPreferences]=useState(readPreferences);
 useEffect(()=>{localStorage.setItem(SETTINGS_KEY,JSON.stringify(preferences));const media=matchMedia('(prefers-color-scheme: dark)'),motion=matchMedia('(prefers-reduced-motion: reduce)'),transparency=matchMedia('(prefers-reduced-transparency: reduce)');const apply=()=>{const root=document.documentElement;root.dataset.theme=preferences.theme==='system'?(media.matches?'dark':'light'):preferences.theme;root.dataset.reduceMotion=String(motion.matches);root.dataset.reduceTransparency=String(transparency.matches)};apply();const queries=[media,motion,transparency];queries.forEach(q=>q.addEventListener('change',apply));void window.desktop?.setTheme(preferences.theme);return()=>queries.forEach(q=>q.removeEventListener('change',apply))},[preferences]);
 useEffect(()=>{if(!window.desktop)return;const apply=(color:string)=>{if(/^#[0-9a-f]{6}$/i.test(color))document.documentElement.style.setProperty('--system-accent',color)};void window.desktop.systemAccent().then(apply);return window.desktop.onAccent(apply)},[]);
 const [entry,setEntry]=useState<ProjectEntry>(initialEntry),[session,setSession]=useState<{doc:Y.Doc;persistence:IndexeddbPersistence;projectId:string}|null>(null),[revision,setRevision]=useState(0);
 useEffect(()=>{let live=true;void ensureWelcomeDemo().then(changed=>{if(live&&changed)setRevision(v=>v+1)}).catch(error=>console.error('演示剧本初始化失败',error));return()=>{live=false}},[]);
 const secured=protectedProject(entry.id,entry.cloud);
 const [view,setViewState]=useState<'library'|'write'|'board'|'preview'|'prompts'>('library'),[active,setActive]=useState(''),[focusScene,setFocusScene]=useState(''),[sidebar,setSidebar]=useState(true),[notes,setNotes]=useState(false),[focus,setFocus]=useState(false),[modal,setModal]=useState(()=>needsGuide(entries().length)?'guide':''),[toast,setToast]=useState('');
 const [localStatus,setLocalStatus]=useState('正在打开'),[remoteStatus,setRemoteStatus]=useState(''),[provider,setProvider]=useState<{awareness:Awareness}>(),[people,setPeople]=useState<any[]>([]),[user,setUser]=useState(initUser);
 const [query,setQuery]=useState(''),[kind,setKind]=useState<Kind>('action'),[projectMenu,setProjectMenu]=useState(false),[pdfUrl,setPdfUrl]=useState(''),[previewHtml,setPreviewHtml]=useState(''),[pdfData,setPdfData]=useState(''),[pageCount,setPageCount]=useState(0),[previewBusy,setPreviewBusy]=useState(false),[previewRevision,setPreviewRevision]=useState(0);
 const [newTitle,setNewTitle]=useState(''),[renameOld,setRenameOld]=useState(''),[renameNew,setRenameNew]=useState(''),[replaceBody,setReplaceBody]=useState(false);
 const [serverUrl,setServerUrl]=useState(localStorage.getItem('changjing-server')||'http://127.0.0.1:1234'),[loginName,setLoginName]=useState(''),[loginPassword,setLoginPassword]=useState(''),[shareBusy,setShareBusy]=useState(false),[shareError,setShareError]=useState(''),[shareRole,setShareRole]=useState('editor'),[invites,setInvites]=useState<any[]>([]),[shareLink,setShareLink]=useState(''),[joinLink,setJoinLink]=useState('');
 const editorRef=useRef<Editor|null>(null),entryRef=useRef(entry),scrollRef=useRef<HTMLDivElement>(null),inputFile=useRef<HTMLInputElement>(null),initialScript=useRef<Script|undefined>(undefined),noteTimer=useRef<ReturnType<typeof setTimeout>>(undefined);
 const writingReady=view==='write'&&session?.projectId===entry.id;
 const manuscriptZoom=useManuscriptZoom(scrollRef,writingReady,entry.id);
 const setView=(next:typeof view)=>{if(next==='prompts'&&!preferences.promptEnabled)return;if(view==='write'&&next!=='write'){manuscriptZoom.remember();setFocusScene('')}setViewState(next)};
 useEffect(()=>{if(!preferences.promptEnabled&&view==='prompts')setViewState('write')},[preferences.promptEnabled,view]);
 const [sceneMenu,setSceneMenu]=useState<{id:string;left:number;top:number}|null>(null),[pendingScene,setPendingScene]=useState<{id:string;action:SceneAction}|null>(null);
 const [findOpen,setFindOpen]=useState(false),[findHits,setFindHits]=useState<FindMatch[]>([]),[findCurrent,setFindCurrent]=useState<FindMatch>();
 const onFindResults=useCallback((hits:FindMatch[],current?:FindMatch)=>{setFindHits(hits);setFindCurrent(current);if(current?.sceneId)setActive(current.sceneId)},[]);
 const closeFind=()=>{setFindOpen(false);setFindHits([]);setFindCurrent(undefined)};
 useEffect(()=>{closeFind()},[entry.id]);
 useEffect(()=>{if(view!=='write')closeFind()},[view]);
 entryRef.current=entry;
 const notify=useCallback((s:string)=>{setToast(s);},[]);
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),4500);return()=>clearTimeout(t)},[toast]);
 useEffect(()=>{if(!opened)return;editorRef.current=null;let cancelled=false;let cleanup:()=>void=()=>{};setSession(null);setProvider(undefined);setRemoteStatus('');setLocalStatus('正在打开');saveEntry(entry);localStorage.setItem('changjing-current',entry.id);
  const seed=initialScript.current;initialScript.current=undefined;openProject(entry,seed,preferences.defaultLayout).then(async s=>{if(cancelled){s.persistence.destroy();s.doc.destroy();return;}
   setSession({...s,projectId:entry.id});setActive(localStorage.getItem(`scene:${entry.id}`)||listScenes(s.doc)[0]?.id||'');setLocalStatus('已保存');
   let timer:ReturnType<typeof setTimeout>;const update=()=>{saveEntry({...entryRef.current,title:meta(s.doc).get('title')||'未命名剧本',updatedAt:Date.now()});setRevision(v=>v+1);setLocalStatus('正在保存');clearTimeout(timer);timer=setTimeout(async()=>{try{await persistProject(s.persistence);if(!cancelled){setLocalStatus('已保存');const next={...entryRef.current,title:meta(s.doc).get('title')||entryRef.current.title,updatedAt:Date.now()};saveEntry(next);}}catch{if(!cancelled)setLocalStatus('保存失败 · 请备份')}},350);};
   s.doc.on('update',update);cleanup=()=>{clearTimeout(timer);s.doc.off('update',update);s.persistence.destroy();s.doc.destroy();};
  }).catch(e=>{setLocalStatus('打开失败');notify(e.message)});
  return()=>{cancelled=true;cleanup()};
 },[entry.id,opened]);
 useEffect(()=>{if(!session||!entry.remote||!security.ready||secured)return;setRemoteStatus('正在连接');const c=connect(session.doc,entry.remote,setRemoteStatus,setPeople,user);setProvider(c.provider.awareness?{awareness:c.provider.awareness}:undefined);return()=>{c.close();setProvider(undefined);setPeople([]);}},[session,entry.remote?.url,entry.remote?.room,entry.remote?.token,user.name,user.color,security.ready,secured]);
 useEffect(()=>{localStorage.setItem(USER_KEY,JSON.stringify(user))},[user]);
 const doc=session?.doc,script=doc?snapshot(doc):null,scenes=script?.scenes.filter(s=>!s.deleted)||[],current=scenes.find(s=>s.id===active)||scenes[0];
 const documentSelection=useDocumentSelection(doc,view==='write'&&!modal);
 const selectDocument=()=>{const target=document.activeElement;if(view==='write'&&!modal&&(!target||target===document.body||target.closest('.manuscript')))return documentSelection.select();return false};
 const changeLayout=(layout:LayoutStyle)=>{setPreferences({...preferences,defaultLayout:layout});if(doc&&view!=='library'&&!readonly)meta(doc).set('layout',layout)};
 const readonly=entry.remote?.role==='viewer'||remoteStatus==='访问已失效'||!!entry.cloud&&(entry.cloud.role==='viewer'||!doc||!meta(doc).has('title'));
 const promptSelection=useRef<{projectId:string;source:PromptSpan[]}>({projectId:'',source:[]});
 const assistantContext=useRef({doc,session,entry,view,readonly});assistantContext.current={doc,session,entry,view,readonly};
 useEffect(()=>window.assistantBridge?.onRequest(async(request:AssistantCall)=>{const authorization=await window.assistantBridge!.status();if(request.explicit){
   assertProjectAccess();
   if(!authorization.appEnabled||authorization.epoch!==request.epoch)throw Error('接入授权已改变');
   const available=entries().filter(project=>!protectedProject(project.id,project.cloud));
   if(request.name==='list_projects')return available.map(({id,title})=>({id,title}));
   const target=available.find(project=>project.id===request.projectId);
   if(request.name!=='open_project'||!target)throw Error('剧本不可用');
   openEntry(target);
   for(let attempt=0;attempt<100;attempt++){
    await new Promise(resolve=>setTimeout(resolve,50));
    const status=await window.assistantBridge!.status();
    assertProjectAccess(target.id,target.cloud);
    if(!status.appEnabled)throw Error('全局接入已关闭');
    if(status.enabled&&status.projectId===target.id&&assistantContext.current.session?.projectId===target.id)return {id:target.id,title:target.title};
   }
   throw Error('尚未打开剧本，请稍后重试');
  }
  const ctx=assistantContext.current;assertProjectAccess(ctx.entry.id,ctx.entry.cloud);if(authorization.epoch!==request.epoch||!authorization.enabled||authorization.projectId!==request.projectId||(request.write&&!authorization.allowWrite))throw Error('接入授权已改变');if(!ctx.doc||!ctx.session||request.projectId!==ctx.entry.id)throw Error('授权剧本尚未打开，请先打开这份剧本');if(request.write&&ctx.readonly)throw Error('当前剧本只读');let result=executeAssistant(ctx.doc,request,name=>saveVersion(ctx.entry.id,name,ctx.doc!));if(request.name==='read_prompt_sources'){let currentDraft=null;try{const saved=JSON.parse(localStorage.getItem(`juhao-prompt-draft:${ctx.entry.id}`)||'null');if(saved&&Array.isArray(saved.source)&&saved.fields)currentDraft={id:saved.id,expectedRevision:saved.expectedRevision,source:saved.source,fields:saved.fields,referenceImageIds:saved.referenceImageIds||[]}}catch{}result={...result as object,current_selection:promptSelection.current.projectId===ctx.entry.id?promptSelection.current.source:[],current_draft:currentDraft};}if(request.write)await persistProject(ctx.session.persistence);return result}),[]);
 useEffect(()=>{void window.assistantBridge?.activate(security.ready&&session?.projectId===entry.id&&!secured?entry.id:'').catch(e=>notify(String(e)))},[entry.id,session,secured,security.ready]);
 const chars=doc?characterNames(doc):[];
 const selectScene=useCallback((id:string,editor?:Editor)=>{setActive(id);localStorage.setItem(`scene:${entryRef.current.id}`,id);if(editor){editorRef.current=editor;setSelectedFont(editor.getAttributes('fontFamily').family||'');}},[]);
 const jumpTarget=useRef('');
 const goScene=(id:string)=>{
  selectScene(id);setView('write');jumpTarget.current=id;
  requestAnimationFrame(()=>{
   const pane=scrollRef.current,scene=document.getElementById(`scene-${id}`);
   if(jumpTarget.current===id&&pane&&scene)pane.scrollTop+=scene.getBoundingClientRect().top-pane.getBoundingClientRect().top-32;
  });
 };
 useEffect(()=>{
  const pane=scrollRef.current;if(!writingReady||!pane)return;
  let frame=0,lastTop=pane.scrollTop;
  const follow=()=>{
   frame=0;
   if(lastTop===pane.scrollTop)return;
   lastTop=pane.scrollTop;
   if(jumpTarget.current){jumpTarget.current='';return}
   const sections=pane.querySelectorAll<HTMLElement>('.scene-section');
   if(!sections.length)return;
   const readingLine=pane.getBoundingClientRect().top+Math.min(72,pane.clientHeight/5);
   let lo=0,hi=sections.length;
   while(lo<hi){const mid=(lo+hi)>>>1;if(sections[mid].getBoundingClientRect().top<=readingLine)lo=mid+1;else hi=mid}
   const atEnd=pane.scrollTop+pane.clientHeight>=pane.scrollHeight-2;
   const scene=sections[atEnd?sections.length-1:Math.max(0,lo-1)];
   setActive(scene.id.slice('scene-'.length));
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(follow)};
  const manual=()=>{jumpTarget.current=''};
  pane.addEventListener('scroll',schedule);pane.addEventListener('wheel',manual,{passive:true});pane.addEventListener('pointerdown',manual);pane.addEventListener('keydown',manual);
  return ()=>{cancelAnimationFrame(frame);pane.removeEventListener('scroll',schedule);pane.removeEventListener('wheel',manual);pane.removeEventListener('pointerdown',manual);pane.removeEventListener('keydown',manual);jumpTarget.current=''};
 },[writingReady,entry.id]);

 const add=(after?:string,actId?:string)=>{if(!doc||readonly)return;const id=addScene(doc,after||current?.id,{actId:actId??current?.actId??''});setActive(id);setFocusScene(id);setView('write');requestAnimationFrame(()=>document.getElementById(`scene-${id}`)?.scrollIntoView({behavior:document.documentElement.dataset.reduceMotion==='true'?'instant':'smooth',block:'center'}));};
 const pasteScenes=(incoming:Scene[],after:string)=>{if(!doc||readonly||!incoming.length)return;let last=after;const currentScene=listScenes(doc).find(s=>s.id===after);const reuse=currentScene&&!currentScene.location&&!currentScene.notes&&!currentScene.summary&&currentScene.blocks.every(b=>!b.text);doc.transact(()=>{incoming.forEach((scene,i)=>{if(i===0&&reuse){updateScene(doc,after,{...(scene.name?{name:scene.name}:{}),episode:scene.episode||1,cast:scene.cast||'',setting:scene.setting,location:scene.location,time:scene.time});const f=fragment(doc,after);f.delete(0,f.length);f.insert(0,(scene.blocks.length?scene.blocks:[{kind:'action' as const,text:''}]).map(blockNode));}else last=addScene(doc,last,{...scene,actId:currentScene?.actId||''});});},LOCAL);setActive(last);setFocusScene(last);notify(`已粘贴 ${incoming.length} 个场景，保留格式`)};
 const performHideScene=(scene:Scene)=>{if(!doc||readonly)return;const source=document.getElementById(`scene-${scene.id}`)?.getBoundingClientRect(),target=document.querySelector('[data-hidden-scenes]')?.getBoundingClientRect();
  if(source&&document.documentElement.dataset.reduceMotion!=='true'&&!matchMedia('(prefers-reduced-motion: reduce)').matches){const ghost=document.createElement('div');ghost.className='scene-hide-flight';ghost.textContent=sceneName(scene);Object.assign(ghost.style,{left:`${source.left}px`,top:`${source.top}px`,width:`${Math.min(source.width,320)}px`});document.body.appendChild(ghost);const animation=ghost.animate([{opacity:.95,transform:'translate(0,0) scale(1)'},{opacity:0,transform:`translate(${(target?.left??24)-source.left}px,${(target?.top??window.innerHeight-80)-source.top}px) scale(.2)`}],{duration:340,easing:'cubic-bezier(.25,.7,.3,1)'});animation.finished.finally(()=>ghost.remove());}
  updateScene(doc,scene.id,{deleted:true});if(current?.id===scene.id)setActive(scenes.find(s=>s.id!==scene.id)?.id||'');notify('场景已移入场景隐藏区，可随时重新显示');
 };
 const sceneName=(scene:Scene)=>scene.name||'场景';
 const requestSceneAction=(id:string,action:SceneAction)=>{if(readonly)return;setSceneMenu(null);setPendingScene({id,action});setModal('scene-action')};
 const openSceneMenu=(id:string,element:HTMLElement)=>{if(readonly)return;const rect=element.getBoundingClientRect();setSceneMenu({id,left:rect.right-8,top:rect.top+12})};
 const confirmSceneAction=(name?:string)=>{if(!doc||readonly||!pendingScene)return;const scene=listScenes(doc,true).find(s=>s.id===pendingScene.id);if(!scene){setModal('');setPendingScene(null);return;}if(pendingScene.action==='rename'){updateScene(doc,scene.id,{name:name||sceneName(scene)});notify('场景名称已更新')}else if(pendingScene.action==='hide')performHideScene(scene);else{deleteScene(doc,scene.id);if(current?.id===scene.id)setActive(scenes.find(s=>s.id!==scene.id)?.id||'');notify('场景已删除')}setModal('');setPendingScene(null)};
 useEffect(()=>{setSceneMenu(null);setPendingScene(null);setModal(value=>value==='scene-action'?'':value)},[entry.id,view]);
 const openNew=()=>{setNewTitle('');setModal('new');setProjectMenu(false)};
 const create=async(title:string,seed?:Script)=>{manuscriptZoom.remember();const next=newEntry(title||'未命名剧本');if(seed&&protectedProject(entryRef.current.id,entryRef.current.cloud)){try{await setProjectProtection(next,true)}catch(e){notify('无法保护副本，未创建：'+String(e));return}}initialScript.current=seed;setOpened(true);setEntry(next);setView('write');setModal('');setQuery('');setPreviewHtml('');};
 const openLibrary=()=>{setView('library');setFocus(false);setProjectMenu(false);};
 const openEntry=(project:ProjectEntry)=>{manuscriptZoom.remember();setOpened(true);setEntry(project);setView('write');setQuery('');setPreviewHtml('');setPdfUrl('');setPdfData('');setFocusScene('');setProjectMenu(false)};
 const revealProject=async(project:ProjectEntry)=>{
  if(!window.desktop)throw Error('请在 Mac 客户端使用');
  const active=project.id===entry.id?session:null;
  const context=active||await openProject(project);
  try{await persistProject(context.persistence);const snap=snapshot(context.doc);const bytes=await encodeDrg(snap,{documentId:project.id,protected:protectedProject(project.id,project.cloud)});await window.desktop.revealProjectFile(project.id,bytes,drgFilename(snap.title));notify('已在 Finder 中显示最新剧本副本')}
  finally{if(!active){context.persistence.destroy();context.doc.destroy()}}
 };
 const backup=async()=>{if(!doc)return;const data=JSON.stringify(snapshot(doc),null,2),name=`${meta(doc).get('title')||'剧本'}.changjing`;try{if(window.desktop){const path=await window.desktop.saveBackup(data,name);if(path)notify('项目备份已保存')}else{download(name,data);notify('项目备份已下载')}}catch(e){notify(String(e))}};
 const saveDrg=async()=>{if(!doc)return;try{const data=await encodeDrg(snapshot(doc),{documentId:entry.id,protected:secured}),name=drgFilename(meta(doc).get('title')||'剧本');if(window.desktop){if(!await window.desktop.saveDrg(data,name))return}else{const url=URL.createObjectURL(new Blob([data.slice().buffer],{type:'application/x-juhaoxie-jhwrite'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}notify('.jhwrite 剧本已保存，可传输到其他电脑');setModal('')}catch(e){notify(String(e))}};
 const importDocument=async(bytes:Uint8Array,name:string)=>{
  if(bytes.length>DRG_MAX_FILE)throw Error('剧本文件过大，无法打开');
  const isDrg=/\.(jhwrite|drg)$/i.test(name)||new TextDecoder().decode(bytes.subarray(0,8))==='JUHAODRG';
  const file=isDrg?await decodeDrg(bytes):undefined;
  const data=file?.script||JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));validateScript(data);
  const existing=file&&entries().find(e=>e.fileSource?.documentId===file.documentId&&e.fileSource.digest===file.digest);
  if(existing){if(file.protected&&!protectedProject(existing.id))await setProjectProtection(existing,true);openEntry(existing);notify('已打开本机副本，保留本机修改');return}
  const next=newEntry(data.title);if(file)next.fileSource={documentId:file.documentId,digest:file.digest};
  if(file?.protected||protectedProject(entryRef.current.id,entryRef.current.cloud))await setProjectProtection(next,true);
  const imported=await openProject(next,data);await persistProject(imported.persistence);imported.persistence.destroy();imported.doc.destroy();saveEntry(next);openEntry(next);setModal('');notify('已打开独立的本机副本；传输前请另存为 .jhwrite');
 };
 const importBackup=async(file?:File)=>{if(!file)return;try{if(file.size>DRG_MAX_FILE)throw Error('剧本文件过大，无法打开');await importDocument(new Uint8Array(await file.arrayBuffer()),file.name)}catch(e){notify(e instanceof Error?e.message:'无法读取此剧本文件')}};
 const importDocumentRef=useRef(importDocument);importDocumentRef.current=importDocument;
 useEffect(()=>{if(!window.desktop||!security.ready)return;let busy=false,again=false,cancelled=false;const drain=async()=>{if(busy){again=true;return}busy=true;try{do{again=false;const files=await window.desktop!.takeDocumentFiles();for(const file of files){if(cancelled)return;try{if(file.error)throw Error(file.error);await importDocumentRef.current(new Uint8Array(file.data!),file.name)}catch(e){notify(String(e))}if(!cancelled)await window.desktop!.ackDocumentFile(file.id)}}while(again&&!cancelled)}catch(e){notify('无法读取打开的文件：'+String(e))}finally{busy=false}};const off=window.desktop.onDocumentFiles(()=>void drain());void drain();return()=>{cancelled=true;off()}},[security.ready]);

 const makePreview=async()=>{if(!doc)return;setView('preview');setPreviewBusy(true);try{const snap=snapshot(doc),fonts=[...new Set([snap.fontFamily||DEFAULT_FONT,...snap.scenes.flatMap(s=>s.blocks.flatMap(b=>(b.runs||[]).map(r=>r.fontFamily||snap.fontFamily||DEFAULT_FONT)))])];await Promise.all(fonts.map(font=>Promise.all([document.fonts.load(`12px "${font}"`),document.fonts.load(`700 12px "${font}"`)])));await document.fonts.ready;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;ctx.font='12px "PingFang SC", "Helvetica Neue", sans-serif';const pages=paginate(snap,(s,font,bold)=>{ctx.font=`${bold?'700':'400'} 12px ${fontStack(font||snap.fontFamily)}`;return ctx.measureText(s).width});setPageCount(pages.length);const html=printHtml(snap,pages,new URL('fonts',document.baseURI).href);setPreviewHtml(html);setPreviewRevision(revision);if(window.desktop){const data=await window.desktop.pdf(html);setPdfData(data);const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));if(pdfUrl)URL.revokeObjectURL(pdfUrl);setPdfUrl(URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})));}}catch(e){notify('生成预览失败：'+String(e))}finally{setPreviewBusy(false)}};
 const exportWordFile=async()=>{if(!doc)return;try{const snap=snapshot(doc),data=exportWord(snap),name=`${snap.title.replace(/[\\/:*?"<>|]/g,'-')||'剧本'}.docx`;if(window.desktop){if(!await window.desktop.exportDocument(data,name,'docx'))return}else downloadBytes(name,data,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');notify('Word 已导出')}catch(e){notify('导出失败：'+String(e))}};
 const exportPdf=async()=>{if(!script)return;if(window.desktop&&pdfData){try{const path=await window.desktop.exportPdf(pdfData,`${script.title}.pdf`);if(path)notify('PDF 已导出')}catch(e){notify(String(e))}}else{const frame=document.querySelector<HTMLIFrameElement>('.print-frame');frame?.contentWindow?.print();}};
 useEffect(()=>window.desktop?.onCommand(command=>{if(command==='select-all'){if(!selectDocument()){const target=document.activeElement;if(target instanceof HTMLInputElement||target instanceof HTMLTextAreaElement)target.select();else document.execCommand('selectAll')}return;}if(command==='search'&&doc){setView('write');setFindOpen(true);}if(command==='settings')setModal('settings');if(command==='new')openNew();if(command==='legacy-backup')void backup();if(command==='backup'||command==='save-drg')void saveDrg();if(command==='preview')void makePreview();if(command==='import')inputFile.current?.click()}),[doc,revision,view,modal]);
 useEffect(()=>{const listener=(e:KeyboardEvent)=>{
  if(e.isComposing||e.keyCode===229||editorRef.current?.view.composing)return;
  if(e.key==='Escape'&&focus)setFocus(false);
  if(modal)return;
  if((e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.code==='KeyA'&&selectDocument()){e.preventDefault();e.stopPropagation();return;}
  const key=keyFromEvent(e);
  if(key==='Mod+Comma'){e.preventDefault();setModal('settings');return;}
  const command=COMMANDS.find(c=>key&&preferences.shortcuts[c.id]===key)?.id;if(!command)return;
  const editor=editorRef.current;
  if(isFormat(command)){
   if(readonly||view!=='write'||!editor?.isFocused)return;
   e.preventDefault();e.stopPropagation();changeBlockKind(editor,command);setKind(command);return;
  }
  e.preventDefault();e.stopPropagation();
  if(command==='new')openNew();if(command==='import')inputFile.current?.click();if(command==='backup')void saveDrg();if(command==='preview')void makePreview();if(command==='addScene')add();
  if(command==='search'&&view==='library'){document.querySelector<HTMLInputElement>('[aria-label="搜索剧本库"]')?.focus();return;}
  if(command==='search'){setView('write');setFindOpen(true);requestAnimationFrame(()=>document.querySelector<HTMLInputElement>('[aria-label="查找内容"]')?.focus());}
  if(command==='save'&&session)void persistProject(session.persistence).then(()=>notify('已保存')).catch(()=>notify('保存失败，请导出项目备份'));
 };window.addEventListener('keydown',listener,true);return()=>window.removeEventListener('keydown',listener,true)},[session,focus,modal,preferences,view,readonly,doc,revision,current?.id]);
 const showVersions=()=>setModal('versions');
 const openShare=()=>{setModal('share');setShareError('');setShareLink('');if(entry.remote)setServerUrl(entry.remote.url);if(entry.remote?.role==='owner')api(entry.remote.url,`/api/rooms/${entry.remote.room}/invites`,undefined,entry.remote.token).then(d=>setInvites(d.invites)).catch(e=>setShareError(e.message))};
 const publish=async()=>{if(!doc)return;assertProjectAccess(entry.id,entry.cloud);setShareBusy(true);setShareError('');try{const url=serverUrl.trim().replace(/\/$/,'');if(!/^https?:\/\//.test(url))throw Error('请输入完整的 http 或 https 服务地址');const auth=await api(url,'/api/login',{username:loginName,password:loginPassword});const bytes=Y.encodeStateAsUpdate(doc);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);const result=await api(url,'/api/rooms',{title:meta(doc).get('title'),update:btoa(binary)},auth.token);const remote={url,room:result.room,token:result.token,role:'owner'};const next={...entry,remote};setEntry(next);saveEntry(next);localStorage.setItem('changjing-server',url);setLoginPassword('');notify('共享剧本已创建')}catch(e){setShareError(e instanceof Error?e.message:String(e))}finally{setShareBusy(false)}};
 const invite=async()=>{if(!entry.remote)return;assertProjectAccess(entry.id,entry.cloud);setShareBusy(true);setShareError('');try{const r=entry.remote;const result=await api(r.url,`/api/rooms/${r.room}/invites`,{role:shareRole},r.token);const payload=btoa(unescape(encodeURIComponent(JSON.stringify({url:r.url,room:r.room,token:result.token,role:shareRole}))));const base=result.publicUrl||r.url;setShareLink(`${base}/#join=${encodeURIComponent(payload)}`);const d=await api(r.url,`/api/rooms/${r.room}/invites`,undefined,r.token);setInvites(d.invites)}catch(e){setShareError(String(e))}finally{setShareBusy(false)}};
 const join=()=>{try{const url=new URL(joinLink),hash=new URLSearchParams(url.hash.slice(1));const remote=JSON.parse(decodeURIComponent(escape(atob(hash.get('join')||''))));if(!/^https?:\/\//.test(remote.url)||!remote.room||!remote.token)throw Error();const old=entries().find(e=>e.remote?.room===remote.room&&e.remote?.url===remote.url);setEntry({...newEntry('共享剧本'),...old,remote});setModal('');setView('write')}catch{setShareError('邀请链接无效，请粘贴完整链接。')}};
 const filtered=scenes.filter(s=>!query||[s.name||'',script?.acts?.find(a=>a.id===s.actId)?.name||'',sceneHeading(s),s.summary,...s.blocks.map(b=>b.text)].some(t=>t.toLowerCase().includes(query.toLowerCase())));
 const count=script?wordCount(script):0;
 const agents=useAgentConnections(entry.id,opened&&!secured);
 const nativeShell=useNativeShell({agents,promptEnabled:preferences.promptEnabled,projectId:entry.id,theme:preferences.theme==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):preferences.theme,title:view==='library'?'剧好写':script?.title||entry.title,view,status:view==='library'?'':secured?'安全区 · '+localStatus:remoteStatus||localStatus,opened,readonly,focus,notes,modal:!!modal,sidebar:view!=='library'&&sidebar&&!focus,active:current?.id||'',groups:[...(script?.acts||[]).map(act=>({id:act.id,name:act.name,children:filtered.filter(s=>s.actId===act.id).map(s=>({id:s.id,name:String(scenes.indexOf(s)+1).padStart(2,'0')+'  '+sceneName(s),detail:[s.setting,s.location||'场景地点',s.time].join(' · ')}))})),{id:'',name:'未分幕',children:filtered.filter(s=>!s.actId||!script?.acts?.some(a=>a.id===s.actId)).map(s=>({id:s.id,name:String(scenes.indexOf(s)+1).padStart(2,'0')+'  '+sceneName(s),detail:[s.setting,s.location||'场景地点',s.time].join(' · ')}))}]},event=>{
  if(event.action==='assistant-settings'){setModal('assistant-settings');return}
  if(modal)return;
  if(event.action==='view'){if(event.value==='library')openLibrary();else if(opened){if(event.value==='preview')void makePreview();else if(['write','board','prompts'].includes(event.value||''))setView(event.value as 'write'|'board'|'prompts')}return;}
  if(event.action==='sidebar'){setSidebar(!sidebar);setFocus(false)}
  if(event.action==='query')setQuery(event.value||'');
  if(event.action==='select-scene'&&scenes.some(s=>s.id===event.id))selectScene(event.id!);
  if(event.action==='scene'&&scenes.some(s=>s.id===event.id))goScene(event.id!);
  if(['rename','hide','delete'].includes(event.action)&&!readonly&&scenes.some(s=>s.id===event.id))requestSceneAction(event.id!,event.action as SceneAction);
  if(event.action==='assign'&&doc&&!readonly&&scenes.some(s=>s.id===event.id)&&(event.actId===''||script?.acts?.some(a=>a.id===event.actId))){assignAct(doc,event.id!,event.actId!,event.beforeId||undefined);}
  if(view==='write'&&opened){if(event.action==='font')setModal('document-font');if(event.action==='focus')setFocus(!focus);if(event.action==='notes')setNotes(!notes);}
  if(event.action==='add')add();if(event.action==='versions')showVersions();
  const panels:Record<string,string>={acts:'acts',characters:'characters',trash:'trash',settings:'settings',profile:'profile',export:'export'};if(panels[event.action])setModal(panels[event.action]);
 });
 return <div className={`app ${focus?'focus-mode':''} ${window.desktop?'desktop':''} ${nativeShell?'native-shell':''} ${nativeShell&&view!=='library'&&sidebar&&!focus?'native-sidebar-visible':''}`}>
  <input ref={inputFile} type="file" accept=".jhwrite,.drg,.changjing,.json" hidden onChange={e=>{void importBackup(e.target.files?.[0]);e.target.value=''}}/>
  <header className="titlebar">
   <div className="titlebar-left"><button className="brand-mark" onClick={()=>setProjectMenu(!projectMenu)} title="我的剧本"><img src={import.meta.env.BASE_URL+'mark.png'}/></button><button className="project-switch" onClick={()=>setProjectMenu(!projectMenu)}><span>{view==='library'?'工作空间':script?.title||entry.title}</span><ChevronDown size={13}/></button>
   {projectMenu&&<div className="popover project-menu"><span className="menu-eyebrow">我的剧本</span>{entries().filter(e=>!e.remote).map(e=><button key={e.id} onClick={()=>openEntry(e)}><FileText size={15}/><span>{e.title}</span>{e.id===entry.id&&<Check size={14}/>}</button>)}<hr/><button onClick={openNew}><Plus size={15}/>新建剧本</button><button onClick={()=>{inputFile.current?.click();setProjectMenu(false)}}><FolderOpen size={15}/>打开项目备份</button><button onClick={()=>{void backup();setProjectMenu(false)}}><Download size={15}/>保存项目备份</button><button onClick={()=>{void saveDrg();setProjectMenu(false)}}><Download size={15}/>保存剧本文件（.jhwrite）</button></div>}
   </div>
   <GlassNavigation value={view} className="view-tabs" label="工作视图"><button className={view==='library'?'selected':''} onClick={openLibrary}><BookOpen size={16}/>剧本库</button><button disabled={!opened} className={view==='write'?'selected':''} onClick={()=>setView('write')}><FileText size={15}/>文稿</button><button disabled={!opened} className={view==='board'?'selected':''} onClick={()=>setView('board')}><LayoutGrid size={15}/>分场</button>{preferences.promptEnabled&&<button disabled={!opened} className={view==='prompts'?'selected':''} onClick={()=>setView('prompts')}><Film size={15}/>Prompt</button>}<button disabled={!opened} className={view==='preview'?'selected':''} onClick={()=>void makePreview()}><Eye size={16}/>预览</button></GlassNavigation>
   <div className="titlebar-right">{view!=='library'&&<><div className="save-indicator" title={localStatus}>{entry.remote?<Cloud size={14}/>:<span className="saved-dot"/>}<span>{secured?'安全区 · '+localStatus:remoteStatus||localStatus}</span></div><button style={{background:user.color,color:'white'}} className="avatar" onClick={()=>setModal('profile')} title="我的名字" aria-label="我的名字">{user.name.slice(0,1)}</button><button className="share-button" onClick={()=>setModal('export')}><Download size={14}/>导出</button></>}</div>
  </header>
  {view==='library'?<Library onDemo={async()=>{await addWelcomeDemo();setRevision(v=>v+1);notify('演示剧本已在剧本库')}} projects={entries(true).filter(e=>!e.remote)} onDelete={async project=>{if(project.id===entry.id&&session){await persistProject(session.persistence);setOpened(false);setSession(null)}trashProject(project.id);setRevision(v=>v+1);notify('已移到最近删除')} } onRestore={project=>{restoreProject(project.id);setRevision(v=>v+1)}} onReveal={revealProject} onOpen={openEntry} onNew={openNew} onImport={()=>inputFile.current?.click()} onSettings={()=>setModal('settings')}/>:<div className="workspace">
   {sidebar&&!focus&&<aside className="sidebar"><div className="sidebar-heading"><span>目录</span><AgentConnections agents={agents} onClick={()=>setModal('assistant-settings')}/><button className="icon-btn" onClick={()=>setSidebar(false)} title="收起目录"><PanelLeft size={16}/></button></div><label className="search-box"><Search size={14}/><input aria-label="搜索剧本" value={query} onChange={e=>setQuery(e.target.value)} placeholder="搜索场景或文稿"/></label><div className="outline-meta"><span>{script?.acts?.length||0} 幕</span><span>{scenes.length} 场</span></div><div className="scene-list"><ActFolders key={entry.id} acts={script?.acts||[]} scenes={filtered} readonly={readonly} searching={!!query} activeScene={current?.id} storageKey={`act-folders:${entry.id}`} onAssign={(id,act,before)=>{if(doc&&!readonly)assignAct(doc,id,act,before)}} renderScene={s=><button key={s.id} className={`scene-item ${current?.id===s.id?'selected':''}`} aria-haspopup={readonly?undefined:'menu'} onDoubleClick={e=>{e.preventDefault();if(!readonly&&(e.target as HTMLElement).closest('[data-scene-name]'))requestSceneAction(s.id,'rename');else goScene(s.id)}} onContextMenu={e=>{e.preventDefault();openSceneMenu(s.id,e.currentTarget)}} onKeyDown={e=>{if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();openSceneMenu(s.id,e.currentTarget)}}} onClick={()=>goScene(s.id)}><span className="outline-number">{String(scenes.indexOf(s)+1).padStart(2,'0')}</span><span className="outline-copy"><span className="outline-title"><span data-scene-name>{sceneName(s)}</span></span><span className="outline-subtitle">{s.setting}<span>·</span>{s.location||'场景地点'}<span>·</span>{s.time}</span></span><span className="scene-mini-dot"/></button>}/></div>{!readonly&&<button className="add-outline" onClick={()=>add()}><Plus size={15}/>添加场景<kbd>{shortcutLabel(preferences.shortcuts.addScene)}</kbd></button>}<div className="sidebar-bottom"><button onClick={()=>setModal('characters')}><Users size={15}/>剧本资料<span>{chars.length}</span></button><button onClick={()=>setModal('acts')}><BookOpen size={15}/>幕管理<span>{script?.acts?.length||''}</span></button><button data-hidden-scenes aria-label="场景隐藏区" onClick={()=>setModal('trash')}><EyeOff size={15}/>场景隐藏区<span>{script?.scenes.filter(s=>s.deleted).length||''}</span></button><button onClick={showVersions}><History size={15}/>版本记录</button><button onClick={()=>setModal('settings')}><Settings2 size={15}/>设置</button></div></aside>}
   <main className={`main-pane ${view==='preview'?'preview-pane':''}`}>
    <div className={`editor-toolbar ${nativeShell&&view==='write'?'native-writing-toolbar':''}`}><div className="toolbar-left">{(!sidebar||focus)&&<button className="icon-btn" title="展开目录" onClick={()=>{setSidebar(true);setFocus(false)}}><PanelLeft size={16}/></button>}<span className="breadcrumb">{view==='prompts'?'剧本与镜头':view==='board'?'故事结构':view==='preview'?'排版预览':''}</span><span className="toolbar-detail">{view==='board'?`${scenes.length} 场 · 拖动以调整顺序`:view==='preview'?`${pageCount} 页`:null}</span></div><div className="toolbar-right">{view==='write'&&<div className="font-controls"><button className="icon-btn" aria-label="文稿字体设置" title="文稿默认字体" onClick={()=>setModal('document-font')}><Type size={16}/></button></div>}<button className="icon-btn" aria-label="打开设置" title="设置" onClick={()=>setModal('settings')}><Settings2 size={16}/></button>{view==='preview'?<><button className="text-btn" onClick={()=>void makePreview()} disabled={previewBusy}><RotateCcw size={14}/>{previewRevision!==revision?'内容已更新 · 刷新预览':'刷新'}</button><button className="primary small" disabled={previewBusy||!previewHtml} onClick={()=>void exportPdf()}><Download size={14}/>{window.desktop?'导出 PDF':'打印 / 保存 PDF'}</button><button className="secondary small" onClick={()=>void exportWordFile()}><Download size={14}/>导出 Word</button></>:<><button className={`icon-btn ${focus?'on':''}`} title="专注写作" onClick={()=>setFocus(!focus)}>{focus?<Minimize2 size={16}/>:<Maximize2 size={16}/>}</button><button className={`icon-btn ${notes?'on':''}`} title="场景笔记" aria-label="场景笔记" onClick={()=>setNotes(!notes)}><PanelRight size={17}/></button></>}</div></div>
    <div className={`editor-scroll ${view==='write'?'writing-scroll':view==='prompts'?'prompt-scroll':''}`} ref={scrollRef}>
     {!session?<div className="loading-state">正在打开你的写作空间……</div>:view==='write'?<div className="manuscript-canvas"><div className={`manuscript ${documentSelection.selected?'document-selected':''}`} data-project-id={entry.id} data-layout={script?.layout||'hollywood'} style={{...layoutVariables(script?.layout),'--document-font':fontStack(script?.fontFamily)} as React.CSSProperties}>
      <div className="manuscript-header"><input className="script-title" aria-label="剧本标题" placeholder="未命名剧本" value={script?.title||''} disabled={readonly} onChange={e=>meta(doc!).set('title',e.target.value)}/><div className="script-subheading"><button onClick={()=>setModal('cover')}>{script?.author||'添加编剧署名'}</button><span>·</span><span>{scenes.length} 场</span><span>·</span><span>{count.toLocaleString()} 字</span></div></div>
      <div className="writing-body">{scenes.map((s,i)=><SceneEditor layout={script?.layout||'hollywood'} shortNumber={shortSceneNumber(scenes,s)} episodeStart={i===0||episodeOf(scenes[i-1])!==episodeOf(s)} findHits={findHits} findCurrent={findCurrent} onPasteScenes={pasteScenes} preferences={preferences} key={s.id} doc={doc!} scene={s} number={i+1} active={current?.id===s.id} autoFocus={focusScene===s.id} readOnly={readonly} provider={provider} user={user} onActive={selectScene} onKind={setKind} onAdd={()=>add(s.id)} onRemove={()=>requestSceneAction(s.id,'hide')}/>)}</div>
     </div></div>:view==='board'?<SceneBoard acts={listActs(doc!)} onAssign={(id,act)=>assignAct(doc!,id,act)} scenes={scenes} active={current?.id} readonly={readonly} onAdd={actId=>add(undefined,actId)} onSelect={selectScene} onMove={(id,target,before)=>moveScene(doc!,id,target,before)} onSummary={(id,summary)=>updateScene(doc!,id,{summary})}/>:view==='prompts'?<PromptWorkspace key={entry.id} doc={doc!} projectId={entry.id} readonly={readonly} onLocate={goScene} onSelection={source=>{promptSelection.current={projectId:entry.id,source}}} onSettings={()=>setModal('assistant-settings')}/>:<div className="preview-container">{previewBusy?<div className="loading-state">正在排版，检查对白与跨页……</div>:pdfUrl&&window.desktop?<iframe className="pdf-frame" title="A4 PDF 预览" src={pdfUrl}/>:previewHtml?<iframe className="print-frame" title="A4 排版预览" srcDoc={previewHtml} onLoad={e=>{const d=e.currentTarget.contentDocument;if(d){d.body.style.background='transparent';d.querySelectorAll<HTMLElement>('.page').forEach(p=>{p.style.background='white';p.style.margin='24px auto';p.style.boxShadow='0 3px 18px #0000000d';})}}}/>:<div className="loading-state">点击刷新生成预览</div>}</div>}
    </div>
    <footer className="statusbar"><div><span className="status-dot"/>{documentSelection.selected?'已选择整份文稿 · ⌘C 复制':readonly?'只读工作稿':view==='prompts'?'Prompt':view==='board'?'分场视图':view==='preview'?'A4 · 210 × 297 mm':LABELS[kind]}<span className="status-divider"/>{count.toLocaleString()} 字<span className="status-divider"/>{scenes.length} 场</div><div>{people.length>1&&<span className="online-people"><Users size={12}/>{people.length} 人在线</span>}<button onClick={()=>setModal('settings')}>Tab 切换格式<span className="status-divider"/>Enter 继续写作</button><ZoomControls controls={manuscriptZoom} enabled={writingReady}/>	</div></footer>
   </main>
   {notes&&!focus&&view!=='preview'&&current&&<aside className="notes-panel"><div className="sidebar-heading"><span>这一场</span><button className="icon-btn" onClick={()=>setNotes(false)}><X size={16}/></button></div><div className="notes-content"><span className="eyebrow">第 {scenes.indexOf(current)+1} 场</span><h3>{current.location||'未命名场景'}</h3><p className="muted">{current.setting} · {current.time}</p><label>分场梗概<textarea placeholder="分场梗概" value={current.summary} readOnly={readonly} onChange={e=>updateScene(doc!,current.id,{summary:e.target.value})}/></label><label>创作笔记<textarea className="long-notes" placeholder="创作笔记" value={current.notes} readOnly={readonly} onChange={e=>updateScene(doc!,current.id,{notes:e.target.value})}/></label></div></aside>}
  </div>}

  {modal==='acts'&&doc&&<ActsPanel acts={listActs(doc)} scenes={script?.scenes||[]} readonly={readonly} onAdd={name=>addAct(doc,name)} onRename={(id,name)=>renameAct(doc,id,name)} onRemove={id=>removeAct(doc,id)} onAssign={(id,act,before)=>assignAct(doc,id,act,before)} onClose={()=>setModal('')}/>}
  {findOpen&&doc&&view==='write'&&!modal&&<FindReplace doc={doc} revision={revision} readOnly={readonly} onResults={onFindResults} onClose={closeFind}/>}
  {sceneMenu&&!modal&&<SceneMenu left={sceneMenu.left} top={sceneMenu.top} onClose={()=>setSceneMenu(null)} onChoose={action=>requestSceneAction(sceneMenu.id,action)}/>}
  {modal==='scene-action'&&pendingScene&&script?.scenes.some(s=>s.id===pendingScene.id)&&<SceneActionDialog action={pendingScene.action} name={sceneName(script.scenes.find(s=>s.id===pendingScene.id)!)} onConfirm={confirmSceneAction} onClose={()=>{setModal('');setPendingScene(null)}}/>}
  {toast&&<div className="toast" role="status"><Check size={16}/>{toast}</div>}
  {modal==='guide'&&<GettingStarted onClose={()=>{localStorage.setItem(GUIDE_KEY,'done');setModal('')}}/>}
  {modal==='new'&&<Modal title="开始一个新故事" onClose={()=>setModal('')}><p className="modal-intro">先给它一个名字。你随时可以修改。</p><label className="field">剧本名称<input autoFocus value={newTitle} onChange={e=>setNewTitle(e.target.value)} placeholder="未命名剧本"/></label><div className="new-project-format"><FileText size={21}/><div><strong>A4 中文剧本</strong><span>自动场号 · A4 元素排版 · 本地自动保存</span></div><Check size={17}/></div><div className="modal-actions"><button className="secondary" onClick={()=>setModal('')}>取消</button><button className="primary" onClick={()=>create(newTitle)}>开始写作<ArrowUpRight size={15}/></button></div></Modal>}
  {modal==='document-font'&&doc&&<Modal title="文稿字体" onClose={()=>setModal('')}><DocumentFonts selected={selectedFont} defaultFont={script?.fontFamily||DEFAULT_FONT} disabled={readonly} selectionDisabled={!editorRef.current||editorRef.current.isDestroyed} onSelected={font=>{const editor=editorRef.current;if(editor&&!editor.isDestroyed){setTextFont(editor,font);setSelectedFont(font)}}} onDefault={font=>meta(doc).set('fontFamily',font)}/><div className="modal-actions"><button className="primary" onClick={()=>setModal('')}>完成</button></div></Modal>}
  {modal==='cover'&&doc&&<Modal title="剧本封面" onClose={()=>setModal('')}><p className="modal-intro">封面单独成页，不计入文稿页数。</p>{[['title','剧本名称'],['author','编剧署名'],['contact','联系信息 / 版本说明']].map(([k,label])=><label key={k} className="field">{label}<input value={meta(doc).get(k)||''} disabled={readonly} onChange={e=>meta(doc).set(k,e.target.value)}/></label>)}<div className="modal-actions"><button className="primary" onClick={()=>setModal('')}>完成</button></div></Modal>}
  {modal==='profile'&&<Modal title="你的写作身份" onClose={()=>setModal('')}><p className="modal-intro">设置你的显示名称和人物颜色。</p><label className="field">显示名称<input maxLength={24} value={user.name} onChange={e=>setUser({...user,name:e.target.value})}/></label><div className="color-choices" aria-label="人物颜色">{[['#2c6954','绿色'],['#b65c34','橙色'],['#396da8','蓝色'],['#7954a2','紫色'],['#a77a18','黄色'],['#b9477d','粉色']].map(([color,label])=><button key={color} aria-label={label} aria-pressed={user.color===color} style={{background:color}} onClick={()=>setUser({...user,color})}>{user.color===color&&<Check size={16}/>}</button>)}</div><div className="modal-actions"><button className="primary" onClick={()=>setModal('')}>完成</button></div></Modal>}
  {(modal==='settings'||modal==='assistant-settings')&&<Settings onGuide={()=>setModal('guide')} initialTab={modal==='assistant-settings'?'assistant':'layout'} projects={entries()} onSecurityChange={()=>setRevision(v=>v+1)} projectId={view==='library'?undefined:entry.id} projectTitle={script?.title} readonly={readonly} layout={view==='library'?preferences.defaultLayout:script?.layout||'hollywood'} hasDocument={!!doc&&view!=='library'} onLayout={changeLayout} value={preferences} onChange={setPreferences} onClose={()=>setModal('')}/>}
  {modal==='export'&&<Modal title="导出剧本" onClose={()=>setModal('')}><p className="modal-intro">.jhwrite 保留文稿格式、幕、场景、人物、隐藏场景、梗概和笔记，适合在装有剧好写的电脑间传输。文件不设密码，未加密。</p><div className="modal-actions"><button className="secondary" onClick={()=>{setModal('');void makePreview()}}>预览与导出 PDF / Word</button><button className="primary" onClick={()=>void saveDrg()}>保存剧本文件（.jhwrite）</button></div><p className="fine-print">编辑自动保存到本机剧本库；传输前请再次保存 .jhwrite 文件。文件不包含 iCloud 或 AI 接入授权，也不包含本机版本历史。</p></Modal>}
  {modal==='versions'&&doc&&<VersionsPanel key={entry.id} projectId={entry.id} onSave={name=>saveVersion(entry.id,name,doc)} onOpen={v=>create(`${v.script.title} · ${v.name}`,{...v.script,title:`${v.script.title} · ${v.name}`})} onClose={()=>setModal('')}/>}
  {modal==='trash'&&<Modal title="场景隐藏区" onClose={()=>setModal('')}><p className="modal-intro">隐藏的场景不出现在文稿、分场、复制和 PDF 中。显示后会回到原来的顺序。</p>{script?.scenes.filter(s=>s.deleted).map(s=><div className="version-row" key={s.id}><EyeOff size={18}/><div><strong>{sceneName(s)}</strong><span>{s.setting} · {s.location||'场景地点'} · {s.time}</span></div><button className="secondary small" disabled={readonly} onClick={()=>updateScene(doc!,s.id,{deleted:false})}><Eye size={13}/>显示</button></div>)}{!script?.scenes.some(s=>s.deleted)&&<p className="empty-state">还没有隐藏的场景。</p>}</Modal>}
  {modal==='characters'&&doc&&<StoryInfo doc={doc} readonly={readonly} onClose={()=>setModal('')}/>}
  {modal==='share'&&<Modal title="一起，把故事写下去" onClose={()=>setModal('')}><p className="modal-intro">邀请伙伴使用浏览器或 Mac 客户端共同写作。断网时可继续写，恢复连接后同步。</p>{!entry.remote?<><div className="info-box">当前剧本只保存在本机。连接协作服务后，才会上传这份剧本。</div><label className="field">协作服务地址<input value={serverUrl} onChange={e=>setServerUrl(e.target.value)} placeholder="https://你的协作服务域名"/></label><div className="two-fields"><label className="field">测试账号<input autoComplete="username" value={loginName} onChange={e=>setLoginName(e.target.value)}/></label><label className="field">密码<input type="password" autoComplete="current-password" value={loginPassword} onChange={e=>setLoginPassword(e.target.value)}/></label></div><div className="modal-actions"><button className="primary" disabled={shareBusy||!loginName||!loginPassword} onClick={()=>void publish()}>{shareBusy?'正在连接…':'开启共同写作'}</button></div></>:<><div className="connection-card"><span className="saved-dot"/><div><strong>{remoteStatus||'正在连接'}</strong><span>{entry.remote.url}</span></div><span className="role-badge">{entry.remote.role==='owner'?'创建者':entry.remote.role==='viewer'?'只读':'可编辑'}</span></div>{entry.remote.role==='owner'?<><div className="inline-form"><select aria-label="邀请权限" value={shareRole} onChange={e=>setShareRole(e.target.value)}><option value="editor">可以编辑</option><option value="viewer">仅可阅读</option></select><button className="primary" disabled={shareBusy} onClick={()=>void invite()}>生成邀请链接</button></div>{shareLink&&<div className="share-link"><input aria-label="邀请链接" readOnly value={shareLink}/><button className="icon-btn" title="复制邀请链接" onClick={()=>navigator.clipboard.writeText(shareLink).then(()=>notify('邀请链接已复制')).catch(()=>notify('请选中链接手动复制'))}><Copy size={16}/></button></div>}<p className="fine-print">持有链接的人可按指定权限加入；撤销后，已连接的会话也会断开。</p><div className="invite-list">{invites.map(inv=><div key={inv.id}><span>{inv.role==='viewer'?'只读邀请':'编辑邀请'} · {new Date(inv.createdAt).toLocaleDateString('zh-CN')}</span><button className="text-btn danger" disabled={inv.revoked} onClick={async()=>{try{await api(entry.remote!.url,`/api/rooms/${entry.remote!.room}/revoke`,{id:inv.id},entry.remote!.token);setInvites(invites.map(i=>i.id===inv.id?{...i,revoked:true}:i));notify('邀请已撤销')}catch(e){setShareError(String(e))}}}>{inv.revoked?'已撤销':'撤销'}</button></div>)}</div></>:<p className="fine-print">邀请与访问权限由这份剧本的创建者管理。</p>}</>}{shareError&&<p className="error-message" role="alert">{shareError}</p>}<button className="text-btn bottom-link" onClick={()=>{setModal('join');setShareError('')}}>已有邀请？粘贴链接加入<ArrowUpRight size={14}/></button></Modal>}
  {modal==='join'&&<Modal title="加入共同写作" onClose={()=>setModal('')}><p className="modal-intro">粘贴创建者发来的完整邀请链接。</p><label className="field">邀请链接<textarea value={joinLink} onChange={e=>setJoinLink(e.target.value)} placeholder="https://…/#join=…"/></label>{shareError&&<p className="error-message">{shareError}</p>}<div className="modal-actions"><button className="primary" disabled={!joinLink} onClick={join}>打开共享剧本</button></div></Modal>}
 </div>;
}
