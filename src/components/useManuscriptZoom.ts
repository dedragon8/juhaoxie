import {useCallback,useEffect,useLayoutEffect,useRef,useState,type RefObject} from 'react';
import {clampZoom,zoomFromWheel,softenPan,pullElastic,stepElasticSpring} from '../core/zoom';
type Viewport={zoom:number;autoFit:boolean;x:number;y:number;sceneId?:string;sceneY?:number};
export function useManuscriptZoom(scroll:RefObject<HTMLDivElement|null>,enabled:boolean,projectId:string){
 const positions=useRef(new Map<string,Viewport>());
 const [zoom,update]=useState(100),value=useRef(100),applied=useRef(100),frame=useRef(0);
 const autoFit=useRef(true),fitFrame=useRef(0),stopElastic=useRef(()=>{});
 const anchor=useRef<{x:number;y:number;pageX:number;pageY:number}|null>(null);
 const setZoom=useCallback((next:number,x?:number,y?:number)=>{
  const el=scroll.current;if(!el)return;autoFit.current=false;cancelAnimationFrame(fitFrame.current);fitFrame.current=0;const target=clampZoom(next);if(target===value.current)return;
  const paper=el.querySelector<HTMLElement>('.manuscript');
  if(!anchor.current&&paper){const viewport=el.getBoundingClientRect(),rect=paper.getBoundingClientRect();const px=x??viewport.left+el.clientWidth/2,py=y??viewport.top+el.clientHeight/2;anchor.current={x:px,y:py,pageX:(px-rect.left)/(applied.current/100),pageY:(py-rect.top)/(applied.current/100)}}
  value.current=target;
  if(frame.current)return;
  frame.current=requestAnimationFrame(()=>{frame.current=0;const scale=value.current/100;el.style.setProperty('--writing-scale',String(scale));const a=anchor.current;if(a&&paper){const rect=paper.getBoundingClientRect();el.scrollLeft+=rect.left+a.pageX*scale-a.x;el.scrollTop+=rect.top+a.pageY*scale-a.y;}anchor.current=null;applied.current=value.current;update(value.current);window.dispatchEvent(new Event('resize'));});
 },[scroll]);
 // Record document coordinates, rather than the shared scroll container's offsets.
 // A scene-relative anchor also follows the same content after scene reordering.
 const capture=useCallback(():Viewport|null=>{
  const el=scroll.current,paper=el?.querySelector<HTMLElement>('.manuscript');
  if(!el||!paper||paper.dataset.projectId!==projectId)return null;
  const viewport=el.getBoundingClientRect(),rect=paper.getBoundingClientRect(),scale=applied.current/100;
  const centerY=viewport.top+el.clientHeight/2;
  const scene=Array.from(paper.querySelectorAll<HTMLElement>('.scene-section')).find(node=>{const r=node.getBoundingClientRect();return r.top<=centerY&&r.bottom>=centerY});
  return {zoom:applied.current,autoFit:autoFit.current,x:(viewport.left+el.clientWidth/2-rect.left)/scale,y:(centerY-rect.top)/scale,sceneId:scene?.id,sceneY:scene?(centerY-scene.getBoundingClientRect().top)/scale:undefined};
 },[scroll,projectId]);
 const remember=useCallback(()=>{stopElastic.current();const position=capture();if(position)positions.current.set(projectId,position)},[capture,projectId]);
 const gutters=useCallback(()=>{const el=scroll.current;if(el){el.style.setProperty('--canvas-x',`${Math.round(el.clientWidth*.75)}px`);el.style.removeProperty('--canvas-y')}},[scroll]);
 const place=useCallback((position:Viewport,centerHorizontally=false)=>{
  const el=scroll.current,paper=el?.querySelector<HTMLElement>('.manuscript');if(!el||!paper)return;
  const viewport=el.getBoundingClientRect(),rect=paper.getBoundingClientRect(),scale=value.current/100;
  const scene=position.sceneId?document.getElementById(position.sceneId):null;
  const targetY=scene&&paper.contains(scene)?scene.getBoundingClientRect().top+(position.sceneY||0)*scale:rect.top+position.y*scale;
  el.scrollLeft+=centerHorizontally?rect.left+rect.width/2-viewport.left-el.clientWidth/2:rect.left+position.x*scale-viewport.left-el.clientWidth/2;
  el.scrollTop+=targetY-viewport.top-el.clientHeight/2;
 },[scroll]);
 const fitToWindow=useCallback(()=>{
  const el=scroll.current;if(!el||!el.querySelector('.manuscript'))return;stopElastic.current();
  const position=capture();if(!position)return;
  gutters();setZoom(Math.min(150,(el.clientWidth-96)/820*100));autoFit.current=true;
  fitFrame.current=requestAnimationFrame(()=>{fitFrame.current=0;place(position,true);remember()});
 },[scroll,setZoom,capture,gutters,place,remember]);
 useLayoutEffect(()=>{
  const el=scroll.current;if(!el||!enabled)return;
  const saved=positions.current.get(projectId);
  autoFit.current=saved?.autoFit??true;
  value.current=applied.current=saved?.zoom??clampZoom(Math.min(150,(el.clientWidth-96)/820*100));
  update(value.current);el.style.setProperty('--writing-scale',String(value.current/100));gutters();
  const restore=()=>{if(saved)place(saved);else{el.scrollLeft=(el.scrollWidth-el.clientWidth)/2;el.scrollTop=0}};
  restore();fitFrame.current=requestAnimationFrame(()=>{fitFrame.current=0;restore();remember()});
  const onScroll=()=>{if(!frame.current&&!fitFrame.current){const position=capture();if(position)positions.current.set(projectId,position)}};el.addEventListener('scroll',onScroll);
  let width=el.clientWidth,height=el.clientHeight;
  const resize=new ResizeObserver(()=>{
   if(width===el.clientWidth&&height===el.clientHeight)return;
   width=el.clientWidth;height=el.clientHeight;
   const position=positions.current.get(projectId)||capture();if(!position)return;
   gutters();if(autoFit.current){setZoom(Math.min(150,(width-96)/820*100));autoFit.current=true}
   cancelAnimationFrame(fitFrame.current);fitFrame.current=requestAnimationFrame(()=>{fitFrame.current=0;place(position,autoFit.current);remember()});
  });resize.observe(el);
  return()=>{resize.disconnect();el.removeEventListener('scroll',onScroll);cancelAnimationFrame(fitFrame.current);fitFrame.current=0};
 },[enabled,projectId,scroll,capture,gutters,place,remember,setZoom]);
 useEffect(()=>{
  const el=scroll.current;if(!el)return;el.style.setProperty('--writing-scale',String(value.current/100));if(!enabled)return;
  let spring=0,release:ReturnType<typeof setTimeout>|undefined,x=0,y=0,vx=0,vy=0,last=0,lastWheel=0,remainderX=0,remainderY=0;
  const reduced=()=>document.documentElement.dataset.reduceMotion==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const paint=()=>{const paper=el.querySelector<HTMLElement>('.manuscript');if(paper)paper.style.transform=x||y?`translate(${x/(value.current/100)}px,${y/(value.current/100)}px)`:''};
  const reset=()=>{cancelAnimationFrame(spring);spring=0;clearTimeout(release);x=y=vx=vy=remainderX=remainderY=0;paint()};
  stopElastic.current=reset;
  const settle=(now:number)=>{const dt=Math.min((now-last)/1000,.032);last=now;if(reduced()){reset();return}[x,vx]=stepElasticSpring(x,vx,dt);[y,vy]=stepElasticSpring(y,vy,dt);if(Math.abs(x)+Math.abs(y)+Math.abs(vx)+Math.abs(vy)<.2){reset();return}paint();spring=requestAnimationFrame(settle)};
  const wheel=(event:WheelEvent)=>{
   if(event.ctrlKey){event.preventDefault();reset();setZoom(zoomFromWheel(value.current,event.deltaY,event.deltaMode,el.clientHeight),event.clientX,event.clientY);return}
   if((event.target as HTMLElement).closest('textarea,select,[role="listbox"],.type-menu'))return;
   event.preventDefault();autoFit.current=false;cancelAnimationFrame(fitFrame.current);fitFrame.current=0;cancelAnimationFrame(spring);spring=0;clearTimeout(release);
   const unit=event.deltaMode===1?16:event.deltaMode===2?el.clientHeight:1;
   const {dx,dy}=softenPan((event.shiftKey&&!event.deltaX?event.deltaY:event.deltaX)*unit,(event.shiftKey&&!event.deltaX?0:event.deltaY)*unit);
   // Carry subpixel input so a heavily damped axis still moves over time.
   const requestedX=el.scrollLeft+dx+remainderX,requestedY=el.scrollTop+dy+remainderY;
   const targetX=Math.max(0,Math.min(el.scrollWidth-el.clientWidth,requestedX)),targetY=Math.max(0,Math.min(el.scrollHeight-el.clientHeight,requestedY));
   el.scrollLeft=targetX;el.scrollTop=targetY;remainderX=targetX-el.scrollLeft;remainderY=targetY-el.scrollTop;
   const excessX=requestedX-targetX,excessY=requestedY-targetY;
   if(reduced()){reset();return}
   // OS momentum remains in the wheel stream; only the distance beyond an edge is elastic.
   const now=performance.now(),dt=Math.max(.008,Math.min(.05,(now-lastWheel)/1000||.016)),previousX=x,previousY=y;
   x=excessX?pullElastic(x,excessX):x*.6;y=excessY?pullElastic(y,excessY):y*.6;
   vx=lastWheel&&now-lastWheel<70?Math.max(-180,Math.min(180,.5*vx+.5*(x-previousX)/dt)):0;
   vy=lastWheel&&now-lastWheel<70?Math.max(-180,Math.min(180,.5*vy+.5*(y-previousY)/dt)):0;lastWheel=now;paint();
   release=setTimeout(()=>{last=performance.now();spring=requestAnimationFrame(settle)},90);
  };
  el.addEventListener('wheel',wheel,{passive:false});
  return()=>{el.removeEventListener('wheel',wheel);reset();cancelAnimationFrame(frame.current);frame.current=0;anchor.current=null;value.current=applied.current};
 },[enabled,projectId,scroll,setZoom]);
 return {zoom,setZoom,remember,zoomBy:(delta:number)=>setZoom(value.current+delta),fitToWindow};
}
