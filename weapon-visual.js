import {visualPart} from './weapon-parts.js?v=20261022-ground3';
// A 2D assembly preview using the item's current attachment tree, not a new item image.
const crop={optic:{'13110000051':[41,1,291,191],'13110000056':[24,55,312,81]},muzzle:[13,50,343,92],grip:[23,12,20,44],stock:[7,12,50,43],magazine:[12,4,33,56],laser:[6,15,51,32]};
function partImage(part,box){const [x,y,w,h]=box,slot=part.attachmentSlot;let bounds=part.visualBounds||(slot==='optic'?crop.optic[part.id]:crop[slot]);if(!bounds)return `<image href="${escape(part.img)}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;const generic=!part.visualSourceSize&&['grip','stock','magazine','laser'].includes(slot);const sourceSize=part.visualSourceSize||(generic?[64,64]:[384,192]);return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${bounds.join(' ')}" preserveAspectRatio="xMidYMid meet"><image href="${escape(part.img)}" width="${sourceSize[0]}" height="${sourceSize[1]}"/></svg>`;}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortNames={'13110000051':'HAMR','13110000056':'8倍镜','13130000164':'轻语','13140000022':'相位','13040000109':'精英托','13040000113':'416托','13120000235':'60发鼓','13120000263':'45发鼓','13120000174':'50发鼓','13120000254':'45发匣','13120000321':'60发鼓','13160000005':'PEQ-2'};
const slots={optic:'瞄具',muzzle:'枪口',grip:'前握把',stock:'枪托',magazine:'弹匣',laser:'镭射'};
const base={optic:[184,-6,93,49],muzzle:[-83,44,101,35],grip:[104,75,32,57],stock:[270,48,114,85],magazine:[174,88,56,82],laser:[96,34,52,27]};
const profiles={
 '18010000001':base,
 '18010000013':{...base,optic:[188,-4,93,49],grip:[105,85,32,57]},
 '18010000016':{...base,optic:[182,0,94,50],muzzle:[-83,60,102,35],grip:[102,91,32,57],stock:[297,48,88,78],magazine:[177,96,56,72]},
 '18010000021':{...base,optic:[186,-2,94,50],muzzle:[-83,55,102,35],stock:[290,52,95,78]},
 '18010000037':{...base,optic:[178,16,95,51],muzzle:[-83,55,102,35],grip:[107,91,31,53],magazine:[175,99,47,57],laser:[110,52,46,23]},
 '18020000010':{...base,optic:[126,-1,80,44],muzzle:[-61,64,79,29],grip:[70,103,28,42],magazine:[162,126,47,43],laser:[62,43,46,25]},
 '18060000011':{...base,optic:[192,34,116,55],muzzle:[-83,72,102,35],grip:[135,104,30,42],stock:[294,85,91,67],magazine:[240,106,41,42],laser:[123,72,43,24]}
};
export function weaponVisualHTML(gun,{legend=false}={}){
 const parts=(gun.attachments||[]).map(part=>visualPart(part,gun)),profile=profiles[gun.id]||base;
 const label=escape(gun.name+(parts.length?'，'+parts.map(a=>a.name).join('，'):'，无已安装配件'));
 const maskId='gun-mask-'+escape(gun.uid);const hasSlot=slot=>parts.some(a=>a.attachmentSlot===slot);
 let cutouts='';
 // Suppress the stock/magazine from the base thumbnail where a replacement is mounted.
 if(hasSlot('stock')){const [x,y,w,h]=profile.stock;cutouts+=`<rect x="${Math.max(298,x+15)}" y="${y}" width="${w}" height="${h}" fill="black"/>`;}
 if(hasSlot('magazine')){const [x,y,w,h]=profile.magazine;cutouts+=`<rect x="${x}" y="${Math.max(104,y+12)}" width="${w}" height="${h}" fill="black"/>`;}
 // These source thumbnails already include an optic; cover it when rendering its current slot.
 if(gun.id==='18060000011'&&hasSlot('optic'))cutouts+='<rect x="190" y="40" width="125" height="47" fill="black"/>';
 if(gun.id==='18010000037'&&hasSlot('optic'))cutouts+='<rect x="165" y="30" width="100" height="37" fill="black"/>';
 const mounted=parts.map(part=>{const slot=part.attachmentSlot,box=profile[slot];if(!box)return '';return `<g class="mounted-part" data-part-slot="${slot}" data-part-uid="${escape(part.uid)}"><title>${escape(part.name)}</title>${partImage(part,box)}</g>`;}).join('');
 const svg=`<svg class="weapon-assembly" viewBox="-90 -12 490 200" role="img" aria-label="${label}" data-weapon-uid="${escape(gun.uid)}"><title>${label}</title><defs><mask id="${maskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="180"><rect width="400" height="180" fill="white"/>${cutouts}</mask></defs><image class="weapon-base" href="${escape(gun.img)}" x="0" y="0" width="384" height="192" mask="url(#${maskId})"/>${mounted}</svg>`;
 const strip=legend&&parts.length?`<div class="weapon-mounted-list" aria-label="已安装配件">${parts.map(a=>`<span title="${escape(a.name)}" data-part-label="${escape(a.attachmentSlot)}"><img src="${escape(a.img)}" alt=""><span>${shortNames[a.id]||slots[a.attachmentSlot]||'配件'}</span></span>`).join('')}</div>`:'';
 return `<div class="weapon-preview ${legend?'has-parts-legend':''}">${svg}${strip}</div>`;
}
