import {useState} from 'react';
import {ShieldCheck,LockKeyhole} from 'lucide-react';
import type {ProjectEntry} from '../core/model';
import {protectedProject,setProjectProtection,useSecurity} from '../core/security';
export function SecuritySettings({projects,onChange}:{projects:ProjectEntry[];onChange:()=>void}){
 const security=useSecurity(),[busy,setBusy]=useState(''),[error,setError]=useState(''),[release,setRelease]=useState<ProjectEntry>();
 const change=async(entry:ProjectEntry,enabled:boolean)=>{setBusy(entry.id);setError('');try{await setProjectProtection(entry,enabled);onChange();setRelease(undefined)}catch(e){setError(String(e))}finally{setBusy('')}};
 return <section className="security-settings"><div className="security-intro"><ShieldCheck size={27}/><div><h3>安全区</h3><p>禁止 Agent 和协作访问所选剧本。</p></div></div><p className="settings-note">本地写作与导出不受影响。iCloud 协作已全局关闭。</p>
 {(error||security.error)&&<p className="error-message" role="alert">{error||security.error}</p>}
 <div className="security-projects">{projects.map(entry=>{const secured=protectedProject(entry.id,entry.cloud);return <div className="security-project" key={entry.id}><LockKeyhole size={16}/><div><strong>{entry.title}</strong><small>{secured?'已保护 · 禁止接入':'未加入安全区'}{entry.cloud||entry.remote?' · 曾关联协作':''}</small></div><button className="secondary small" disabled={!!busy||!security.ready||security.locked} aria-label={`${secured?'移出安全区':'加入安全区'}：${entry.title}`} onClick={()=>secured?setRelease(entry):void change(entry,true)}>{busy===entry.id?'正在保存…':secured?'移出':'加入安全区'}</button></div>})}{!projects.length&&<p className="settings-note">暂无剧本。</p>}</div>
 {release&&<div className="security-release" role="alertdialog" aria-label="移出安全区确认"><strong>将“{release.title}”移出安全区？</strong><p>若已开启全局接入，移出后 Agent 即可访问这份剧本。</p><div className="modal-actions"><button className="secondary" disabled={!!busy} onClick={()=>setRelease(undefined)}>取消</button><button className="primary" disabled={!!busy} onClick={()=>void change(release,false)}>确认移出</button></div></div>}
 <p className="settings-note security-boundary">安全区不加密文件，也不收回已发送内容。手动复制、导出及其他软件访问不受此限制。</p></section>;
}
