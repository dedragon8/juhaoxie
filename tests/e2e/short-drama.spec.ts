import {test,expect} from '@playwright/test';import {newScript} from './helpers';
test('short drama is editable, reversible, persisted, and exported in the referenced format',async({page})=>{
 await page.goto('/');await newScript(page,'AI 短剧验收');await page.getByLabel('第 1 场地点').fill('车站');await page.getByLabel('第 1 场地点').press('Enter');const editor=page.locator('.tiptap').first();
 await editor.fill('末班车驶离。');await editor.press('Enter');await editor.press('Meta+1');await editor.pressSequentially('林舟');await editor.press('Enter');await editor.press('Meta+4');await editor.pressSequentially('轻声');await editor.press('Enter');await editor.pressSequentially('我们明天见。');
 const original=await editor.locator('p').allTextContents();
 const choose=async(name:string)=>{await page.getByLabel('打开设置',{exact:true}).click();await page.getByRole('button',{name:'文稿排版',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:new RegExp('^'+name)}).click();await page.getByRole('button',{name:'关闭',exact:true}).click();};
 await choose('AI 短剧');await expect(page.locator('.manuscript')).toHaveAttribute('data-layout','shortDrama');await expect(page.getByLabel('第 1 场出场人物')).toHaveValue('林舟');await page.getByLabel('第 1 场集数').fill('2');await page.getByLabel('第 1 场出场人物').fill('林舟、乘客若干');await expect(page.locator('.scene-number')).toHaveText('2-1');
 const geometry=await editor.evaluate(el=>{const c=el.querySelector('[data-kind=character]')!,p=el.querySelector('[data-kind=parenthetical]')!,d=el.querySelector('[data-kind=dialogue]')!;const top=(node:Element)=>{const range=document.createRange();range.selectNodeContents(node);return range.getClientRects()[0].top};return {cue:top(c),paren:top(p),dialogue:top(d),action:getComputedStyle(el.querySelector('[data-kind=action]')!,'::before').content}});expect(Math.abs(geometry.cue-geometry.paren)).toBeLessThan(2);expect(Math.abs(geometry.cue-geometry.dialogue)).toBeLessThan(7);expect(geometry.action).toContain('△');
 await choose('好莱坞');expect(await editor.locator('p').allTextContents()).toEqual(original);await choose('AI 短剧');
 await editor.locator('p').last().click();await editor.press('End');await editor.press('Enter');await editor.press('Meta+2');await page.getByLabel('第 1 场短剧标注').selectOption('subtitle');await page.keyboard.insertText('次日清晨');await expect(editor.locator('p').last()).toHaveText('【字幕：次日清晨】');
 await editor.press('Enter');await editor.press('Meta+1');await page.keyboard.insertText('林舟');await page.getByLabel('第 1 场短剧标注').selectOption('os');await page.keyboard.press('Enter');await page.keyboard.insertText('他还会来吗？');await expect(editor.locator('p').last()).toHaveAttribute('data-kind','dialogue');
 await editor.press('Tab');await expect(page.getByRole('menuitem',{name:/描述\/动作/})).toBeVisible();await page.keyboard.press('Escape');
 await page.screenshot({path:'artifacts/short-drama-writing.png'});
 await page.locator('.add-outline').click();await expect(page.getByLabel('第 2 场集数')).toHaveValue('2');await expect(page.locator('.scene-number').last()).toHaveText('2-2');await page.getByLabel('第 2 场集数').fill('3');await page.getByLabel('第 2 场地点').fill('站台');await page.locator('.tiptap').last().fill('太阳升起。');
 await page.getByRole('button',{name:'分场',exact:true}).click();await expect(page.locator('.empty-card')).toHaveCount(0);await expect(page.getByText('下一场，会发生什么？')).toHaveCount(0);await expect(page.locator('.act-assignment').first()).not.toContainText('所属幕');await expect(page.locator('.board-heading').getByRole('button',{name:'添加场景',exact:true})).toBeVisible();
 await page.reload();await page.getByRole('button',{name:'打开剧本：AI 短剧验收',exact:true}).dblclick();await expect(page.locator('.manuscript')).toHaveAttribute('data-layout','shortDrama');await expect(page.getByLabel('第 1 场出场人物')).toHaveValue('林舟、乘客若干');await expect(page.getByLabel('第 2 场集数')).toHaveValue('3');
 await page.getByRole('button',{name:'预览',exact:true}).click();const frame=page.frameLocator('.print-frame');await expect(frame.locator('body')).toContainText('林舟（轻声）：我们明天见。');await expect(frame.locator('body')).toContainText('林舟（OS）：他还会来吗？');await expect(frame.locator('body')).toContainText('3-1  日  内  站台');await expect(frame.locator('body')).toContainText('△太阳升起。');await page.screenshot({path:'artifacts/short-drama-preview.png'});
});

