import {useEffect,useState} from 'react';
import {FONTS,DEFAULT_FONT,fontStack,validFont,type SystemFont} from '../core/fonts';

export function DocumentFonts({selected,defaultFont,selectionDisabled,disabled,onSelected,onDefault}:{selected:string;defaultFont:string;selectionDisabled:boolean;disabled:boolean;onSelected:(font:string)=>void;onDefault:(font:string)=>void}){
 const [fonts,setFonts]=useState<SystemFont[]>(FONTS.map(([family,label])=>({family,label}))),[query,setQuery]=useState(''),[loading,setLoading]=useState(false),[status,setStatus]=useState(''),[scanned,setScanned]=useState(false);
 const refresh=async()=>{
  if(!window.desktop?.listFonts){setStatus('系统字体选择请在 Mac 版中使用。');return;}
  setLoading(true);setStatus('');
  try{const result=await window.desktop.listFonts();const unique=[...new Map(result.filter(f=>validFont(f.family)).map(f=>[f.family,f])).values()];if(!unique.length)throw Error();setFonts(unique.sort((a,b)=>a.label.localeCompare(b.label,'zh-CN')));setScanned(true)}
  catch{setStatus('暂时无法读取系统字体，请重试。')}
  finally{setLoading(false)}
 };
 useEffect(()=>{void refresh()},[]);
 const options=(current:string)=>{
  const filtered=fonts.filter(f=>f.family===current||`${f.label} ${f.family}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  if(current&&!fonts.some(f=>f.family===current))filtered.unshift({family:current,label:`${current}${scanned?'（本机未安装）':''}`});
  return filtered.map(f=><option key={f.family} value={f.family}>{f.label===f.family?f.label:`${f.label} · ${f.family}`}</option>);
 };
 const missing=scanned&&[defaultFont,selected].filter(Boolean).some(f=>!fonts.some(v=>v.family===f));
 return <div className="document-fonts">
  <div className="font-search"><input type="search" aria-label="搜索字体" placeholder="搜索字体名称" value={query} onChange={e=>setQuery(e.target.value)}/><button className="text-btn" disabled={loading} onClick={()=>void refresh()}>{loading?'读取中…':'刷新字体'}</button></div>
  <label className="field">选中文字字体<select aria-label="选中文字字体" value={selected} disabled={selectionDisabled||disabled} onChange={e=>onSelected(e.target.value)}><option value="">跟随文稿</option>{options(selected)}</select></label>
  <label className="field">默认字体<select aria-label="文稿默认字体" value={defaultFont||DEFAULT_FONT} disabled={disabled} onChange={e=>onDefault(e.target.value)}>{options(defaultFont||DEFAULT_FONT)}</select></label>
  <div className="font-sample" style={{fontFamily:fontStack(defaultFont)}}>内景　书房　日<br/>她翻开剧本，开始写作。<br/>故事由此开始。Aa 0123</div>
  <p className="settings-note" role="status">{status||(loading?'正在读取字体库…':scanned?`本机可用字体 ${fonts.length} 种`:'')}</p>
  {missing&&<p className="settings-note">缺少的字体保留原名称，暂用苹方显示。</p>}
  <p className="settings-note">默认字体用于文稿和导出，单独设置的文字保持原样。</p>
 </div>;
}
