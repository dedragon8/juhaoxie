import {Fragment,Slice,type Node as PMNode} from '@tiptap/pm/model';
import type {Schema} from '@tiptap/pm/model';
import {validateScript,type Script,type Scene} from './model';
import {DEFAULT_FONT,validFont} from './fonts';
export const SCENE_CLIPBOARD='application/x-juhaoxie-scenes+json';
export function sceneClipboard(script:Script){
 const scenes=script.scenes.filter(s=>!s.deleted).map(s=>({
  ...(s.name?{name:s.name}:{}),episode:s.episode,cast:s.cast,setting:s.setting,location:s.location,time:s.time,
  blocks:s.blocks.map(b=>({kind:b.kind,text:b.text,runs:(b.runs||[{text:b.text}]).map(r=>({...r,fontFamily:r.fontFamily||script.fontFamily||DEFAULT_FONT}))}))
 }));
 return JSON.stringify({version:1,scenes});
}

export function parseSceneClipboard(raw:string):Scene[]|null{
 try{if(raw.length>30_000_000)return null;const data=JSON.parse(raw);if(data.version!==1||!Array.isArray(data.scenes))return null;
 const script={schemaVersion:1,title:'',author:'',contact:'',characters:{},scenes:data.scenes};validateScript(script);
 return script.scenes.map(s=>({id:'',order:'',deleted:false,summary:'',notes:'',...(s.name?{name:s.name}:{}),...(s.episode?{episode:s.episode}:{}),...(s.cast?{cast:s.cast}:{}),setting:s.setting,location:s.location,time:s.time,blocks:s.blocks.map(b=>({kind:b.kind,text:b.text,...(b.runs?{runs:b.runs.map(r=>({text:r.text,fontFamily:r.fontFamily}))}:{})}))}));
 }catch{return null}
}
export function readSceneClipboard(data:DataTransfer){
 const custom=data.getData(SCENE_CLIPBOARD);if(custom){const scenes=parseSceneClipboard(custom);if(scenes)return scenes;}
 const html=data.getData('text/html');if(!html||html.length>60_000_000)return null;
 const value=new DOMParser().parseFromString(html,'text/html').querySelector('[data-juhaoxie-scenes]')?.getAttribute('data-juhaoxie-scenes');
 try{return value?parseSceneClipboard(decodeURIComponent(value)):null}catch{return null}
}
// Resolve the source document's default font when copying, so a different destination font cannot replace it.
export function preserveCopiedFonts(slice:Slice,schema:Schema,defaultFont:string){
 const visit=(node:PMNode):PMNode=>{if(node.isText){if(node.marks.some(m=>m.type.name==='fontFamily'))return node;return node.mark([...node.marks,schema.marks.fontFamily.create({family:validFont(defaultFont)?defaultFont:DEFAULT_FONT})]);}
 const children:PMNode[]=[];node.forEach(child=>children.push(visit(child)));return node.type.create({...node.attrs,...(node.type.name==='scriptBlock'?{characterId:null}:{})},Fragment.fromArray(children),node.marks);};
 const nodes:PMNode[]=[];slice.content.forEach(node=>nodes.push(visit(node)));return new Slice(Fragment.fromArray(nodes),slice.openStart,slice.openEnd);
}
