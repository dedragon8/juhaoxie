import {useEffect,useRef,useState,type ReactNode} from 'react';
import {ChevronRight,Folder,FolderOpen} from 'lucide-react';
import type {Act,Scene} from '../core/model';
type Group={id:string;name:string;scenes:Scene[]};
export function ActFolders({acts,scenes,readonly,onAssign,renderScene,renderActions,storageKey,searching=false,activeScene}:{acts:Act[];scenes:Scene[];readonly:boolean;onAssign:(id:string,act:string,before?:string)=>void;renderScene:(scene:Scene)=>ReactNode;renderActions?:(group:Group)=>ReactNode;storageKey?:string;searching?:boolean;activeScene?:string}){
 const [collapsed,setCollapsed]=useState<Record<string,boolean>>(()=>{try{return storageKey?JSON.parse(localStorage.getItem(storageKey)||'{}'): {}}catch{return {}}});
 const [target,setTarget]=useState<string|null>(null),[dragged,setDragged]=useState(''),[announcement,setAnnouncement]=useState('');
 const dragging=useRef(''),expandTimer=useRef<ReturnType<typeof setTimeout>>(undefined);
 const clearTimer=()=>{clearTimeout(expandTimer.current);expandTimer.current=undefined};
 const finish=()=>{clearTimer();dragging.current='';setDragged('');setTarget(null)};
 useEffect(()=>{if(storageKey)try{localStorage.setItem(storageKey,JSON.stringify(collapsed))}catch{}},[collapsed,storageKey]);
 useEffect(()=>()=>clearTimer(),[]);
 const lastActive=useRef<{scene:string;group:string}>(undefined);
 const activeGroup=scenes.find(s=>s.id===activeScene)?.actId||'';
 useEffect(()=>{if(!activeScene||!scenes.some(s=>s.id===activeScene))return;if(lastActive.current&&(lastActive.current.scene!==activeScene||lastActive.current.group!==activeGroup))setCollapsed(old=>old[activeGroup]?{...old,[activeGroup]:false}:old);lastActive.current={scene:activeScene,group:activeGroup}},[activeScene,activeGroup,scenes]);
 const tree=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const row=activeScene&&tree.current?.querySelector<HTMLElement>(`[data-folder-scene="${CSS.escape(activeScene)}"]`);
  const pane=tree.current?.closest<HTMLElement>('.scene-list');
  if(!row||!pane)return;
  const r=row.getBoundingClientRect(),bounds=pane.getBoundingClientRect();
  if(r.top<bounds.top)pane.scrollTop+=r.top-bounds.top;
  else if(r.bottom>bounds.bottom)pane.scrollTop+=r.bottom-bounds.bottom;
 },[activeScene,collapsed]);
 const groups:Group[]=[...acts.map(a=>({...a,scenes:scenes.filter(s=>s.actId===a.id)})),{id:'',name:'未分幕',scenes:scenes.filter(s=>!s.actId||!acts.some(a=>a.id===s.actId))}];
 return <div ref={tree} className={`act-folders ${dragged?'dragging-scene':''}`} onKeyDown={e=>{if(e.key==='Escape')finish()}}>
 {groups.filter(g=>!searching||g.scenes.length>0).map(group=>{const open=searching||!collapsed[group.id],isTarget=target===group.id;return <section key={group.id} className={`act-folder ${isTarget?'drop-target':''}`} data-act-folder={group.id||'unassigned'} aria-label={`${group.name}目录`}
 onDragOver={e=>{if(readonly||!dragging.current)return;e.preventDefault();e.dataTransfer.dropEffect='move';if(target!==group.id){clearTimer();setTarget(group.id);expandTimer.current=setTimeout(()=>setCollapsed(old=>({...old,[group.id]:false})),450)}}}
 onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node)){clearTimer();setTarget(null)}}}
 onDrop={e=>{if(readonly||!dragging.current)return;e.preventDefault();e.stopPropagation();const scene=scenes.find(s=>s.id===dragging.current);if(scene){try{onAssign(scene.id,group.id);setCollapsed(old=>({...old,[group.id]:false}));setAnnouncement(`已将${scene.name||'场景'}移入${group.name}`)}catch(error){setAnnouncement(String(error))}}finish()}}>
 <div className="act-folder-heading"><button className="act-folder-toggle" aria-label={group.name} aria-expanded={open} onClick={()=>setCollapsed(old=>({...old,[group.id]:open}))}><ChevronRight className={open?'expanded':''} size={13}/>{open?<FolderOpen size={15}/>:<Folder size={15}/>}<span>{group.name}</span><small aria-hidden="true">{group.scenes.length}</small></button>{renderActions?.(group)}</div>
 <div className={`act-folder-disclosure ${open?'open':''}`} inert={!open} aria-hidden={!open}><div className="act-folder-clip"><div className="act-folder-scenes">{group.scenes.map((scene,index)=><div className={`act-scene ${dragged===scene.id?'is-dragged':''}`} data-folder-scene={scene.id} key={scene.id} draggable={!readonly} onDragStart={e=>{if(readonly){e.preventDefault();return}dragging.current=scene.id;setDragged(scene.id);e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-juhaoxie-scene',scene.id)}} onDrop={e=>{
  if(readonly||!dragging.current)return;
  e.preventDefault();e.stopPropagation();
  const bounds=e.currentTarget.getBoundingClientRect();
  const before=e.clientY<bounds.top+bounds.height/2?scene.id:group.scenes[index+1]?.id;
  if(dragging.current!==scene.id)onAssign(dragging.current,group.id,before);
  finish();
 }} onDragEnd={finish}>{renderScene(scene)}</div>)}{!group.scenes.length&&<p className="act-folder-empty">{readonly?'暂无场景':'拖动场景到这里'}</p>}</div></div></div>
 {isTarget&&<div className="act-drop-hint" role="status">松开，移入{group.name}</div>}
 </section>})}
 {searching&&!scenes.length&&<p className="empty-search">没有匹配的场景</p>}
 <span className="sr-only" aria-live="polite">{announcement}</span>
 </div>;
}
