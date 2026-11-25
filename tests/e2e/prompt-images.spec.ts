import {test,expect} from '@playwright/test';import {newScript} from './helpers';import {readFile} from 'node:fs/promises';import {decodeDrg} from '../../src/core/drg';
test('flat black fields, image upload, keyboard mentions in every field, and portable image persistence',async({page})=>{
 await page.goto('/');await newScript(page,'参考图验收');await page.locator('.tiptap').first().fill('她走进房间。');await page.getByRole('button',{name:'Prompt',exact:true}).click();
 await page.locator('.prompt-source-scroll').evaluate(el=>{const p=el.querySelector('[data-prompt-paragraph]')!,range=document.createRange();range.selectNodeContents(p);const selection=window.getSelection()!;selection.removeAllRanges();selection.addRange(range);el.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}))});
 const labels=page.locator('.prompt-flat-fields h3,.prompt-flat-fields .promote-field>span,.prompt-flat-fields legend');await expect(labels).toHaveText(['参考图','人物及定妆照','预使用生视频模型','画面','景别','焦段','机位','运镜','镜头组','声音/对话','光线与色调','时长','连续性与避免项']);for(const label of await labels.all())await expect(label).toHaveCSS('color','rgb(32, 33, 36)');
 await expect(page.locator('.promote-hint').first()).toHaveText('人物已智能关联');await page.getByLabel('上传参考图',{exact:true}).setInputFiles('public/mark.png');await expect(page.locator('.prompt-reference-card img')).toBeVisible();await expect(page.locator('.prompt-reference-card img')).toHaveJSProperty('naturalWidth',1024);
 for(const name of ['人物及定妆照','画面','景别','焦段','机位','运镜','声音/对话','光线与色调','时长','连续性与避免项']){
  const field=page.getByLabel(`Prompt ${name}`,{exact:true});await field.fill('@');await expect(page.getByRole('listbox',{name:'选择参考图'})).toBeVisible();await field.press('ArrowDown');await field.press('Enter');await expect(field).toHaveValue('@参考图1 ');
 }
 await expect(page.getByLabel('完整 Prompt',{exact:true})).toHaveValue(/@参考图1/);await page.getByRole('button',{name:'保存镜头',exact:true}).click();await page.locator('.prompt-editor').evaluate(el=>el.scrollTop=0);await page.screenshot({path:'artifacts/prompt-flat-images.png'});
 await page.getByRole('button',{name:'参考图验收',exact:true}).click();const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'保存剧本文件（.jhwrite）',exact:true}).click();const download=await downloading;const file=await decodeDrg(new Uint8Array(await readFile((await download.path())!)));expect(file.script.promptImages).toHaveLength(1);expect(file.script.videoPrompts?.at(-1)?.referenceImageIds).toEqual([file.script.promptImages![0].id]);
 await page.reload();await page.getByRole('button',{name:'选择剧本：参考图验收',exact:true}).dblclick();await page.getByRole('button',{name:'Prompt',exact:true}).click();await page.getByRole('button',{name:'镜头 1',exact:true}).click();await expect(page.locator('.prompt-reference-card img')).toBeVisible();await expect(page.getByLabel('Prompt 运镜',{exact:true})).toHaveValue('@参考图1 ');
});
test('Prompt original shares the manuscript typography in all four formats',async({page})=>{
 await page.goto('/');await newScript(page,'原文排版验收');const editor=page.locator('.tiptap').first();await editor.fill('她走到门口。');await editor.press('Enter');await editor.press('Meta+1');await page.keyboard.insertText('小林');await editor.press('Enter');await page.keyboard.insertText('你好。');
 for(const name of ['好莱坞格式','常见中文','优化中文','短剧']){
  await page.getByRole('button',{name:'文稿',exact:true}).click();await page.getByLabel('打开设置',{exact:true}).click();await page.locator('.layout-options>button').filter({has:page.locator('strong',{hasText:name})}).click();await page.getByRole('button',{name:'关闭',exact:true}).click();
  const before=await editor.locator('p').evaluateAll(ps=>ps.map(p=>{const s=getComputedStyle(p);return [s.lineHeight,s.marginTop,s.marginBottom,s.fontWeight,s.fontFamily,s.cssFloat]}));
  await page.getByRole('button',{name:'Prompt',exact:true}).click();const after=await page.locator('[data-prompt-paragraph]').evaluateAll(ps=>ps.map(p=>{const s=getComputedStyle(p);return [s.lineHeight,s.marginTop,s.marginBottom,s.fontWeight,s.fontFamily,s.cssFloat]}));expect(after).toEqual(before);
 }
});
