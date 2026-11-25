import type {PromptFields} from './prompt-types';
import type {PromptImage} from './prompt-images';
import {promptCharacterChips} from './prompt-composition';

// Reject malformed Agent output instead of silently rewriting user content or dialogue.
export function validateAgentPrompt(fields:Partial<PromptFields>|undefined,prompt:string,images:PromptImage[],referenceIds:string[]){
 const names=fields?.characters?.split(/[、，,；;\n]/).map(s=>s.trim()).filter(Boolean)||[];
 if(names.some(name=>!promptCharacterChips(name).includes(name)))throw Error('人物标签字段只能写姓名；人物及定妆照由用户在 characterAppearance 中填写。请重新读取 get_video_prompt_skill。');
 if(/【人物设定】/.test(prompt))throw Error('不要追加人物设定；只使用用户在人物及定妆照中填写的内容。请重新读取 get_video_prompt_skill。');
 const output=[prompt,...Object.entries(fields||{}).filter(([key])=>key!=='aspectRatio'&&key!=='model').map(([,value])=>value)].join('\n');
 if(/待确定|待补充|待确认|是否原生生成取决于|除标明原文指定的部分外|[（(](?:建议|原文指定|全画幅等效建议)[）)]/.test(output))throw Error('Prompt 含占位或解释性文字；请省略未知项，按 get_video_prompt_skill 输出可直接使用的文本。');
 if(fields?.aspectRatio?.trim()||/画幅\s*[:：]/.test(prompt))throw Error('Prompt 不包含画幅；请将 aspectRatio 留空。');
 const selected=images.filter(image=>referenceIds.includes(image.id));
 if(referenceIds.some(id=>!images.some(image=>image.id===id)))throw Error('参考图不存在，请重新读取 read_prompt_sources。');
 for(const token of output.match(/@参考图\d+/g)||[])if(!selected.some(image=>'@'+image.name===token))throw Error('引用的参考图未关联：'+token+'。请读取图片并设置 reference_image_ids。');
 for(const image of selected)if(!new RegExp('@'+image.name+'(?![\\d])').test(prompt))throw Error('完整 Prompt 缺少 @'+image.name+'，请在对应内容处锚定参考图。');
}
