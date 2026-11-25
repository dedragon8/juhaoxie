import {useState} from 'react';
import {Modal} from './Modal';
import {versions,renameVersion,deleteVersion,type Version} from '../core/storage';

export function VersionsPanel({projectId,onSave,onOpen,onClose}:{projectId:string;onSave:(name:string)=>void;onOpen:(v:Version)=>void;onClose:()=>void}){
 const [list,setList]=useState(()=>versions(projectId));
 const [name,setName]=useState(()=>`修改稿 ${new Date().toLocaleDateString('zh-CN')}`);
 const [action,setAction]=useState<{id:string;kind:'rename'|'delete'}>();
 const [draft,setDraft]=useState(''),[error,setError]=useState('');
 const change=(operation:()=>void)=>{
  try{operation();setList(versions(projectId));setAction(undefined);setError('')}
  catch(e){setError(e instanceof Error?e.message:'版本记录保存失败')}
 };
 return <Modal title="版本记录" onClose={onClose}>
  <p className="modal-intro">本机最多保留 20 个版本。打开副本可继续编辑。</p>
  <form className="inline-form" onSubmit={e=>{e.preventDefault();change(()=>onSave(name.trim()||'未命名版本'))}}>
   <input aria-label="版本名称" value={name} onChange={e=>setName(e.target.value)}/>
   <button className="primary">保存版本</button>
  </form>
  {error&&<p role="alert" className="error-message">{error}</p>}
  <div className="version-list">{!list.length&&<p className="empty-state">暂无版本记录</p>}
   {list.map(v=><div className="version-row" key={v.id}>
    {action?.id===v.id&&action.kind==='rename'?<form className="inline-form" onSubmit={e=>{e.preventDefault();if(draft.trim())change(()=>renameVersion(projectId,v.id,draft))}}>
     <input autoFocus aria-label="新版本名称" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setAction(undefined)}}}/>
     <button className="secondary small" disabled={!draft.trim()}>保存</button><button type="button" className="secondary small" onClick={()=>setAction(undefined)}>取消</button>
    </form>:action?.id===v.id&&action.kind==='delete'?<>
     <div>删除版本“{v.name}”？</div><button className="secondary small" autoFocus onClick={()=>setAction(undefined)}>取消</button>
     <button className="secondary small" onClick={()=>change(()=>deleteVersion(projectId,v.id))}>确认删除</button>
    </>:<>
     <div><strong>{v.name}</strong><span>{new Date(v.at).toLocaleString('zh-CN')}</span></div>
     <button className="secondary small" onClick={()=>onOpen(v)}>打开副本</button>
     <button className="secondary small" onClick={()=>{setDraft(v.name);setAction({id:v.id,kind:'rename'})}}>重命名</button>
     <button className="secondary small" onClick={()=>setAction({id:v.id,kind:'delete'})}>删除</button>
    </>}
   </div>)}
  </div>
 </Modal>;
}
