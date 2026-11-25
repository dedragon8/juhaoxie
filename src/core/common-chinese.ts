import type {Block,Scene} from './model';
import {shortDramaBlocks} from './short-drama';
// Presentation only. The structured source is preserved when switching layouts.
export const commonChineseBlocks=(blocks:Block[])=>shortDramaBlocks(blocks,false);
export const commonChineseHeading=(scene:Scene,index:number)=>`${index+1}　${scene.location||'场景地点'}　${scene.time}　${scene.setting}`;
