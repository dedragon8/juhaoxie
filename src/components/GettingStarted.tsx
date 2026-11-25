import {useState} from 'react';
import {BookOpen,Type,FolderOpen,Film,Download,ChevronRight} from 'lucide-react';
import {Modal} from './Modal';
export const GUIDE_KEY='juhaoxie-getting-started-v1';
export function needsGuide(projectCount:number){try{return projectCount===0&&!localStorage.getItem(GUIDE_KEY)}catch{return false}}
const steps=[
 {title:'从一个剧本开始',label:'剧本库',icon:BookOpen,lead:'剧本库是你的起点。',tips:['可先打开《落水狗》节选演示，也可点击“新建剧本”，输入名称开始写作；已有 .jhwrite 文件可直接打开。','双击剧本进入文稿；右键可删除或显示文件位置。','日常修改自动保存到这台电脑。']},
 {title:'写内容，格式交给工具',label:'文稿',icon:Type,lead:'不用手工对齐人物和对白。',tips:['在文稿中按 Tab，用 ↑ ↓ 选择段落类型，再按回车确认。','人物名写好后按回车继续对白；⌘0 添加场景。','设置 → 剧本格式，可选好莱坞格式、常见中文、优化中文或短剧。']},
 {title:'把故事整理成幕与场景',label:'结构',icon:FolderOpen,lead:'目录负责组织，分场负责总览。',tips:['在“幕管理”中新建幕，把场景拖入对应目录；点击幕名前的箭头展开或收起。','在“分场”填写梗概，拖动卡片调整顺序。','单击目录里的场景跳到开头，双击场景名称可重命名。']},
 {title:'从剧本片段设计镜头',label:'Prompt',icon:Film,lead:'一段原文，可以对应多个镜头。',tips:['进入 Prompt，在左侧拖选一句或多段原文，建立镜头。','填写人物、内容、景别、焦段、声音等，底部自动汇总完整 Prompt。','切换镜头会自动保存；点击镜头可查看对应原文，也能复制或导出全文。']},
 {title:'保存副本，带走你的作品',label:'保存与接入',icon:Download,lead:'自动保存之外，也记得保存文件副本。',tips:['⌘⇧S 保存 .jhwrite 文件，可在另一台电脑的剧好写中继续编辑。','在“预览”导出 PDF 或 Word；Prompt 支持 PDF、Word、TXT。','Agent 接入是可选功能：设置 → 接入 Agent。保密剧本可放入安全区，禁止 Agent 访问；iCloud 协作已关闭。']},
];
function GuidePreview({step}:{step:number}){
 if(step===0)return <div className="guide-demo-library"><div><BookOpen/><strong>我的第一个剧本</strong><span>双击打开</span></div><div><span className="guide-plus">＋</span><strong>新建剧本</strong></div></div>;
 if(step===1)return <div className="guide-demo-script"><b>01　内景　车站　日</b><p>雨停了，站台恢复安静。</p><div><b>林舟</b><p>我们走吧。</p></div><span className="guide-key"><kbd>Tab</kbd> 人物 · 描述/动作 · 对白</span></div>;
 if(step===2)return <div className="guide-demo-tree"><b>⌄　第一幕</b><span>01　相遇</span><span>02　决定出发</span><b>⌄　第二幕</b><span>03　意外来客</span><small>拖动场景，调整所属幕</small></div>;
 if(step===3)return <div className="guide-demo-prompt"><p>林舟<mark>放下手机，望向门口。</mark></p><ChevronRight/><div><strong>镜头 01</strong><p>中近景 · 50mm · 缓慢推进</p><p>林舟放下手机，抬头望向门口，停在注视门口的状态。</p></div></div>;
 return <div className="guide-demo-files"><BookOpen size={36}/><strong>我的剧本.jhwrite</strong><span>继续编辑</span><div><span>PDF</span><span>Word</span><span>TXT · Prompt</span></div><small>导出与分享</small></div>;
}
export function GettingStarted({onClose}:{onClose:()=>void}){
 const [step,setStep]=useState(0),current=steps[step],Icon=current.icon;
 return <Modal title="新手引导" wide onClose={onClose}><div className="getting-started"><nav className="guide-progress" aria-label="引导步骤">{steps.map((item,index)=><button key={item.label} aria-current={step===index?'step':undefined} onClick={()=>setStep(index)}><span>{index+1}</span>{item.label}</button>)}</nav><div className="guide-content"><div className="guide-preview" aria-label="操作示意"><GuidePreview step={step}/></div><section aria-live="polite"><Icon size={24}/><p className="guide-count">{step+1} / {steps.length}</p><h3>{current.title}</h3><p>{current.lead}</p><ol>{current.tips.map(tip=><li key={tip}>{tip}</li>)}</ol></section></div><div className="modal-actions guide-actions"><button className="text-btn" onClick={onClose}>跳过引导</button><span/><button className="secondary" disabled={step===0} onClick={()=>setStep(step-1)}>上一步</button><button className="primary" onClick={()=>step===steps.length-1?onClose():setStep(step+1)}>{step===steps.length-1?'开始使用':'下一步'}</button></div><p className="guide-return">设置 → 关于与版权 → 新手引导，可随时重新查看。</p></div></Modal>;
}