test('short drama Tab offers markers, preserves text, and recognizes inline character parentheses',async({page})=>{
 await page.goto('/');await newScript(page,'短剧 Tab 验收');
 const choose=async(name:string)=>{await page.getByLabel('打开设置',{exact:true}).click();await page.getByRole('button',{name:'文稿排版',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:new RegExp('^'+name)}).click();await page.getByRole('button',{name:'关闭',exact:true}).click();};
 await choose('AI 短剧');const editor=page.locator('.tiptap').first();await editor.fill('保留这一句。');await editor.press('Tab');
 const items=page.getByRole('menuitem');expect(await items.evaluateAll(nodes=>nodes.map(n=>n.childNodes[0].textContent))).toEqual(['人物','描述/动作','对白','括注','内心独白 OS','画外音 VO','字幕','空镜','闪回','闪回结束']);
 await expect(page.getByRole('menuitem',{name:/描述\/动作/})).toBeFocused();await page.keyboard.press('ArrowUp');await expect(page.getByRole('menuitem',{name:/^人物/})).toBeFocused();await page.keyboard.press('ArrowUp');await expect(page.getByRole('menuitem',{name:'闪回结束',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(page.getByRole('menu')).toHaveCount(0);
 const markers=[['字幕','【字幕：清晨】'],['空镜','【空镜：清晨】'],['闪回','闪回'],['闪回结束','闪回结束'],['内心独白 OS','（OS）'],['画外音 VO','（VO）']];
 for(const [label,text] of markers){
  await editor.press('Tab');await page.getByRole('menuitem',{name:label,exact:true}).click();await expect(page.getByRole('menu')).toHaveCount(0);
  if(label==='字幕'||label==='空镜')await page.keyboard.insertText('清晨');
  await expect(editor.locator('p').last()).toHaveText(text);await expect(editor.locator('p').first()).toHaveText('保留这一句。');
  const count=await editor.locator('p').count();await editor.press('Tab');await expect(page.getByRole('menuitem',{name:label,exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(editor.locator('p')).toHaveCount(count);
 }
 await editor.press('Enter');await editor.press('Meta+1');await page.keyboard.insertText('林舟（压低声音）');await editor.press('Enter');await page.keyboard.insertText('车来了。');
 const rows=editor.locator('p');await expect(rows.nth((await rows.count())-3)).toHaveText('林舟');await expect(rows.nth((await rows.count())-2)).toHaveAttribute('data-kind','parenthetical');await expect(rows.nth((await rows.count())-2)).toHaveText('（压低声音）');await expect(rows.last()).toHaveAttribute('data-kind','dialogue');await expect(rows.last()).toHaveText('车来了。');
 await editor.press('Enter');await editor.press('Meta+1');await page.keyboard.insertText('陈远(轻声)');await editor.press('Enter');await page.keyboard.insertText('走吧。');await expect(editor.locator('p[data-kind=parenthetical]').last()).toHaveText('(轻声)');
 await page.screenshot({path:'artifacts/short-drama-tab-055.png'});
 const original=await rows.allTextContents();await choose('好莱坞');await editor.locator('p').last().click();await editor.press('Tab');expect(await items.evaluateAll(nodes=>nodes.map(n=>n.childNodes[0].textContent))).toEqual(['人物','描述/动作','对白','括注','转场','蒙太奇','连续镜头','镜头内容','段落结束']);await page.keyboard.press('Escape');expect(await rows.allTextContents()).toEqual(original);
 await choose('AI 短剧');await page.getByRole('button',{name:'预览',exact:true}).click();await expect(page.frameLocator('.print-frame').locator('body')).toContainText('林舟（压低声音）：车来了。');
});

test('typed OS VO become structured speech without disturbing IME; headings alone are bold',async({page})=>{
 await page.goto('/');await newScript(page,'自动短剧对白');await page.getByLabel('打开设置',{exact:true}).click();await page.getByRole('button',{name:'文稿排版',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/^AI 短剧/}).click();await page.getByRole('button',{name:'关闭',exact:true}).click();
 const editor=page.locator('.tiptap').first();await editor.click();
 // A whole sentence committed in one input, including its dialogue, is parsed in the action line.
 await page.keyboard.insertText('xx角色（os）：等哈就开始和打卡机');
 await expect(editor.locator('p')).toHaveText(['xx角色','（OS）','等哈就开始和打卡机']);
 expect(await editor.locator('p').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-kind')))).toEqual(['character','parenthetical','dialogue']);
 await editor.press('Meta+z');await expect(editor).toHaveText('');await editor.press('Meta+Shift+z');await expect(editor.locator('p')).toHaveText(['xx角色','（OS）','等哈就开始和打卡机']);
 await page.keyboard.insertText('。继续写');await expect(editor.locator('p').last()).toHaveText('等哈就开始和打卡机。继续写');
 await expect(page.getByLabel('第 1 场出场人物')).toHaveValue('xx角色');
 await editor.press('Enter');await editor.press('Meta+1');await editor.pressSequentially('广播(vo):');await page.keyboard.insertText('请准备乘车。');
 await expect(editor.locator('p[data-kind=parenthetical]').last()).toHaveText('(VO)');await expect(editor.locator('p[data-kind=dialogue]').last()).toHaveText('请准备乘车。');
 // Plain parenthetical typing is normalized too, without altering dialogue words containing os/vo.
 await editor.press('Enter');await editor.press('Meta+4');await page.keyboard.insertText('os');await expect(editor.locator('p').last()).toHaveText('（OS）');await editor.press('Enter');await page.keyboard.insertText('os 和 vo 在对白里保持原文');await expect(editor.locator('p').last()).toHaveText('os 和 vo 在对白里保持原文');
 await editor.press('Enter');await editor.press('Meta+2');await editor.dispatchEvent('compositionstart',{data:''});await page.keyboard.insertText('林舟（vo）：我到了');await expect(editor.locator('p').last()).toHaveText('林舟（vo）：我到了');await editor.dispatchEvent('compositionend',{data:'林舟（vo）：我到了'});
 await expect(editor.locator('p[data-kind=parenthetical]').last()).toHaveText('（VO）');await expect(editor.locator('p').last()).toHaveText('我到了');await page.keyboard.insertText('。');await expect(editor.locator('p').last()).toHaveText('我到了。');
 for(const locator of [page.getByLabel('第 1 场地点'),page.getByLabel('第 1 场内外景'),page.getByLabel('第 1 场出场人物'),page.locator('.scene-number')])await expect(locator).toHaveCSS('font-weight','700');
 for(const locator of [editor.locator('p[data-kind=character]').first(),editor.locator('p[data-kind=parenthetical]').first(),editor.locator('p[data-kind=dialogue]').first()])await expect(locator).toHaveCSS('font-weight','400');
 const original=await editor.locator('p').allTextContents();await page.reload();await page.getByRole('button',{name:'打开剧本：自动短剧对白',exact:true}).dblclick();expect(await editor.locator('p').allTextContents()).toEqual(original);
 await page.getByRole('button',{name:'预览',exact:true}).click();const body=page.frameLocator('.print-frame').locator('body');await expect(body).toContainText('xx角色（OS）：等哈就开始和打卡机。继续写');await expect(body.locator('.line').filter({hasText:/^人物：/})).toHaveCSS('font-weight','700');await expect(body.locator('.line').filter({hasText:/^xx角色/})).toHaveCSS('font-weight','400');
});

test('bare OS VO suffixes gain parentheses and continue into dialogue',async({page})=>{
 await page.goto('/');await newScript(page,'短剧简写');await page.getByLabel('打开设置',{exact:true}).click();await page.getByRole('button',{name:'文稿排版',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:/^AI 短剧/}).click();await page.getByRole('button',{name:'关闭',exact:true}).click();
 const editor=page.locator('.tiptap').first();await editor.click();await page.keyboard.insertText('角色');await editor.pressSequentially('os');await expect(editor.locator('p')).toHaveText('角色（OS）');await expect(editor.locator('p')).toHaveAttribute('data-kind','character');
 await page.keyboard.insertText('：等哈就开始和打卡机');await expect(editor.locator('p')).toHaveText(['角色','（OS）','等哈就开始和打卡机']);await page.keyboard.insertText('。');await expect(editor.locator('p').last()).toHaveText('等哈就开始和打卡机。');
 await editor.press('Enter');await editor.press('Meta+1');await page.keyboard.insertText('广播vO');await expect(editor.locator('p').last()).toHaveText('广播（VO）');await editor.press('Enter');await page.keyboard.insertText('请准备乘车。');await expect(editor.locator('p').last()).toHaveAttribute('data-kind','dialogue');await expect(editor.locator('p[data-kind=parenthetical]').last()).toHaveText('（VO）');
 await editor.press('Enter');await editor.press('Meta+2');await page.keyboard.insertText('林舟vo:我到了');await expect(editor.locator('p[data-kind=character]').last()).toHaveText('林舟');await expect(editor.locator('p[data-kind=parenthetical]').last()).toHaveText('（VO）');await expect(editor.locator('p').last()).toHaveText('我到了');
 await editor.press('Enter');await editor.press('Meta+1');await page.keyboard.insertText('Carlos');await expect(editor.locator('p').last()).toHaveText('Carlos');await editor.press('Enter');await page.keyboard.insertText('我说的是角色os和广播vo');await expect(editor.locator('p').last()).toHaveText('我说的是角色os和广播vo');
 await editor.press('Enter');await editor.press('Meta+1');await editor.dispatchEvent('compositionstart',{data:''});await page.keyboard.insertText('陈远os');await expect(editor.locator('p').last()).toHaveText('陈远os');await editor.dispatchEvent('compositionend',{data:'陈远os'});await expect(editor.locator('p').last()).toHaveText('陈远（OS）');await editor.press('Enter');await page.keyboard.insertText('出发吧。');
 const text=await editor.locator('p').allTextContents();await page.reload();await page.getByRole('button',{name:'打开剧本：短剧简写',exact:true}).dblclick();expect(await editor.locator('p').allTextContents()).toEqual(text);
 await page.getByRole('button',{name:'预览',exact:true}).click();await expect(page.frameLocator('.print-frame').locator('body')).toContainText('角色（OS）：等哈就开始和打卡机。');await expect(page.frameLocator('.print-frame').locator('body')).toContainText('陈远（OS）：出发吧。');
});
