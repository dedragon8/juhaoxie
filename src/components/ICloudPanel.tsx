import {useSecurity,protectedProject,assertProjectAccess} from '../core/security';
import {useEffect,useState} from 'react';
import * as Y from 'yjs';
import {Cloud,Copy,RefreshCw,UserPlus} from 'lucide-react';
import {Modal} from './Modal';
import {getCloudBridge} from '../core/icloud-client';
import {meta,snapshot,newId,type ProjectEntry,type Script} from '../core/model';
import {toBase64,fromBase64,type CloudAccount,type CloudMember,type CloudProject,type CloudRecord,type CloudReference,type CloudBridge} from '../core/icloud-types';
import type {ICloudSync} from '../core/icloud-sync';

const unavailable:CloudAccount={status:'not-configured',message:'此版本尚未配置 iCloud。需要 Apple Developer 账号、容器和签名；本地写作不受影响。'};
export function ICloudPanel({entry,doc,sync,cloudVersions,onAttach,onOpen,onCopy,onClose,onRefresh,onLocalVersion}:{entry?:ProjectEntry;doc?:Y.Doc;sync?:ICloudSync;cloudVersions:CloudRecord[];onAttach:(ref:CloudReference)=>void;onOpen:(project:CloudProject)=>void;onCopy:(script:Script)=>void;onClose:()=>void;onRefresh:()=>void;onLocalVersion:(name:string)=>void}){
 const security=useSecurity(),secured=protectedProject(entry?.id,entry?.cloud);
 const [account,setAccount]=useState<CloudAccount>(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [members,setMembers]=useState<CloudMember[]>([]),[link,setLink]=useState(''),[email,setEmail]=useState(''),[permission,setPermission]=useState('editor'),[join,setJoin]=useState('');
 const [projects,setProjects]=useState<CloudProject[]>([]),[versionName,setVersionName]=useState(''),[remove,setRemove]=useState<CloudMember>();
 const call=async(method:string,args?:Record<string,unknown>)=>{if(entry)assertProjectAccess(entry.id,entry.cloud);if(!getCloudBridge())throw Error(unavailable.message);return getCloudBridge()!.request(method,args)};
 const task=async(fn:()=>Promise<void>)=>{setBusy(true);setError('');try{await fn()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
 const loadMembers=async()=>{if(!entry?.cloud)return;const result=await call('members',{ref:entry.cloud});setMembers(result.members);setLink(result.url)};
 const refresh=()=>task(async()=>{const value=getCloudBridge()?await call('account'):unavailable;setAccount(value);if(value.status==='available'){if(entry?.cloud&&entry.cloud.accountID!==value.accountID){setError('iCloud 账号已切换，请切回原账号；本地文稿可打开独立副本。');return;}setProjects(await call('projects'));await loadMembers();sync?.retry();onRefresh()}});
 useEffect(()=>{if(security.ready&&!secured)void refresh()},[entry?.id,entry?.cloud?.zone,security.ready,secured]);
 const ready=account?.status==='available'&&(!entry?.cloud||entry.cloud.accountID===account.accountID);
 const owner=entry?.cloud?.scope==='private';
 const publish=()=>task(async()=>{
  if(!doc||!entry)return;
  // Stable project ID makes retry after an uncertain response idempotent.
  const ref=await call('create',{projectId:entry.id,title:meta(doc).get('title')||entry.title,data:toBase64(Y.encodeStateAsUpdate(doc))});onAttach(ref);
 });
 const changeMember=(member:CloudMember,role:string)=>task(async()=>{const result=await call('permission',{ref:entry!.cloud,memberID:member.id,role});setMembers(result.members);setLink(result.url)});
 const copyVersion=(record:CloudRecord)=>{try{const script=JSON.parse(new TextDecoder().decode(fromBase64(record.data)));onCopy({...script,title:`${script.title} · ${record.name||'版本副本'}`})}catch{setError('此版本无法读取，请保留当前文稿并重试')}};
 if(secured||!security.ready)return <Modal title="iCloud 协作" onClose={onClose}><div className="info-box">{secured?'此剧本位于安全区，iCloud 同步、邀请、光标和云端版本均已停用。':'正在核对安全区设置…'}</div><p className="settings-note">仍可在本机编辑和保存。请在设置 → 安全区管理保护状态。此前上传的云端内容及协作者已有副本不会自动删除。</p></Modal>;
 return <Modal title="iCloud 协作" onClose={onClose}>
  <div className="cloud-account"><Cloud size={22}/><div><strong>{!account?'正在检查 iCloud':account.status==='available'?'已连接系统 iCloud 账号':account.status==='not-configured'?'待配置 iCloud':'iCloud 暂不可用'}</strong><p>{account?.message||(account?.status==='available'?'使用系统 Apple 账号，无需向剧好写提供密码。':'正在读取账号状态…')}</p></div><button className="icon-btn" aria-label="刷新 iCloud 状态" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={16}/></button></div>
  {account?.status==='not-configured'&&<div className="info-box">需要开发者完成 CloudKit 容器、签名和双账号验收后才能使用真实共享。此界面不会上传文稿，也不会创建模拟邀请。</div>}
  {getCloudBridge()&&<button className="text-btn" onClick={()=>void getCloudBridge()!.openSettings()}>打开系统 Apple 账号设置</button>}
  {error&&<p className="error-message" role="alert">{error}</p>}
  {doc&&entry&&!entry.cloud&&<section className="cloud-section"><h3>共享当前剧本</h3><p>仅上传这份剧本，包括场景笔记与隐藏场景。共享数据占用所有者的 iCloud 空间；本地仍保留副本。</p><button className="primary" disabled={busy||!ready} onClick={()=>void publish()}>启用此剧本的 iCloud 协作</button></section>}
  {entry?.cloud&&<section className="cloud-section"><h3>协作成员</h3><p>光标与修改按 iCloud 同步节奏更新，可能有延迟。只读成员可阅读文稿，不发布光标。</p>
   {members.map(member=><div className="cloud-member" key={member.id}><span>{member.name}<small>{member.accepted?'已加入':'待接受邀请'}</small></span>{member.role==='owner'?<span className="muted">所有者</span>:owner?<><select aria-label={`成员 ${member.name} 权限`} disabled={busy||!ready} value={member.role} onChange={e=>void changeMember(member,e.target.value)}><option value="editor">可以编辑</option><option value="viewer">仅可阅读</option></select><button className="text-btn danger" disabled={busy||!ready} onClick={()=>setRemove(member)}>移除</button></>:<span>{member.role==='editor'?'可编辑':'只读'}</span>}</div>)}
   {owner&&<><label className="field">受邀人的 Apple 账号邮箱<input type="email" autoComplete="off" value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com"/></label><div className="inline-form"><select aria-label="iCloud 邀请权限" value={permission} onChange={e=>setPermission(e.target.value)}><option value="editor">可以编辑</option><option value="viewer">仅可阅读</option></select><button className="primary" disabled={busy||!ready||!email.includes('@')} onClick={()=>void task(async()=>{const result=await call('invite',{ref:entry.cloud,email:email.trim(),role:permission});setMembers(result.members);setLink(result.url);setEmail('')})}><UserPlus size={15}/>创建邀请</button></div>{link&&<div className="share-link"><input aria-label="已生成的 iCloud 邀请链接" value={link} readOnly/><button className="icon-btn" aria-label="复制 iCloud 邀请链接" onClick={()=>void task(async()=>navigator.clipboard.writeText(link))}><Copy size={16}/></button></div>}<p className="fine-print">仅指定账号可接受邀请。复制链接后自行发送给对方。</p></>}
   {remove&&<div className="info-box" role="alertdialog" aria-label="确认移除协作者"><p>移除“{remove.name}”的云端访问权限？已下载到对方设备的副本无法远程删除。</p><div className="modal-actions"><button className="secondary" onClick={()=>setRemove(undefined)}>取消</button><button className="primary" disabled={busy} onClick={()=>void task(async()=>{const result=await call('revoke',{ref:entry.cloud,memberID:remove.id});setMembers(result.members);setRemove(undefined)})}>确认移除</button></div></div>}
  </section>}
  {doc&&entry?.cloud&&<section className="cloud-section"><h3>版本副本</h3><p>打开版本会创建独立的本地剧本，不覆盖共享文稿，也不撤销其他人的修改。</p><div className="inline-form"><input aria-label="iCloud 版本名称" value={versionName} onChange={e=>setVersionName(e.target.value)} placeholder="例如：第二稿"/><button className="secondary" disabled={busy||!ready||entry.cloud.role==='viewer'} onClick={()=>void task(async()=>{const name=versionName.trim()||'版本副本';onLocalVersion(name);await sync?.syncOnce();const script=snapshot(doc);await call('version',{ref:entry.cloud,id:newId(),name,data:toBase64(new TextEncoder().encode(JSON.stringify(script)))});await sync?.syncOnce();setVersionName('')})}>保存云端版本</button></div>{cloudVersions.map(v=><div className="version-row" key={v.id}><div><strong>{v.name||'版本副本'}</strong><span>{new Date(v.at).toLocaleString('zh-CN')}</span></div><button className="secondary small" onClick={()=>copyVersion(v)}>打开副本</button></div>)}<button className="text-btn" onClick={()=>onCopy({...snapshot(doc),title:`${meta(doc).get('title')} · 本地副本`})}>将当前文稿另存为独立本地副本</button></section>}
  <section className="cloud-section"><h3>接受邀请</h3><label className="field">iCloud 邀请链接<input value={join} onChange={e=>setJoin(e.target.value)} placeholder="https://www.icloud.com/share/…"/></label><button className="secondary" disabled={busy||!ready||!join.trim()} onClick={()=>void task(async()=>onOpen(await call('accept',{url:join.trim()})))}>接受并打开剧本</button></section>
  {projects.length>0&&<section className="cloud-section"><h3>iCloud 剧本库</h3>{projects.map(p=><button className="cloud-project" key={`${p.ref.scope}:${p.ref.owner}:${p.ref.zone}`} onClick={()=>onOpen(p)}><span>{p.title}</span><small>{p.ref.role==='owner'?'我的剧本':p.ref.role==='editor'?'共享 · 可编辑':'共享 · 只读'}</small></button>)}</section>}
  {busy&&<p className="fine-print" role="status">正在与 iCloud 通信…</p>}
 </Modal>
}
