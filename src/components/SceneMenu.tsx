import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Pencil,EyeOff,Trash2} from 'lucide-react';
export type SceneAction='rename'|'hide'|'delete';
export function SceneMenu({left,top,onChoose,onClose}:{left:number;top:number;onChoose:(action:SceneAction)=>void;onClose:()=>void}){
 const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.querySelector('button')?.focus();const dismiss=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))onClose()};document.addEventListener('pointerdown',dismiss);return()=>{document.removeEventListener('pointerdown',dismiss);if(previous?.isConnected)previous.focus({preventScroll:true})}},[]);
 return createPortal(<div className="popover scene-context-menu" role="menu" aria-label="场景操作" ref={ref} style={{left:Math.max(8,Math.min(left,window.innerWidth-188)),top:Math.max(8,Math.min(top,window.innerHeight-148))}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose()}if(e.key==='Tab'){onClose()}if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const buttons=[...e.currentTarget.querySelectorAll('button')],index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}}}>
  <button role="menuitem" onClick={()=>onChoose('rename')}><Pencil size={14}/>重命名</button>
  <button role="menuitem" onClick={()=>onChoose('hide')}><EyeOff size={14}/>隐藏</button>
  <hr/><button role="menuitem" className="delete-scene-menu" onClick={()=>onChoose('delete')}><Trash2 size={14}/>删除</button>
 </div>,document.body);
}
