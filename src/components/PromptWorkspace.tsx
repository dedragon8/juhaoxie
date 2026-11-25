import {PromptSourceScene} from './PromptSourceScene';
import {isLayout} from '../core/layout';
import {PromptDesignFields} from './PromptDesignFields';
import {PromptMentionInput} from './PromptMentionInput';
import {promptImages} from '../core/prompt-images';
import {PromptExportDialog} from './PromptExportDialog';
import type {PromptExportItem} from '../core/prompt-export';
import {useEffect,useRef,useState} from 'react';
import type * as Y from 'yjs';
import {Copy,Plus,ArrowUpRight,Film,Check,History,Download,EyeOff,Trash2,Eye} from 'lucide-react';
import filmSkill from '../generated/prompt-skill.json';
import {download} from '../core/storage';
import {meta} from '../core/model';
import {promptSources,videoPrompts,promptHistory,saveVideoPrompt,sourceStatus,composeVideoPrompt,changeVideoPromptState,changeVideoPromptStates} from '../core/video-prompts';
import {charactersInAppearance,inferPromptCharacters,promptCharacterNames,mergeCharacters,normalizePromptFields,promptCharacterChips} from '../core/prompt-composition';
import {PROMPT_FIELDS,emptyPromptFields,type PromptSpan,type PromptFields,type VideoPrompt} from '../core/prompt-types';
import {Modal} from './Modal';
type Draft={id?:string;expectedRevision:string|null;source:PromptSpan[];referenceImageIds?:string[];fields:PromptFields;prompt:string;outputMode?:'auto'|'manual';autoSeed?:boolean};
export function PromptWorkspace({doc,projectId,readonly,onLocate,onSelection,onSettings}:{doc:Y.Doc;projectId:string;readonly:boolean;onLocate:(id:string)=>void;onSelection:(source:PromptSpan[])=>void;onSettings:()=>void}){
 const scenes=promptSources(doc),prompts=videoPrompts(doc,true),root=useRef<HTMLDivElement>(null);
 const compose=(fields:PromptFields,referenceIds:string[]=[])=>composeVideoPrompt(fields,{referenceNames:promptImages(doc).filter(image=>referenceIds.includes(image.id)).map(image=>image.name)});
 const draftKey=`juhao-prompt-draft:${projectId}`;
 const [selected,setSelected]=useState<PromptSpan[]>([]),[draft,setDraft]=useState<Draft|null>(()=>{try{const saved=JSON.parse(localStorage.getItem(draftKey)||'null');return saved?{...saved,fields:normalizePromptFields(saved.fields,promptCharacterNames(doc))}:null}catch{return null}}),[dirty,setDirty]=useState(()=>!!localStorage.getItem(draftKey)),[message,setMessage]=useState(''),[error,setError]=useState(''),[filter,setFilter]=useState('all'),[history,setHistory]=useState(false),[skillOpen,setSkillOpen]=useState(false),[manage,setManage]=useState<VideoPrompt|null>(null),[pendingAction,setPendingAction]=useState<'hide'|'show'|'delete'|null>(null);
 const [manageDirect,setManageDirect]=useState(false),[picked,setPicked]=useState<string[]>([]),[batch,setBatch]=useState<{records:VideoPrompt[];action:'hide'|'show'|'delete'}|null>(null),[exporting,setExporting]=useState<{items:PromptExportItem[];single:boolean}|null>(null);
 const [uploading,setUploading]=useState(false);
 const [freshSelection,setFreshSelection]=useState(false),[selecting,setSelecting]=useState(false);
 const togglePicked=(id:string)=>setPicked(ids=>ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);
 const setLibraryFilter=(value:string)=>{setFilter(value);setPicked([])};
 useEffect(()=>{if(draft&&dirty)localStorage.setItem(draftKey,JSON.stringify(draft));else localStorage.removeItem(draftKey)},[draft,dirty,draftKey]);
 const status=(p:VideoPrompt)=>sourceStatus(doc,p.source),labels={current:'已关联',changed:'原文变更 · 待复核',missing:'原文隐藏或移除'};
 const draftRef=useRef(draft);draftRef.current=draft;
 const update=(patch:Partial<Draft>)=>{const current=draftRef.current;if(current){const next={...current,...patch,autoSeed:false};if(patch.fields||patch.referenceImageIds&&next.outputMode!=='manual'){next.prompt=compose(next.fields,next.referenceImageIds);next.outputMode='auto'}else if(patch.referenceImageIds){const missing=promptImages(doc).filter(image=>patch.referenceImageIds!.includes(image.id)&&!new RegExp('@'+image.name+'(?![\\d])').test(next.prompt));if(missing.length){const references='【参考图】'+missing.map(image=>'@'+image.name).join('、');const at=next.prompt.indexOf('【人物设定】');next.prompt=at<0?next.prompt+'\n\n'+references:next.prompt.slice(0,at)+references+'\n\n'+next.prompt.slice(at)}};draftRef.current=next;localStorage.setItem(draftKey,JSON.stringify(next));setDraft(next);setDirty(true);setMessage('草稿已在本机暂存');setError('')}};
 const field=(key:keyof PromptFields,value:string)=>{if(draft)update({fields:{...draft.fields,[key]:value,...(key==='characterAppearance'?{characters:charactersInAppearance(value,characterOptions).join('、')}:{})}})};
 const canLeave=()=>{
  if(uploading){setError('参考图处理中，请稍候');return false}
  if(!draft||!dirty||draft.autoSeed)return true;
  if(readonly){setError('当前为只读，草稿已保留；无法保存并切换镜头。');return false}
  try{const saved=saveVideoPrompt(doc,draft);setDraft({...draft,id:saved.id,expectedRevision:saved.revision,autoSeed:false});setDirty(false);setMessage('已保存');return true}
  catch(e){setError(`未能自动保存：${(e as Error).message}`);return false}
 };
 const choose=(p:VideoPrompt)=>{if(draft?.id===p.id&&dirty)return;if(draft?.id!==p.id&&!canLeave())return;setDraft({id:p.id,expectedRevision:p.revision,source:p.source,referenceImageIds:p.referenceImageIds||[],fields:normalizePromptFields(p.fields,promptCharacterNames(doc)),prompt:p.prompt,outputMode:p.prompt===compose(p.fields,p.referenceImageIds)?'auto':'manual'});setDirty(false);setFreshSelection(false);setSelecting(false);setSelected(p.source);onSelection(p.source);setError('');setMessage('');window.getSelection()?.removeAllRanges();requestAnimationFrame(()=>{const pane=root.current;if(!pane)return;const el=[...pane.querySelectorAll<HTMLElement>('[data-prompt-paragraph]')].find(el=>el.dataset.promptParagraph===p.source[0]?.paragraphId&&el.dataset.sceneId===p.source[0]?.sceneId);if(el){const box=el.getBoundingClientRect(),outer=pane.getBoundingClientRect();pane.scrollTo({top:pane.scrollTop+box.top-outer.top-pane.clientHeight*.3,behavior:document.documentElement.dataset.reduceMotion==='true'?'instant':'smooth'})}})};
 const seed=(source:PromptSpan[])=>{
  const fields={...emptyPromptFields(),characters:inferPromptCharacters(doc,source).join('、')};
  const selectedKind=(span:PromptSpan)=>scenes.find(s=>s.id===span.sceneId)?.paragraphs.find(p=>p.paragraphId===span.paragraphId)?.kind;
  fields.content=source.filter(s=>!['character','parenthetical','dialogue'].includes(selectedKind(s)||'')).map(s=>s.text).join(' ');
  fields.sound=source.filter(s=>selectedKind(s)==='dialogue').map(s=>s.text).join(' ');
  setDraft({expectedRevision:null,source,fields,prompt:compose(fields),outputMode:'auto',autoSeed:true});setDirty(true);setError('');
 };
 const collect=()=>{const selection=window.getSelection();if(!selection?.rangeCount||selection.isCollapsed||!root.current)return;const range=selection.getRangeAt(0);if(!root.current.contains(range.startContainer)||!root.current.contains(range.endContainer))return;const spans:PromptSpan[]=[];
  root.current.querySelectorAll<HTMLElement>('[data-prompt-paragraph]').forEach(el=>{if(!range.intersectsNode(el))return;const text=el.textContent||'';const startRange=document.createRange();startRange.selectNodeContents(el);let start=0,end=text.length;
   if(el.contains(range.startContainer)){startRange.setEnd(range.startContainer,range.startOffset);start=startRange.toString().length}
   if(el.contains(range.endContainer)){const endRange=document.createRange();endRange.selectNodeContents(el);endRange.setEnd(range.endContainer,range.endOffset);end=endRange.toString().length}
   if(end<=start||!text.slice(start,end).trim())return;
   spans.push({sceneId:el.dataset.sceneId!,paragraphId:el.dataset.promptParagraph!,paragraphIndex:Number(el.dataset.index),start,end,text:text.slice(start,end),paragraphText:text});
  });if(spans.length){setFreshSelection(true);setSelecting(false);setSelected(spans);onSelection(spans);if(!readonly&&(!draft||draft.autoSeed))seed(spans);setMessage(`已选择 ${spans.length} 段内容${draft&&!draft.autoSeed?'；可新建镜头或关联到当前镜头，已有内容不会被覆盖':''}`)}
 };
 const create=()=>{if(!canLeave())return;if(freshSelection&&selected.length){seed(selected)}else{setDraft(null);setDirty(false);setSelected([]);onSelection([]);setMessage('框选原文，创建新镜头。');setError('')}setFreshSelection(false);setSelecting(false);window.getSelection()?.removeAllRanges()};
 const rebind=()=>{if(!draft||!selected.length)return;update({source:selected,fields:{...draft.fields,characters:mergeCharacters(draft.fields.characters,inferPromptCharacters(doc,selected))}});onSelection(selected)};
 const save=()=>{if(!draft||readonly)return;try{const p=saveVideoPrompt(doc,draft);setDraft({...draft,id:p.id,expectedRevision:p.revision,autoSeed:false});setDirty(false);setFreshSelection(false);setError('');setMessage('已保存')}catch(e){setError(String((e as Error).message))}};
 const copy=async(text:string)=>{try{await navigator.clipboard.writeText(text);setMessage('已复制完整文本')}catch{setError('复制失败，请手动选择文字复制')}};
 const openExport=(scope:'current'|'library'|'selected')=>{
  if(scope==='current'&&draft){setExporting({items:[{number:draft.id?Math.max(1,prompts.findIndex(p=>p.id===draft.id)+1):prompts.length+1,text:draft.prompt}],single:true});return}
  if(!canLeave())return;const all=videoPrompts(doc,true),current=all.filter(p=>!p.hidden);const records=scope==='selected'?current.filter(p=>picked.includes(p.id)):current;if(!records.length)return;
  setExporting({items:records.map(p=>({number:all.findIndex(x=>x.id===p.id)+1,text:p.prompt||compose(p.fields,p.referenceImageIds)})),single:false});
 };
 const applyBatch=()=>{if(!batch||readonly)return;try{
  const targets=batch.records.map(p=>({id:p.id,revision:p.revision}));
  for(const p of targets){const latest=promptHistory(doc,p.id).at(-1);if(!latest||latest.deleted||latest.revision!==p.revision)throw Error('选中的镜头已变更，请取消后重新选择。')}
  const activeTarget=targets.find(p=>p.id===draft?.id);
  if(activeTarget&&draft&&dirty&&batch.action!=='delete')activeTarget.revision=saveVideoPrompt(doc,draft).revision;
  changeVideoPromptStates(doc,targets,batch.action);
  if(activeTarget){setDraft(null);setDirty(false);setSelected([]);onSelection([])}setPicked([]);setBatch(null);setError('');setMessage(`已${batch.action==='delete'?'删除':batch.action==='hide'?'隐藏':'显示'} ${targets.length} 个镜头`);
 }catch(e){setError((e as Error).message)}};
 const visible=prompts.filter(p=>filter==='hidden'?p.hidden:!p.hidden&&(filter==='all'||filter==='review'&&status(p)!=='current'));
 const changeState=()=>{if(!manage||!pendingAction||readonly)return;try{let expected=manage.revision;if(draft?.id===manage.id&&dirty&&pendingAction!=='delete')expected=saveVideoPrompt(doc,draft).revision;changeVideoPromptState(doc,manage.id,expected,pendingAction);if(draft?.id===manage.id){setDraft(null);setDirty(false);setSelected([]);onSelection([])}setManage(null);setPendingAction(null);setMessage(pendingAction==='delete'?'镜头已删除；剧本原文保留':pendingAction==='hide'?'镜头已隐藏':'镜头已显示')}catch(e){setError((e as Error).message)}};
 const revisionNow=draft?.id?promptHistory(doc,draft.id).at(-1):undefined;
 const inferred=inferPromptCharacters(doc,selected.length?selected:draft?.source||[]);
 const characterOptions=promptCharacterChips(draft?.fields.characters||'',[...inferred,...promptCharacterNames(doc)]);
 return <div className="prompt-workspace">
  <div className="prompt-workspace-heading"><div><h1>Prompt</h1></div><div className="prompt-header-actions"><button className="secondary" onClick={()=>setSkillOpen(true)}>内置分镜 SKILL</button><button className="secondary" onClick={onSettings}>接入 Agent</button></div></div>
  <details className="prompt-project-style"><summary>全片设定 <span>人物、场景与统一视觉风格</span></summary><textarea aria-label="全片镜头设定" readOnly={readonly} value={meta(doc).get('promptStyle')||''} onChange={e=>doc.transact(()=>meta(doc).set('promptStyle',e.target.value),'screenwriter-local')} placeholder="填写已确定的全片设定。未填写的内容不写入 Prompt。"/></details>
  <div className="prompt-columns">
   <section className="prompt-source-panel"><div className="prompt-panel-bar"><strong>剧本原文</strong><button className="secondary small" disabled={readonly} onMouseDown={e=>e.preventDefault()} onClick={create}><Plus size={14}/>新建镜头</button></div>
    <div className={`prompt-source-scroll ${selecting?'selecting-source':''}`} ref={root} onPointerDown={()=>setSelecting(true)} onMouseUp={collect} onKeyUp={collect}>
     {!scenes.length&&<p className="empty-state">先在文稿中添加场景与内容。</p>}
     {scenes.map((scene,i)=><PromptSourceScene key={scene.id} scene={scene} scenes={scenes} index={i} layout={isLayout(meta(doc).get('layout'))?meta(doc).get('layout') as import('../core/layout').LayoutStyle:'hollywood'} font={meta(doc).get('fontFamily')} source={freshSelection?selected:draft?.source||[]}/>)}
    </div>
    <div className="prompt-source-footer"><span>{selected.length?`已框选 ${selected.reduce((n,s)=>n+s.text.length,0)} 字`:'拖选文字，可跨段落'}</span><button className="text-btn" disabled={!selected.length} onClick={()=>void copy('请通过剧好写 MCP 调用 get_video_prompt_skill，按内置电影分镜模板，为以下框选内容设计镜头，并调用 save_video_prompt 保存。先用 read_prompt_sources 检查原文、人物、全片设定及现有 Prompt。一条 Prompt 对应一段视频，可含单镜头或镜头组；镜头组按顺序写入 shotSequence，整体保存一条。省略未知项、画幅和解释文字；不得修改正文。\n'+JSON.stringify({source:selected,suggested_characters:inferred},null,2))}>复制 AI 任务</button></div>
   </section>
   <section className="prompt-library-panel" aria-label="镜头库"><div className="prompt-panel-bar"><strong>镜头库 <small>{prompts.filter(p=>!p.hidden).length}</small></strong></div>
    <div className="prompt-filters"><button aria-pressed={filter==='all'} onClick={()=>setLibraryFilter('all')}>全部</button><button aria-pressed={filter==='review'} onClick={()=>setLibraryFilter('review')}>待复核</button><button aria-pressed={filter==='hidden'} onClick={()=>setLibraryFilter('hidden')}>隐藏</button></div>
    <div className="prompt-batch-bar"><label><input type="checkbox" aria-label="全选当前镜头" checked={visible.length>0&&visible.every(p=>picked.includes(p.id))} disabled={!visible.length} onChange={e=>setPicked(e.target.checked?visible.map(p=>p.id):[])}/><span>{picked.length?`已选 ${picked.length}`:'多选'}</span></label>{picked.length>0&&<div><button className="icon-btn" aria-label={filter==='hidden'?'显示所选镜头':'隐藏所选镜头'} title={filter==='hidden'?'显示所选镜头':'隐藏所选镜头'} disabled={readonly} onClick={()=>{setError('');setBatch({records:prompts.filter(p=>picked.includes(p.id)),action:filter==='hidden'?'show':'hide'})}}>{filter==='hidden'?<Eye size={14}/>:<EyeOff size={14}/>}</button><button className="icon-btn" aria-label="删除所选镜头" title="删除所选镜头" disabled={readonly} onClick={()=>{setError('');setBatch({records:prompts.filter(p=>picked.includes(p.id)),action:'delete'})}}><Trash2 size={14}/></button></div>}</div>
    <div className="prompt-library-list">{visible.map(p=>{const number=prompts.indexOf(p)+1;return <div className={`prompt-shot ${draft?.id===p.id?'active':''} ${picked.includes(p.id)?'picked':''}`} key={p.id}>
     <input className="shot-checkbox" type="checkbox" aria-label={`选择镜头 ${number}`} checked={picked.includes(p.id)} onChange={()=>togglePicked(p.id)}/>
     <button className={`prompt-library-item ${draft?.id===p.id?'selected':''}`} onClick={()=>choose(p)} onDoubleClick={()=>{setManageDirect(false);setManage(p);setPendingAction(null);setError('')}} onContextMenu={e=>{e.preventDefault();setManageDirect(false);setManage(p);setPendingAction(null);setError('')}} aria-label={`镜头 ${number}`}><span className="shot-number">{String(number).padStart(2,'0')}</span><span><strong>{p.fields.shotSequence?.trim()?'镜头组':p.fields.shotSize||'未设景别'}{p.fields.focalLength&&<i>{p.fields.focalLength}</i>}</strong><small>{p.fields.content||p.source.map(s=>s.text).join(' ')}</small><em>{p.hidden?'已隐藏':labels[status(p)]}</em></span></button>
     <div className="shot-quick-actions"><button className="icon-btn" title={p.hidden?'显示镜头':'隐藏镜头'} aria-label={`${p.hidden?'显示':'隐藏'}镜头 ${number}`} disabled={readonly} onClick={()=>{setManageDirect(true);setManage(p);setPendingAction(p.hidden?'show':'hide');setError('')}}>{p.hidden?<Eye size={13}/>:<EyeOff size={13}/>}</button><button className="icon-btn" title="删除镜头" aria-label={`删除镜头 ${number}`} disabled={readonly} onClick={()=>{setManageDirect(true);setManage(p);setPendingAction('delete');setError('')}}><Trash2 size={13}/></button></div>
    </div>})}{!visible.length&&<p className="prompt-library-empty">{filter==='hidden'?'没有隐藏的镜头':filter==='review'?'暂无待复核镜头':'框选原文，建立第一个镜头。'}</p>}</div>
    <div className="prompt-library-footer"><button className="secondary small" disabled={!prompts.some(p=>!p.hidden&&(!picked.length||picked.includes(p.id)))} onClick={()=>openExport(picked.length?'selected':'library')}><Download size={14}/>{picked.length?'导出所选':'导出镜头库'}</button><span>PDF · Word · TXT</span></div>
   </section>
   <section className="prompt-design-panel" aria-label="镜头设计">
    {draft?<div className="prompt-editor">
     <div className="prompt-editor-heading"><h2>{draft.id?'镜头设计':'新镜头'}</h2><div>{draft.id&&<button className="icon-btn" title="Prompt 历史版本" onClick={()=>setHistory(true)}><History size={16}/></button>}<button className="text-btn" onClick={()=>onLocate(draft.source[0].sceneId)}><ArrowUpRight size={14}/>定位文稿</button></div></div>
     {!!selected.length&&JSON.stringify(selected)!==JSON.stringify(draft.source)&&<div className="prompt-warning">新选区{inferred.length?`关联人物：${inferred.join('、')}`:'已就绪'}。<button className="text-btn" disabled={readonly} onClick={rebind}>关联到此镜头</button><button className="text-btn" disabled={readonly} onClick={create}>另建镜头</button></div>}
     {sourceStatus(doc,draft.source)!=='current'&&<p role="status" className="prompt-warning">原文已改变或移除。旧 Prompt 已保留；请在左侧重新框选对应内容后复核。</p>}
     {revisionNow&&revisionNow.revision!==draft.expectedRevision&&<p role="status" className="prompt-warning">此镜头有新版本。当前草稿已保留，请复制草稿或从库中重新打开最新版本。</p>}
     <PromptDesignFields doc={doc} fields={draft.fields} onField={field} referenceIds={draft.referenceImageIds||[]} onReferences={referenceImageIds=>update({referenceImageIds})} readonly={readonly} characterOptions={characterOptions} onBusy={setUploading}/>
     <section className="promote-output"><div className="prompt-compose"><strong>完整 Prompt</strong><span>{draft.outputMode==='auto'?'模板 · 实时生成':'已润色全文'}</span></div>
      <PromptMentionInput className="prompt-final" label="完整 Prompt" rows={8} images={promptImages(doc).filter(image=>draft.referenceImageIds?.includes(image.id))} readOnly={readonly} value={draft.prompt} onChange={prompt=>update({prompt,outputMode:'manual'})}/>
      <div className="prompt-actions"><button className="primary" disabled={!draft.prompt} onClick={()=>void copy(draft.prompt)}><Copy size={14}/>复制全文</button><button className="secondary" disabled={!draft.prompt} onClick={()=>openExport('current')}><Download size={14}/>导出全文</button><button className="text-btn" disabled={readonly} onClick={()=>{update({prompt:compose(draft.fields,draft.referenceImageIds),outputMode:'auto'})}}>恢复模板</button></div>
      {draft.outputMode!=='auto'&&<p className="promote-hint">可直接润色全文；修改上方字段时，下方会重新生成完整 Prompt。</p>}
     </section>
     <div className="promote-save"><span>{dirty?'未保存到镜头库':'已保存'}</span><button className="primary" disabled={readonly||!dirty||uploading} onClick={save}><Check size={14}/>保存镜头</button></div>
    </div>:<div className="prompt-empty"><Film size={32}/><h2>从一段文字开始</h2><p>框选左侧剧本，创建镜头。</p><p>自行填写或让 Agent 生成 Prompt。</p></div>}
   </section>
  </div>
  {exporting&&<PromptExportDialog title={String(meta(doc).get('title')||'剧本')} items={exporting.items} single={exporting.single} onClose={()=>setExporting(null)} onDone={()=>setMessage('已导出 Prompt')}/> }
  {message&&<p className="prompt-feedback" role="status">{message}</p>}{error&&!manage&&!batch&&<p className="error-message" role="alert">{error}</p>}
  {manage&&<Modal title={pendingAction?pendingAction==='delete'?'删除镜头？':pendingAction==='hide'?'隐藏镜头？':'显示镜头？':'管理镜头'} onClose={()=>{setManage(null);setPendingAction(null)}}>{error&&<p role="alert" className="error-message">{error}</p>}{pendingAction?<><p className="settings-note">{pendingAction==='delete'?'从镜头库中移除此镜头，不删除剧本原文。':pendingAction==='hide'?'镜头会放入隐藏列表，不进入整库导出；原文和镜头内容保留。':'镜头将重新出现在镜头库中。'}</p><div className="modal-actions"><button className="secondary" onClick={()=>{if(manageDirect)setManage(null);setPendingAction(null);setError('')}}>取消</button><button className="primary" disabled={readonly} onClick={changeState}>确认{pendingAction==='delete'?'删除':pendingAction==='hide'?'隐藏':'显示'}</button></div></>:<div className="shot-management"><button className="secondary" disabled={readonly} onClick={()=>setPendingAction(manage.hidden?'show':'hide')}>{manage.hidden?<Eye size={16}/>:<EyeOff size={16}/>} {manage.hidden?'显示镜头':'隐藏镜头'}</button><button className="secondary" disabled={readonly} onClick={()=>setPendingAction('delete')}><Trash2 size={16}/>删除镜头</button></div>}</Modal>}
  {batch&&<Modal title={`${batch.action==='delete'?'删除':batch.action==='hide'?'隐藏':'显示'} ${batch.records.length} 个镜头？`} onClose={()=>{setBatch(null);setError('')}}><p className="settings-note">{batch.action==='delete'?'这些镜头将从镜头库移除，剧本原文保留。':batch.action==='hide'?'这些镜头将放入隐藏列表，不进入导出。':'这些镜头将回到镜头库。'}</p><div className="batch-shot-list">{batch.records.map(p=><div key={p.id}><span>镜头 {prompts.findIndex(x=>x.id===p.id)+1}</span><strong>{p.fields.content||p.fields.shotSize||'未命名镜头'}</strong></div>)}</div>{error&&<p role="alert" className="error-message">{error}</p>}<div className="modal-actions"><button className="secondary" onClick={()=>{setBatch(null);setError('')}}>取消</button><button className="primary" disabled={readonly} onClick={applyBatch}>确认{batch.action==='delete'?'删除':batch.action==='hide'?'隐藏':'显示'}</button></div></Modal>}
  {skillOpen&&<Modal title="电影分镜 SKILL" wide onClose={()=>setSkillOpen(false)}><p className="settings-note">按框选片段设计镜头，每个字段都可修改。Codex / Claude 可通过 get_video_prompt_skill 直接读取；也可下载文件交给其他客户端。</p><div className="skill-field-guide">{PROMPT_FIELDS.filter(([key])=>key!=='aspectRatio').map(([key,label])=><span key={key}>{label}</span>)}</div><details className="skill-instructions"><summary>查看完整技能与参考来源</summary><pre>{filmSkill.skill}</pre><details><summary>第三方许可</summary><pre>{filmSkill.licenses}</pre></details></details><div className="modal-actions"><button className="secondary" onClick={()=>download('SKILL.md',filmSkill.skill,'text/markdown')}>下载 SKILL.md</button><button className="primary" onClick={()=>void copy(filmSkill.skill)}>复制完整技能</button></div></Modal>}
  {history&&draft?.id&&<Modal title="Prompt 历史版本" onClose={()=>setHistory(false)}>{promptHistory(doc,draft.id).reverse().map(p=><div className="prompt-history" key={p.revision}><small>{new Date(p.updatedAt).toLocaleString()}</small><pre>{p.prompt||compose(p.fields,p.referenceImageIds)||'空白 Prompt'}</pre><button className="text-btn" onClick={()=>void copy(p.prompt||compose(p.fields,p.referenceImageIds))}>复制此版本</button></div>)}</Modal>}
 </div>;
}
