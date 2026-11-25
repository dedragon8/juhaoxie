import {useState} from 'react';
import {Plus,Pencil,Trash2,GripVertical,ArrowRightToLine,EyeOff} from 'lucide-react';
import {Modal} from './Modal';
import {ActFolders} from './ActFolders';
import type {Act,Scene} from '../core/model';
export function ActsPanel({acts,scenes,readonly,onAdd,onRename,onRemove,onAssign,onClose}:{acts:Act[];scenes:Scene[];readonly:boolean;onAdd:(name:string)=>void;onRename:(id:string,name:string)=>void;onRemove:(id:string)=>void;onAssign:(id:string,act:string,before?:string)=>void;onClose:()=>void}){
 const [name,setName]=useState(''),[removing,setRemoving]=useState<string>(),[editing,setEditing]=useState<string>(),[draft,setDraft]=useState(''),[picked,setPicked]=useState('');
 const visible=scenes.filter(s=>!s.deleted);
 const defaultName=(()=>{let n=1;const numerals=['一','二','三','四','五','六','七','八','九','十'];while(acts.some(a=>a.name===`第${numerals[n-1]||n}幕`))n++;return `第${numerals[n-1]||n}幕`})();
 const add=()=>{onAdd(name.trim()||defaultName);setName('')};
 const rename=()=>{if(editing&&draft.trim())onRename(editing,draft.trim());setEditing(undefined)};
 return <Modal title="幕管理" wide onClose={onClose}><p className="settings-note act-manager-intro">拖动场景到目标幕的目录下，即可分配。点击幕前的箭头展开或收起。</p>
 <div className="act-create"><input aria-label="新幕名称" placeholder={defaultName} value={name} disabled={readonly} onChange={e=>setName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing&&!readonly)add()}}/><button className="secondary" disabled={readonly} onClick={add}><Plus size={14}/>添加幕</button></div>
 <div className="act-manager-tree"><ActFolders acts={acts} scenes={scenes} readonly={readonly} onAssign={onAssign} renderActions={group=><div className="act-folder-actions">
 {picked&&<button className="act-move-here" disabled={readonly} aria-label={`移入${group.name}`} onClick={()=>{onAssign(picked,group.id);setPicked('')}}><ArrowRightToLine size={13}/>移入</button>}
 {group.id&&editing===group.id?<form onSubmit={e=>{e.preventDefault();rename()}}><input autoFocus aria-label="幕名称" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setEditing(undefined)}if(e.key==='Enter'&&e.nativeEvent.isComposing)e.preventDefault()}}/><button type="submit" disabled={!draft.trim()}>保存</button><button type="button" onClick={()=>setEditing(undefined)}>取消</button></form>:group.id&&<><button className="icon-btn" disabled={readonly} aria-label={`重命名${group.name}`} onClick={()=>{setEditing(group.id);setDraft(group.name);setRemoving(undefined)}}><Pencil size={13}/></button><button className="icon-btn" disabled={readonly} aria-label={`删除${group.name}`} onClick={()=>{setRemoving(group.id);setEditing(undefined)}}><Trash2 size={13}/></button></>}
 {removing===group.id&&<div className="act-delete-confirm" role="alertdialog" aria-label="删除幕确认"><span>删除此幕？场景将保留在“未分幕”。</span><button onClick={()=>setRemoving(undefined)}>取消</button><button data-modal-confirm disabled={readonly} onClick={()=>{onRemove(group.id);setRemoving(undefined)}}>确认删除幕</button></div>}
 </div>} renderScene={s=><button className={`act-manager-scene ${picked===s.id?'picked':''}`} aria-label={`选择${s.deleted?'隐藏场景':'第 '+(visible.indexOf(s)+1)+' 场'}：${s.name||'场景'}`} aria-pressed={picked===s.id} disabled={readonly} onClick={()=>setPicked(picked===s.id?'':s.id)}><GripVertical size={14}/><span className="act-scene-number">{s.deleted?'—':String(visible.indexOf(s)+1).padStart(2,'0')}</span><span className="act-scene-copy"><strong>{s.name||'场景'}</strong><small>{s.setting} · {s.location||'场景地点'} · {s.time}</small></span>{s.deleted&&<span className="act-hidden-label"><EyeOff size={12}/>已隐藏</span>}</button>}/></div>
 <p className="settings-note act-manager-footnote">也可选中场景，再点击目标幕的“移入”。场号随文稿顺序更新。</p>
 </Modal>;
}
