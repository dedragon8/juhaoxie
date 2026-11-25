import {Extension,type Editor} from '@tiptap/core';
import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import type {FindMatch} from './find-replace';
const key=new PluginKey<DecorationSet>('manuscript-find');
export const FindHighlights=Extension.create({name:'findHighlights',addProseMirrorPlugins(){return [new Plugin({key,state:{init:()=>DecorationSet.empty,apply:(tr,previous)=>tr.getMeta(key)??previous.map(tr.mapping,tr.doc)},props:{decorations:state=>key.getState(state)}})]}});
export function highlightMatches(editor:Editor,matches:FindMatch[],current?:FindMatch){const decorations:Decoration[]=[];let activePos:number|undefined;
 editor.state.doc.forEach((node,offset,index)=>{for(const hit of matches.filter(m=>m.field==='block'&&m.blockIndex===index)){const from=offset+1+hit.from,to=offset+1+hit.to;if(to>offset+1+node.content.size)continue;const active=hit.id===current?.id;decorations.push(Decoration.inline(from,to,{class:active?'find-hit find-hit-current':'find-hit'}));if(active)activePos=from;}});
 editor.view.dispatch(editor.state.tr.setMeta(key,DecorationSet.create(editor.state.doc,decorations)).setMeta('addToHistory',false));return activePos;
}
