import {useState} from 'react';
import {FileText,File,AlignLeft,Download} from 'lucide-react';
import {Modal} from './Modal';
import {download} from '../core/storage';
import {downloadBytes,zipStore} from '../core/zip-store';
import {promptExportText,promptExportHtml,promptExportWord,type PromptExportItem} from '../core/prompt-export';
export function PromptExportDialog({title,items,single=false,onClose,onDone}:{title:string;items:PromptExportItem[];single?:boolean;onClose:()=>void;onDone:()=>void}){
 const [format,setFormat]=useState<'txt'|'pdf'|'docx'>('txt'),[separate,setSeparate]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const save=async()=>{if(busy)return;setBusy(true);setError('');try{
  const name=`${title.replace(/[\\/:*?"<>|]/g,'-')||'剧本'}-${single?'Prompt':'Prompt库'}`;
  if(format==='txt'&&separate){const data=zipStore(Object.fromEntries(items.map(p=>[`镜头-${String(p.number).padStart(3,'0')}.txt`,p.text])));if(window.desktop){if(!await window.desktop.exportDocument(data,`${name}.zip`,'zip'))return}else downloadBytes(`${name}.zip`,data,'application/zip')}
  else if(format==='txt'){const text=promptExportText(items,single);if(window.desktop){if(!await window.desktop.exportPromptText(text,`${name}.txt`))return}else download(`${name}.txt`,text,'text/plain;charset=utf-8')}
  else if(format==='docx'){const data=promptExportWord(title,items);if(window.desktop){if(!await window.desktop.exportDocument(data,`${name}.docx`,'docx'))return}else downloadBytes(`${name}.docx`,data,'application/vnd.openxmlformats-officedocument.wordprocessingml.document')}
  else {const html=promptExportHtml(title,items);if(window.desktop){const data=await window.desktop.pdf(html);if(!await window.desktop.exportPdf(data,`${name}.pdf`))return}else {const frame=document.createElement('iframe');frame.style.cssText='position:fixed;width:1px;height:1px;opacity:0;pointer-events:none';frame.srcdoc=html;frame.onload=()=>{frame.contentWindow?.focus();frame.contentWindow?.print();setTimeout(()=>frame.remove(),60000)};document.body.appendChild(frame)}}
  onDone();onClose();
 }catch(e){setError(`导出失败：${(e as Error).message}`)}finally{setBusy(false)}};
 return <Modal title="导出 Prompt" canClose={!busy} onClose={()=>{if(!busy)onClose()}}><p className="export-summary">{items.length} 个镜头 · 完整 Prompt 全文</p><fieldset className="prompt-export-formats"><legend>文件格式</legend>{([['txt','TXT','纯文本，方便复制',AlignLeft],['pdf','PDF','A4 排版，便于分享',File],['docx','Word','可继续编辑的文档',FileText]] as const).map(([value,label,description,Icon])=><label key={value}><input type="radio" name="prompt-export-format" value={value} checked={format===value} disabled={busy} onChange={()=>setFormat(value)}/><span><Icon size={23}/><strong>{label}</strong><small>{description}</small></span></label>)}</fieldset>{format==='txt'&&items.length>1&&<label className="export-separate"><input type="checkbox" checked={separate} disabled={busy} onChange={e=>setSeparate(e.target.checked)}/>每个镜头保存为独立 TXT 文件（ZIP）</label>}<p className="settings-note">{format==='txt'?'保留全文，不附加剧本原文或设计表格。':'每个镜头另起一页，长内容自动续页。'}</p>{error&&<p role="alert" className="error-message">{error}</p>}<div className="modal-actions"><button className="secondary" disabled={busy} onClick={onClose}>取消</button><button className="primary" disabled={busy||!items.length} onClick={()=>void save()}><Download size={14}/>{busy?'正在导出…':'导出'}</button></div></Modal>
}
