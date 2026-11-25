import {test,expect,type Page,type Browser} from '@playwright/test';
import {TestCloudStore} from '../support/cloud-store';
import {newScript} from './helpers';
async function cloudPage(browser:Browser,store:TestCloudStore,account:string){
 const context=await browser.newContext();const page=await context.newPage();
 await page.exposeFunction('cloudRequestTest',(method:string,args:any)=>store.request(account,method,args).then(value=>({ok:true,value}),e=>({ok:false,error:{message:e.message,code:e.code}})));
 await page.addInitScript(()=>{(window as any).icloudNative={request:(method:string,args:any)=>(window as any).cloudRequestTest(method,args),openSettings:async()=>{}}});
 await page.goto('/');return {page,context};
}
async function panel(page:Page){await page.getByRole('button',{name:'iCloud 协作',exact:true}).click();await expect(page.getByText('已连接系统 iCloud 账号',{exact:true})).toBeVisible()}
async function close(page:Page){await page.getByRole('button',{name:'关闭',exact:true}).click()}
async function sharedPair(browser:Browser){
 const store=new TestCloudStore();const a=await cloudPage(browser,store,'a@example.com'),b=await cloudPage(browser,store,'b@example.com');
 await newScript(a.page,'云端验收');await a.page.getByLabel('第 1 场地点').fill('江边');await a.page.getByLabel('第 1 场地点').press('Enter');await a.page.locator('.tiptap').first().pressSequentially('雨落在江边。');
 await panel(a.page);await a.page.getByRole('button',{name:'启用此剧本的 iCloud 协作'}).click();await expect(a.page.getByText('协作成员',{exact:true})).toBeVisible();
 await a.page.getByLabel('受邀人的 Apple 账号邮箱').fill('b@example.com');await a.page.getByRole('button',{name:'创建邀请',exact:true}).click();const url=await a.page.getByLabel('已生成的 iCloud 邀请链接',{exact:true}).inputValue();await close(a.page);
 await panel(b.page);await b.page.getByLabel('iCloud 邀请链接',{exact:true}).fill(url);await b.page.getByRole('button',{name:'接受并打开剧本'}).click();await expect(b.page.locator('.tiptap').first()).toContainText('雨落在江边。');
 return {store,a,b,cleanup:async()=>{await a.context.close();await b.context.close()}};
}
test('unconfigured browser build is explicit, cannot upload, and preserves local writing',async({page})=>{
 await page.goto('/');await newScript(page,'本地保留');await page.getByLabel('第 1 场地点').press('Enter');await page.locator('.tiptap').first().pressSequentially('本地正文不能丢。');
 await page.getByRole('button',{name:'iCloud 协作',exact:true}).click();await expect(page.getByText('待配置 iCloud',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'启用此剧本的 iCloud 协作'})).toBeDisabled();await close(page);await expect(page.locator('.tiptap')).toContainText('本地正文不能丢。');
});
test('two real editors: same-paragraph edits, remote caret and local-only undo (CloudKit transport double)',async({browser})=>{
 const t=await sharedPair(browser);try{
 const ea=t.a.page.locator('.tiptap').first(),eb=t.b.page.locator('.tiptap').first();
 await ea.click();await ea.press('End');await eb.click();await eb.press('End');
 await Promise.all([ea.pressSequentially('甲新增'),eb.pressSequentially('乙新增')]);
 await expect(ea).toContainText('乙新增',{timeout:15000});await expect(eb).toContainText('甲新增',{timeout:15000});
 await expect(t.b.page.locator('.collaboration-carets__caret').first()).toBeVisible({timeout:15000});
 await ea.press('Meta+z');await expect(ea).not.toContainText('甲新增');await expect(ea).toContainText('乙新增');await expect(eb).not.toContainText('甲新增',{timeout:15000});await expect(eb).toContainText('乙新增');
 await expect(t.a.page.locator('.scene-section')).toHaveCount(1);await expect(t.b.page.locator('.scene-section')).toHaveCount(1);
 }finally{await t.cleanup()}
});
test('scene move concurrent with body edit, offline reload and transport restart preserve text and IDs',async({browser})=>{
 const t=await sharedPair(browser);try{
 await t.a.page.locator('.add-outline').click();await t.a.page.getByLabel('第 2 场地点').fill('车站');await t.a.page.getByLabel('第 2 场地点').press('Enter');await t.a.page.locator('.tiptap').nth(1).pressSequentially('车站关门了。');await expect(t.b.page.locator('.scene-section')).toHaveCount(2,{timeout:15000});await expect(t.b.page.locator('.tiptap').nth(1)).toContainText('车站关门了。');
 t.store.offline.add('b@example.com');await t.b.page.locator('.tiptap').nth(1).click();await t.b.page.locator('.tiptap').nth(1).press('End');await t.b.page.locator('.tiptap').nth(1).pressSequentially('乙的离线修改');
 await t.a.page.getByRole('button',{name:'分场',exact:true}).click();const dt=await t.a.page.evaluateHandle(()=>new DataTransfer());await t.a.page.locator('.scene-card').nth(1).dispatchEvent('dragstart',{dataTransfer:dt});const rect=(await t.a.page.locator('.scene-card').first().boundingBox())!;await t.a.page.locator('.cards').dispatchEvent('drop',{dataTransfer:dt,clientX:rect.x+2,clientY:rect.y+60});await t.a.page.getByRole('button',{name:'文稿',exact:true}).click();await expect(t.a.page.getByLabel('第 1 场地点')).toHaveValue('车站');
 await expect(t.b.page.locator('.save-indicator')).toContainText('待');
 await t.b.page.reload();await t.b.page.getByRole('button',{name:'打开剧本：云端验收',exact:true}).dblclick();await expect(t.b.page.locator('.tiptap').nth(1)).toContainText('乙的离线修改');
 const disk=t.store.snapshot();t.store.projects.clear();t.store.restore(disk);t.store.offline.clear();await t.b.page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(t.b.page.getByLabel('第 1 场地点')).toHaveValue('车站',{timeout:15000});await expect(t.a.page.locator('.tiptap').first()).toContainText('乙的离线修改',{timeout:15000});await expect(t.a.page.locator('.scene-section')).toHaveCount(2);await expect(t.b.page.locator('.scene-section')).toHaveCount(2);
 }finally{await t.cleanup()}
});
test('viewer permission disables writing and cloud version restores to an independent local project',async({browser})=>{
 const t=await sharedPair(browser);try{
 await panel(t.a.page);await t.a.page.getByLabel('成员 b@example.com 权限').selectOption('viewer');await expect(t.b.page.locator('.tiptap').first()).toHaveAttribute('contenteditable','false',{timeout:15000});
 await t.a.page.getByLabel('iCloud 版本名称').fill('第一稿');await t.a.page.getByRole('button',{name:'保存云端版本',exact:true}).click();await expect(t.a.page.getByText('第一稿',{exact:true})).toBeVisible();await t.a.page.getByRole('button',{name:'打开副本',exact:true}).click();await expect(t.a.page.getByLabel('剧本标题')).toHaveValue('云端验收 · 第一稿');
 await t.a.page.locator('.tiptap').first().click();await t.a.page.locator('.tiptap').first().press('End');await t.a.page.locator('.tiptap').first().pressSequentially('仅在副本');await expect(t.b.page.locator('.tiptap').first()).not.toContainText('仅在副本');await expect(t.b.page.locator('.tiptap').first()).toContainText('雨落在江边。');
 }finally{await t.cleanup()}
});
test('protecting an active shared script stops synchronization and keeps private edits local after reload',async({browser})=>{
 const t=await sharedPair(browser);try{
 await t.a.page.getByLabel('打开设置',{exact:true}).click();await t.a.page.getByRole('button',{name:'安全区',exact:true}).click();await t.a.page.getByLabel('加入安全区：云端验收',{exact:true}).click();await expect(t.a.page.getByText('已保护 · iCloud / AI 禁止接入 · 曾关联协作',{exact:true})).toBeVisible();await close(t.a.page);
 const requests=t.store.calls.filter(c=>c.account==='a@example.com').length;await t.a.page.locator('.tiptap').fill('仅限本机的保密修改');await t.a.page.reload();await t.a.page.getByRole('button',{name:'打开剧本：云端验收',exact:true}).dblclick();await expect(t.a.page.locator('.tiptap')).toHaveText('仅限本机的保密修改');await t.a.page.evaluate(()=>window.dispatchEvent(new Event('online')));
 // Force the other device through a real sync cycle instead of relying on a short negative assertion.
 await t.b.page.locator('.tiptap').fill('协作者继续写作');await expect(t.b.page.locator('.save-indicator')).toContainText('iCloud 已保存',{timeout:15000});await expect(t.a.page.locator('.tiptap')).toHaveText('仅限本机的保密修改');expect(t.store.calls.filter(c=>c.account==='a@example.com')).toHaveLength(requests);await expect(t.b.page.locator('.tiptap')).not.toContainText('保密修改');
 }finally{await t.cleanup()}
});
