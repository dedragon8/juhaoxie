import {type CloudBridge} from './icloud-types';
declare global {interface Window {icloudNative?:{request:(method:string,args?:Record<string,unknown>)=>Promise<{ok:boolean;value?:any;error?:{code:string;message:string;retryAfter?:number}}>;openSettings:()=>Promise<void>}}}
export type NativeCloudBridge=CloudBridge&{openSettings:()=>Promise<void>};
// Keep the bridge type for file compatibility; this release never starts CloudKit.
export function getCloudBridge():NativeCloudBridge|undefined {return undefined}
