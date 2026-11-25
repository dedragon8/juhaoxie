import type * as Y from 'yjs';
import {newId,LOCAL} from './model';
export type PromptImage={id:string;name:string;filename:string;dataUrl:string;width:number;height:number};
export const MAX_PROMPT_IMAGE_BYTES=1024*1024;
export function validatePromptImages(value:unknown){
 if(value===undefined)return;
 if(!Array.isArray(value)||value.length>200)throw Error('参考图数据无效');
 let total=0;const ids=new Set<string>(),names=new Set<string>();
 for(const image of value){
  if(!image||typeof image.id!=='string'||!/^[-\w]{1,100}$/.test(image.id)||typeof image.name!=='string'||!/^参考图[1-9]\d{0,5}$/.test(image.name)||typeof image.filename!=='string'||image.filename.length>300||typeof image.dataUrl!=='string'||!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(image.dataUrl)||image.dataUrl.length>MAX_PROMPT_IMAGE_BYTES*1.4||!Number.isInteger(image.width)||!Number.isInteger(image.height)||image.width<1||image.height<1||image.width>1600||image.height>1600||ids.has(image.id)||names.has(image.name))throw Error('参考图数据无效');
  total+=image.dataUrl.length;ids.add(image.id);names.add(image.name);
 }
 if(total>24*1024*1024)throw Error('参考图总大小超过 24 MB');
}
export function promptImages(doc:Y.Doc){return [...doc.getMap<PromptImage>('promptImages').values()]}
export async function importPromptImage(doc:Y.Doc,file:File):Promise<PromptImage>{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('请选择 JPG、PNG 或 WebP 图片');
 if(file.size>20*1024*1024)throw Error('请选择小于 20 MB 的图片');
 const bitmap=await createImageBitmap(file);let dataUrl='',width=0,height=0;
 try{
  const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height));width=Math.max(1,Math.round(bitmap.width*ratio));height=Math.max(1,Math.round(bitmap.height*ratio));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d')!;context.fillStyle='#fff';context.fillRect(0,0,width,height);context.drawImage(bitmap,0,0,width,height);
  dataUrl=canvas.toDataURL('image/jpeg',.86);
  for(const quality of [.72,.55,.4]){if(dataUrl.length<=MAX_PROMPT_IMAGE_BYTES*1.4)break;dataUrl=canvas.toDataURL('image/jpeg',quality)}
 }finally{bitmap.close()}
 const existing=promptImages(doc),number=Math.max(0,...existing.map(i=>Number(i.name.slice(3))))+1;
 const image:PromptImage={id:newId(),name:`参考图${number}`,filename:file.name.slice(0,300),dataUrl,width,height};validatePromptImages([...existing,image]);
 doc.transact(()=>doc.getMap<PromptImage>('promptImages').set(image.id,image),LOCAL);return image;
}
