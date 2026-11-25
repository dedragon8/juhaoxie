import {test,expect} from '@playwright/test';import {newScript} from './helpers';
test('four formats preserve writing; common film uses numbered headings and inline dialogue',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await newScript(page,'四种格式');await page.getByLabel('第 1 场地点').fill('餐馆');await page.getByLabel('第 1 场地点').press('Enter');const editor=page.locator('.tiptap').first();
 await editor.fill('咖啡凉了。');await editor.press('Enter');await editor.press('Meta+1');await page.keyboard.insertText('白先生');await editor.press('Enter');await editor.press('Meta+4');await page.keyboard.insertText('轻声');await editor.press('Enter');await page.keyboard.insertText('我们走吧。');
 const original=await editor.locator('p').allTextContents();
 const choose=async(name:string)=>{await page.getByLabel('打开设置',{exact:true}).click();await page.getByRole('dialog').locator('.layout-options>button').filter({has:page.locator('strong',{hasText:name})}).click();await page.getByRole('button',{name:'关闭',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0)};
 await choose('常见中文');await expect(page.locator('.manuscript')).toHaveAttribute('data-layout','commonChinese');await expect(page.locator('.short-scene-meta')).toHaveCount(0);await expect(page.locator('.short-cast')).toHaveCount(0);
 const geometry=await editor.evaluate(el=>{const c=el.querySelector('[data-kind=character]')!,p=el.querySelector('[data-kind=parenthetical]')!,d=el.querySelector('[data-kind=dialogue]')!;const top=(node:Element)=>{const range=document.createRange();range.selectNodeContents(node);return range.getClientRects()[0].top};return {cue:top(c),paren:top(p),dialogue:top(d),indent:getComputedStyle(c).textIndent,font:getComputedStyle(c).fontSize,action:getComputedStyle(el.querySelector('[data-kind=action]')!,'::before').content}});
 expect(Math.abs(geometry.cue-geometry.paren)).toBeLessThan(2);expect(Math.abs(geometry.cue-geometry.dialogue)).toBeLessThan(7);expect(parseFloat(geometry.indent)).toBeCloseTo(parseFloat(geometry.font)*2);expect(geometry.action).not.toContain('△');
 await page.screenshot({path:'artifacts/common-chinese-writing.png'});
 for(const name of ['短剧','好莱坞格式','优化中文','常见中文']){await choose(name);expect(await editor.locator('p').allTextContents()).toEqual(original)}
 await page.getByRole('button',{name:'预览',exact:true}).click();const body=page.frameLocator('.print-frame').locator('body');await expect(body).toContainText('1　餐馆　日　内景');await expect(body).toContainText('白先生（轻声）：我们走吧。');await expect(body).not.toContainText('△');await page.screenshot({path:'artifacts/common-chinese-preview.png'});
});
test('common Chinese and short drama keep body baselines evenly spaced across paragraph types',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');await newScript(page,'行距');await page.getByLabel('第 1 场地点').fill('书房');await page.getByLabel('第 1 场地点').press('Enter');const editor=page.locator('.tiptap').first();
 await editor.fill('第一行');await editor.press('Shift+Enter');await page.keyboard.insertText('第二行');await editor.press('Enter');await editor.press('Meta+1');await page.keyboard.insertText('小林');await editor.press('Enter');await page.keyboard.insertText('你好');await editor.press('Enter');await editor.press('Meta+2');await page.keyboard.insertText('结束');
 for(const name of ['常见中文','短剧']){
  await page.getByLabel('打开设置',{exact:true}).click();await page.getByRole('dialog').locator('.layout-options>button').filter({has:page.locator('strong',{hasText:name})}).click();await page.getByRole('button',{name:'关闭',exact:true}).click();
  const tops=await editor.evaluate(el=>{const result:number[]=[];el.querySelectorAll('p').forEach(p=>{const r=document.createRange();r.selectNodeContents(p);for(const rect of Array.from(r.getClientRects()))if(rect.width>0&&rect.height>0&&!result.some(y=>Math.abs(y-rect.top)<2))result.push(rect.top)});return result.sort((a,b)=>a-b)});
  expect(tops.length).toBe(4);const step=tops[1]-tops[0];expect(step).toBeGreaterThan(10);for(let i=2;i<tops.length;i++)expect(Math.abs(tops[i]-tops[i-1]-step)).toBeLessThan(2);
 }
});
