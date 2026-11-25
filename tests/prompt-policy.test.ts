import test from 'node:test';import assert from 'node:assert/strict';import * as Y from 'yjs';
import {composeVideoPrompt,promptSources,videoPrompts} from '../src/core/video-prompts';
import {emptyPromptFields} from '../src/core/prompt-types';
import {normalizePromptFields,charactersInAppearance,promptCharacterChips} from '../src/core/prompt-composition';
import {addScene,snapshot,fromSnapshot} from '../src/core/model';
import {executeAssistant} from '../src/core/assistant';
import {validateAgentPrompt} from '../src/core/prompt-policy';
import {connectedAgents} from '../src/components/AgentConnections';

test('complete prompt skips empty details and aspect/model metadata, never imports character descriptions',()=>{
 const fields={...emptyPromptFields(),characters:'琳娜、大王',content:'琳娜（@参考图1）回头。',focalLength:'35mm（原文指定）',lighting:'待确定',aspectRatio:'16:9',model:'用户填写的模型'};
 const result=composeVideoPrompt(fields,{characterDescriptions:{琳娜:'黑色短发。',大王:'',白:'红衣。'},referenceNames:['参考图1','参考图2']});
 assert.ok(!/待确定|原文指定|画幅|16:9|用户填写的模型|红衣|【光线/.test(result));assert.match(result,/【镜头】焦段：35mm/);assert.ok(!/人物设定|黑色短发/.test(result));assert.equal(result.match(/@参考图1/g)?.length,1);assert.match(result,/【参考图】@参考图2/);assert.equal(composeVideoPrompt(emptyPromptFields()),'');
 assert.match(composeVideoPrompt({...fields,content:'@参考图10'},{referenceNames:['参考图1']}),/【参考图】@参考图1/);
});
test('old descriptive sentences never become person chips; explicit names still work',()=>{
 assert.deepEqual(promptCharacterChips('琳娜、大王、俊。琳娜为艺术学院大四学生、三人的具体外观与服装待确定。',['俊','白']),['俊','白','琳娜','大王']);
});
test('Agent output validation rejects placeholders, commentary, character sentences, fake/missing image anchors',()=>{
 for(const prompt of ['【光线】待确定','35mm（建议）','声音是否原生生成取决于所用模型','画幅：16:9'])assert.throws(()=>validateAgentPrompt({},prompt,[],[]));
 assert.throws(()=>validateAgentPrompt({characters:'琳娜。热情大方'},'她回头',[],[]),/姓名/);
 assert.throws(()=>validateAgentPrompt({},'人物 @参考图1',[],[]),/未关联/);
 const images=[{id:'img',name:'参考图1',filename:'a.png',width:1,height:1,dataUrl:'data:image/png;base64,YQ=='}];
 assert.throws(()=>validateAgentPrompt({},'人物 @参考图10',images,['img']),/未关联/);
 assert.throws(()=>validateAgentPrompt({},'人物转身',images,['img']),/缺少/);
 assert.doesNotThrow(()=>validateAgentPrompt({characters:'琳娜',model:'用户选用模型'},'琳娜（@参考图1）回头',images,['img']));
});
test('one Prompt can store a multi-shot video with one source, preserve group/model in transfers, and supply latest Skill',()=>{
 const doc=new Y.Doc();addScene(doc,undefined,{blocks:[{kind:'action',text:'两人交谈。'}]});const scene=promptSources(doc)[0],p=scene.paragraphs[0];
 const source=[{sceneId:scene.id,paragraphId:p.paragraphId,paragraphIndex:0,start:0,end:p.text.length,text:p.text,paragraphText:p.text}];
 const fields={...emptyPromptFields(),characters:'甲、乙',characterAppearance:'甲：白衣；乙：黑衣',model:'用户模型',shotSize:'中近景',shotSequence:'镜头1：甲说话。\n镜头2：切到乙的反打，保持视线方向。'};
 const prompt=composeVideoPrompt(fields);assert.match(prompt,/【镜头组】镜头1/);assert.match(prompt,/【共同镜头设定】景别：中近景/);assert.ok(!prompt.includes('用户模型'));
 const args={request_id:'group-test',expected_revision:null,source,fields,prompt};executeAssistant(doc,{projectId:'test',name:'save_video_prompt',write:true,args},()=>{});const saved=videoPrompts(doc);assert.equal(saved.length,1);assert.equal(saved[0].fields.shotSequence,fields.shotSequence);const copy=fromSnapshot(snapshot(doc));assert.equal(videoPrompts(copy)[0].fields.model,fields.model);assert.equal(videoPrompts(copy)[0].fields.characterAppearance,fields.characterAppearance);assert.equal(videoPrompts(copy)[0].fields.shotSequence,fields.shotSequence);
 const read=executeAssistant(doc,{projectId:'test',name:'read_prompt_sources',write:false,args:{}},()=>{}) as any;assert.equal(read.promptSkill.version,'1.3.1');assert.match(read.promptSkill.skill,/一条 Prompt 对应一次生成的一段视频/);assert.match(read.promptSkill.skill,/没有的信息直接省略/);
});
test('connection badges require a live authorized project and do not label unknown clients as Codex',()=>{
 const state={enabled:true,projectId:'a',allowWrite:false,clients:['codex-mcp-client','Codex Desktop','Claude Code','工具'],lastCall:'',lastError:'',config:{command:'',args:[],env:{}}};
 assert.deepEqual(connectedAgents(state,'a').map(a=>[a.kind,a.access]),[['codex','只读'],['claude','只读'],['other','只读']]);assert.deepEqual(connectedAgents(state,'b'),[]);assert.deepEqual(connectedAgents({...state,enabled:false},'a'),[]);assert.deepEqual(connectedAgents({...state,clients:[]},'a'),[]);
});

test('user appearance text controls the people section, keeps names separate, and can be cleared',()=>{
 const fields={...emptyPromptFields(),characters:'俊',characterAppearance:'俊@参考图4，白色衬衫'};
 assert.deepEqual(charactersInAppearance(fields.characterAppearance,['白','俊']),['俊']);
 const legacy=normalizePromptFields({...emptyPromptFields(),characters:'俊@参考图4'},['俊','白']);assert.equal(legacy.characters,'俊');assert.equal(legacy.characterAppearance,'俊@参考图4');
 assert.deepEqual(charactersInAppearance('大王（黑衣）\n琳娜：红裙，@参考图1',['王','大王','琳娜']),['大王','琳娜']);
 const full=composeVideoPrompt(fields,{characterDescriptions:{俊:'大学生'},referenceNames:['参考图4']});
 assert.equal(full,'【人物】俊@参考图4，白色衬衫');
 assert.equal(composeVideoPrompt({...fields,characterAppearance:''}),'');
 assert.equal(composeVideoPrompt({...emptyPromptFields(),characters:'俊'}),'【人物】俊');
 assert.throws(()=>validateAgentPrompt({},'【人物设定】俊：白衣',[],[]),/不要追加/);
});
