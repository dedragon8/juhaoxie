export const MIN_ZOOM=50,MAX_ZOOM=200;
export const clampZoom=(zoom:number)=>Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,zoom));
// Chromium encodes the OS pinch scale as DOM deltaY = -100 * log(scale).
// Invert that encoding; do not read pointer tracking speed or dampen the gesture.
// https://chromium.googlesource.com/chromium/src.git/+/refs/heads/lkgr/components/input/touchpad_pinch_event_queue.cc
export function zoomFromWheel(current:number,deltaY:number,deltaMode=0,pageHeight=800){
 const pixels=deltaY*(deltaMode===1?16:deltaMode===2?pageHeight:1);
 return Number.isFinite(pixels)?clampZoom(current*Math.exp(-pixels/100)):current;
}

// Soft attenuation, never axis locking. No new inertia or system-setting overrides.
// Apple describes predominant-axis intent in NSScrollView; this gain curve is app-specific.
export function softenPan(dx:number,dy:number){
 const ax=Math.abs(dx),ay=Math.abs(dy),major=Math.max(ax,ay);
 if(!major)return {dx,dy};
 const ratio=Math.min(ax,ay)/major,gain=.04+.96*ratio**3;
 return ax<ay?{dx:dx*gain,dy}:ay<ax?{dx,dy:dy*gain}:{dx,dy};
}

// Increasing edge resistance, limited to 48 screen pixels regardless of zoom.
export function pullElastic(offset:number,excess:number){
 const limit=48,raw=Math.sign(offset)*-limit*Math.log1p(-Math.min(Math.abs(offset)/limit,.999999));
 const next=raw-excess*.3;return Math.sign(next)*limit*-Math.expm1(-Math.abs(next)/limit);
}
// Exact critically damped spring step. Keeps position/velocity continuous and avoids repeated oscillation.
export function stepElasticSpring(position:number,velocity:number,dt:number):[number,number]{
 const omega=20,b=velocity+omega*position,decay=Math.exp(-omega*dt);
 return [(position+b*dt)*decay,(velocity-omega*b*dt)*decay];
}
