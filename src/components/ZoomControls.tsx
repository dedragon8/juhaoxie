import type {CSSProperties} from 'react';
import {Minus,Plus} from 'lucide-react';
import {useManuscriptZoom} from './useManuscriptZoom';
import {MIN_ZOOM,MAX_ZOOM} from '../core/zoom';
// Keep rapid gesture updates local to this control; never rerender all scene editors.
export function ZoomControls({controls,enabled}:{controls:ReturnType<typeof useManuscriptZoom>;enabled:boolean}){
 const {zoom,setZoom,zoomBy,fitToWindow}=controls;
 return <div className="zoom-controls" style={{'--zoom-fill':`${(zoom-MIN_ZOOM)/(MAX_ZOOM-MIN_ZOOM)*100}%`} as CSSProperties}>
  <button aria-label="缩小文稿" disabled={!enabled||zoom<=MIN_ZOOM} onClick={()=>zoomBy(-10)}><Minus size={12}/></button>
  <input type="range" aria-label="写作缩放" aria-valuetext={`${Math.round(zoom)}%`} min={MIN_ZOOM} max={MAX_ZOOM} step="any" value={zoom} disabled={!enabled} onChange={e=>setZoom(Number(e.target.value))}/>
  <button aria-label="放大文稿" disabled={!enabled||zoom>=MAX_ZOOM} onClick={()=>zoomBy(10)}><Plus size={12}/></button>
  <button className="zoom-reset" title="适配窗口并居中" disabled={!enabled} onClick={fitToWindow}>{Math.round(zoom)}%</button>
 </div>;
}
