import {useEffect,useState,useId} from 'react';
import {Plug} from 'lucide-react';
import type {AssistantState} from '../core/assistant';
export type ConnectedAgent={kind:'codex'|'claude'|'other';label:string;access:string};
export function connectedAgents(state:AssistantState|undefined,projectId:string):ConnectedAgent[]{
 if(!state?.enabled||state.projectId!==projectId)return [];
 const result=new Map<string,ConnectedAgent>();
 for(const name of state.clients){const kind=/codex/i.test(name)?'codex':/claude/i.test(name)?'claude':'other',label=kind==='codex'?'Codex':kind==='claude'?'Claude':name;result.set(kind==='other'?name:kind,{kind,label,access:state.allowWrite?'可编辑':'只读'})}
 return [...result.values()];
}
export function useAgentConnections(projectId:string,active:boolean){
 const [state,setState]=useState<AssistantState>();
 useEffect(()=>{let alive=true,busy=false;setState(undefined);const poll=async()=>{if(busy)return;busy=true;try{const next=await window.assistantBridge?.status();if(alive)setState(next)}catch{if(alive)setState(undefined)}finally{busy=false}};if(active){void poll();const timer=setInterval(()=>void poll(),2000);return()=>{alive=false;clearInterval(timer)}}return()=>{alive=false}},[projectId,active]);
 return active?connectedAgents(state,projectId):[];
}
export function AgentConnections({agents,onClick}:{agents:ConnectedAgent[];onClick:()=>void}){
 const clipId=useId().replace(/:/g,'');
 if(!agents.length)return null;
 return <div className="agent-connections" aria-label="已连接的 Agent">{agents.map(agent=><button className="agent-connected" key={agent.kind+agent.label} title={`${agent.label} 已连接 · ${agent.access}`} aria-label={`${agent.label} 已连接 · ${agent.access}`} onClick={onClick}>{agent.kind==='other'?<Plug size={18}/>:agent.kind==='codex'?<svg viewBox="190 194 640 640" width="24" height="24" aria-hidden="true"><defs><clipPath id={clipId}><path d="M469 210 C391 190 512 190 581 253 C678 225 786 313 775 441 C854 545 821 660 698 699 C672 812 540 851 443 770 C326 803 226 716 254 580 C165 488 204 363 325 324 C340 257 391 208 469 210 Z"/></clipPath></defs><image href="./agent-icons/codex.png" width="1024" height="1024" clipPath={`url(#${clipId})`}/></svg>:<img src={`./agent-icons/${agent.kind}.png`} alt=""/>}<i aria-hidden="true"/></button>)}</div>;
}
