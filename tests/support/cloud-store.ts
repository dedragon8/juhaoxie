// Deterministic CloudKit transport double. Never bundled into the application.
import {createHash} from 'node:crypto';
import {CloudFailure,type CloudReference,type CloudRecord} from '../../src/core/icloud-types';
type Project={title:string;owner:string;members:Record<string,'editor'|'viewer'>;records:CloudRecord[]};
export class TestCloudStore {
 calls:{account:string;method:string}[]=[];
 projects=new Map<string,Project>(); offline=new Set<string>();dropNextAck=false;
 snapshot(){return JSON.stringify([...this.projects])}
 restore(json:string){this.projects=new Map(JSON.parse(json))}
 bridge(accountID:string){return {request:(method:string,args:Record<string,any>={})=>this.request(accountID,method,args)}}
 ref(zone:string,accountID:string):CloudReference{const p=this.projects.get(zone)!;return {container:'iCloud.test.juhao',zone,owner:p.owner,scope:p.owner===accountID?'private':'shared',accountID,role:p.owner===accountID?'owner':p.members[accountID]}}
 async request(accountID:string,method:string,args:Record<string,any>={}):Promise<any>{
  this.calls.push({account:accountID,method});
  if(this.offline.has(accountID))throw new CloudFailure('retry','offline');
  if(method==='account')return {status:'available',accountID,container:'iCloud.test.juhao'};
  if(method==='create'){
   const zone='jw-'+args.projectId;
   if(!this.projects.has(zone))this.projects.set(zone,{title:args.title,owner:accountID,members:{},records:[]});
   const ref=this.ref(zone,accountID);await this.request(accountID,'push',{ref,data:args.data});return ref;
  }
  if(method==='projects')return [...this.projects].filter(([,p])=>p.owner===accountID||p.members[accountID]).map(([zone,p])=>({title:p.title,ref:this.ref(zone,accountID)}));
  if(method==='accept'){
   const zone=new URL(args.url).pathname.split('/').at(-1)!;const p=this.projects.get(zone);
   if(!p||!p.members[accountID])throw new CloudFailure('permission','not invited');return {title:p.title,ref:this.ref(zone,accountID)};
  }
  const ref=args.ref as CloudReference;
  if(ref.accountID!==accountID)throw new CloudFailure('account-changed','account changed');
  const p=this.projects.get(ref.zone);if(!p)throw new CloudFailure('permission','not found');
  const role=p.owner===accountID?'owner':p.members[accountID];if(!role)throw new CloudFailure('permission','revoked');
  if(method==='pull')return {records:p.records.slice(Number(args.token||0)),deleted:[],token:String(p.records.length),role};
  const members=()=>({url:`https://www.icloud.com/share/${ref.zone}`,members:[{id:p.owner,name:p.owner,role:'owner',accepted:true},...Object.entries(p.members).map(([id,role])=>({id,name:id,role,accepted:true}))]});
  if(method==='members')return members();
  if(['invite','permission','revoke'].includes(method)){
   if(role!=='owner')throw new CloudFailure('permission','owner only');
   if(method==='invite')p.members[args.email]=args.role;
   else if(method==='revoke')delete p.members[args.memberID];
   else p.members[args.memberID]=args.role;
   return members();
  }
  if(role==='viewer')throw new CloudFailure('permission','read only');
  if(method==='push'){
   const id='u-'+createHash('sha256').update(Buffer.from(args.data,'base64')).digest('hex');
   if(!p.records.some(r=>r.id===id))p.records.push({id,kind:'update',data:args.data,at:Date.now()});
   if(this.dropNextAck){this.dropNextAck=false;throw new CloudFailure('retry','saved but acknowledgement lost')}
   return {saved:true};
  }
  if(method==='presence'){p.records.push({id:'p-'+args.clientID,kind:'presence',data:args.data,clientID:args.clientID,at:Date.now()});return {saved:true}}
  if(method==='version'){p.records.push({id:'v-'+args.id,kind:'version',data:args.data,name:args.name,at:Date.now()});return {saved:true}}
  throw Error('Unsupported test operation '+method);
 }
}
