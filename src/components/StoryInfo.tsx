import {useState} from 'react';
import type * as Y from 'yjs';
import {Plus} from 'lucide-react';
import {Modal} from './Modal';
import {characterNames,meta,renameCharacter,snapshot,LOCAL} from '../core/model';
export function StoryInfo({doc,readonly,onClose}:{doc:Y.Doc;readonly:boolean;onClose:()=>void}){
 const script=snapshot(doc),names=characterNames(doc);
 const [selected,setSelected]=useState(names[0]||''),[newName,setNewName]=useState(names[0]||''),[adding,setAdding]=useState(false),[replaceBody,setReplaceBody]=useState(false),[error,setError]=useState('');
 const descriptions=doc.getMap<string>('characterDescriptions');
 const choose=(name:string)=>{setSelected(name);setNewName(name);setAdding(false);setError('')};
 const saveName=()=>{const name=newName.trim();if(!name)return;if(names.includes(name)&&name!==selected){setError('已有同名人物，请使用不同的名字。');return}if(adding){doc.transact(()=>descriptions.set(name,''),LOCAL)}else renameCharacter(doc,selected,name,replaceBody);choose(name)};
 return <Modal title="剧本资料" wide onClose={onClose}>
  <label className="checkbox-field"><input type="checkbox" checked={!!script.includeStoryInfo} disabled={readonly} onChange={e=>meta(doc).set('includeStoryInfo',String(e.target.checked))}/>在封面与文稿之间加入人物设定、故事梗概</label>
  <p className="settings-note">关闭后仍会保留资料。开启后显示在预览与 PDF 中，内容较长会自动续页，不计入文稿页码。</p>
  <div className="story-info-layout"><nav className="story-character-nav" aria-label="人物设定">{names.map(name=><button key={name} className={selected===name&&!adding?'selected':''} onClick={()=>choose(name)}>{name}</button>)}<button disabled={readonly} onClick={()=>{setAdding(true);setSelected('');setNewName('');setError('')}}><Plus size={14}/>添加人物</button></nav>
  <div className="story-info-fields"><h3>人物设定</h3>{selected||adding?<><label className="field">人物名<input maxLength={200} value={newName} disabled={readonly} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();saveName()}}}/></label>{!adding&&<label className="checkbox-field"><input type="checkbox" checked={replaceBody} disabled={readonly} onChange={e=>setReplaceBody(e.target.checked)}/>同时替换描述/动作与对白中的同名文字</label>}<p className="settings-note">改名会同步更新文稿中的人物段，包括隐藏场景。</p>{error&&<p role="alert">{error}</p>}<button className="secondary" disabled={readonly||!newName.trim()||(!adding&&newName.trim()===selected)} onClick={saveName}>{adding?'添加人物':'更新人物名称'}</button>{!adding&&<label className="field">人物介绍<textarea aria-label={`${selected}的人物介绍`} maxLength={100000} value={descriptions.get(selected)||''} readOnly={readonly} placeholder="性格、背景、人物关系……" onChange={e=>doc.transact(()=>descriptions.set(selected,e.target.value),LOCAL)}/></label>}</>:<p className="muted">可以先添加人物，也会自动收录文稿中的人物。</p>}</div></div>
  <div className="story-info-synopsis"><label className="field">故事梗概<textarea maxLength={200000} value={script.storySynopsis||''} readOnly={readonly} placeholder="写下整个故事的梗概……" onChange={e=>meta(doc).set('storySynopsis',e.target.value)}/></label></div>
  <div className="modal-actions"><button className="primary" onClick={onClose}>完成</button></div>
 </Modal>;
}
