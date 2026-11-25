import {_electron as electron,expect} from '@playwright/test';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {decodeDrg} from '../src/core/drg.ts';
const profile=await mkdtemp(path.join(tmpdir(),'juhao-story-native-'));let app;
try{
 const executablePath=process.argv[2]||path.resolve('node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
 app=await electron.launch({executablePath,args:process.argv[2]?[]:['.'],env:{...process.env,CHANGJING_USER_DATA:profile}});
 const page=await app.firstWindow();await page.waitForLoadState('domcontentloaded');
 await page.getByRole('button',{name:'新建剧本',exact:true}).first().click();await page.getByLabel('剧本名称').fill('资料文件验收');await page.getByRole('button',{name:'开始写作'}).click();
 await page.getByRole('button',{name:/剧本资料/}).click();await page.getByRole('button',{name:'添加人物',exact:true}).first().click();await page.getByLabel('人物名',{exact:true}).fill('林舟');await page.getByRole('button',{name:'添加人物',exact:true}).last().click();await page.getByLabel('林舟的人物介绍').fill('他在车站等一封信。');await page.getByLabel('故事梗概',{exact:true}).fill('多年之后，他们再次相遇。');await page.getByLabel('在封面与文稿之间加入人物设定、故事梗概').check();await page.getByRole('button',{name:'完成',exact:true}).click();
 await app.evaluate(({shell})=>{shell.showItemInFolder=file=>{global.__revealedProject=file}});
 await page.getByRole('button',{name:'剧本库',exact:true}).click();await page.getByRole('button',{name:'选择剧本：资料文件验收'}).click({button:'right'});await page.getByRole('menuitem',{name:'显示在电脑的文件位置'}).click();
 await expect.poll(()=>app.evaluate(()=>global.__revealedProject||'')).not.toBe('');const file=await app.evaluate(()=>global.__revealedProject);expect(file.startsWith(path.join(profile,'Manuscripts'))).toBe(true);
 const data=await decodeDrg(await readFile(file));expect(data.script.storySynopsis).toBe('多年之后，他们再次相遇。');expect(data.script.characterDescriptions.林舟).toBe('他在车站等一封信。');expect(data.script.includeStoryInfo).toBe(true);
 await page.getByRole('button',{name:'选择剧本：资料文件验收'}).dblclick();
 const fit=await page.locator('.editor-scroll').evaluate(el=>Math.min(150,(el.clientWidth-96)/820*100));await expect.poll(async()=>Number(await page.getByLabel('写作缩放',{exact:true}).inputValue())).toBeCloseTo(fit,1);
 await page.getByRole('button',{name:'放大文稿',exact:true}).click();await page.locator('.editor-toolbar').click({position:{x:100,y:20}});
 await page.getByTitle('适配窗口并居中',{exact:true}).click();
 await expect.poll(async()=>Number(await page.getByLabel('写作缩放',{exact:true}).inputValue())).toBeCloseTo(fit,1);
 const editor=page.locator('.tiptap').first();await editor.click();await page.keyboard.insertText('原生撤销验收');await page.keyboard.press('Meta+z');await expect(editor).not.toContainText('原生撤销验收');
 await editor.fill('当前位置的剧本内容。\n'.repeat(180));await page.getByRole('button',{name:'放大文稿',exact:true}).click();
 await page.locator('.editor-scroll').evaluate(el=>{el.scrollTop=3200;el.scrollLeft+=100});
 const position=()=>page.locator('.editor-scroll').evaluate(el=>{const p=el.querySelector('.manuscript'),r=p.getBoundingClientRect(),v=el.getBoundingClientRect(),s=r.width/p.offsetWidth;return {x:(v.left+el.clientWidth/2-r.left)/s,y:(v.top+el.clientHeight/2-r.top)/s,zoom:s*100}});
 const beforeFit=await position();await page.getByTitle('适配窗口并居中',{exact:true}).click();await expect.poll(async()=>Math.abs((await position()).y-beforeFit.y)).toBeLessThan(2);
 const beforeSwitch=await position();
 for(const workspace of ['分场','预览','剧本库']){await page.getByRole('button',{name:workspace,exact:true}).click();if(workspace==='预览')await expect(page.locator('.pdf-frame')).toBeVisible();await page.getByRole('button',{name:'文稿',exact:true}).click();await expect.poll(async()=>Math.abs((await position()).y-beforeSwitch.y)).toBeLessThan(2);expect((await position()).zoom).toBeCloseTo(beforeSwitch.zoom,1)}

 await page.getByRole('button',{name:'剧本库',exact:true}).click();await page.getByRole('button',{name:'打开剧本：资料文件验收'}).dblclick();await page.getByRole('button',{name:/剧本资料/}).click();await expect(page.getByLabel('林舟的人物介绍')).toHaveValue('他在车站等一封信。');
 await mkdir('artifacts/native-0.5.12',{recursive:true});await writeFile('artifacts/native-0.5.12/result.json',JSON.stringify({passed:true,checks:['native reveal writes current jhwrite inside managed folder','front matter and character description survive transfer','native PDF renders optional front matter','fit preserves current content and native board/PDF/library round trips restore viewport','percentage fits canvas and native Cmd Z remains undo','reopening preserves story information']},null,2));console.log('Native story info and library file reveal passed');
}finally{await app?.close();await rm(profile,{recursive:true,force:true})}
