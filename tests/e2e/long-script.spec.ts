import {test,expect} from '@playwright/test';import fs from 'node:fs/promises';
import {paginate} from '../../src/core/pagination';import type {Script} from '../../src/core/model';
test('a hundred-page local script remains editable and backs up without loss',async({page})=>{
 const script:Script={schemaVersion:1,title:'长篇性能测试',author:'测试',contact:'',characters:{},scenes:Array.from({length:20},(_,i)=>({id:String(i),order:String(i),setting:'外景',location:`测试场景 ${i+1}`,time:'日',summary:'',notes:'',deleted:false,blocks:[{kind:'action' as const,text:'雨停了，街道上的人慢慢走出来。远处传来火车的声音，她停下脚步，看了一眼手里的信。'.repeat(180)}]}))};
 const pages=paginate(script,s=>Array.from(s).reduce((n,c)=>n+(/[\x00-\x7f]/.test(c)?7.2:12),0)).length;expect(pages).toBeGreaterThanOrEqual(100);
 await page.goto('/');await expect(page.getByRole('heading',{name:'剧本库',exact:true})).toBeVisible();await page.locator('input[type=file]').setInputFiles({name:'long.changjing',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(script))});await expect(page.getByLabel('剧本标题')).toHaveValue(script.title);
 const editor=page.locator('.tiptap').first();await editor.click();await editor.press('Meta+End');const times:number[]=[];
 for(let i=0;i<30;i++){const start=performance.now();await editor.pressSequentially('雨');times.push(performance.now()-start)}
 const p95=times.sort((a,b)=>a-b)[Math.floor(times.length*.95)];await fs.writeFile('artifacts/performance.json',JSON.stringify({pages,scenes:20,characters:script.scenes.reduce((n,s)=>n+s.blocks[0].text.length,0),inputRoundTripP95Ms:p95},null,2));expect(p95).toBeLessThan(100);
 await page.getByRole('button',{name:'长篇性能测试',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'保存项目备份',exact:true}).click();const backup=await download;await backup.saveAs('artifacts/long-backup.changjing');const saved=JSON.parse(await fs.readFile('artifacts/long-backup.changjing','utf8'));expect(saved.scenes).toHaveLength(20);expect(saved.scenes[0].blocks[0].text.length).toBe(script.scenes[0].blocks[0].text.length+30);
});
