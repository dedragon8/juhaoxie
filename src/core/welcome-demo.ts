import type {Script,ProjectEntry} from './model';
import {entries,newEntry,openProject,saveEntry,restoreProject} from './storage';
export const DEMO_KEY='juhaoxie-welcome-demo-v1';
export const DEMO_TITLE='落水狗 · 节选演示';
// Very short, independently translated quotation from the 1990-10-22 draft.
// Action/parenthetical are original layout examples, not attributed quotations.
export function welcomeDemo():Script{return {schemaVersion:1,title:DEMO_TITLE,author:'昆汀·塔伦蒂诺（原剧本）',contact:'排版演示 · 对白自译',layout:'hollywood',fontFamily:'PingFang SC',characters:{},includeStoryInfo:true,storySynopsis:'本演示选用《落水狗》1990 年 10 月 22 日剧本稿中的三句简短对白，自译。该稿此处角色为白先生，可能与电影成片不同。\n来源：https://imsdb.com/scripts/Reservoir-Dogs.html\n动作和括注是原创排版示意，并非原剧本节选。原作品权利归其权利人所有。\n可编辑这份演示、切换四种剧本格式，或在 Prompt 工作区框选原文设计镜头。',acts:[{id:'demo-act',name:'第一幕',order:'a0'}],scenes:[{id:'demo-cafe',order:'a0',actId:'demo-act',name:'小费',location:'餐馆',time:'日',setting:'内景',summary:'关于小费的对话。',notes:'原作：Quentin Tarantino，Reservoir Dogs，1990-10-22 稿。三句对白自译；动作和括注为原创示意。\n可按 Tab 切换行类型；切换格式不会改变原文。',deleted:false,blocks:[{kind:'action',text:'桌上的咖啡渐渐冷了。'},{kind:'character',text:'白先生'},{kind:'parenthetical',text:'平静地'},{kind:'dialogue',text:'我不给小费。'},{kind:'character',text:'埃迪'},{kind:'dialogue',text:'什么叫不给小费？'},{kind:'character',text:'白先生'},{kind:'dialogue',text:'我不信这一套。'}]}]}}
let pending:Promise<boolean>|undefined;
export function ensureWelcomeDemo():Promise<boolean>{
 if(pending)return pending;
 pending=(async()=>{
  const record=JSON.parse(localStorage.getItem(DEMO_KEY)||'null') as {done?:boolean;entry?:ProjectEntry}|null;
  if(record?.done)return false;
  if(!record&&(entries(true).length>0||localStorage.getItem('juhaoxie-getting-started-v1'))){localStorage.setItem(DEMO_KEY,JSON.stringify({done:true}));return false}
  const entry=record?.entry||newEntry(DEMO_TITLE);
  localStorage.setItem(DEMO_KEY,JSON.stringify({entry}));
  const session=await openProject(entry,welcomeDemo());
  try{saveEntry(entry);localStorage.setItem(DEMO_KEY,JSON.stringify({done:true,entry}));return true}
  finally{session.persistence.destroy();session.doc.destroy()}
 })().finally(()=>{pending=undefined});return pending;
}

let manualPending:Promise<ProjectEntry>|undefined;
// Explicit entry point for existing installations. Never overwrite edited demo content.
export function addWelcomeDemo():Promise<ProjectEntry>{
 if(manualPending)return manualPending;
 manualPending=(async()=>{
  if(pending)await pending;
  const record=JSON.parse(localStorage.getItem(DEMO_KEY)||'null') as {entry?:ProjectEntry}|null;
  const existing=entries(true).find(e=>e.id===record?.entry?.id)||entries(true).find(e=>e.title===DEMO_TITLE);
  if(existing){if(existing.deletedAt)restoreProject(existing.id);return {...existing,deletedAt:undefined}}
  const entry=newEntry(DEMO_TITLE),session=await openProject(entry,welcomeDemo());
  try{saveEntry(entry);localStorage.setItem(DEMO_KEY,JSON.stringify({done:true,entry}));return entry}
  finally{session.persistence.destroy();session.doc.destroy()}
 })().finally(()=>{manualPending=undefined});return manualPending;
}
