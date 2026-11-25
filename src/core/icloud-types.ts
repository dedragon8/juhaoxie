export type CloudRole='owner'|'editor'|'viewer';
export type CloudReference={container:string;zone:string;owner:string;scope:'private'|'shared';accountID:string;role:CloudRole};
export type CloudAccount={status:'available'|'no-account'|'restricted'|'unavailable'|'not-configured';accountID?:string;container?:string;message?:string};
export type CloudRecord={id:string;kind:'update'|'version'|'presence';data:string;name?:string;at:number;clientID?:number};
export type CloudPage={records:CloudRecord[];deleted:string[];token:string;role:CloudRole};
export type CloudMember={id:string;name:string;role:CloudRole;accepted:boolean};
export type CloudProject={title:string;ref:CloudReference};
export type CloudBridge={request:(method:string,args?:Record<string,unknown>)=>Promise<any>};
export class CloudFailure extends Error {
 constructor(public code:string,message:string,public retryAfter=0){super(message);this.name='CloudFailure'}
}
export function toBase64(bytes:Uint8Array){let result='';for(let i=0;i<bytes.length;i+=8192)result+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(result)}
export function fromBase64(text:string){return Uint8Array.from(atob(text),c=>c.charCodeAt(0))}
export function cloudProjectKey(ref:CloudReference){return [ref.container,ref.accountID,ref.scope,ref.owner,ref.zone].map(encodeURIComponent).join(':')}
