import type {LayoutStyle} from '../core/layout';
import {episodeOf,sceneCast,SHORT_MARKERS} from '../core/short-drama';
import {ShortDramaInput,ShortDramaDecorations,insertShortMarker,currentShortMarker,finishShortCharacter} from '../core/short-drama-editor';
import {useEffect,useLayoutEffect,useMemo,useState,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Node,mergeAttributes,type Editor} from '@tiptap/core';
import {EditorContent,useEditor} from '@tiptap/react';
import Document from '@tiptap/extension-document';
import Text from '@tiptap/extension-text';
import HardBreak from '@tiptap/extension-hard-break';
import Collaboration,{isChangeOrigin} from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import Placeholder from '@tiptap/extension-placeholder';
import {Slice} from '@tiptap/pm/model';
import {preserveCopiedFonts,readSceneClipboard} from '../core/clipboard';
import {FindHighlights,highlightMatches} from '../core/find-highlights';
import type {FindMatch} from '../core/find-replace';
import {meta} from '../core/model';
import {TextSelection,Plugin} from '@tiptap/pm/state';
import * as Y from 'yjs';
import type {Awareness} from 'y-protocols/awareness';
import {KINDS,LABELS,nextKind,characterNames,registerCharacter,updateScene,type Scene,type Kind} from '../core/model';
import {FontFamily,changeBlockKind} from '../core/editor-format';
import {FORMAT_COMMANDS,shortcutLabel,type Preferences} from '../core/preferences';
import {ChevronDown,Eye} from 'lucide-react';

