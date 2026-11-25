import {Mark,mergeAttributes,type Editor} from '@tiptap/core';
import {TextSelection} from '@tiptap/pm/state';
import {validFont,fontStack} from './fonts';
import type {Kind} from './model';
export const FontFamily=Mark.create({name:'fontFamily',addAttributes(){return {family:{default:null}}},parseHTML(){return [{tag:'span[data-font]',getAttrs:element=>({family:(element as HTMLElement).dataset.font})}]},renderHTML({HTMLAttributes}){const family=HTMLAttributes.family;return ['span',mergeAttributes({'data-font':family,style:`font-family:${fontStack(family)}`}),0]}});
export function changeBlockKind(editor:Editor,kind:Kind){
 editor.commands.updateAttributes('scriptBlock',{kind,characterId:null});
 if(kind!=='parenthetical')return;
 const {$from}=editor.state.selection,node=$from.parent,text=node.textContent;
 if(/^[（(].*[）)]$/s.test(text)){editor.commands.setTextSelection($from.end()-1);return;}
 // Insert punctuation separately so inline font marks survive changing the element type.
 const tr=editor.state.tr.insertText('）',$from.end()).insertText('（',$from.start());
 tr.setSelection(TextSelection.create(tr.doc,$from.end()+1));editor.view.dispatch(tr);
}
export function setTextFont(editor:Editor,font:string){if(validFont(font))editor.chain().focus().setMark('fontFamily',{family:font}).run();else editor.chain().focus().unsetMark('fontFamily').run();}
