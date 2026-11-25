import {shortParagraphClasses} from './short-drama';
import type {Kind} from './model';
import {Extension,type Editor} from '@tiptap/core';
import {Plugin,TextSelection} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import {isChangeOrigin} from '@tiptap/extension-collaboration';
import {isSpecialAction,type ShortMarker} from './short-drama';

export const ShortDramaInput=Extension.create<{enabled:()=>boolean}>({
 name:'shortDramaInput',addOptions(){return {enabled:()=>false}},
 addProseMirrorPlugins(){const editor=this.editor,enabled=this.options.enabled;let pending:ReturnType<typeof setTimeout>|undefined;
  return [new Plugin({
   props:{handleDOMEvents:{compositionend(view){
    clearTimeout(pending);pending=setTimeout(()=>{if(!editor.isDestroyed&&!view.composing&&editor.isEditable&&enabled())view.dispatch(view.state.tr.setMeta('shortDramaInput',true));},0);return false;
   }}},view(){return {destroy(){clearTimeout(pending)}}},
   appendTransaction(transactions,_old,state){
    if(!enabled()||!editor.isEditable||editor.view.composing||!transactions.some(t=>(t.docChanged&&!isChangeOrigin(t))||t.getMeta('shortDramaInput')))return;
    const {$from}=state.selection;if($from.depth!==1)return;
    let node=$from.parent;const pos=$from.before();
    if(!['character','action','parenthetical'].includes(node.attrs.kind))return;
    const tr=state.tr;let text=node.textContent;
    // A suffix on a cue is shorthand, not an English word ending in these letters (e.g. Carlos).
    const bare=node.attrs.kind!=='parenthetical'?/^([^（）()\n：:，。！？、；,!?;]+?)(os|vo)(?:([：:])([\s\S]*))?$/i.exec(text):null;
    if(bare&&bare[1].trim()&&!/[a-z]$/i.test(bare[1])){
     const start=pos+1+bare[1].length;
     for(let i=0;i<2;i++)if(bare[2][i]!==bare[2][i].toUpperCase())tr.insertText(bare[2][i].toUpperCase(),start+i,start+i+1);
     tr.insertText('）',start+2).insertText('（',start);
     tr.setNodeMarkup(pos,undefined,{...node.attrs,kind:'character',characterId:null});
     tr.setSelection(TextSelection.create(tr.doc,tr.mapping.map(state.selection.anchor),tr.mapping.map(state.selection.head)));
     node=tr.doc.nodeAt(pos)!;text=node.textContent;
    }
    const {anchor,head}=tr.selection;
    const full=/^([^（）()\n：:]+)([（(]\s*(os|vo)\s*[）)])\s*[:：]([\s\S]*)$/i.exec(text);
    const standalone=node.attrs.kind==='parenthetical'?/^(?:[（(]\s*)?(os|vo)(?:\s*[）)])?$/i.exec(text):null;
    const cue=/^([^（）()\n：:]+)[（(]\s*(os|vo)\s*[）)]$/i.exec(text);
    if(!full&&!standalone&&!cue)return tr.docChanged?tr:undefined;
    // Same-length replacements retain inline font marks and all existing text offsets.
    const token=full?.[3]||standalone?.[1]||cue![2];
    const tokenStart=standalone?text.toLowerCase().indexOf(token.toLowerCase()):text.search(/[（(]/)+1+text.slice(text.search(/[（(]/)+1).search(/\S/);
    for(let i=0;i<token.length;i++)if(token[i]!==token[i].toUpperCase())tr.insertText(token[i].toUpperCase(),pos+1+tokenStart+i,pos+2+tokenStart+i);
    if(full){
     const normalized=tr.doc.nodeAt(pos)!,nameEnd=full[1].length,asideEnd=nameEnd+full[2].length,bodyStart=text.length-full[4].length;
     const character=state.schema.nodes.scriptBlock.create({kind:'character',characterId:null},normalized.content.cut(0,nameEnd));
     const aside=state.schema.nodes.scriptBlock.create({kind:'parenthetical'},normalized.content.cut(nameEnd,asideEnd));
     const dialogue=state.schema.nodes.scriptBlock.create({kind:'dialogue'},normalized.content.cut(bodyStart));
     const mapFrom=tr.mapping.maps.length;tr.replaceWith(pos,pos+node.nodeSize,[character,aside,dialogue]);
     const map=(old:number)=>{const offset=old-pos-1;if(offset<0||offset>node.content.size)return tr.mapping.slice(mapFrom).map(old);if(offset<nameEnd)return pos+1+offset;if(offset<asideEnd)return pos+character.nodeSize+1+offset-nameEnd;return pos+character.nodeSize+aside.nodeSize+1+Math.max(0,offset-bodyStart)};
     tr.setSelection(TextSelection.create(tr.doc,map(anchor),map(head)));
    }
    return tr.docChanged?tr:undefined;
   }
  })];
 }
});

export function currentShortMarker(kind:string,text:string):ShortMarker|undefined{
 if(kind==='parenthetical'){
  if(/^[（(]?OS(?:[）)]|\s|$)/i.test(text))return 'os';
  if(/^[（(]?VO(?:[）)]|\s|$)/i.test(text))return 'vo';
 }
 if(kind==='action'){
  if(/^【字幕：/.test(text))return 'subtitle';
  if(/^【空镜：/.test(text))return 'emptyShot';
  if(text==='闪回')return 'flashback';
  if(text==='闪回结束')return 'flashbackEnd';
 }
}

// Split only when the writer finishes a character cue with Enter, never during IME composition.
export function finishShortCharacter(editor:Editor):string|undefined{
 const {$from,empty}=editor.state.selection,node=$from.parent;
 if(!empty||node.attrs.kind!=='character'||$from.parentOffset!==node.content.size)return;
 const match=/^([^（）()\n]+?)\s*((?:[（(][^（）()\n]*[）)]\s*)+)[:：]?$/.exec(node.textContent);
 if(!match||!match[1].trim())return;
 const name=match[1].trim(),nameStart=node.textContent.indexOf(name),parenStart=node.textContent.search(/[（(]/);
 const parenEnd=parenStart+match[2].trimEnd().length;
 const cue=editor.schema.nodes.scriptBlock.create({...node.attrs,characterId:null},node.content.cut(nameStart,nameStart+name.length));
 const aside=editor.schema.nodes.scriptBlock.create({kind:'parenthetical'},node.content.cut(parenStart,parenEnd));
 const dialogue=editor.schema.nodes.scriptBlock.create({kind:'dialogue'}),pos=$from.before();
 const tr=editor.state.tr.replaceWith(pos,$from.after(),[cue,aside,dialogue]);
 tr.setSelection(TextSelection.create(tr.doc,pos+cue.nodeSize+aside.nodeSize+1));
 editor.view.dispatch(tr.scrollIntoView());return name;
}

export const ShortDramaDecorations=Extension.create({name:'shortDramaDecorations',addProseMirrorPlugins(){return [new Plugin({props:{decorations(state){
 const decorations:Decoration[]=[];const blocks:{kind:Kind;text:string}[]=[];state.doc.forEach(node=>blocks.push({kind:node.attrs.kind,text:node.textContent}));
 state.doc.forEach((node,pos,index)=>{
  const classes=shortParagraphClasses(blocks,index);
  if(classes.length)decorations.push(Decoration.node(pos,pos+node.nodeSize,{class:classes.join(' ')}));
 });return DecorationSet.create(state.doc,decorations);
}}})]}});

export function insertShortMarker(editor:Editor,marker:ShortMarker){
 const {$from}=editor.state.selection;
 if(currentShortMarker($from.parent.attrs.kind,$from.parent.textContent)===marker){
  const inside=['os','vo','subtitle','emptyShot'].includes(marker)&&/[）)】]$/.test($from.parent.textContent);
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc,$from.end()-(inside?1:0))));editor.view.focus();return;
 }
 const speech=marker==='os'||marker==='vo';
 const text=speech?`（${marker.toUpperCase()}）`:marker==='subtitle'?'【字幕：】':marker==='emptyShot'?'【空镜：】':marker==='flashback'?'闪回':'闪回结束';
 // A dedicated paragraph is inserted; existing selected text is never replaced.
 const empty=!$from.parent.textContent;
 const pos=empty?$from.before():$from.after();
 const node=editor.schema.nodes.scriptBlock.create({kind:speech?'parenthetical':'action'},editor.schema.text(text));
 let tr=editor.state.tr;
 if(empty)tr=tr.replaceWith($from.before(),$from.after(),node);else tr=tr.insert(pos,node);
 const inside=marker==='subtitle'||marker==='emptyShot'||speech;
 tr.setSelection(TextSelection.create(tr.doc,pos+1+text.length-(inside?1:0)));
 editor.view.dispatch(tr.scrollIntoView());editor.view.focus();
}
