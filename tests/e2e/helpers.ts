import type {Page} from '@playwright/test';
export async function newScript(page:Page,title='未命名剧本'){
 if(await page.getByRole('dialog',{name:'新手引导'}).count())await page.getByRole('button',{name:'跳过引导'}).click();
 await page.getByRole('button',{name:'新建剧本',exact:true}).first().click();await page.getByLabel('剧本名称').fill(title);await page.getByRole('button',{name:'开始写作',exact:true}).click();
}
