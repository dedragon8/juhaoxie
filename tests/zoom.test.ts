import test from 'node:test';import assert from 'node:assert/strict';
import {zoomFromWheel} from '../src/core/zoom';
test('pinch decodes the OS scale instead of dampening it into fixed increments',()=>{for(const start of [60,100,150])for(const factor of [.9,1.2])assert.ok(Math.abs(zoomFromWheel(start,-100*Math.log(factor))-start*factor)<1e-10)});
test('small gesture events accumulate identically to a coalesced event, and reverse exactly',()=>{let value=100;for(let i=0;i<10;i++)value=zoomFromWheel(value,-2);assert.ok(Math.abs(value-zoomFromWheel(100,-20))<1e-10);assert.ok(Math.abs(zoomFromWheel(value,20)-100)<1e-10);assert.equal(zoomFromWheel(195,-50),200);assert.equal(zoomFromWheel(52,50),50);assert.equal(zoomFromWheel(100,NaN),100)});

import {softenPan,pullElastic,stepElasticSpring} from '../src/core/zoom';
test('slight diagonal pan is strongly damped but never locked; deliberate two-axis input stays available',()=>{
 for(const sign of [-1,1]){const p=softenPan(2*sign,40*sign);assert.equal(p.dy,40*sign);assert.ok(Math.abs(p.dx)>0&&Math.abs(p.dx)<.1);const h=softenPan(40*sign,2*sign);assert.equal(h.dx,40*sign);assert.ok(Math.abs(h.dy)>0&&Math.abs(h.dy)<.1)}
 assert.deepEqual(softenPan(20,20),{dx:20,dy:20});assert.deepEqual(softenPan(-60,0),{dx:-60,dy:0});assert.deepEqual(softenPan(0,0),{dx:0,dy:0});
});
test('edge resistance stays bounded and a critically damped release settles without oscillating',()=>{
 let x=0;for(let i=0;i<100;i++)x=pullElastic(x,-100);assert.ok(x>0&&x<=48);assert.ok(pullElastic(0,100)<0);
 let v=0,previous=x;for(let i=0;i<120;i++){[x,v]=stepElasticSpring(x,v,1/120);assert.ok(x>=0&&x<=previous);previous=x}assert.ok(x<.01);
 const a=stepElasticSpring(20,-90,.016),b=stepElasticSpring(...stepElasticSpring(20,-90,.008),.008);assert.ok(Math.abs(a[0]-b[0])<1e-10);assert.ok(Math.abs(a[1]-b[1])<1e-10);
});
