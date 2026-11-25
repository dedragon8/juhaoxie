import {test,expect} from '@playwright/test';
import {newScript} from './helpers';
test('appearance follows system; overrides and shortcuts persist; montage and sequences export',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.emulateMedia({colorScheme:'light'});await page.goto('/');await newScript(page);
 await expect(page.getByLabel('剧本标题')).toBeVisible();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 expect(await page.locator('.main-pane').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
 await expect(page.getByText('SCREENPLAY WORKSPACE')).toHaveCount(0);await expect(page.getByText('场景写作工作室')).toHaveCount(0);
 await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.getByRole('button',{name:'打开设置',exact:true}).click();await page.getByRole('button',{name:'浅色',exact:true}).click();
 await expect(page.locator('html')).toHaveAttribute('data-theme','light');
 await page.getByRole('dialog').getByRole('button',{name:'快捷键',exact:true}).click();
 const actionKey=page.getByRole('button',{name:'修改描述/动作快捷键',exact:true});await actionKey.click();await actionKey.press('Meta+1');await expect(page.getByRole('alert')).toContainText('已用于“人物”');
 await actionKey.press('Meta+Alt+a');await expect(actionKey).toHaveText('⌘ ⌥ A');
 await page.screenshot({path:'artifacts/settings-shortcuts.png',fullPage:true});
 await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByLabel('剧本标题').fill('雨停之前');await page.getByLabel('第 1 场地点').fill('旧车站');await page.getByLabel('第 1 场地点').press('Enter');
 const editor=page.locator('.tiptap').first();await editor.press('Meta+6');await editor.pressSequentially('等待的日子');await editor.press('Enter');await editor.pressSequentially('林在日历上划去一天。');await editor.press('Enter');await editor.pressSequentially('窗外的叶子落尽。');await editor.press('Enter');await editor.press('Enter');
 await expect(editor.locator('[data-kind=montage]')).toHaveText('等待的日子');await expect(editor.locator('[data-kind=shot]')).toHaveCount(2);await expect(editor.locator('[data-kind=sequenceEnd]')).toHaveText('蒙太奇');
 await editor.press('Enter');await editor.press('Meta+7');await editor.pressSequentially('穿过车站');await editor.press('Enter');await editor.pressSequentially('她推开门，走向站台。');await editor.press('Enter');await editor.press('Enter');await editor.press('Enter');
 await editor.press('Meta+1');await editor.press('Meta+2');await expect(editor.locator('p').last()).toHaveAttribute('data-kind','character');
 await editor.press('Meta+Alt+a');await expect(editor.locator('p').last()).toHaveAttribute('data-kind','action');await editor.pressSequentially('远处，响起火车的汽笛。');
 expect(await editor.evaluate(el=>getComputedStyle(el).fontFamily)).toContain('PingFang SC');
 await page.screenshot({path:'artifacts/writing-light.png',fullPage:true});
 await page.getByRole('button',{name:'打开设置',exact:true}).click();await page.getByRole('button',{name:'深色',exact:true}).click();await page.screenshot({path:'artifacts/settings-appearance.png',fullPage:true});await page.getByRole('button',{name:'关闭',exact:true}).click();await page.screenshot({path:'artifacts/writing-dark.png',fullPage:true});
 await page.reload();await page.getByRole('button',{name:'打开剧本：雨停之前',exact:true}).dblclick();await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await expect(page.locator('.tiptap')).toContainText('穿过车站');
 await page.getByRole('button',{name:'打开设置',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'快捷键',exact:true}).click();await expect(page.getByRole('button',{name:'修改描述/动作快捷键',exact:true})).toHaveText('⌘ ⌥ A');await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'预览',exact:true}).click();const frame=page.frameLocator('.print-frame');await expect(frame.locator('.page').nth(1)).toContainText('蒙太奇：等待的日子');await expect(frame.locator('.page').nth(1)).toContainText('连续镜头：穿过车站');await expect(frame.locator('.page').nth(1)).toContainText('结束：连续镜头');
 expect(await frame.locator('body').evaluate(el=>getComputedStyle(el).fontFamily)).toContain('PingFang SC');expect(await frame.locator('.page').first().evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(255, 255, 255)');
 expect(errors).toEqual([]);
});

test('Tab menu anchors to the current line in a long scene without scrolling to the end',async({page})=>{
 await page.goto('/');await newScript(page);await page.getByLabel('第 1 场地点').press('Enter');const editor=page.locator('.tiptap').first();
 await editor.fill(Array.from({length:50},(_,i)=>`第 ${i+1} 行，雨声不停。`).join('\n'));
 await editor.locator('p').first().click({position:{x:40,y:12}});
 const before=await page.locator('.editor-scroll').evaluate(el=>el.scrollTop);
 const caret=await editor.evaluate(el=>{const s=window.getSelection()!;const r=s.getRangeAt(0).cloneRange();r.collapse(true);return {top:r.getBoundingClientRect().top,bottom:r.getBoundingClientRect().bottom}});
 await editor.press('Tab');const menu=page.getByRole('menu',{name:'段落格式'});await expect(menu).toBeVisible();
 const bounds=(await menu.boundingBox())!;expect(bounds.width).toBe(240);expect(Math.abs(bounds.y-caret.bottom)).toBeLessThan(50);expect(await page.locator('.editor-scroll').evaluate(el=>el.scrollTop)).toBe(before);
 await menu.getByRole('menuitem',{name:/蒙太奇/}).click();await expect(editor.locator('p').first()).toHaveAttribute('data-kind','montage');await expect(editor).toBeFocused();
 await editor.press('Tab');await page.screenshot({path:'artifacts/tab-menu.png',fullPage:true});await page.keyboard.press('Escape');await expect(menu).toHaveCount(0);
 await editor.locator('p').last().click({position:{x:40,y:12}});
 const bottomCaret=await editor.evaluate(()=>{const r=window.getSelection()!.getRangeAt(0).cloneRange();r.collapse(true);return r.getBoundingClientRect().top});
 const bottomScroll=await page.locator('.editor-scroll').evaluate(el=>el.scrollTop);await editor.press('Tab');await expect(menu).toBeVisible();const bottomMenu=(await menu.boundingBox())!;
 expect(bottomCaret-(bottomMenu.y+bottomMenu.height)).toBeGreaterThanOrEqual(0);expect(bottomCaret-(bottomMenu.y+bottomMenu.height)).toBeLessThan(24);expect(await page.locator('.editor-scroll').evaluate(el=>el.scrollTop)).toBe(bottomScroll);

});
