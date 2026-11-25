import {useLayoutEffect,useRef,useState} from 'react';
import {Modal} from './Modal';
import type {SceneAction} from './SceneMenu';
export function SceneActionDialog({action,name,onConfirm,onClose}:{action:SceneAction;name:string;onConfirm:(name?:string)=>void;onClose:()=>void}){
 const [value,setValue]=useState(name);const input=useRef<HTMLInputElement>(null),confirm=useRef<HTMLButtonElement>(null);
 useLayoutEffect(()=>{if(action==='rename'){input.current?.focus({preventScroll:true});input.current?.select()}else confirm.current?.focus()},[action]);
 const title=action==='rename'?'重命名场景':action==='hide'?'隐藏场景？':'删除场景？';
 return <Modal title={title} onClose={onClose}>
  {action==='rename'?<label className="field">场景名称<input className="scene-rename-input" ref={input} value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&e.nativeEvent.keyCode!==229&&value.trim()){e.preventDefault();onConfirm(value.trim())}}}/></label>:<><p className="scene-confirm-name">{name}</p><p className="modal-intro">{action==='hide'?'隐藏后，这一场将不出现在文稿、分场和 PDF 中。内容会保留，可在“场景隐藏区”点击“显示”重新放回。':'将删除这一场的文稿、梗概和笔记。此操作无法撤销。'}</p></>}
  <div className="modal-actions"><button className="secondary" onClick={onClose}>取消</button><button ref={confirm} className={action==='delete'?'primary destructive':'primary'} disabled={action==='rename'&&!value.trim()} onClick={()=>onConfirm(action==='rename'?value.trim():undefined)}>{action==='rename'?'保存名称':action==='hide'?'隐藏场景':'删除场景'}</button></div>
 </Modal>;
}
