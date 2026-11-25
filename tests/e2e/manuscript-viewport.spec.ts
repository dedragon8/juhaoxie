import {test,expect,type Page} from '@playwright/test';
import {newScript} from './helpers';
const viewport=(page:Page)=>page.locator('.editor-scroll').evaluate(el=>{
 const paper=el.querySelector<HTMLElement>('.manuscript')!,r=paper.getBoundingClientRect(),v=el.getBoundingClientRect(),scale=r.width/paper.offsetWidth;
 return {x:(v.left+el.clientWidth/2-r.left)/scale,y:(v.top+el.clientHeight/2-r.top)/scale,zoom:scale*100,left:el.scrollLeft,top:el.scrollTop};
});
async function longScript(page:Page,title:string){
 await newScript(page,title);await expect(page.locator('.tiptap').first()).toBeVisible();
 await page.locator('.tiptap').first().fill(Array.from({length:180},(_,i)=>`第${i+1}行，林舟沿着河岸向前走，远处的灯光渐渐亮起。`).join('\n'));
 await page.getByRole('button',{name:'放大文稿',exact:true}).click();
 await page.locator('.editor-scroll').evaluate(el=>{el.scrollTop=3400;el.scrollLeft+=110});
 await expect.poll(()=>viewport(page).then(v=>v.top)).toBeGreaterThan(3000);
}
test('fit keeps the current manuscript content at the vertical center, even when already fitted',async({page})=>{
 await page.goto('/');await longScript(page,'当前位置适配');const before=await viewport(page);
 await page.getByTitle('适配窗口并居中',{exact:true}).click();
 await expect.poll(()=>viewport(page).then(v=>Math.abs(v.y-before.y))).toBeLessThan(2);
 await expect.poll(()=>viewport(page).then(v=>Math.abs(v.x-410))).toBeLessThan(2);
 await page.getByTitle('适配窗口并居中',{exact:true}).click();await expect.poll(()=>viewport(page).then(v=>Math.abs(v.y-before.y))).toBeLessThan(2);
 await expect(page.locator('.editor-scroll')).toHaveCSS('background-color','rgb(255, 255, 255)');
});
test('writing zoom and both pan axes survive board, preview, library and other scripts',async({page})=>{
 await page.goto('/');await longScript(page,'位置甲');const before=await viewport(page);
 for(const view of ['分场','预览','分场']){
  await page.getByRole('button',{name:view,exact:true}).click();
  if(view==='预览')await expect(page.locator('.print-frame')).toBeVisible();
  await page.locator('.editor-scroll').evaluate(el=>{el.scrollTop=0;el.scrollLeft=0});
  await page.getByRole('button',{name:'文稿',exact:true}).click();
  await expect.poll(()=>viewport(page).then(v=>Math.abs(v.y-before.y))).toBeLessThan(2);
  await expect.poll(()=>viewport(page).then(v=>Math.abs(v.x-before.x))).toBeLessThan(2);
  expect((await viewport(page)).zoom).toBeCloseTo(before.zoom,1);
 }
 await page.getByRole('button',{name:'剧本库',exact:true}).click();await longScript(page,'位置乙');
 await page.getByRole('button',{name:'缩小文稿',exact:true}).click();
 await page.getByRole('button',{name:'剧本库',exact:true}).click();await page.getByRole('button',{name:'选择剧本：位置甲',exact:true}).dblclick();
 await expect.poll(()=>viewport(page).then(v=>Math.abs(v.y-before.y))).toBeLessThan(2);
 await expect.poll(()=>viewport(page).then(v=>Math.abs(v.x-before.x))).toBeLessThan(2);
 expect((await viewport(page)).zoom).toBeCloseTo(before.zoom,1);
});
test('an added scene does not refocus its heading when returning to the manuscript',async({page})=>{
 await page.goto('/');await newScript(page,'焦点验收');await page.getByRole('button',{name:/添加场景/}).click();
 const editor=page.locator('.tiptap').last();await expect(editor).toBeVisible();await editor.fill('这一场的动作与对白。\n'.repeat(180));
 await page.locator('.editor-scroll').evaluate(el=>{el.scrollTop=3000});const before=await viewport(page);
 await page.getByRole('button',{name:'分场',exact:true}).click();await page.getByRole('button',{name:'文稿',exact:true}).click();
 await expect.poll(()=>viewport(page).then(v=>Math.abs(v.y-before.y))).toBeLessThan(2);
 // Explicit navigation is still allowed to jump to another scene.
 await page.locator('.scene-item').first().click();await expect.poll(()=>viewport(page).then(v=>v.top)).toBeLessThan(1500);
});
test('restoration follows the visible scene when cards are reordered in the board',async({page})=>{
 await page.goto('/');await longScript(page,'换序验收');await page.getByRole('button',{name:/添加场景/}).click();
 await page.locator('.tiptap').last().fill('另一场的内容。\n'.repeat(130));
 const anchor=await page.locator('.scene-section').last().getAttribute('id');
 await page.locator('.editor-scroll').evaluate(el=>{const scene=el.querySelectorAll('.scene-section')[1];el.scrollTop+=scene.getBoundingClientRect().top-el.getBoundingClientRect().top+500});
 const sceneOffset=()=>page.locator('.editor-scroll').evaluate((el,id)=>{const scene=document.getElementById(id!)!,paper=el.querySelector<HTMLElement>('.manuscript')!;return (el.getBoundingClientRect().top+el.clientHeight/2-scene.getBoundingClientRect().top)/(paper.getBoundingClientRect().width/paper.offsetWidth)},anchor);
 const before=await sceneOffset();await page.getByRole('button',{name:'分场',exact:true}).click();
 await page.locator('.scene-card').last().dragTo(page.locator('.scene-card').first(),{targetPosition:{x:2,y:50}});
 await page.getByRole('button',{name:'文稿',exact:true}).click();await expect(page.locator('.scene-section').first()).toHaveAttribute('id',anchor!);
 await expect.poll(async()=>Math.abs(await sceneOffset()-before)).toBeLessThan(2);
});
test('trackpad pan dampens small diagonal drift without locking, and edges rebound only beyond bounds',async({page})=>{
 await page.goto('/');await longScript(page,'触控板边界');
 const pane=page.locator('.writing-scroll');const before=await viewport(page);
 await pane.evaluate(el=>{for(let i=0;i<20;i++)el.dispatchEvent(new WheelEvent('wheel',{deltaX:2,deltaY:40,bubbles:true,cancelable:true}))});
 const after=await viewport(page);expect(after.top-before.top).toBeCloseTo(800,0);expect(after.left-before.left).toBeGreaterThan(0);expect(after.left-before.left).toBeLessThan(4);await expect(page.locator('.manuscript')).toHaveCSS('transform','none');
 await pane.evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaX:70,deltaY:1,bubbles:true,cancelable:true})));expect((await viewport(page)).left-after.left).toBeCloseTo(70,0);
 await pane.evaluate(el=>{el.scrollTop=0;el.dispatchEvent(new WheelEvent('wheel',{deltaY:-180,bubbles:true,cancelable:true}))});expect((await viewport(page)).top).toBe(0);await expect(page.locator('.manuscript')).not.toHaveCSS('transform','none');await expect(page.locator('.manuscript')).toHaveCSS('transform','none',{timeout:2500});
 const gap=await pane.evaluate(el=>el.querySelector('.manuscript-header')!.getBoundingClientRect().top-el.getBoundingClientRect().top);expect(gap).toBeGreaterThanOrEqual(0);expect(gap).toBeLessThan(140);
 await pane.evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new WheelEvent('wheel',{deltaY:180,bubbles:true,cancelable:true}))});await expect(page.locator('.manuscript')).not.toHaveCSS('transform','none');await expect(page.locator('.manuscript')).toHaveCSS('transform','none',{timeout:2500});
 expect(await pane.evaluate(el=>el.scrollHeight-el.clientHeight-el.scrollTop)).toBeLessThan(1);
 const freeSpace=await pane.evaluate(el=>{
  const last=el.querySelector('.scene-section:last-child .script-editor p:last-child')!;
  return (el.getBoundingClientRect().top+el.clientHeight-last.getBoundingClientRect().bottom)/el.clientHeight;
 });
 expect(freeSpace).toBeGreaterThanOrEqual(.5);expect(freeSpace).toBeLessThan(.8);
 await expect(pane.getByRole('button',{name:'新的场景'})).toHaveCount(0);
 await page.evaluate(()=>document.documentElement.dataset.reduceMotion='true');await pane.evaluate(el=>el.dispatchEvent(new WheelEvent('wheel',{deltaY:180,bubbles:true,cancelable:true})));await expect(page.locator('.manuscript')).toHaveCSS('transform','none');
});
