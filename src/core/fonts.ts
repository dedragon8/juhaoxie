export const FONTS=[['PingFang SC','苹方简体'],['Songti SC','宋体简体'],['Heiti SC','黑体简体'],['Kaiti SC','楷体简体'],['Helvetica Neue','Helvetica Neue'],['Courier','Courier']] as const;
export const DEFAULT_FONT='PingFang SC';
export type SystemFont={family:string;label:string};
// Accept portable family names even when the receiving Mac lacks that font.
// Reject CSS/HTML delimiters because names also appear in exported stylesheets.
export const validFont=(font:unknown):font is string=>typeof font==='string'&&font.length>0&&font.length<=200&&font.trim()===font&&!/[\x00-\x1f\x7f"\\;<>\{\}]/.test(font);
export const fontStack=(font?:string)=>`"${validFont(font)?font:DEFAULT_FONT}", "PingFang SC", sans-serif`;
