import {useEffect,useRef,useState} from 'react';
import * as Y from 'yjs';
import {snapshot} from '../core/model';
import {SCENE_CLIPBOARD} from '../core/clipboard';
import {documentClipboard} from '../core/document-copy';
export function useDocumentSelection(doc:Y.Doc|undefined,enabled:boolean){
 const [selected,setSelected]=useState(false),selectedRef=useRef(false);
 const clear=()=>{selectedRef.current=false;setSelected(false)};
 const select=()=>{const manuscript=document.querySelector('.manuscript');if(!enabled||!manuscript)return false;(document.activeElement as HTMLElement)?.blur?.();const range=document.createRange();range.selectNodeContents(manuscript);const selection=window.getSelection();selection?.removeAllRanges();selection?.addRange(range);selectedRef.current=true;setSelected(true);return true;};
 useEffect(()=>{if(!enabled)clear()},[enabled,doc]);
 useEffect(()=>{const copy=(e:ClipboardEvent)=>{if(!selectedRef.current||!doc||!e.clipboardData)return;const content=documentClipboard(snapshot(doc));e.preventDefault();e.stopPropagation();e.clipboardData.setData('text/plain',content.text);e.clipboardData.setData('text/html',content.html);e.clipboardData.setData(SCENE_CLIPBOARD,content.internal)};
 const key=(e:KeyboardEvent)=>{if(!selectedRef.current)return;if(e.key==='Escape'){window.getSelection()?.removeAllRanges();clear()}else if(!e.metaKey&&!e.ctrlKey&&!['Meta','Control','Shift','Alt'].includes(e.key))clear()};
 document.addEventListener('copy',copy,true);document.addEventListener('pointerdown',clear,true);window.addEventListener('keydown',key,true);return()=>{document.removeEventListener('copy',copy,true);document.removeEventListener('pointerdown',clear,true);window.removeEventListener('keydown',key,true)};
 },[doc]);
 return {selected,select};
}
