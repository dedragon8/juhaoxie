import {isLayout,type LayoutStyle} from './layout';
import {KINDS,LABELS,type Kind} from './model';
export type Theme='system'|'light'|'dark';
export const FORMAT_ORDER=['character','action','dialogue','parenthetical','transition','montage','sequence','shot','sequenceEnd'] as const;
export const FORMAT_COMMANDS=FORMAT_ORDER.map((id,i)=>({id,label:LABELS[id],key:`Mod+Digit${i+1}`}));
export const COMMANDS=[...FORMAT_COMMANDS,{id:'addScene',label:'新增场景',key:'Mod+Digit0'},
 {id:'new',label:'新建剧本',key:'Mod+KeyN'}, {id:'import',label:'打开剧本文件',key:'Mod+KeyO'},
 {id:'backup',label:'保存剧本文件（.jhwrite）',key:'Mod+Shift+KeyS'}, {id:'preview',label:'预览与导出 PDF',key:'Mod+KeyP'},
 {id:'search',label:'查找与替换',key:'Mod+KeyF'}, {id:'save',label:'立即保存',key:'Mod+KeyS'},
] as const;
export type Command=typeof COMMANDS[number]['id'];
export type Preferences={theme:Theme;promptEnabled:boolean;defaultLayout:LayoutStyle;shortcuts:Record<Command,string>};
export const DEFAULT_KEYS=Object.fromEntries(COMMANDS.map(c=>[c.id,c.key])) as Record<Command,string>;
export const SETTINGS_KEY='changjing-settings-v1';
export function keyFromEvent(e:Pick<KeyboardEvent,'code'|'metaKey'|'ctrlKey'|'altKey'|'shiftKey'>){
 if(!/^(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal)$/.test(e.code))return '';
 return [e.metaKey||e.ctrlKey?'Mod':'',e.altKey?'Alt':'',e.shiftKey?'Shift':'',e.code].filter(Boolean).join('+');
}
export function shortcutError(key:string,command:Command,keys:Record<Command,string>){
 if(command==='addScene')return key==='Mod+Digit0'?'':'新增场景固定使用 ⌘0';
 if(key==='Mod+Digit0')return '⌘0 固定用于新增场景';
 if(!key)return '';
 if(!/^(Mod\+)?(Alt\+)?(Shift\+)?(Key[A-Z]|Digit[0-9]|F(?:[1-9]|1[0-2])|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash|Minus|Equal)$/.test(key))return '不支持这个组合';
 if(!key.startsWith('Mod+')&&!/^F\d+$/.test(key))return '请使用 ⌘ / Ctrl 加其他键，避免影响文字输入';
 if(/^(Mod\+(Shift\+)?Key[ACVXZQWHMR]|Mod\+Comma|Mod\+Alt\+Key[IJC]|Mod\+Shift\+Key[34]|Mod\+Alt\+KeyF)$/.test(key))return '此组合保留给系统或基础编辑操作';
 const conflict=COMMANDS.find(c=>c.id!==command&&keys[c.id]===key);
 return conflict?`已用于“${conflict.label}”，请换一个组合`:'';
}
export function shortcutLabel(key:string){if(!key)return '未设置';return key.replace('Mod+','⌘ ').replace('Alt+','⌥ ').replace('Shift+','⇧ ').replace(/Key|Digit/g,'').replace('Comma',',').replace('Period','.').replace('Slash','/').replace('Semicolon',';').replace('Quote',"'").replace('BracketLeft','[').replace('BracketRight',']').replace('Backslash','\\').replace('Minus','−').replace('Equal','=');}
export function readPreferences():Preferences {
 const result:Preferences={theme:'system',promptEnabled:true,defaultLayout:'hollywood',shortcuts:{...DEFAULT_KEYS}};
 try{const raw=JSON.parse(localStorage.getItem(SETTINGS_KEY)||'null');if(raw){if(typeof raw.promptEnabled==='boolean')result.promptEnabled=raw.promptEnabled;if(isLayout(raw.defaultLayout))result.defaultLayout=raw.defaultLayout;if(['system','light','dark'].includes(raw.theme))result.theme=raw.theme;
 // Validate the complete map together, so swapping two shortcuts survives reopening.
 let keys={...DEFAULT_KEYS,...Object.fromEntries(COMMANDS.filter(c=>typeof raw.shortcuts?.[c.id]==='string').map(c=>[c.id,raw.shortcuts[c.id]]))};
 const formerOrder=['addScene','action','character','dialogue','parenthetical','transition','montage','sequence','shot','sequenceEnd'] as const;
 const previous=formerOrder.every((id,i)=>keys[id]===(i===9?'':`Mod+Alt+Digit${i+1}`));
 const observed=formerOrder.every((id,i)=>keys[id]===`Mod+Digit${i}`);
 const v040Order=['character','addScene','dialogue','action','parenthetical','transition','montage','sequence','shot','sequenceEnd'] as const;
 const v040=v040Order.every((id,i)=>keys[id]===`Mod+Digit${(i+1)%10}`);
 if(previous||observed||v040)keys={...keys,...Object.fromEntries([...FORMAT_COMMANDS,{id:'addScene',key:'Mod+Digit0'}].map(c=>[c.id,c.key]))};
 // Reserve scene creation even for customized maps; move a displaced binding to a free default or clear it.
 const displaced=COMMANDS.filter(c=>c.id!=='addScene'&&keys[c.id]==='Mod+Digit0');keys.addScene='Mod+Digit0';
 for(const c of displaced){const preferred=DEFAULT_KEYS[c.id];keys[c.id]=COMMANDS.some(other=>other.id!==c.id&&keys[other.id]===preferred)?'':preferred;}
 if(COMMANDS.every(c=>!shortcutError(keys[c.id],c.id,keys)))result.shortcuts=keys;
 }}catch{}return result;
}
export const isFormat=(command:string):command is Kind=>(KINDS as readonly string[]).includes(command);
