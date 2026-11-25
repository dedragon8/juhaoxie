const path=require('node:path');const fs=require('node:fs');const os=require('node:os');
const binary=path.join(__dirname,'../native/build/juhao-appkit.node');
const packaged=path.join(process.resourcesPath||'', 'juhao-appkit.node');
const available=process.platform==='darwin'&&Number(os.release().split('.')[0])>=25&&process.env.JUHAO_NATIVE_SHELL!=='0'&&(fs.existsSync(binary)||fs.existsSync(packaged));
let addon,window;
function attach(win){if(!available)return false;addon=require(fs.existsSync(binary)?binary:packaged);window=win;return addon.attach(win.getNativeWindowHandle(),text=>{if(!window||window.isDestroyed())return;try{const action=JSON.parse(text);if(action.action==='rename')window.webContents.focus();window.webContents.send('native-shell-action',action)}catch(error){console.error('Native command:',error.message)}})}
function update(state){
 if(!addon||!state||typeof state!=='object'||!Array.isArray(state.groups))return false;
 if(['projectId','title','view','status','active','theme'].some(k=>typeof state[k]!=='string')||['opened','readonly','modal','sidebar'].some(k=>typeof state[k]!=='boolean'))return false;
 if(state.groups.some(g=>!g||typeof g.id!=='string'||typeof g.name!=='string'||!Array.isArray(g.children)||g.children.some(s=>!s||['id','name','detail'].some(k=>typeof s[k]!=='string'))))return false;
 const agents=Array.isArray(state.agents)?state.agents.slice(0,3).filter(a=>a&&['codex','claude','other'].includes(a.kind)&&typeof a.label==='string'&&typeof a.access==='string').map(a=>({kind:a.kind,label:a.label.slice(0,80),access:a.access.slice(0,20),icon:a.kind==='other'?'':path.join(__dirname,'../dist/agent-icons',a.kind+'.png')})):[];
 const json=JSON.stringify({...state,agents});if(json.length>2000000)return false;return addon.update(json)
}
function detach(){addon?.detach();window=undefined}
module.exports={available,attach,update,detach,inspect:()=>addon?JSON.parse(addon.inspect()):{attached:false},testAction:value=>{if(process.env.JUHAO_NATIVE_SELF_TEST!=='1')throw Error('Test mode is disabled');return addon?.testAction(value)}};
