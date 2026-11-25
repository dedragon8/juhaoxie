import fs from 'node:fs/promises';
import path from 'node:path';
import {Pool} from 'pg';
export class Store {
 private pool?:Pool;private queues=new Map<string,Promise<void>>();
 constructor(public directory:string,connection?:string){if(connection)this.pool=new Pool({connectionString:connection});}
 async init(){if(this.pool)await this.pool.query('CREATE TABLE IF NOT EXISTS changjing_store (key text PRIMARY KEY, value bytea NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())');else await fs.mkdir(this.directory,{recursive:true,mode:0o700});}
 async get(key:string):Promise<Buffer|null>{if(this.pool){const r=await this.pool.query('SELECT value FROM changjing_store WHERE key=$1',[key]);return r.rows[0]?.value||null;}try{return await fs.readFile(path.join(this.directory,encodeURIComponent(key)))}catch(e:any){if(e.code==='ENOENT')return null;throw e}}
 async set(key:string,value:Uint8Array){const data=Buffer.from(value);const prior=this.queues.get(key)||Promise.resolve();const next=prior.catch(()=>{}).then(async()=>{if(this.pool){await this.pool.query('INSERT INTO changjing_store(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=$2,updated_at=now()',[key,data]);}else{const destination=path.join(this.directory,encodeURIComponent(key));const temp=destination+'.tmp';const handle=await fs.open(temp,'w',0o600);try{await handle.writeFile(data);await handle.sync()}finally{await handle.close()}await fs.rename(temp,destination);}});this.queues.set(key,next);await next;if(this.queues.get(key)===next)this.queues.delete(key);}
 async json<T>(key:string,fallback:T):Promise<T>{const raw=await this.get(key);return raw?JSON.parse(raw.toString()):fallback;}
 async putJson(key:string,value:unknown){await this.set(key,Buffer.from(JSON.stringify(value)));}
 async close(){await Promise.all(this.queues.values());await this.pool?.end();}
}
