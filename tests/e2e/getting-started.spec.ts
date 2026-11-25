import {test,expect} from '@playwright/test';
test('first launch guide can be completed and revisited; settings keep OS accessibility and chosen layouts',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
 const guide=page.getByRole('dialog',{name:'新手引导'});await expect(guide).toBeVisible();await expect(guide).toContainText('从一个剧本开始');
 await page.screenshot({path:'artifacts/guide-welcome.png'});
 await page.keyboard.press('Enter');await expect(guide).toContainText('写内容，格式交给工具');await page.getByRole('button',{name:'上一步',exact:true}).click();await expect(guide).toContainText('从一个剧本开始');
 for(let i=0;i<4;i++)await page.getByRole('button',{name:'下一步',exact:true}).click();await page.getByRole('button',{name:'开始使用',exact:true}).click();await expect(guide).toHaveCount(0);await page.reload();await expect(guide).toHaveCount(0);
 await page.getByRole('button',{name:'新建剧本',exact:true}).first().click();await page.getByLabel('剧本名称').fill('引导之后');await page.keyboard.press('Enter');await page.locator('.tiptap').first().fill('保留我的文稿。');
 await page.getByLabel('打开设置',{exact:true}).click();await expect(page.locator('.layout-options>button>strong')).toHaveText(['好莱坞格式','常见中文','优化中文','短剧']);
 await page.locator('.layout-options>button').nth(1).click();await expect(page.locator('.layout-options>button').nth(1)).toHaveAttribute('aria-pressed','true');await page.screenshot({path:'artifacts/format-settings-066.png'});
 await page.getByRole('button',{name:'外观',exact:true}).click();await expect(page.getByLabel('减少动态效果')).toHaveCount(0);await expect(page.getByLabel('减少透明度')).toHaveCount(0);await expect(page.getByText('强调色跟随系统。')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.dataset.reduceMotion)).toBe('true');
 await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.locator('html')).toHaveAttribute('data-reduce-motion','false');
 await page.getByRole('button',{name:'关于与版权',exact:true}).click();await expect(page.locator('.about-software')).not.toContainText('内测');await expect(page.locator('.about-software')).toContainText('付俊皓');await page.getByRole('button',{name:'新手引导',exact:true}).click();await expect(guide).toBeVisible();await page.getByRole('button',{name:'跳过引导'}).click();await expect(page.locator('.tiptap').first()).toHaveText('保留我的文稿。');
 await page.getByLabel('打开设置',{exact:true}).click();await page.getByRole('button',{name:'接入 Agent',exact:true}).click();await page.getByText('手动配置与排查',{exact:true}).click();await expect(page.locator('.assistant-steps')).toContainText('~/.codex');await page.getByRole('button',{name:'Claude Desktop',exact:true}).click();await expect(page.locator('.assistant-steps')).toContainText('Edit Config');
 await page.keyboard.press('Escape');await page.reload();await expect(guide).toHaveCount(0);
});
test('dismissal persists and first launch adds the editable demo only once',async({page})=>{
 await page.goto('/');await page.getByRole('dialog',{name:'新手引导'}).getByRole('button',{name:'关闭',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await page.reload();await expect(page.getByRole('dialog',{name:'新手引导'})).toHaveCount(0);await expect(page.locator('.library-card')).toHaveCount(1);await expect(page.getByRole('button',{name:'选择剧本：落水狗 · 节选演示',exact:true})).toBeVisible();
});