type Props={layout:LayoutStyle;shortNumber:string;episodeStart:boolean;preferences:Preferences;doc:Y.Doc;scene:Scene;number:number;active:boolean;autoFocus?:boolean;readOnly:boolean;provider?:{awareness:Awareness};user:{name:string;color:string};onActive:(id:string,editor?:Editor)=>void;onAdd:()=>void;onPasteScenes:(scenes:Scene[],after:string)=>void;onRemove:()=>void;findHits:FindMatch[];findCurrent?:FindMatch;onKind:(kind:Kind)=>void};
export function SceneEditor(p:Props){
 const readOnlyRef=useRef(p.readOnly);readOnlyRef.current=p.readOnly;
 const [typeMenu,setTypeMenu]=useState(false),[suggestions,setSuggestions]=useState<string[]>([]);
 const [kind,setKind]=useState<Kind>('action');
 const sectionRef=useRef<HTMLElement>(null),ime=useRef(false);
 const [composing,setComposing]=useState(false),[indicatorTop,setIndicatorTop]=useState<number>();
 const menuRef=useRef<HTMLDivElement>(null);
 const [menuPosition,setMenuPosition]=useState({left:0,top:0});
 const extension=useMemo(()=>Node.create({
  name:'scriptBlock',group:'block',content:'inline*',defining:true,
  addAttributes(){return {kind:{default:'action',parseHTML:el=>KINDS.includes(el.getAttribute('data-kind') as Kind)?el.getAttribute('data-kind'):'action'},characterId:{default:null}};},
  parseHTML(){return [{tag:'p[data-kind]'}, {tag:'p'}];},
  renderHTML({HTMLAttributes}){return ['p',mergeAttributes(HTMLAttributes,{'data-kind':HTMLAttributes.kind}),0];},
  addProseMirrorPlugins(){return [new Plugin({filterTransaction:tr=>!readOnlyRef.current||!tr.docChanged||isChangeOrigin(tr)})]},
  addKeyboardShortcuts(){const editor=this.editor;
   const convert=(k:Kind)=>{if(editor.view.composing)return false;editor.commands.updateAttributes('scriptBlock',{kind:k,characterId:null});return true;};
   return {
    Enter:()=>{
     if(editor.view.composing)return false;
     const {$from,empty}=editor.state.selection;
     const current=$from.parent.attrs.kind as Kind;
     const bracketed=current==='parenthetical'||(meta(p.doc).get('layout')==='shortDrama'&&current==='action'&&/^【(?:字幕|空镜)：.*】$/s.test($from.parent.textContent));
     if(!empty||(!bracketed&&$from.parentOffset!==$from.parent.content.size))return editor.commands.splitBlock();
     if(meta(p.doc).get('layout')==='shortDrama'){const name=finishShortCharacter(editor);if(name){registerCharacter(p.doc,name);return true;}}
     if(current==='character'&&$from.parent.textContent.trim()){
      const name=$from.parent.textContent.trim();const matches=characterNames(p.doc).filter(n=>n.startsWith(name)&&n!==name);
      if(matches.length===1){const start=$from.start();editor.commands.insertContentAt({from:start,to:start+$from.parent.content.size},matches[0]);}
      editor.commands.updateAttributes('scriptBlock',{characterId:registerCharacter(p.doc,editor.state.selection.$from.parent.textContent.trim())});
     }
     const next=nextKind(current,editor.state.selection.$from.parent.textContent);
     if(next==='scene'){p.onAdd();return true;}
     if(!$from.parent.textContent&&current==='character')return convert('action');
     if(next==='sequenceEnd'){let label='镜头段落';editor.state.doc.nodesBetween(0,$from.before(),node=>{if(node.attrs.kind==='montage')label='蒙太奇';if(node.attrs.kind==='sequence')label='连续镜头'});editor.chain().updateAttributes('scriptBlock',{kind:'sequenceEnd'}).insertContent(label).run();return true;}
     const pos=editor.state.selection.$from.after();
     const node=editor.schema.nodes.scriptBlock.create({kind:next});
     const tr=editor.state.tr.insert(pos,node);tr.setSelection(TextSelection.create(tr.doc,pos+1));editor.view.dispatch(tr.scrollIntoView());return true;
    },
    Tab:()=>{if(editor.view.composing)return false;
     // A mouse selection can reach the DOM before ProseMirror's selection observer.
     const selection=window.getSelection();if(selection?.anchorNode&&selection.focusNode&&editor.view.dom.contains(selection.anchorNode)&&editor.view.dom.contains(selection.focusNode)){
      const anchor=editor.view.posAtDOM(selection.anchorNode,selection.anchorOffset),head=editor.view.posAtDOM(selection.focusNode,selection.focusOffset);
      editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc,anchor,head)));
     }
     setTypeMenu(v=>!v);return true;},
   };
  }
 }),[p.doc,p.scene.id]);
 const editor=useEditor({extensions:[Document.extend({content:'scriptBlock+'}),Text,HardBreak,FontFamily,FindHighlights,ShortDramaInput.configure({enabled:()=>meta(p.doc).get('layout')==='shortDrama'}),ShortDramaDecorations,extension,Collaboration.extend({addKeyboardShortcuts(){return {'Mod-z':()=>readOnlyRef.current||this.editor.commands.undo(),'Mod-y':()=>readOnlyRef.current||this.editor.commands.redo(),'Mod-Shift-z':()=>readOnlyRef.current||this.editor.commands.redo()}}}).configure({document:p.doc,field:`scene:${p.scene.id}`}),Placeholder.configure({placeholder:({node})=>LABELS[node.attrs.kind as Kind]||''}),...(p.provider?[CollaborationCaret.configure({provider:p.provider,user:p.user})]:[])],editable:!p.readOnly,
  editorProps:{attributes:{class:'script-editor','aria-label':`第 ${p.number} 场文稿`,spellcheck:'false'},handleDOMEvents:{compositionstart:()=>{ime.current=true;setComposing(true);setSuggestions([]);setTypeMenu(false);return false},compositionend:()=>{ime.current=false;setComposing(false);return false}},transformCopied:(slice,view)=>preserveCopiedFonts(slice,view.state.schema,meta(p.doc).get('fontFamily')||'PingFang SC'),handlePaste(view,event,slice){
   if(p.readOnly)return true;
   if(event.clipboardData){const scenes=readSceneClipboard(event.clipboardData);if(scenes){event.preventDefault();p.onPasteScenes(scenes,p.scene.id);return true;}
    const html=event.clipboardData.getData('text/html');if(html&&new DOMParser().parseFromString(html,'text/html').querySelector('p[data-kind]')){event.preventDefault();const empty=!view.state.selection.$from.parent.textContent;const sourceKind=slice.content.firstChild?.attrs.kind;const different=sourceKind&&sourceKind!==view.state.selection.$from.parent.attrs.kind;view.dispatch(view.state.tr.replaceSelection(empty||different?new Slice(slice.content,0,0):slice).scrollIntoView());return true;}
   }
   const plain=event.clipboardData?.getData('text/plain');if(!plain)return false;
   event.preventDefault();const nodes=plain.replace(/\r\n/g,'\n').split('\n').map(text=>({type:'scriptBlock',attrs:{kind:view.state.selection.$from.parent.attrs.kind||'action'},content:text?[{type:'text',text}]:[]}));
   editor?.commands.insertContent(nodes);return true;
  }},
  onFocus:({editor})=>p.onActive(p.scene.id,editor),
  onSelectionUpdate:({editor})=>{const k=editor.state.selection.$from.parent.attrs.kind as Kind;setKind(k);p.onKind(k);p.onActive(p.scene.id,editor);},
  onUpdate:({editor})=>{const node=editor.state.selection.$from.parent;setKind(node.attrs.kind);p.onKind(node.attrs.kind);if(!ime.current&&!editor.view.composing&&node.attrs.kind==='character'&&node.textContent){setSuggestions(characterNames(p.doc).filter(n=>n!==node.textContent&&n.startsWith(node.textContent)).slice(0,5));}else setSuggestions([]);}
 },[p.doc,p.scene.id,p.provider]);
 useLayoutEffect(()=>{
  if(!typeMenu||!editor)return;
  const position=()=>{const rect=editor.view.coordsAtPos(editor.state.selection.from),menu=menuRef.current;if(!menu)return;const height=menu.offsetHeight,width=menu.offsetWidth;setMenuPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),top:rect.bottom+8+height<=window.innerHeight-12?rect.bottom+8:Math.max(12,rect.top-height-8)});};
  position();const node=editor.state.selection.$from.parent;const current=p.layout==='shortDrama'?currentShortMarker(node.attrs.kind,node.textContent)||node.attrs.kind:node.attrs.kind;const button=menuRef.current?.querySelector<HTMLButtonElement>(`[data-format="${current}"]`)||menuRef.current?.querySelector<HTMLButtonElement>('button');button?.focus({preventScroll:true});
  window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  const outside=(e:PointerEvent)=>{if(!menuRef.current?.contains(e.target as globalThis.Node))setTypeMenu(false)};
  document.addEventListener('pointerdown',outside);
  return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);document.removeEventListener('pointerdown',outside)};
 },[typeMenu,editor,p.layout]);
 useLayoutEffect(()=>{
  if(!editor||!p.active)return;
  let frame=0;
  const position=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{const section=sectionRef.current;if(!section||editor.isDestroyed)return;
   let rect=editor.view.coordsAtPos(editor.state.selection.head);
   const native=window.getSelection();if(native?.focusNode&&editor.view.dom.contains(native.focusNode)){const range=document.createRange();range.setStart(native.focusNode,native.focusOffset);range.collapse(true);const measured=range.getBoundingClientRect();if(measured.height)rect=measured;}
   const scale=section.getBoundingClientRect().width/section.offsetWidth;setIndicatorTop(((rect.top+rect.bottom)/2-section.getBoundingClientRect().top)/scale);
  })};
  position();editor.on('selectionUpdate',position);editor.on('transaction',position);editor.on('focus',position);
  document.addEventListener('selectionchange',position);window.addEventListener('resize',position);
  const observer=new ResizeObserver(position);observer.observe(editor.view.dom);if(sectionRef.current)observer.observe(sectionRef.current);
  void document.fonts.ready.then(()=>{if(!editor.isDestroyed)position()});
  return()=>{cancelAnimationFrame(frame);editor.off('selectionUpdate',position);editor.off('transaction',position);editor.off('focus',position);document.removeEventListener('selectionchange',position);window.removeEventListener('resize',position);observer.disconnect()};
 },[editor,p.active]);
 useEffect(()=>{if(!editor||editor.isDestroyed)return;const position=highlightMatches(editor,p.findHits.filter(h=>h.sceneId===p.scene.id),p.findCurrent);if(position!==undefined){const dom=editor.view.domAtPos(position).node;const element=dom instanceof Element?dom:dom.parentElement;element?.scrollIntoView({block:'center'});}},[editor,p.findHits,p.findCurrent]);
 useEffect(()=>{editor?.setEditable(!p.readOnly)},[p.readOnly,editor]);
 const setType=(k:Kind)=>{if(editor){editor.view.focus();changeBlockKind(editor,k);}setTypeMenu(false);setKind(k);p.onKind(k);};
 const menuItems=p.layout==='shortDrama'?[...FORMAT_COMMANDS.slice(0,4).map(c=>({...c,marker:false as const})),...SHORT_MARKERS.map(([id,label])=>({id,label,marker:true as const}))]:FORMAT_COMMANDS.map(c=>({...c,marker:false as const}));
 const selectedNode=editor?.state.selection.$from.parent;
 const selectedFormat=p.layout==='shortDrama'&&selectedNode?currentShortMarker(selectedNode.attrs.kind,selectedNode.textContent)||kind:kind;
 const currentLabel=menuItems.find(c=>c.id===selectedFormat)?.label||LABELS[kind];
 const headingFields=[<select key="0" aria-label={`第 ${p.number} 场内外景`} value={p.scene.setting} disabled={p.readOnly} onChange={e=>updateScene(p.doc,p.scene.id,{setting:e.target.value})}>{!['内景','外景','内/外景'].includes(p.scene.setting)&&<option>{p.scene.setting}</option>}<option>内景</option><option>外景</option><option>内/外景</option></select>,<input key="1" autoFocus={p.autoFocus} aria-label={`第 ${p.number} 场地点`} placeholder="场景地点" value={p.scene.location} disabled={p.readOnly} autoComplete="off" spellCheck={false} onChange={e=>updateScene(p.doc,p.scene.id,{location:e.target.value})} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();editor?.commands.focus('start');}}}/>,<select key="2" aria-label={`第 ${p.number} 场时间`} value={p.scene.time} disabled={p.readOnly} onChange={e=>updateScene(p.doc,p.scene.id,{time:e.target.value})}>{!['日','夜','晨','黄昏','连续','稍后'].includes(p.scene.time)&&<option>{p.scene.time}</option>}{['日','夜','晨','黄昏','连续','稍后'].map(t=><option key={t}>{t}</option>)}</select>];
 return <section ref={sectionRef} className={`scene-section ${p.active?'is-active':''}`} id={`scene-${p.scene.id}`} onClick={()=>p.onActive(p.scene.id,editor||undefined)}>
  {p.layout==='shortDrama'&&<div className="short-scene-meta"><label>第 <input aria-label={`第 ${p.number} 场集数`} type="number" min="1" max="9999" value={episodeOf(p.scene)} disabled={p.readOnly} onChange={e=>{const value=Number(e.target.value);if(Number.isInteger(value)&&value>=1&&value<=9999)updateScene(p.doc,p.scene.id,{episode:value})}}/> 集{!p.episodeStart&&<span className="short-continuation"> · 续场</span>}</label>{!p.readOnly&&<select aria-label={`第 ${p.number} 场短剧标注`} value="" onChange={e=>{if(editor&&e.target.value)insertShortMarker(editor,e.target.value as typeof SHORT_MARKERS[number][0]);}}><option value="" disabled>短剧标注</option>{SHORT_MARKERS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>}</div>}
  <div className="scene-heading-row">
   <span className="scene-number">{p.layout==='shortDrama'?p.shortNumber:String(p.number).padStart(2,'0')}</span>
   <div className="scene-heading-inputs">{p.layout==='commonChinese'?[headingFields[1],headingFields[2],headingFields[0]]:headingFields}</div>
   {!p.readOnly&&<div className="scene-options"><button className="icon-btn" title="隐藏场景" aria-label={`隐藏第 ${p.number} 场`} onClick={e=>{e.stopPropagation();p.onRemove()}}><Eye size={13} strokeWidth={1.5}/></button></div>}
  </div>
  {p.layout==='shortDrama'&&<label className="short-cast">人物：<input aria-label={`第 ${p.number} 场出场人物`} placeholder={sceneCast({...p.scene,cast:''})||'根据人物段落自动显示，可补充群演'} value={p.scene.cast||sceneCast({...p.scene,cast:''})} disabled={p.readOnly} onChange={e=>updateScene(p.doc,p.scene.id,{cast:e.target.value})}/></label>}
  <EditorContent editor={editor}/>
  {p.active&&!p.readOnly&&<div className="element-indicator" style={{top:indicatorTop,visibility:indicatorTop===undefined?'hidden':undefined}}><button title="Tab 切换格式" aria-label="当前段落格式" aria-expanded={typeMenu} onMouseDown={e=>e.preventDefault()} onClick={()=>setTypeMenu(!typeMenu)}><span className="format-indicator-label">{currentLabel||'描述/动作'}</span><ChevronDown size={12}/></button>{typeMenu&&createPortal(<div className="popover element-menu" role="menu" aria-label="段落格式" ref={menuRef} style={menuPosition} onKeyDown={e=>{const buttons=[...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];const index=buttons.indexOf(document.activeElement as HTMLButtonElement);if(['ArrowDown','ArrowUp','Tab'].includes(e.key)){e.preventDefault();const dir=e.key==='ArrowUp'||e.shiftKey?-1:1;buttons[(index+dir+buttons.length)%buttons.length]?.focus()}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setTypeMenu(false);editor?.view.focus()}}}>{menuItems.map(c=><button key={c.id} data-format={c.id} aria-current={selectedFormat===c.id?'true':undefined} className={selectedFormat===c.id?'selected':''} role="menuitem" onClick={()=>{if(c.marker){if(editor)insertShortMarker(editor,c.id);setTypeMenu(false);}else setType(c.id)}}>{c.label}{!c.marker&&<kbd>{shortcutLabel(p.preferences.shortcuts[c.id])}</kbd>}</button>)}</div>,document.body)}</div>}
  {!composing&&suggestions.length>0&&p.active&&<div className="character-suggestions" style={{top:indicatorTop===undefined?undefined:indicatorTop+18,bottom:'auto'}}>{suggestions.map(name=><button key={name} onMouseDown={e=>{e.preventDefault();if(!editor)return;const {$from}=editor.state.selection;editor.chain().focus().insertContentAt({from:$from.start(),to:$from.end()},name).run();setSuggestions([]);}}>{name}<span>人物补全</span></button>)}</div>}
 </section>;
}
