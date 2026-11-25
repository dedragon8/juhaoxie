import {useLayoutEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {FolderOpen,Trash2} from 'lucide-react';
export function LibraryMenu({left,top,onReveal,onDelete,onClose,canReveal}:{left:number;top:number;onReveal:()=>void;onDelete:()=>void;onClose:()=>void;canReveal:boolean}){
 const ref=useRef<HTMLDivElement>(null),close=useRef(onClose);close.current=onClose;
 useLayoutEffect(()=>{
  const menu=ref.current!,previous=document.activeElement as HTMLElement;
  const rect=menu.getBoundingClientRect();menu.style.left=`${Math.max(8,Math.min(left,innerWidth-rect.width-8))}px`;menu.style.top=`${Math.max(8,Math.min(top,innerHeight-rect.height-8))}px`;
  menu.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  const dismiss=(e:PointerEvent)=>{if(!menu.contains(e.target as Node))close.current()};
  const moved=()=>close.current();document.addEventListener('pointerdown',dismiss);window.addEventListener('resize',moved);window.addEventListener('scroll',moved,true);
  return()=>{document.removeEventListener('pointerdown',dismiss);window.removeEventListener('resize',moved);window.removeEventListener('scroll',moved,true);if(previous?.isConnected)previous.focus({preventScroll:true})};
 },[left,top]);
 return createPortal(<div ref={ref} className="popover scene-context-menu library-context-menu" role="menu" aria-label="剧本操作" style={{left,top}} onContextMenu={e=>e.preventDefault()} onKeyDown={e=>{
  if(e.key==='Escape'||e.key==='Tab'){e.preventDefault();e.stopPropagation();onClose()}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')],i=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}
 }}><button role="menuitem" disabled={!canReveal} title={canReveal?'生成最新 .jhwrite 副本并在 Finder 中显示':'请在 Mac 客户端使用'} onClick={onReveal}><FolderOpen size={14}/>显示在电脑的文件位置</button><hr/><button role="menuitem" onClick={onDelete}><Trash2 size={14}/>删除</button></div>,document.body);
}
