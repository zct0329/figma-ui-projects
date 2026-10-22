export function regions(layout){return layout.map(([w,h,x,y],i)=>({id:i,w,h,x,y}));}
export function dimensions(item){return item.rotated?[item.h,item.w]:[item.w,item.h];}
export function allowed(item,c){return c.kind!=='safe'||['collection','medical','ammo'].includes(item.type);}
export function fits(item,c,rid,x,y,ignore=item.uid){
 const r=c.regions.find(r=>r.id===rid),[w,h]=dimensions(item);
 if(!r||!allowed(item,c)||x<0||y<0||x+w>r.w||y+h>r.h)return false;
 return !c.items.some(t=>{if(t.uid===ignore||t.region!==rid)return false;const [tw,th]=dimensions(t);return x<t.x+tw&&x+w>t.x&&y<t.y+th&&y+h>t.y;});
}
export function firstFit(item,c,rotate=true){
 for(const turn of rotate?[false,true]:[false]){
  const t={...item,rotated:turn?!item.rotated:item.rotated};
  for(const r of c.regions)for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++)if(fits(t,c,r.id,x,y))return {region:r.id,x,y,rotated:t.rotated};
 }return null;
}
export function capacity(c){return c.regions.reduce((s,r)=>s+r.w*r.h,0);}
export function used(c){return c.items.reduce((s,i)=>s+i.w*i.h,0);}
export function value(i){return i.value*(i.qty||1)+(i.attachments||[]).reduce((n,a)=>n+value(a),0);}
export function earnings(i){return i.value*Math.max(0,(i.qty||1)-(i.initialQty||0))+(i.attachments||[]).reduce((n,a)=>n+earnings(a),0);}
export function transfer(item,from,to,pos=null){
 if(!from?.items.includes(item)||!to)return {ok:false,reason:'物品已移动或来源无效'};
 if(!item.revealed)return {ok:false,reason:'搜索完成后才能移动物品'};
 if(!allowed(item,to))return {ok:false,reason:'安全箱不能放入枪械、配件或装备'};
 if(pos){
  const target=to.items.find(t=>t.uid!==item.uid&&t.region===pos.region&&pos.x>=t.x&&pos.y>=t.y&&pos.x<t.x+dimensions(t)[0]&&pos.y<t.y+dimensions(t)[1]);
  if(target&&target.id===item.id&&item.maxStack&&target.qty<target.maxStack){
   const n=Math.min(item.qty,target.maxStack-target.qty);const init=Math.min(n,item.initialQty||0);
   target.qty+=n;target.initialQty=(target.initialQty||0)+init;item.qty-=n;item.initialQty=(item.initialQty||0)-init;
   if(!item.qty)from.items.splice(from.items.indexOf(item),1);
   return {ok:true,merged:true,partial:item.qty>0};
  }
 }
 const p=pos?{...pos,rotated:item.rotated}:firstFit(item,to);
 if(!p||!fits({...item,rotated:p.rotated},to,p.region,p.x,p.y))return {ok:false,reason:'空间不足，试试旋转物品或换一个分格'};
 from.items.splice(from.items.indexOf(item),1);Object.assign(item,p);to.items.push(item);return {ok:true};
}
export function repack(c){
 const original=c.items.map(i=>({...i}));const sorted=[...c.items].sort((a,b)=>b.w*b.h-a.w*a.h);c.items=[];
 for(const i of sorted){const p=firstFit(i,c);if(!p){c.items=original;return false;}Object.assign(i,p);c.items.push(i);}return true;
}
export function searchStep(source,ms,speed=1){
 const item=source.flatMap(c=>c.items).find(i=>!i.revealed);
 if(!item)return null;
 item.progress=Math.min(item.duration,(item.progress||0)+ms*speed);
 if(item.progress>=item.duration){item.revealed=true;return item;}return null;
}
export function validate(containers){
 const seen=new Set();for(const c of containers)for(const i of c.items){if(seen.has(i.uid))throw new Error('Duplicate '+i.uid);seen.add(i.uid);if(!fits(i,c,i.region,i.x,i.y))throw new Error('Invalid placement '+i.name+' in '+c.id);}return true;
}

export function detachAttachment(gun,uid,targets){
 const part=gun.attachments?.find(a=>a.uid===uid);
 if(!part)return {ok:false,reason:'配件已不在此枪上'};
 for(const to of targets){const pos=firstFit(part,to);if(!pos)continue;gun.attachments.splice(gun.attachments.indexOf(part),1);Object.assign(part,pos);to.items.push(part);return {ok:true};}
 return {ok:false,reason:'没有足够空间拆下配件，配件仍在枪上'};
}
export function attachAttachment(gun,part,from){
 if(gun.type!=='weapon'||part.type!=='attachment'||!part.revealed||!from.items.includes(part))return {ok:false,reason:'不能安装此物品'};
 const slot=part.attachmentSlot||(part.id.startsWith('1311')?'optic':part.id.startsWith('1313')?'muzzle':null);
 if(!slot||part.compatibleWeapon&&part.compatibleWeapon!==gun.id)return {ok:false,reason:'此配件不兼容当前枪械'};
 gun.attachments??=[];
 if(gun.attachments.some(a=>a.attachmentSlot===slot))return {ok:false,reason:'先拆下当前槽位配件'};
 from.items.splice(from.items.indexOf(part),1);part.attachmentSlot=slot;gun.attachments.push(part);return {ok:true};
}
