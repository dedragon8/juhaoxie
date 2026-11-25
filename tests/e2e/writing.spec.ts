import {test,expect} from '@playwright/test';
import {newScript} from './helpers';
test('write, outline, restore, export and reopen locally',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await newScript(page);await expect(page.getByLabel('剧本标题')).toBeVisible();
 await page.getByLabel('剧本标题').fill('雨停之前');await page.getByLabel('第 1 场地点').fill('旧车站');await page.getByLabel('第 1 场地点').press('Enter');
 const editor=page.locator('.tiptap').first();await expect(editor).toBeFocused();await editor.pressSequentially('雨水沿着站台的屋檐落下。');
 await editor.press('Enter');await editor.press('Meta+1');await editor.pressSequentially('林');await editor.press('Enter');await editor.pressSequentially('最后一班车，还会来吗？');
 await expect(editor.locator('[data-kind="character"]')).toHaveText('林');await expect(editor.locator('[data-kind="dialogue"]')).toHaveText('最后一班车，还会来吗？');
 await page.locator('.add-outline').click();await page.getByLabel('第 2 场地点').fill('候车室');await page.getByLabel('第 2 场地点').press('Enter');await page.locator('.tiptap').nth(1).pressSequentially('墙上的钟停在十一点。');
 await page.getByRole('button',{name:'分场',exact:true}).click();await page.getByLabel('第 1 场梗概').fill('林在雨夜等待一个不会回来的人。');await page.getByLabel('第 2 场梗概').fill('她终于决定离开。');
 await page.screenshot({path:'artifacts/board.png',fullPage:true});
 const data=await page.evaluateHandle(()=>new DataTransfer());await page.locator('.scene-card').nth(1).dispatchEvent('dragstart',{dataTransfer:data});const first=(await page.locator('.scene-card').first().boundingBox())!;await page.locator('.cards').dispatchEvent('drop',{dataTransfer:data,clientX:first.x+2,clientY:first.y+70});await expect(page.locator('.scene-card h3').first()).toHaveText('候车室');
 await page.getByRole('button',{name:'文稿',exact:true}).click();await expect(page.getByLabel('第 1 场地点')).toHaveValue('候车室');await expect(page.locator('.tiptap').first()).toContainText('墙上的钟');
 await page.getByRole('button',{name:'场景笔记',exact:true}).click();await page.screenshot({path:'artifacts/writing.png',fullPage:true});
 await page.getByRole('button',{name:'版本记录'}).click();await page.getByLabel('版本名称').fill('第一次修改');await page.getByRole('button',{name:'保存版本',exact:true}).click();await expect(page.getByText('第一次修改',{exact:true})).toBeVisible();await page.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'预览',exact:true}).click();await expect(page.locator('.print-frame')).toBeVisible();const frame=page.frameLocator('.print-frame');await expect(frame.locator('.cover-title')).toHaveText('雨停之前');await expect(frame.locator('.page')).toHaveCount(2);await page.screenshot({path:'artifacts/preview.png',fullPage:true});
 await page.reload();await page.getByRole('button',{name:'打开剧本：雨停之前',exact:true}).dblclick();await expect(page.getByLabel('剧本标题')).toHaveValue('雨停之前');await expect(page.getByLabel('第 1 场地点')).toHaveValue('候车室');await expect(page.locator('.tiptap').nth(1)).toContainText('最后一班车');
 expect(errors).toEqual([]);
});
test('IME composition must not split a screenplay paragraph',async({page})=>{
 await page.goto('/');await newScript(page);await page.getByLabel('第 1 场地点').press('Enter');const editor=page.locator('.tiptap').first();await editor.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:229,isComposing:true,bubbles:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'你'}))});await expect(editor.locator('p')).toHaveCount(1);
});
