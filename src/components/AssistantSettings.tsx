import {claudeConnectionConfig,claudeSetupInstruction,codexConnectionConfig,codexSetupInstruction} from '../core/agent-setup';
import {useSecurity,protectedProject} from '../core/security';
import {useEffect,useState} from 'react';
import type {AssistantState} from '../core/assistant';
export function AssistantSettings({projectId,projectProtected=false}:{projectProtected?:boolean;projectId?:string}){
 const security=useSecurity(),secured=projectProtected||protectedProject(projectId);
 const [state,setState]=useState<AssistantState>(),[error,setError]=useState(''),[copied,setCopied]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!window.assistantBridge)return;let live=true;const refresh=()=>window.assistantBridge!.status().then(s=>{if(live)setState(s)}).catch(e=>{if(live)setError(String(e))});void refresh();const timer=setInterval(refresh,1500);return()=>{live=false;clearInterval(timer)}},[]);
 const configure=async(enabled:boolean,allowWrite=false)=>{setBusy(true);setError('');try{setState(await window.assistantBridge!.configure({enabled,projectId:secured?'':projectId,allowWrite}))}catch(e){setError(String(e))}finally{setBusy(false)}};
 const enabled=!!state?.appEnabled;
 const config=state?.config;
 const [manualText,setManualText]=useState('');
 const [manualClient,setManualClient]=useState<'codex'|'claude'>('codex');
 const manualConfig=config?(manualClient==='codex'?codexConnectionConfig(config):claudeConnectionConfig(config)):'';
 const copySetup=async(target:'codex'|'claude')=>{
  if(!enabled||!config)return;
  const instruction=target==='codex'?codexSetupInstruction(config):claudeSetupInstruction(config);
  try{await navigator.clipboard.writeText(instruction);setManualText('');setCopied(`已复制，可粘贴给 ${target==='codex'?'Codex':'Claude Desktop'}`)}
  catch{setManualText(instruction);setCopied('请选中下方指令并复制')}
 };
 const copyFeedback=<>{copied&&<p className="settings-note" role="status">{copied}</p>}{manualText&&<textarea className="assistant-config" aria-label="接入指令" readOnly value={manualText} onFocus={e=>e.currentTarget.select()}/>}</>;

 const unavailable=security.locked||!security.ready||busy||!state||!window.assistantBridge;
 return <div className="assistant-settings">
  <label className="agent-access-toggle">
   <span>接入Agent</span>
   <input type="checkbox" role="switch" checked={enabled} disabled={unavailable}
    onChange={e=>void configure(e.target.checked)}/>
  </label>
  {enabled&&<div className="agent-copy-actions">
   <button className="secondary" disabled={!config||busy} onClick={()=>void copySetup('codex')}>复制给 Codex</button>
   <button className="secondary" disabled={!config||busy} onClick={()=>void copySetup('claude')}>复制给 Claude</button>
  </div>}
  {enabled&&copyFeedback}
  <details className="agent-manual-setup"><summary>Agent 接入教程</summary>
   <ol className="assistant-steps">
    <li>打开「接入Agent」，再打开一本普通剧本。安全区剧本始终排除。</li>
    <li>点击「复制给 Codex」或「复制给 Claude」，将整段指令粘贴到对应客户端。首次配置后，按客户端提示重新打开会话。</li>
    <li>让 Agent 读取当前剧本标题，核对返回的名称。</li>
   </ol>
   {enabled&&<label className="agent-permission">接入权限
    <select aria-label="接入权限" disabled={unavailable} value={state?.appWrite?'edit':'read'} onChange={e=>void configure(true,e.target.value==='edit')}>
     <option value="read">只读</option><option value="edit">可编辑</option>
    </select>
   </label>}
   {config&&<details className="agent-manual-setup"><summary>手动配置</summary>
    <div className="settings-tabs">{(['codex','claude'] as const).map(k=><button key={k} className={manualClient===k?'selected':''} aria-pressed={manualClient===k} onClick={()=>setManualClient(k)}>{k==='codex'?'Codex':'Claude Desktop'}</button>)}</div>
    <p className="settings-note">{manualClient==='codex'?<>备份 Codex 的 <code>config.toml</code>，添加或更新下方的 juhaoxie 配置。</>:<>在 Claude Desktop 打开 Settings → Developer → Edit Config，将 juhaoxie 合并到已有的 mcpServers。</>}</p>
    <textarea className="assistant-config" aria-label="MCP 接入配置" readOnly value={manualConfig} onFocus={e=>e.currentTarget.select()}/>
    <button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(manualConfig);setManualText('');setCopied('配置已复制')}catch{setManualText(manualConfig);setCopied('请选中配置并复制')}}}>复制配置</button>
    <p className="settings-note"><a href={manualClient==='codex'?'https://developers.openai.com/codex/mcp':'https://modelcontextprotocol.io/docs/develop/connect-local-servers'} target="_blank" rel="noreferrer">{manualClient==='codex'?'Codex 官方 MCP 文档':'Claude Desktop 接入说明'}</a></p>
   </details>}
  </details>
  {(error||state?.lastError)&&<p role="alert" className="error-message">{error||state?.lastError}</p>}
 </div>;
}
