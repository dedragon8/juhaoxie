import {useLayoutEffect,useRef,type ReactNode} from 'react';
type Geometry={left:number;top:number;width:number;height:number};
const keys=['left','top','width','height'] as const;
export function GlassNavigation({value,className,label,children}:{value:string;className:string;label:string;children:ReactNode}){
 const ref=useRef<HTMLElement>(null),pill=useRef<HTMLSpanElement>(null),current=useRef<Geometry|null>(null),velocity=useRef<Geometry>({left:0,top:0,width:0,height:0});
 useLayoutEffect(()=>{
  const el=ref.current,selected=el?.querySelector<HTMLElement>('button.selected'),indicator=pill.current;if(!el||!selected||!indicator)return;
  let frame=0,last=0,target:Geometry;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const paint=()=>{const p=current.current!;Object.assign(indicator.style,{transform:`translate3d(${p.left}px,${p.top}px,0)`,width:`${p.width}px`,height:`${p.height}px`,opacity:'1'})};
  const tick=(time:number)=>{const dt=Math.min((time-last)/1000||1/60,1/30);last=time;let moving=false;
   for(const key of keys){const distance=target[key]-current.current![key];velocity.current[key]+=(distance*440-velocity.current[key]*40)*dt;current.current![key]+=velocity.current[key]*dt;if(Math.abs(distance)>.08||Math.abs(velocity.current[key])>.08)moving=true}
   paint();if(moving)frame=requestAnimationFrame(tick);else{current.current={...target};velocity.current={left:0,top:0,width:0,height:0};paint();frame=0}
  };
  const measure=()=>{target={left:selected.offsetLeft,top:selected.offsetTop,width:selected.offsetWidth,height:selected.offsetHeight};cancelAnimationFrame(frame);last=0;if(!current.current||reduced.matches||document.documentElement.dataset.reduceMotion==='true'){current.current={...target};velocity.current={left:0,top:0,width:0,height:0};paint()}else frame=requestAnimationFrame(tick)};
  measure();const observer=new ResizeObserver(measure);observer.observe(el);observer.observe(selected);const preferences=new MutationObserver(measure);preferences.observe(document.documentElement,{attributes:true,attributeFilter:['data-reduce-motion']});reduced.addEventListener('change',measure);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();preferences.disconnect();reduced.removeEventListener('change',measure)};
 },[value]);
 return <nav ref={ref} className={`${className} glass-navigation`} aria-label={label}><span ref={pill} aria-hidden="true" className="glass-selection"/>{children}</nav>;
}
