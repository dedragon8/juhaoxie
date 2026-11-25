import {Server} from '@hocuspocus/server';
import * as Y from 'yjs';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {Store} from './store';
const PORT=Number(process.env.PORT||1234),HOST=process.env.HOST||'127.0.0.1';
const DATA=path.resolve(process.env.DATA_DIR||'data');
const PUBLIC_URL=(process.env.PUBLIC_URL||`http://127.0.0.1:${PORT}`).replace(/\/$/,'');
const store=new Store(DATA,process.env.DATABASE_URL);await store.init();
type Account={salt:string;hash:string};type Grant={id:string;room:string;role:'owner'|'editor'|'viewer';createdAt:number;revoked:boolean};type Auth={users:Record<string,Account>;sessions:Record<string,{user:string;expires:number}>;grants:Record<string,Grant>;rooms:Record<string,{title:string;owner:string}>};
const auth=await store.json<Auth>('auth',{users:{},sessions:{},grants:{},rooms:{}});
const hash=(s:string)=>crypto.createHash('sha256').update(s).digest('hex');const token=()=>crypto.randomBytes(32).toString('base64url');
const configured=process.env.TEST_USERS_JSON?JSON.parse(process.env.TEST_USERS_JSON):null;
async function addUser(name:string,password:string){const salt=crypto.randomBytes(16).toString('hex');auth.users[name]={salt,hash:crypto.scryptSync(password,salt,32).toString('hex')};}
if(configured){for(const [name,password]of Object.entries(configured))await addUser(name,String(password));}
if(!Object.keys(auth.users).length){const password=token().slice(0,20);await addUser('writer',password);await fs.mkdir(DATA,{recursive:true,mode:0o700});await fs.writeFile(path.join(DATA,'first-login.txt'),`场景协作服务\n地址：${PUBLIC_URL}\n账号：writer\n密码：${password}\n\n仅首次启动生成，请妥善保管。\n`,{mode:0o600});console.log(`首次测试账号已写入 ${path.join(DATA,'first-login.txt')}`);}
await store.putJson('auth',auth);
const allowed=new Set([PUBLIC_URL,'http://127.0.0.1:5173','http://localhost:5173','null',...(process.env.ALLOWED_ORIGINS||'').split(',').filter(Boolean)]);
function grant(raw:string,room:string){const g=auth.grants[hash(raw)];if(!g||g.revoked||g.room!==room)throw Error('访问已失效');return g;}
function bearer(req:IncomingMessage){return String(req.headers.authorization||'').replace(/^Bearer /,'')}
function respond(res:ServerResponse,status:number,data:unknown){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
async function body(req:IncomingMessage){let bytes=0;const parts:Buffer[]=[];for await(const chunk of req){const b=Buffer.from(chunk);bytes+=b.length;if(bytes>25_000_000)throw Error('请求内容过大');parts.push(b)}return JSON.parse(Buffer.concat(parts).toString()||'{}')}
const attempts=new Map<string,{count:number;until:number}>();
const server=new Server({port:PORT,address:HOST,quiet:true,debounce:350,maxDebounce:1500,
 async onAuthenticate({token,documentName,connectionConfig}){const g=grant(token,documentName);connectionConfig.readOnly=g.role==='viewer';return {grantKey:hash(token),role:g.role};},
 async beforeHandleMessage({context,documentName}){const g=auth.grants[context.grantKey];if(!g||g.revoked||g.room!==documentName)throw Error('访问已失效');},
 async onLoadDocument({documentName,document}){const state=await store.get(`doc:${documentName}`);if(state)Y.applyUpdate(document,state);},
 async onStoreDocument({documentName,document}){await store.set(`doc:${documentName}`,Y.encodeStateAsUpdate(document));},
 async onStateless({payload,document,documentName,connection}){const message=JSON.parse(payload);if(message.type==='persist'){await store.set(`doc:${documentName}`,Y.encodeStateAsUpdate(document));connection.sendStateless(JSON.stringify({type:'persisted',requestId:message.requestId}));}},
 async onRequest({request:req,response:res}){
  try{
   const origin=req.headers.origin;if(origin&&!allowed.has(origin)){respond(res,403,{error:'此来源未获授权'});throw null;}
   if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');}
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();throw null;}
   const url=new URL(req.url||'/',PUBLIC_URL),route=url.pathname;
   if(route==='/api/health'){respond(res,200,{ok:true,service:'changjing',version:'0.1.0'});throw null;}
   if(route==='/api/login'&&req.method==='POST'){
    const ip=req.socket.remoteAddress||'unknown';const rate=attempts.get(ip);if(rate&&rate.until>Date.now()&&rate.count>=10){respond(res,429,{error:'尝试次数过多，请稍后再试'});throw null;}
    const input=await body(req),account=auth.users[String(input.username)];const calculated=crypto.scryptSync(String(input.password||''),account?.salt||'missing-account',32);
    if(!account||!crypto.timingSafeEqual(calculated,Buffer.from(account.hash,'hex'))){attempts.set(ip,{count:rate&&rate.until>Date.now()?rate.count+1:1,until:Date.now()+10*60_000});respond(res,401,{error:'账号或密码不正确'});throw null;}
    attempts.delete(ip);const raw=token();auth.sessions[hash(raw)]={user:input.username,expires:Date.now()+8*3600_000};await store.putJson('auth',auth);respond(res,200,{token:raw});throw null;
   }
   if(route==='/api/rooms'&&req.method==='POST'){
    const session=auth.sessions[hash(bearer(req))];if(!session||session.expires<Date.now()){respond(res,401,{error:'请重新登录'});throw null;}
    const input=await body(req);const state=Buffer.from(String(input.update||''),'base64');const probe=new Y.Doc();try{Y.applyUpdate(probe,state);if(probe.getMap('meta').get('schemaVersion')!=='1')throw Error()}catch{respond(res,400,{error:'剧本数据无效'});throw null;}finally{probe.destroy()}
    const room=crypto.randomUUID(),raw=token();auth.rooms[room]={title:String(input.title||'未命名剧本'),owner:session.user};auth.grants[hash(raw)]={id:crypto.randomUUID(),room,role:'owner',createdAt:Date.now(),revoked:false};await store.set(`doc:${room}`,state);await store.putJson('auth',auth);respond(res,201,{room,token:raw});throw null;
   }
   const match=route.match(/^\/api\/rooms\/([\w-]+)\/(invites|revoke)$/);
   if(match){let owner;try{owner=grant(bearer(req),match[1]);}catch{respond(res,403,{error:'没有访问权限'});throw null;}if(owner.role!=='owner'){respond(res,403,{error:'仅创建者可管理邀请'});throw null;}
    if(match[2]==='invites'&&req.method==='GET'){respond(res,200,{invites:Object.values(auth.grants).filter(g=>g.room===match[1]&&g.role!=='owner')});throw null;}
    if(match[2]==='invites'&&req.method==='POST'){const input=await body(req);if(!['editor','viewer'].includes(input.role)){respond(res,400,{error:'无效的权限'});throw null;}const raw=token();auth.grants[hash(raw)]={id:crypto.randomUUID(),room:match[1],role:input.role,createdAt:Date.now(),revoked:false};await store.putJson('auth',auth);respond(res,201,{token:raw,publicUrl:PUBLIC_URL});throw null;}
    if(match[2]==='revoke'&&req.method==='POST'){const input=await body(req);const target=Object.entries(auth.grants).find(([,g])=>g.id===input.id&&g.room===match[1]&&g.role!=='owner');if(!target){respond(res,404,{error:'邀请不存在'});throw null;}target[1].revoked=true;await store.putJson('auth',auth);const live=server.hocuspocus.documents.get(match[1]);live?.getConnections().filter(c=>c.context.grantKey===target[0]).forEach(c=>c.close({code:4403,reason:'邀请已撤销'}));respond(res,200,{ok:true});throw null;}
   }
   if(route.startsWith('/api/')){respond(res,404,{error:'接口不存在'});throw null;}
   if(req.method!=='GET'){respond(res,405,{error:'请求方法不支持'});throw null;}
   const root=path.resolve('dist'),filename=path.resolve(root,'.'+decodeURIComponent(route==='/'?'/index.html':route));
   if(!filename.startsWith(root+path.sep)){respond(res,404,{error:'文件不存在'});throw null;}
   try{const data=await fs.readFile(filename);const ext=path.extname(filename);const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.otf':'font/otf','.ttf':'font/ttf','.txt':'text/plain'};res.writeHead(200,{'Content-Type':mime[ext]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(data)}catch{respond(res,404,{error:'请先运行 pnpm build，或检查网址。'})}
  }catch(e){if(e&&!res.headersSent){console.error('HTTP request failed',e instanceof Error?e.message:'unknown');respond(res,400,{error:'请求失败，请检查输入或服务状态'})}}
  throw null;
 }
});
await server.listen();console.log(`场景协作服务：${PUBLIC_URL}（绑定 ${HOST}:${PORT}）`);
process.on('SIGTERM',()=>store.close());
