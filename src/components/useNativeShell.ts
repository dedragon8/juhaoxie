import {useEffect,useRef,useState} from 'react';
export type NativeShellAction={action:string;value?:string;id?:string;actId?:string;beforeId?:string};
export type NativeShellState={agents?:{kind:string;label:string;access:string}[];promptEnabled:boolean;projectId:string;theme:string;title:string;view:string;status:string;opened:boolean;readonly:boolean;focus:boolean;notes:boolean;modal:boolean;sidebar:boolean;active:string;groups:{id:string;name:string;children:{id:string;name:string;detail:string}[]}[]};
declare global {interface Window {nativeShell?:{status:()=>Promise<{attached:boolean;toolbarInset?:number}>;update:(state:NativeShellState)=>Promise<boolean>;onAction:(cb:(action:NativeShellAction)=>void)=>()=>void}}}
export function useNativeShell(state:NativeShellState,onAction:(action:NativeShellAction)=>void){
 const [enabled,setEnabled]=useState(false),[dialog,setDialog]=useState(false),[appearance,setAppearance]=useState(state.theme),handler=useRef(onAction);handler.current=onAction;
 useEffect(()=>{let alive=true;void window.nativeShell?.status().then(s=>{if(alive){setEnabled(s.attached);document.documentElement.style.setProperty('--native-toolbar-inset',`${s.toolbarInset||0}px`)}});const off=window.nativeShell?.onAction(action=>{if(action.action==='toolbar-inset'){document.documentElement.style.setProperty('--native-toolbar-inset',`${Math.max(0,Math.min(120,Number(action.value)||0))}px`);return}handler.current(action)});return()=>{alive=false;off?.()}},[]);
 useEffect(()=>{const check=()=>setDialog(!!document.querySelector('[role="dialog"],[role="alertdialog"]'));const observer=new MutationObserver(check);observer.observe(document.body,{childList:true,subtree:true});check();return()=>observer.disconnect()},[]);
 useEffect(()=>{const check=()=>setAppearance(document.documentElement.dataset.theme||state.theme);const observer=new MutationObserver(check);observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});check();return()=>observer.disconnect()},[state.theme]);
 const serialized=JSON.stringify({...state,theme:appearance,modal:state.modal||dialog});
 useEffect(()=>{if(!enabled)return;void window.nativeShell?.update(JSON.parse(serialized)).catch(console.error)},[enabled,serialized]);
 return enabled;
}
