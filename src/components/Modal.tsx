import {useEffect,useRef,useState,type ReactNode} from 'react';
import {X} from 'lucide-react';
export function Modal({title,children,onClose,wide=false,canClose=true}:{canClose?:boolean;title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
 const ref=useRef<HTMLDivElement>(null),closeRef=useRef(onClose),timer=useRef<ReturnType<typeof setTimeout>>(undefined),isClosing=useRef(false),canCloseRef=useRef(canClose);closeRef.current=onClose;canCloseRef.current=canClose;
 const [closing,setClosing]=useState(false);
 const close=()=>{if(isClosing.current||!canCloseRef.current)return;isClosing.current=true;if(document.documentElement.dataset.reduceMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches){closeRef.current();return}setClosing(true);timer.current=setTimeout(()=>closeRef.current(),150)};
 useEffect(()=>{
  const prev=document.activeElement as HTMLElement,backdrop=ref.current?.parentElement;
  const siblings=Array.from(backdrop?.parentElement?.children||[]).filter(el=>el!==backdrop).map(el=>({el,wasInert:el.hasAttribute('inert')}));siblings.forEach(({el})=>el.setAttribute('inert',''));
  if(!ref.current?.contains(document.activeElement))ref.current?.focus();
  const handler=(e:KeyboardEvent)=>{if(e.isComposing||e.keyCode===229||e.defaultPrevented||isClosing.current)return;
   const dialogs=Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]')).filter(el=>el.getClientRects().length&&!el.closest('[inert]'));
   const top=dialogs.at(-1);if(!top||!ref.current?.contains(top))return;
   if(e.key==='Enter'&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
    const target=e.target as HTMLElement;
    if(e.repeat){e.preventDefault();return}
    if(!top.contains(target)||!target.closest('textarea,select,[contenteditable="true"],button,form')){
     const actions=Array.from(top.querySelectorAll<HTMLButtonElement>('[data-modal-confirm],.modal-actions button.primary')).filter(el=>!el.disabled&&el.getClientRects().length&&!el.closest('[inert]'));
     if(actions.length===1){e.preventDefault();actions[0].click();return}
    }
   }
if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){
   const items=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]')||[]).filter(el=>el.getClientRects().length&&!el.closest('[inert]'));
   if(!items.length){e.preventDefault();return}const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||document.activeElement===ref.current)){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===ref.current)){e.preventDefault();first.focus()}
  }};
  document.addEventListener('keydown',handler);return()=>{clearTimeout(timer.current);document.removeEventListener('keydown',handler);siblings.forEach(({el,wasInert})=>{if(!wasInert)el.removeAttribute('inert')});if(prev?.isConnected)prev.focus()};
 },[]);
 return <div className={`modal-backdrop ${closing?'is-closing':''}`} onMouseDown={e=>{if(e.target===e.currentTarget)close()}}><div className={`modal ${wide?'wide':''}`} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}><div className="modal-heading"><h2>{title}</h2><button className="icon-btn" aria-label="关闭" disabled={!canClose} onClick={close}><X size={19}/></button></div>{children}</div></div>;
}
