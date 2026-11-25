export type LayoutStyle='hollywood'|'commonChinese'|'chinese'|'shortDrama';
export const isLayout=(value:unknown):value is LayoutStyle=>value==='commonChinese'||value==='hollywood'||value==='chinese'||value==='shortDrama';
export type ElementMetrics={x:number;width:number;align?:string};
// A4 points. Chinese dialogue keeps the 7 cm left edge and adds two 12 pt CJK glyphs to the original 7 cm column.
// Hollywood parentheticals start at 3.1 inches; keep the 2.9-inch right margin on A4.
const hollywood={scene:{x:108,width:415.2756},action:{x:108,width:415.2756},character:{x:266.4,width:256.8756},dialogue:{x:180,width:235.2756},parenthetical:{x:223.2,width:163.2756},transition:{x:108,width:415.2756,align:'right'},montage:{x:108,width:415.2756},sequence:{x:108,width:415.2756},shot:{x:120,width:403.2756},sequenceEnd:{x:108,width:415.2756},more:{x:266.4,width:256.8756}};
const chinese={scene:{x:113.3858,width:396.8504},action:{x:113.3858,width:396.8504},character:{x:198.4252,width:198.4252},dialogue:{x:198.4252,width:222.4252},parenthetical:{x:198.4252,width:198.4252},transition:{x:113.3858,width:396.8504,align:'right'},montage:{x:113.3858,width:396.8504},sequence:{x:113.3858,width:396.8504},shot:{x:125.3858,width:384.8504},sequenceEnd:{x:113.3858,width:396.8504},more:{x:198.4252,width:198.4252}};
const shortDrama=Object.fromEntries(Object.keys(hollywood).map(kind=>[kind,{x:72,width:451.2756}])) as typeof hollywood;
const commonChinese={...shortDrama};
export const LAYOUT_NAMES={hollywood:'好莱坞格式',commonChinese:'常见中文',chinese:'优化中文',shortDrama:'短剧'};
export function layoutFor(style?:LayoutStyle){return style==='commonChinese'?{metrics:commonChinese,top:72,bottom:72,gap:18,line:18,speechLine:18}:style==='shortDrama'?{metrics:shortDrama,top:56.6929,bottom:56.6929,gap:18,line:18,speechLine:18}:style==='chinese'?{metrics:chinese,top:56.6929,bottom:56.6929,gap:22,line:22,speechLine:17}:{metrics:hollywood,top:72,bottom:72,gap:16,line:16,speechLine:16};}
export function layoutVariables(style?:LayoutStyle){const m=layoutFor(style).metrics,base=m.action;return Object.fromEntries((['character','dialogue','parenthetical'] as const).flatMap(kind=>[[`--${kind}-left`,`${(m[kind].x-base.x)/base.width*100}%`],[`--${kind}-right`,`${(base.x+base.width-m[kind].x-m[kind].width)/base.width*100}%`]]));}
