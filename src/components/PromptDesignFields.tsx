import {useRef,useState} from 'react';
import type * as Y from 'yjs';
import {Plus,Upload, X} from 'lucide-react';
import {PROMPT_FIELDS,type PromptFields} from '../core/prompt-types';
import {promptImages,importPromptImage} from '../core/prompt-images';
import {hasCharacter,mergeCharacters,removeCharacter,SHOT_SIZES,FOCAL_LENGTHS,CAMERA_ANGLES,CAMERA_MOVES} from '../core/prompt-composition';
import {PromptMentionInput} from './PromptMentionInput';
export function PromptDesignFields({doc,fields,onField,referenceIds,onReferences,readonly,characterOptions,onBusy}:{doc:Y.Doc;fields:PromptFields;onField:(key:keyof PromptFields,value:string)=>void;referenceIds:string[];onReferences:(ids:string[])=>void;readonly:boolean;characterOptions:string[];onBusy:(busy:boolean)=>void}){
 const upload=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[character,setCharacter]=useState('');
 const images=promptImages(doc).filter(image=>referenceIds.includes(image.id));
 const load=async(files:File[])=>{setError('');if(files.length+referenceIds.length>20){setError('每个镜头最多 20 张参考图');return}setBusy(true);onBusy(true);const ids=[...referenceIds];try{for(const file of files){const image=await importPromptImage(doc,file);ids.push(image.id)}}catch(e){setError((e as Error).message)}finally{onReferences(ids);setBusy(false);onBusy(false);if(upload.current)upload.current.value=''}};
 const input=(key:keyof PromptFields,rows=1,placeholder?:string)=><PromptMentionInput value={key==='characterAppearance'?(fields.characterAppearance??fields.characters):(fields[key]||'')} onChange={value=>onField(key,value)} images={images} label={`Prompt ${PROMPT_FIELDS.find(([k])=>k===key)![1]}`} rows={rows} readOnly={readonly} placeholder={placeholder}/>;
 const text=(key:keyof PromptFields,rows=2)=><label className="promote-field"><span>{PROMPT_FIELDS.find(([k])=>k===key)![1]}</span>{input(key,rows)}</label>;
 const choices=(key:'shotSize'|'focalLength'|'camera'|'movement',options:string[],multiple=false)=><fieldset className="promote-options"><legend>{PROMPT_FIELDS.find(([k])=>k===key)![1]}</legend><div className="promote-chips">{options.map(option=>{const values=(fields[key]||'').split(/[、，,；;\n]/).map(s=>s.trim()).filter(Boolean);return <label key={option}><input type={multiple?'checkbox':'radio'} name={`promote-${key}`} checked={multiple?values.includes(option):fields[key]===option} disabled={readonly} onChange={e=>onField(key,multiple?(e.target.checked?[...values,option]:values.filter(s=>s!==option)).join('，'):option)}/><span>{option}</span></label>})}</div>{input(key,1,'也可自定义')}</fieldset>;
 const add=()=>{if(character.trim()){onField('characters',mergeCharacters(fields.characters,[character.trim()]));setCharacter('')}};
 return <div className="prompt-flat-fields">
  <section className="prompt-reference-images"><div className="prompt-reference-heading"><h3>参考图</h3><button className="text-btn" disabled={readonly||busy} onClick={()=>upload.current?.click()}><Upload size={14}/>{busy?'处理中…':'上传'}</button><input ref={upload} type="file" aria-label="上传参考图" accept="image/png,image/jpeg,image/webp" multiple hidden disabled={readonly||busy} onChange={e=>void load(Array.from(e.target.files||[]))}/></div>
   {images.length>0&&<div className="prompt-reference-grid">{images.map(image=><div className="prompt-reference-card" key={image.id}><img src={image.dataUrl} alt={image.name}/><span>@{image.name}</span><button className="icon-btn" aria-label={`移除${image.name}`} disabled={readonly||busy} title="移除参考图" onClick={()=>{if(Object.values(fields).some(value=>value?.includes(`@${image.name}`))){setError(`请先移除字段中的 @${image.name} 引用`);return}onReferences(referenceIds.filter(id=>id!==image.id));setError('')}}><X size={12}/></button></div>)}</div>}
   {error&&<p role="alert" className="error-message">{error}</p>}
  </section>
  <section className="prompt-characters-field"><h3>人物及定妆照</h3><div className="promote-character-chips" role="group" aria-label="关联人物">{characterOptions.map(name=><label key={name}><input type="checkbox" disabled={readonly} checked={hasCharacter(fields.characters,name)} onChange={e=>onField('characters',e.target.checked?mergeCharacters(fields.characters,[name]):removeCharacter(fields.characters,name))}/><span>{name}</span></label>)}</div>
   <div className="promote-add-character"><input aria-label="添加人物" value={character} placeholder="添加其他人物" disabled={readonly} onChange={e=>setCharacter(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();add()}}}/><button className="text-btn" disabled={readonly||!character.trim()} onClick={add}><Plus size={13}/>添加</button></div>
   <p className="promote-hint">人物已智能关联</p>{input('characterAppearance',2)}
  </section>
  {text('model',1)}{text('content',3)}{choices('shotSize',SHOT_SIZES)}{choices('focalLength',FOCAL_LENGTHS)}{choices('camera',CAMERA_ANGLES,true)}{choices('movement',CAMERA_MOVES,true)}{text('shotSequence',4)}{text('sound')}{text('lighting')}{text('duration',1)}{text('continuity')}
 </div>;
}
