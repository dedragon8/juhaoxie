import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {mkdtemp,rm,stat,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';
const {createMcp}=createRequire(import.meta.url)('../electron/mcp.cjs');
test('real STDIO MCP handshake, status, read/write gates and disconnect',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'juhaoxie-mcp-test-'));const calls:any[]=[];let secured=false,slow=false,started:()=>void=()=>{},release:()=>void=()=>{};const server=createMcp({isProtected:()=>secured,userData:dir,executable:process.execPath,bridge:path.resolve('electron/mcp-stdio.cjs'),call:async(r:any)=>{calls.push(r);if(slow){started();await new Promise<void>(resolve=>release=resolve)}return {text:'文稿'}}});let child:ReturnType<typeof spawn>|undefined;
 try{
  assert.equal(server.state().enabled,false);const state=await server.configure({enabled:true,projectId:'a'});assert.equal((await stat(path.join(dir,'assistant-connection.json'))).mode&0o777,0o600);
  child=spawn(state.config.command,state.config.args,{stdio:['pipe','pipe','pipe']});let buffer='',id=0;const requests=new Map<number,(v:any)=>void>();child.stdout!.on('data',data=>{buffer+=data.toString();let i;while((i=buffer.indexOf('\n'))>=0){const message=JSON.parse(buffer.slice(0,i));buffer=buffer.slice(i+1);requests.get(message.id)?.(message);requests.delete(message.id)}});
  const request=(method:string,params:any={})=>new Promise<any>((resolve,reject)=>{const key=++id;const timer=setTimeout(()=>reject(Error('MCP timeout')),5000);requests.set(key,v=>{clearTimeout(timer);resolve(v)});child!.stdin!.write(JSON.stringify({jsonrpc:'2.0',id:key,method,params})+'\n')});
  const init=await request('initialize',{protocolVersion:'2025-06-18',clientInfo:{name:'验收客户端',version:'1'},capabilities:{}});assert.equal(init.result.serverInfo.name,'juhaoxie');child.stdin!.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  const list=await request('tools/list');assert.ok(list.result.tools.some((t:any)=>t.name==='read_script'));assert.deepEqual(server.state().clients,['验收客户端']);
  const untrained=await request('tools/call',{name:'save_video_prompt',arguments:{}});assert.equal(untrained.result.isError,true);
  const read=await request('tools/call',{name:'read_script',arguments:{}});assert.equal(read.result.isError,undefined);assert.equal(calls.length,1);
  const denied=await request('tools/call',{name:'create_scene',arguments:{request_id:'1',blocks:[]}});assert.equal(denied.result.isError,true);assert.equal(calls.length,1);
  await server.configure({enabled:true,projectId:'a',allowWrite:true});await request('tools/call',{name:'create_scene',arguments:{request_id:'1',blocks:[]}});assert.equal(calls.length,2);assert.equal(calls[1].write,true);assert.match(server.state().lastCall,/create_scene/);
  slow=true;const began=new Promise<void>(resolve=>started=resolve);const reading=request('tools/call',{name:'read_script',arguments:{}});await began;secured=true;release();const blocked=await reading;assert.equal(blocked.result.isError,true);assert.match(blocked.result.content[0].text,/安全区/);await assert.rejects(server.configure({enabled:true,projectId:'a'}),/安全区/);
  const close=new Promise(resolve=>child!.once('exit',resolve));await server.stop();await close;assert.equal(server.state().enabled,false);
 }finally{child?.kill();await server.stop();await rm(dir,{recursive:true,force:true})}
});
test('global access is opt-in, persists across restart and excludes protected projects',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'juhao-grants-'));
 const protectedIds=new Set<string>();
 const options={userData:dir,executable:process.execPath,bridge:path.resolve('electron/mcp-stdio.cjs'),call:async()=>({}),isProtected:(id:string)=>protectedIds.has(id)};
 await writeFile(path.join(dir,'assistant-grants.json'),JSON.stringify({version:1,grants:{a:{allowWrite:true}}}));
 let server=createMcp(options);
 try{
  assert.equal((await server.activate('a')).allowWrite,true);
  assert.equal((await server.activate('b')).enabled,false);
  assert.equal(server.state().appEnabled,false);
  await server.configure({enabled:true,projectId:'b'});
  assert.equal((await server.activate('a')).allowWrite,false);
  assert.equal((await server.activate('new')).enabled,true);
  await server.stop();server=createMcp(options);
  assert.equal((await server.activate('b')).appEnabled,true);
  protectedIds.add('b');await server.protectionChanged('b');
  assert.equal(server.state().enabled,false);assert.equal(server.state().appEnabled,true);
  assert.equal((await server.activate('a')).enabled,true);
  await server.configure({enabled:false});await server.stop();server=createMcp(options);
  assert.equal((await server.activate('a')).enabled,false);
 }finally{await server.stop();await rm(dir,{recursive:true,force:true})}
});
