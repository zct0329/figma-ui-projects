import {referenceParts,referenceBuilds,visualPart} from './weapon-parts.js?v=20261022-ground3';
import {weaponVisualHTML} from './weapon-visual.js?v=20261022-ground3';
import {regions,dimensions,allowed,fits,firstFit,capacity,used,value,earnings,transfer,repack,searchStep,validate,detachAttachment,attachAttachment,dropContainer} from './engine.js?v=20261022-ground3';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const soundEffects=await fetch('sound-effects.json').then(r=>r.ok?r.json():{}).catch(()=>({}));
const catalog=await fetch('catalog.json').then(r=>{if(!r.ok)throw Error('物品资源加载失败');return r.json()});
const byName=n=>catalog.find(i=>i.name===n), pick=a=>a[Math.floor(Math.random()*a.length)], rarities=['','#89988b','#69a883','#619ec7','#a28abd','#d5ad67','#dc7772'];
const fmt=n=>Math.round(n).toLocaleString('zh-CN'), short=n=>n>=10000?(n/10000).toFixed(1)+'万':fmt(n);
let lastDrag=-Infinity;
let counter=0,state,selected=null,drag=null,toastTimer,modalOpen=false,flashUid=null,lastSaved=0;
let settings={sound:false,speed:1,safeSize:9,mode:'relax'};try{Object.assign(settings,JSON.parse(localStorage.getItem('space-settings')||'{}'));}catch{}
function freshItem(n,initial=false,qty=1){const base=typeof n==='string'?byName(n):n;if(!base)throw Error('Unknown item '+n);const result={...base,uid:('i'+Date.now().toString(36)+'-'+(++counter)+'-'+Math.random().toString(36).slice(2,8)),qty,initialQty:initial?qty:0,revealed:initial,progress:0,duration:950+base.grade*180+Math.random()*500,rotated:false};if(base.type==='weapon')result.attachments=weaponBuild(base,initial);return result;}

const attachmentSlots={optic:'瞄具',muzzle:'枪口',grip:'前握把',stock:'枪托',magazine:'弹匣',laser:'镭射'};
function weaponBuild(gun,initial){
 const optic=freshItem(gun.name.includes('AWM')?'光学狙击8倍瞄准镜':'HAMR组合瞄准镜',initial);optic.attachmentSlot='optic';
 const muzzle=freshItem('轻语战术消音器',initial);muzzle.attachmentSlot='muzzle';
 const parts=[optic,muzzle];
 for(const [slot,name] of [['grip','战术前握把'],['stock','稳定枪托'],['magazine','扩容弹匣'],['laser','战术镭射']]){
  if((gun.name.includes('AS Val')||gun.name.includes('MP7'))&&slot==='stock')continue;
  const refId=referenceBuilds[gun.id]?.[slot];if(refId){parts.push(freshItem({...referenceParts[refId],compatibleWeapon:gun.id},initial));continue;}
  parts.push({uid:'part-'+Date.now().toString(36)+'-'+(++counter),id:gun.id+'-'+slot,name:gun.name+' · '+name,w:1,h:1,grade:4,weight:.18,type:'attachment',value:18000,qty:1,initialQty:initial?1:0,revealed:true,rotated:false,attachmentSlot:slot,compatibleWeapon:gun.id,img:'assets/attachment-'+slot+'.svg',simulated:true});
 }
 parts.forEach(i=>i.revealed=true);return parts;
}
function gunPanel(uid){const l=locate(uid);if(!l||l.i.type!=='weapon'||!l.i.revealed)return;const gun=l.i;
 const loose=state.player.flatMap(c=>c.items).filter(i=>i.type==='attachment');
 openModal('枪械改装 · '+gun.name,`<div class="gunsmith-hero">${weaponVisualHTML(gun)}<span>${(gun.attachments||[]).length} / 6 配件</span></div><p>配件随枪保存、转移和结算。拆下后优先放入背包，空间不足时保留原位。</p><div class="attachment-grid">${Object.entries(attachmentSlots).map(([slot,label])=>{const owned=(gun.attachments||[]).find(a=>a.attachmentSlot===slot),part=owned?visualPart(owned,gun):null;return `<div class="attachment-card"><span>${label}</span>${part?`<img src="${part.img}" alt=""><b>${part.name}</b><small>${part.simulated?'模拟配件 · 非原版数值':'参考资料配件'}</small><button data-detach="${part.uid}">拆下 · ${short(value(part))}</button>`:'<b class="muted">未安装</b>'}</div>`}).join('')}</div><p>可安装的随身配件</p><div class="attach-options">${loose.map(a=>`<button data-attach="${a.uid}">${a.name}</button>`).join('')||'<span class="muted">暂无随身配件</span>'}</div><p class="muted">此为六槽模拟改装，非原版完整兼容性或属性系统。旧存档枪械保持原配置。</p>`);
 document.querySelectorAll('[data-detach]').forEach(b=>b.onclick=()=>{const r=detachAttachment(gun,b.dataset.detach,[state.player[1],state.player[0],state.player[3]]);if(!r.ok){toast(r.reason);return;}save();render();playItemMoveSound('move');gunPanel(uid);});
 document.querySelectorAll('[data-attach]').forEach(b=>b.onclick=()=>{const part=locate(b.dataset.attach);const r=attachAttachment(gun,part.i,part.c);if(!r.ok){toast(r.reason);return;}save();render();playItemMoveSound('move');gunPanel(uid);});
}

function makeContainer(id,label,layout,kind='normal',equipment=null){return {id,label,kind,equipment,regions:regions(layout),items:[]};}
function put(c,i,revealed=false){const p=firstFit(i,c);if(!p)return false;Object.assign(i,p);i.revealed=revealed||i.revealed;c.items.push(i);return true;}
function newGame(){
 const backpack=freshItem('D2战术登山包',true),rig=freshItem('DRC先进侦察胸挂',true);
 state={version:3,mode:settings.mode,searchCount:0,totalSearch:0,round:Math.random().toString(36).slice(2,7).toUpperCase(),seconds:0,finished:false,paused:false,current:0,created:Date.now(),equipment:{helmet:freshItem('GT5 指挥官头盔',true),armor:freshItem('特里克MAS2.0装甲',true),weapon1:freshItem('M4A1突击步枪',true),weapon2:null,backpack,rig},player:[makeContainer('p-rig','胸挂',rig.layout,'normal',rig),makeContainer('p-bag','背包',backpack.layout,'normal',backpack),makeContainer('p-safe','安全箱',[[settings.safeSize===9?3:settings.safeSize===6?3:2,settings.safeSize===9?3:settings.safeSize===6?2:1,0,0]],'safe'),makeContainer('p-pockets','口袋',[[1,1,0,0],[1,1,1.08,0],[1,1,2.16,0],[1,1,3.24,0]])],sources:[]};
 put(state.player[0],freshItem('5.56x45mm M855A1',true,60));put(state.player[0],freshItem('5.56x45mm M855A1',true,60));put(state.player[0],freshItem('野战急救包',true));put(state.player[0],freshItem('DVE止疼片',true));put(state.player[1],freshItem('户外医疗箱',true));put(state.player[1],freshItem('精密护甲维修包',true));put(state.player[3],freshItem('CAT止血带',true));
 const names=['干员 01','干员 02','干员 03','干员 04','航空物资箱','地面物资'];
 const collections=catalog.filter(i=>i.type==='collection'),meds=catalog.filter(i=>i.type==='medical'),ammo=catalog.filter(i=>i.type==='ammo'),acc=catalog.filter(i=>i.type==='attachment');
 for(let k=0;k<6;k++){
  const source={id:'s'+k,name:names[k],location:['黑室 · 二楼楼梯口','黑室 · 服务器机房','黑室 · 外侧平台','核心区 · 连廊','核心区 · 航空物资','黑室周边 · 丢弃的物资'][k],gear:{},containers:[]};
  if(k<4){
   source.gear={helmet:freshItem(pick(catalog.filter(x=>x.type==='helmet'))),armor:freshItem(pick(catalog.filter(x=>x.type==='armor'))),weapon1:freshItem(pick(catalog.filter(x=>x.type==='weapon'))),backpack:freshItem(['GT5野战背包','D7战术背包','MAP侦察背包','GTO重型战术包'][k]),rig:freshItem(['DAR突击手胸挂','黑鹰野战胸挂','DSA战术胸挂','DRC先进侦察胸挂'][k])};Object.values(source.gear).forEach(i=>i.revealed=true);
   const erig=makeContainer('s'+k+'-rig','胸挂',source.gear.rig.layout,'normal',source.gear.rig),ebag=makeContainer('s'+k+'-bag','背包',source.gear.backpack.layout,'normal',source.gear.backpack),ep=makeContainer('s'+k+'-pockets','口袋',[[1,1,0,0],[1,1,1.07,0],[1,1,2.14,0],[1,1,3.21,0]]);
   const gun=source.gear.weapon1.name,prefix=gun.includes('AWM')?'.338':gun.includes('MP7')?'4.6':gun.includes('AS Val')?'9x39':(gun.includes('M7')||gun.includes('SCAR'))?'7.62':'5.56';const compatibleAmmo=ammo.filter(i=>i.name.startsWith(prefix));
   for(let j=0;j<3;j++)put(erig,freshItem(pick(compatibleAmmo),false,pick([30,45,60])));
   for(let j=0;j<2;j++)put(erig,freshItem(pick(meds)));
   put(erig,freshItem(pick(acc)));put(ep,freshItem(pick(ammo),false,Math.floor(Math.random()*25)+10));
   const high=collections.filter(x=>x.grade>=5&&x.w*x.h<=9),mid=collections.filter(x=>x.grade>=3&&x.grade<=5);
   put(ebag,freshItem(pick(k===0?collections.filter(x=>['显卡','量子存储','实验数据'].includes(x.name)):high)));
   if(k===3)put(ebag,freshItem('火箭燃料'));
   for(let j=0;j<5;j++)put(ebag,freshItem(pick(j===0?high:mid)));
   source.containers=[erig,ebag,ep];
  }else{const c=makeContainer('s'+k+'-box',k===4?'航空物资箱':'地面物资',[[6,k===4?6:12,0,0]]);source.containers=[c];if(k===4){for(let j=0;j<9;j++)put(c,freshItem(pick(collections.filter(x=>x.grade>=3))));}}
  state.sources.push(source);
 }
 state.totalSearch=state.sources.flatMap(s=>s.containers.flatMap(c=>c.items)).length;selected=null;closeModal();closeMenu();save();render();
}
function allContainers(){return [...state.player,...state.sources.flatMap(s=>s.containers)];}
function currentSource(){return state.sources[state.current];}
function locate(uid){for(const c of allContainers()){const i=c.items.find(i=>i.uid===uid);if(i)return {i,c};}for(const [slot,i]of Object.entries(state.equipment)){if(i?.uid===uid)return{i,slot,owner:'player'};}for(const s of state.sources)for(const [slot,i]of Object.entries(s.gear)){if(i?.uid===uid)return{i,slot,owner:s};}return null;}
function playerItems(){return [...state.player.flatMap(c=>c.items),...Object.values(state.equipment).filter(Boolean)];}
function save(){try{localStorage.setItem('space-city-v3',JSON.stringify(state));localStorage.setItem('space-settings',JSON.stringify(settings));}catch{}}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2800);}
let moveAudio=null;
function playItemMoveSound(kind='move'){
 if(kind!=='move'||!settings.sound||!soundEffects.move)return;
 moveAudio??=new Audio(soundEffects.move);moveAudio.volume=.2;moveAudio.currentTime=0;moveAudio.play().catch(()=>{});
}
function color(i){return rarities[i.grade]||rarities[1];}
function itemHTML(i){if(i.type==='attachment'&&i.simulated&&i.compatibleWeapon)i=visualPart(i,{id:i.compatibleWeapon});const [w,h]=dimensions(i);if(!i.revealed){const active=!state.paused&&currentSource().containers.flatMap(c=>c.items).find(x=>!x.revealed)?.uid===i.uid;return `<div class="item unknown ${active?'searching':''}" data-uid="${i.uid}" style="--ix:${i.x};--iy:${i.y};--iw:${w};--ih:${h}" aria-label="未搜索物品">${active?'<i class="search-spinner"></i><span class="search-seconds">搜索中</span>':'<span class="unknown-mark">?</span>'}</div>`;}
 return `<div class="item ${w===1&&h===1?'small':''} ${i.rotated?'rotated':''} ${selected===i.uid?'selected':''} ${flashUid===i.uid?'reveal-flash':''}" tabindex="0" role="button" aria-label="${i.name}，${i.qty>1?i.qty+'发，':''}${short(value(i))}哈夫币" data-uid="${i.uid}" style="--ix:${i.x};--iy:${i.y};--iw:${w};--ih:${h};--rarity:${color(i)}"><span class="item-name">${i.name}</span>${i.type==='weapon'?weaponVisualHTML(i):`<img src="${i.img}" alt="" draggable="false">`}<span class="item-grade">${i.type==='ammo'?'Lv.'+i.grade:''}</span>${i.qty>1?'<span class="item-qty">'+i.qty+'</span>':''}</div>`;
}
function containerHTML(c,enemy=false){if(!c.regions.length){const slot=c.id.includes('rig')?'rig':'backpack';return `<div class="container-block empty-container" data-container-block="${c.id}"><div class="container-heading"><strong>${c.label}</strong><span class="cap">未装备</span></div><div class="container-body"><div class="container-equipment empty-container-slot" data-owner="${enemy?'enemy':'player'}" data-slot="${slot}"><b>＋</b><span>拖入${slotNames[slot]}</span></div><span class="empty-container-note">${enemy?'容器已移走':'可从地面重新装备'}</span></div></div>`;}const mw=Math.max(...c.regions.map(r=>r.x+r.w)),mh=Math.max(...c.regions.map(r=>r.y+r.h));const equipment=c.equipment;const owner=enemy?'enemy':'player';const gearTile=equipment?`<div class="container-equipment" data-slot="${equipment.type}" data-owner="${owner}" data-uid="${equipment.uid}" role="button" tabindex="0" aria-label="${equipment.name}，点击${enemy?'交换装备':'查看'}"><img src="${equipment.img}" alt=""><span>${equipment.name}</span></div>`:c.kind==='safe'?'<div class="container-equipment safe-tile"><span class="safe-case">◇</span><span>安全箱 · 受保护</span></div>':'';return `<div class="container-block ${equipment||c.kind==='safe'?'has-equipment':''}" data-container-block="${c.id}"><div class="container-heading"><strong>${c.label}</strong><span class="cap">${used(c)} / ${capacity(c)}</span>${equipment?`<span class="container-model">${equipment.name}</span>`:''}</div><div class="container-body">${gearTile}<div class="container-map" style="--map-w:${mw};--map-h:${mh}">${c.regions.map(r=>`<div class="region" data-container="${c.id}" data-region="${r.id}" style="--rx:${r.x};--ry:${r.y};--rw:${r.w};--rh:${r.h}">${c.items.filter(i=>i.region===r.id).map(itemHTML).join('')}</div>`).join('')}</div></div></div>`;}
const slotNames={helmet:'头盔',armor:'护甲',weapon1:'主武器',weapon2:'副武器',backpack:'背包',rig:'胸挂'};
function gearHTML(slot,i,enemy=false){return `<div class="gear-slot ${slot.startsWith('weapon')?'wide':''}" data-slot="${slot}" data-owner="${enemy?'enemy':'player'}" ${i?`data-uid="${i.uid}" role="button" tabindex="0" aria-label="${i.name}，${enemy?'点击装备或拾取':'点击查看'}"`:''} style="${i?'border-color:'+color(i)+'70':''}"><span class="gear-label">${slotNames[slot]}</span>${i?`${i.grade>0?`<span class="grade-corner">${i.grade}</span>`:""}${i.type==='weapon'?weaponVisualHTML(i,{legend:true}):`<img src="${i.img}" alt="" draggable="false">`}<div class="gear-name">${i.name}</div>${['helmet','armor'].includes(slot)?'<i class="gear-durability"></i>':''}`:`<div class="empty-slot"><span class="plus">＋</span><span>${slot.startsWith('weapon')?'拖入武器':enemy?'已取走':'未装备'}</span></div>`}</div>`;}
function renderEquipment(){const e=state.equipment;$('#equipment-slots').innerHTML=`<div class="gear-grid">${['helmet','armor','weapon1','weapon2'].map(s=>gearHTML(s,e[s])).join('')}</div>`;}
function renderPlayer(){for(const [sel,c]of [['#player-rig',state.player[0]],['#player-bag',state.player[1]],['#player-safe',state.player[2]],['#player-pockets',state.player[3]]])$(sel).innerHTML=containerHTML(c);}
function renderTabs(){ $('#source-count').textContent=state.sources.length;$('#source-tabs').innerHTML=state.sources.map((s,k)=>`<button class="source-card ${state.current===k?'active':''}" data-source="${k}" aria-label="${s.name}"><span class="source-index">${String(k+1).padStart(2,'0')}</span><span class="source-icon">${k<4?'▱':k===4?'▤':'⋯'}</span><span class="source-label">${s.name}</span>${s.containers.every(c=>c.items.every(i=>i.revealed))?'<i class="checked-dot"></i>':''}</button>`).join('');}
function renderLoot(){const s=currentSource(),scroll=$('#loot-content').scrollTop;$('#source-name').textContent=s.name;$('#source-location').textContent=s.location;$('#loot-content').innerHTML=(state.current<4?`<div class="loot-gear">${['weapon1','weapon2','helmet','armor'].map(k=>gearHTML(k,s.gear[k],true)).join('')}</div>`:'')+(state.current===5?[...s.containers.filter(c=>c.dropped).reverse(),...s.containers.filter(c=>!c.dropped)]:s.containers).map(c=>containerHTML(c,true)).join('');$('#loot-content').scrollTop=scroll;updateSearchUI();}
function stats(){const items=playerItems(),profit=items.reduce((s,i)=>s+earnings(i),0),total=items.reduce((s,i)=>s+value(i),0),weight=items.reduce((s,i)=>s+(i.weight+(i.attachments||[]).reduce((n,a)=>n+a.weight,0))*(i.qty||1),0);$('#profit').textContent='+ '+fmt(profit);$('#total-value').textContent=short(total);$('#weight').textContent=weight.toFixed(1)+' / 80 kg';$('#weight-fill').style.width=Math.min(100,weight/80*100)+'%';$('#weight-fill').style.background=weight>80?'#d68d66':'';const all=state.sources.flatMap(s=>s.containers.flatMap(c=>c.items));$('#searched').textContent=(state.searchCount??all.filter(i=>i.revealed).length)+' / '+(state.totalSearch||all.length);$('#capacity').textContent=state.player.reduce((s,c)=>s+used(c),0)+' / '+state.player.reduce((s,c)=>s+capacity(c),0)+' 格';$('#round-id').textContent='OP. '+state.round;$('.session-time>span').textContent=state.mode==='challenge'?'撤离倒计时':'理包用时';$('#sound').textContent=settings.sound&&soundEffects.move?'◖))':'◖×';$('#sound').title=settings.sound&&soundEffects.move?'关闭物品音效':'物品音效静音';$('#sound').setAttribute('aria-label',$('#sound').title);}
function render(){renderEquipment();renderPlayer();renderTabs();renderLoot();stats();}
function updateSearchUI(){const source=currentSource(),all=source.containers.flatMap(c=>c.items),complete=all.filter(i=>i.revealed).length,current=all.find(i=>!i.revealed);const done=!current;$('#search-toggle').className='search-button '+(done?'complete':state.paused?'paused':'');$('#search-toggle span').textContent=done?'搜索完成':state.paused?'继续搜索':'暂停搜索';$('#search-fill').style.width=(all.length?((complete+(current?(current.progress||0)/current.duration:0))/all.length*100):100)+'%';$('#search-description').textContent=done?'本容器已全部搜索':`已搜索 ${complete} / ${all.length} 件`;const sec=$('.item.searching .search-seconds');if(sec&&current)sec.textContent=Math.max(.1,(current.duration-current.progress)/1000/settings.speed).toFixed(1)+'s';}
function moved(){selected=null;closeMenu();save();render();playItemMoveSound();}
function autoTransfer(uid,targetId=null){const l=locate(uid);if(!l||!l.i.revealed)return;const {i,c}=l;if(!c){if(l.owner&&l.owner!=='player')pickupGear(uid);else toast('可把装备拖入背包或对应装备位');return;}
 if(targetId){const t=allContainers().find(c=>c.id===targetId);const r=transfer(i,c,t);if(!r.ok){toast(r.reason);playItemMoveSound('error');return;}moved();return;}
 let targets=c.id.startsWith('p-')?currentSource().containers.filter(c=>c.id.includes('bag')||state.current>=4):[state.player[1],state.player[0],state.player[3]];
 for(const to of targets){if(to===c)continue;
  if(i.maxStack){for(const t of [...to.items])if(t.id===i.id&&t.qty<t.maxStack){const r=transfer(i,c,to,{region:t.region,x:t.x,y:t.y});if(r.ok&&!r.partial){moved();return;}}}
  if(firstFit(i,to)){const r=transfer(i,c,to);if(r.ok){moved();return;}}
 }
 toast('没有足够的连续空间，试试旋转物品或换更大的背包');save();render();playItemMoveSound('error');
}
function equip(uid,requestedSlot=null){const l=locate(uid);if(!l)return;const i=l.i;let slot={helmet:'helmet',armor:'armor',backpack:'backpack',rig:'rig',weapon:state.equipment.weapon1?'weapon2':'weapon1'}[i.type];if(requestedSlot){if(i.type==='weapon'&&!requestedSlot.startsWith('weapon')||i.type!=='weapon'&&requestedSlot!==slot){toast('装备类型与槽位不匹配');return;}slot=requestedSlot;}if(!slot)return;
 if(l.owner==='player'){if(l.slot!==slot&&i.type==='weapon'){[state.equipment[l.slot],state.equipment[slot]]=[state.equipment[slot],state.equipment[l.slot]];moved();}return;}if(!i.revealed)return;if(['backpack','rig'].includes(slot)&&l.c){toast('地面容器装备暂不支持直接穿戴，请从干员装备位交换');return;}
 if(['backpack','rig'].includes(slot)&&l.owner&&l.owner!=='player'){
  const enemy=l.owner,ec=enemy.containers.find(c=>c.equipment?.uid===i.uid),pc=state.player[slot==='rig'?0:1];
  if(ec.items.some(i=>!i.revealed)){toast('先搜索完这个'+slotNames[slot]+'，再连同内容物一起交换');return;}
  const old=state.equipment[slot]||null;state.equipment[slot]=i;enemy.gear[l.slot]=old;
  [pc.regions,ec.regions]=[ec.regions,pc.regions];[pc.items,ec.items]=[ec.items,pc.items];pc.equipment=i;ec.equipment=old;
  if(ec.dropped){if(old){delete enemy.gear[l.slot];enemy.gear['drop-'+old.uid]=old;ec.id='ground-'+old.uid;ec.label=old.name;}else{enemy.containers.splice(enemy.containers.indexOf(ec),1);delete enemy.gear[l.slot];}}
  toast('已'+(old?'交换':'装备')+slotNames[slot]+'，内容物随容器一起转移');moved();return;
 }
 const old=state.equipment[slot];
 if(l.c){const idx=l.c.items.indexOf(i);l.c.items.splice(idx,1);if(old&&!put(l.c,old,true)){l.c.items.splice(idx,0,i);toast('原装备没有空间放回，请先腾出位置');return;}}else if(l.owner){l.owner.gear[l.slot]=old||null;}
 state.equipment[slot]=i;toast('已装备 '+i.name);moved();
}
function pickupGear(uid){const l=locate(uid);if(!l||!l.owner||l.owner==='player')return;if(['backpack','rig'].includes(l.i.type)){toast('请使用交换容器，内容物随容器一起转移');return;}for(const c of [state.player[1],state.player[0]])if(put(c,l.i,true)){l.owner.gear[l.slot]=null;moved();return;}toast('背包没有足够空间放入这件装备');}
function discard(uid){
 const l=locate(uid);if(!l||!l.i.revealed)return;const ground=state.sources[5],floor=ground.containers[0];
 if(l.owner===ground){toast('这件装备已在地面');return;}
 if(!l.c&&['backpack','rig'].includes(l.i.type)){
  const c=l.owner==='player'?state.player[l.i.type==='rig'?0:1]:l.owner?.containers.find(c=>c.equipment?.uid===uid);
  if(!c){toast('容器来源无效');return;}const count=c.items.length,r=dropContainer(c,ground,l.i);if(!r.ok){toast(r.reason);return;}
  if(l.owner==='player')state.equipment[l.slot]=null;else l.owner.gear[l.slot]=null;
  state.current=5;$('#loot-content').scrollTop=0;toast('已将'+slotNames[l.i.type]+'连同 '+count+' 件物资丢到地面');moved();return;
 }
 if(l.c){if(l.c===floor){toast('物品已在地面');return;}const r=transfer(l.i,l.c,floor);if(!r.ok){toast(r.reason);return;}}
 else{if(!put(floor,l.i,true)){toast('地面物资空间已满');return;}if(l.owner==='player')state.equipment[l.slot]=null;else l.owner.gear[l.slot]=null;}
 toast('已放到地面物资，可随时捡回');moved();
}
function rotate(uid){const l=locate(uid);if(!l?.c)return;const {i,c}=l;if(i.w===i.h){toast('这件物品旋转后尺寸相同');return;}const t={...i,rotated:!i.rotated};let p=fits(t,c,i.region,i.x,i.y)?{region:i.region,x:i.x,y:i.y}:firstFit(t,c,false);if(!p){toast('旋转后的空间不足');return;}Object.assign(i,p,{rotated:!i.rotated});moved();}
function splitAmmo(uid){const l=locate(uid);if(!l?.c||l.i.qty<=1)return;const i=l.i,n=Math.floor(i.qty/2),init=Math.min(n,i.initialQty||0),copy={...i,uid:('i'+Date.now().toString(36)+'-'+(++counter)+'-'+Math.random().toString(36).slice(2,8)),qty:n,initialQty:init};const p=firstFit(copy,l.c);if(!p){toast('当前容器没有空格拆分弹药');return;}i.qty-=n;i.initialQty=(i.initialQty||0)-init;Object.assign(copy,p);l.c.items.push(copy);moved();}
function closeMenu(){selected=null;$('#item-menu').hidden=true;$$('.item.selected').forEach(el=>el.classList.remove('selected'));}
function openMenu(uid,x,y){const l=locate(uid);if(!l?.i.revealed)return;const i=l.i;selected=uid;$$('.item.selected').forEach(el=>el.classList.remove('selected'));const el=$(`[data-uid="${uid}"]`);el?.classList.add('selected');const isPlayer=l.owner==='player'||l.c?.id.startsWith('p-');let buttons='';if(i.type==='weapon')buttons+='<button data-action="gunsmith">查看 / 拆装配件 <small>改装</small></button>';if(!isPlayer&&['backpack','rig','weapon','helmet','armor'].includes(i.type))buttons+=`<button data-action="equip">装备 / 交换装备 ${['backpack','rig'].includes(i.type)?'<small>含容器内容物</small>':''}</button>`;if(!isPlayer&&l.owner&&['weapon','helmet','armor'].includes(i.type))buttons+='<button data-action="pickupgear">收入背包</button>';if(l.c)buttons+=`<button data-action="transfer">${isPlayer?'移入当前物资箱':'快捷拾取'} <small>双击</small></button>`;if(l.c&&l.c.kind!=='safe'&&allowed(i,state.player[2]))buttons+='<button data-action="secure">放入安全箱 <small>受保护</small></button>';if(l.c&&i.w!==i.h)buttons+='<button data-action="rotate">旋转物品 <small>R</small></button>';if(l.c&&i.type==='ammo'&&i.qty>1)buttons+='<button data-action="split">拆分一半弹药</button>';if(isPlayer)buttons+='<button data-action="discard" class="danger">丢到地面物资 <small>可捡回</small></button>';
 const menu=$('#item-menu');menu.innerHTML=`<div class="menu-preview" style="--rarity:${color(i)}"><span class="menu-grade"></span>${i.type==='weapon'?weaponVisualHTML(i):`<img src="${i.img}" alt="">`}</div><div class="menu-info"><h3>${i.name}</h3><p><span>参考总价</span><b class="menu-value">${short(value(i))}</b></p><p><span>单格价值</span><span>${short(value(i)/(i.w*i.h))}</span></p><p><span>${i.w} × ${i.h} 格${i.qty>1?' · '+i.qty+' 发':''}</span><span>${(i.weight*i.qty).toFixed(2)} kg</span></p></div><div class="menu-actions">${buttons}</div>`;menu.hidden=false;menu.style.left=Math.max(8,Math.min(x+9,innerWidth-246))+'px';menu.style.top=Math.max(8,Math.min(y-30,innerHeight-menu.offsetHeight-10))+'px';}
$('#item-menu').addEventListener('click',e=>{const a=e.target.closest('[data-action]')?.dataset.action;if(!a||!selected)return;const id=selected;closeMenu();if(a==='gunsmith')gunPanel(id);if(a==='transfer')autoTransfer(id);if(a==='secure')autoTransfer(id,'p-safe');if(a==='equip')equip(id);if(a==='pickupgear')pickupGear(id);if(a==='rotate')rotate(id);if(a==='discard')discard(id);if(a==='split')splitAmmo(id);});
document.addEventListener('click',e=>{
 if(e.target.closest('#item-menu'))return;
 if(drag?.moved||performance.now()-lastDrag<250)return;
 const card=e.target.closest('[data-source]');if(card){closeMenu();state.current=+card.dataset.source;state.paused=false;$('#loot-content').scrollTop=0;save();renderTabs();renderLoot();return;}
 const item=e.target.closest('[data-uid]');if(item){if(e.altKey){equip(item.dataset.uid);return;}if(e.ctrlKey||e.metaKey){autoTransfer(item.dataset.uid);return;}if(e.detail===1)openMenu(item.dataset.uid,e.clientX,e.clientY);return;}
 if(!e.target.closest('#item-menu'))closeMenu();
});
document.addEventListener('dblclick',e=>{const el=e.target.closest('[data-uid]');if(el){const l=locate(el.dataset.uid);if(l?.c)autoTransfer(el.dataset.uid);else if(l?.owner!=='player')equip(el.dataset.uid);}});
document.addEventListener('contextmenu',e=>{const el=e.target.closest('[data-uid]');if(el){e.preventDefault();const l=locate(el.dataset.uid);if(l?.i.type==='weapon'&&l.i.revealed)gunPanel(l.i.uid);else openMenu(el.dataset.uid,e.clientX,e.clientY);}});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(drag){e.preventDefault();cancelDrag();return;}if(modalOpen)closeModal();else closeMenu();}
 if((e.key==='r'||e.key==='R')&&!modalOpen&&!e.repeat){
  e.preventDefault();if(drag){const l=locate(drag.uid);if(l?.c&&l.i.w!==l.i.h){const oldX=drag.grabX;drag.grabX=1-drag.grabY;drag.grabY=oldX;drag.rotated=!drag.rotated;updateGhost();positionGhost();updatePlacement(drag.lastX,drag.lastY);}}else if(selected)rotate(selected);
 }
 if(e.key==='?'&&!modalOpen)help();
 if(e.key==='Enter'&&e.target.matches('[data-uid]')){const r=e.target.getBoundingClientRect();openMenu(e.target.dataset.uid,r.x,r.y);}
});
function positionGhost(){if(!drag)return;const turned=drag.rotated!==drag.initialRotated,w=turned?drag.height:drag.width,h=turned?drag.width:drag.height;const ghost=$('#drag-ghost');ghost.style.left=drag.lastX-drag.grabX*w+'px';ghost.style.top=drag.lastY-drag.grabY*h+'px';}
function updateGhost(){
 if(!drag)return;const turned=drag.rotated!==drag.initialRotated,ghost=$('#drag-ghost');ghost.style.width=(turned?drag.height:drag.width)+'px';ghost.style.height=(turned?drag.width:drag.height)+'px';
 const clone=drag.template.cloneNode(true);clone.removeAttribute('data-uid');clone.removeAttribute('tabindex');clone.removeAttribute('role');clone.classList.remove('selected','drag-origin');clone.classList.add('drag-thumbnail');clone.classList.toggle('rotated',drag.rotated);
 Object.assign(clone.style,{position:'relative',left:'0',top:'0',width:'100%',height:'100%',minHeight:'0',maxHeight:'none',margin:'0'});clone.style.setProperty('--s',drag.cell+'px');const [iw,ih]=dimensions({...locate(drag.uid).i,rotated:drag.rotated});clone.style.setProperty('--iw',iw);clone.style.setProperty('--ih',ih);ghost.replaceChildren(clone);
}
function clearPlacement(){document.body.classList.remove('ground-drop-active');$('#ground-drop-hint').hidden=true; $$('.placement-preview').forEach(e=>e.remove());$$('.drop-valid,.drop-invalid').forEach(e=>e.classList.remove('drop-valid','drop-invalid')); }
function updatePlacement(x,y){
 if(!drag)return;clearPlacement();drag.target=null;drag.slotTarget=null;drag.groundTarget=false;
 const l=locate(drag.uid);if(!l)return;
 const el=document.elementFromPoint(x,y),slot=el?.closest('.gear-slot[data-owner="player"],.container-equipment[data-owner="player"]');
 if(slot){const wanted=slot.dataset.slot,valid=l.i.type==='weapon'?wanted.startsWith('weapon'):l.i.type===wanted;slot.classList.add(valid?'drop-valid':'drop-invalid');if(valid)drag.slotTarget=wanted;return;}
 const reg=el?.closest('.region');if(!reg){
  if(el?.closest('.workspace')&&!el.closest('.panel,.gear-slot,.container-equipment,[data-uid],button,input,select,.operator-stats,.operator-location')){
   drag.groundTarget=true;document.body.classList.add('ground-drop-active');const hint=$('#ground-drop-hint');hint.textContent=['backpack','rig'].includes(l.i.type)?'松手丢到地面 · 保留容器内容物':'松手丢到地面';hint.hidden=false;
  }return;
 }
 const c=allContainers().find(c=>c.id===reg.dataset.container),r=+reg.dataset.region,b=reg.getBoundingClientRect(),size=b.width/c.regions.find(t=>t.id===r).w;
 const i={...l.i,rotated:drag.rotated},[w,h]=dimensions(i),ox=Math.min(w-1,Math.floor(drag.grabX*w)),oy=Math.min(h-1,Math.floor(drag.grabY*h));
 const px=Math.floor((x-b.x)/size)-ox,py=Math.floor((y-b.y)/size)-oy;
 const valid=fits(i,c,r,px,py)&&!!(l.c||!['backpack','rig'].includes(i.type));drag.target={c,region:r,x:px,y:py};
 const p=document.createElement('div');p.className='placement-preview '+(valid?'':'invalid');p.style.cssText=`left:${px*size}px;top:${py*size}px;width:${w*size}px;height:${h*size}px`;reg.append(p);
}
function finishDrag(){
 if(!drag)return;const pointerId=drag.pointerId;cancelAnimationFrame(drag.frame);drag=null;$('#drag-ghost').hidden=true;$('#drag-ghost').replaceChildren();clearPlacement();$$('.drag-origin').forEach(e=>e.classList.remove('drag-origin'));document.body.classList.remove('is-dragging');
 if(document.documentElement.hasPointerCapture(pointerId))document.documentElement.releasePointerCapture(pointerId);
}
function cancelDrag(){if(drag?.moved)lastDrag=performance.now();finishDrag();renderPlayer();renderLoot();}
function scrollWhileDragging(){
 if(!drag?.moved)return;const el=document.elementFromPoint(drag.lastX,drag.lastY),scroll=el?.closest('.inventory-scroll,.loot-scroll');
 if(scroll){const r=scroll.getBoundingClientRect(),edge=Math.min(40,r.height/5),top=drag.lastY-r.top,bottom=r.bottom-drag.lastY;let step=top<edge?-Math.ceil((edge-top)/4):bottom<edge?Math.ceil((edge-bottom)/4):0;if(step){scroll.scrollTop+=step;updatePlacement(drag.lastX,drag.lastY);}}
 drag.frame=requestAnimationFrame(scrollWhileDragging);
}
function moveGearIntoGrid(l,target){
 if(['backpack','rig'].includes(l.i.type))return {ok:false,reason:'请拖到对应装备位交换容器'};
 const i={...l.i,rotated:drag.rotated};if(!fits(i,target.c,target.region,target.x,target.y))return {ok:false,reason:'空间不足或此容器不接受该装备'};
 Object.assign(l.i,{region:target.region,x:target.x,y:target.y,rotated:drag.rotated});target.c.items.push(l.i);
 if(l.owner==='player')state.equipment[l.slot]=null;else l.owner.gear[l.slot]=null;return {ok:true};
}
// Native selection and HTML drag must never compete with inventory pointer dragging.
document.addEventListener('dragstart',e=>{if(e.target.closest('.app-shell,#item-menu,#drag-ghost'))e.preventDefault();});
document.addEventListener('pointerdown',e=>{
 if(e.button!==0||modalOpen||drag||e.target.closest('#item-menu'))return;
 const el=e.target.closest('.item[data-uid],.gear-slot[data-uid],.container-equipment[data-uid]');if(!el)return;const l=locate(el.dataset.uid);if(!l?.i.revealed)return;
 e.preventDefault();window.getSelection()?.removeAllRanges();el.focus({preventScroll:true});const r=el.getBoundingClientRect(),[w]=dimensions(l.i);
 drag={uid:l.i.uid,pointerId:e.pointerId,origin:el,template:el.cloneNode(true),width:r.width,height:r.height,grabX:(e.clientX-r.left)/r.width,grabY:(e.clientY-r.top)/r.height,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false,rotated:l.i.rotated,initialRotated:l.i.rotated,cell:r.width/w,target:null,slotTarget:null,frame:0};
});
document.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.pointerId)return;drag.lastX=e.clientX;drag.lastY=e.clientY;if(!drag.moved&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5)return;
 e.preventDefault();if(!drag.moved){closeMenu();drag.moved=true;drag.origin.classList.add('drag-origin');document.body.classList.add('is-dragging');document.documentElement.setPointerCapture(e.pointerId);updateGhost();drag.frame=requestAnimationFrame(scrollWhileDragging);}
 $('#drag-ghost').hidden=false;positionGhost();updatePlacement(e.clientX,e.clientY);
},{passive:false});
document.addEventListener('pointerup',e=>{
 if(!drag||e.pointerId!==drag.pointerId)return;if(!drag.moved){finishDrag();return;}
 e.preventDefault();lastDrag=performance.now();updatePlacement(e.clientX,e.clientY);const d=drag,l=locate(d.uid);
 if(l){if(d.groundTarget){discard(d.uid);}else if(d.slotTarget){equip(d.uid,d.slotTarget);}else if(d.target){let r;if(l.c){const oldRot=l.i.rotated;l.i.rotated=d.rotated;r=transfer(l.i,l.c,d.target.c,{region:d.target.region,x:d.target.x,y:d.target.y});if(!r.ok)l.i.rotated=oldRot;}else r=moveGearIntoGrid(l,d.target);
 if(r.ok){save();playItemMoveSound();}else toast(r.reason);
 }}finishDrag();render();
},{passive:false});
document.addEventListener('pointercancel',()=>{if(drag)cancelDrag();});
document.addEventListener('lostpointercapture',()=>{if(drag?.moved)cancelDrag();});
window.addEventListener('blur',()=>{if(drag)cancelDrag();});
function openModal(title,body,actions=''){closeMenu();modalOpen=true;$('#modal-root').innerHTML=`<div class="modal-overlay"><section class="modal" role="dialog" aria-modal="true" aria-label="${title}"><div class="modal-header"><h2>${title}</h2><button class="close-modal" aria-label="关闭">×</button></div><div class="modal-body">${body}</div>${actions?'<div class="modal-actions">'+actions+'</div>':''}</section></div>`;$('.close-modal').onclick=closeModal;$('.modal-overlay').addEventListener('click',e=>{if(e.target.classList.contains('modal-overlay'))closeModal();});$('.close-modal').focus();}
function closeModal(){modalOpen=false;$('#modal-root').innerHTML='';if(state?.finished){state.finished=false;if(state.mode==='challenge'&&state.seconds>=300)state.mode='relax';save();}}
function help(){openModal('操作说明',`<div class="help-row"><span>右键枪械</span><kbd>直接查看 / 拆装配件</kbd></div><div class="help-row"><span>点击 / 右键其他物品</span><kbd>查看详情和操作</kbd></div><div class="help-row"><span>拖到人物旁的空白区域松手</span><kbd>丢到地面 · 包内物资随包保留</kbd></div><div class="help-row"><span>双击 / Ctrl + 点击</span><kbd>快捷转移</kbd></div><div class="help-row"><span>按住物品拖到目标格子</span><kbd>移动物品</kbd></div><div class="help-row"><span>拖动时按 R / 菜单中选择旋转</span><kbd>旋转物品</kbd></div><div class="help-row"><span>点击敌人的装备 → 装备</span><kbd>换装 / 换包</kbd></div><div class="help-row"><span>点击物品 → 放入安全箱</span><kbd>保护物资</kbd></div><p class="help-tip">打开盒子后会逐件搜索。转圈完成才显示物品，搜索期间也可以拿走已发现物资。切换盒子会保留进度；换胸挂、背包时，内容物一起交换。</p><p>关闭页面会自动保留本局。价格为固定模拟数据，不代表当前交易行价格。</p><div class="source-note">玩家自制练习作品，非官方。物品名称与图像来自《三角洲行动》公开物品资料；分格数据参考 <a href="https://github.com/panedioic/delta-force-loot-simulator" target="_blank" rel="noopener">Y1yan / delta-force-loot-simulator</a>，遵循 Apache-2.0。<a href="credits.txt" target="_blank">资源说明</a></div>`,`<button class="primary" id="help-ok">开始理包</button>`);$('#help-ok').onclick=closeModal;}
$('#help').onclick=help;
$('#settings').onclick=()=>{openModal('模拟设置',`<div class="settings-row"><label for="set-speed">搜索速度<small>逐件搜索，保留未知物品的悬念</small></label><select id="set-speed"><option value="1">标准 · 1×</option><option value="1.5">快速 · 1.5×</option><option value="2">快速 · 2×</option></select></div><div class="settings-row"><label for="set-mode">游玩模式<small>限时模式在新一局开始时生效</small></label><select id="set-mode"><option value="relax">放松理包</option><option value="challenge">限时挑战 · 5 分钟</option></select></div><div class="settings-row"><label for="set-safe">安全箱规格<small>在新一局开始时生效</small></label><select id="set-safe"><option value="9">3 × 3 · 9 格</option><option value="6">3 × 2 · 6 格</option><option value="2">2 × 1 · 2 格</option></select></div><p>当前选择会保存在本机。放松模式没有撤离倒计时。</p>`,`<button class="primary" id="save-settings">保存设置</button>`);$('#set-speed').value=settings.speed;$('#set-mode').value=settings.mode;$('#set-safe').value=settings.safeSize;$('#save-settings').onclick=()=>{settings.speed=+$('#set-speed').value;settings.mode=$('#set-mode').value;settings.safeSize=+$('#set-safe').value;save();closeModal();toast('设置已保存');};};
$('#sound').onclick=()=>{if(!soundEffects.move){settings.sound=false;toast('当前没有可用的物品音效，保持静音');}else settings.sound=!settings.sound;save();stats();};
$('#search-toggle').onclick=()=>{state.paused=!state.paused;save();renderLoot();};
$('#sort').onclick=()=>{let ok=true;for(const c of state.player)if(!repack(c))ok=false;save();renderPlayer();toast(ok?'随身物资已整理':'部分分格无法进一步整理');};
$('#take-all').onclick=()=>{const ids=currentSource().containers.flatMap(c=>c.items).filter(i=>i.revealed).sort((a,b)=>value(b)/(b.w*b.h)-value(a)/(a.w*a.h)).map(i=>i.uid);if(!ids.length){toast('还没有可拾取的物品，等待搜索完成');return;}let n=0;for(const uid of ids){const l=locate(uid);for(const c of [state.player[1],state.player[0],state.player[3]]){if(l.i.maxStack){for(const t of [...c.items])if(t.id===l.i.id&&t.qty<t.maxStack){const r=transfer(l.i,l.c,c,{region:t.region,x:t.x,y:t.y});if(r.ok&&!r.partial){n++;break;}}if(!locate(uid)){break;}if(c.items.some(i=>i.uid===uid))break;}
 if(firstFit(l.i,c)){if(transfer(l.i,l.c,c).ok){n++;break;}}
 }}save();render();toast(n?'已拾取 '+n+' 件物资，剩余物资可手动取舍':'背包空间不足，请先整理或换包');};
$('#new-round').onclick=()=>{openModal('开始下一局',`<p>当前这一局的理包进度将结束。下一局重新生成敌人装备和战利品。</p>`,`<button class="ghost" id="keep-playing">继续本局</button><button class="primary" id="confirm-new">再清一图</button>`);$('#keep-playing').onclick=closeModal;$('#confirm-new').onclick=()=>{newGame();state.mode=settings.mode;save();toast('区域已肃清，开始搜索物资');};};
function result(forced=false){state.finished=true;save();const items=playerItems(),loot=items.filter(i=>earnings(i)>0),profit=loot.reduce((s,i)=>s+earnings(i),0),best=[...loot].sort((a,b)=>earnings(b)-earnings(a))[0],spaces=state.player.reduce((s,c)=>s+capacity(c),0),occupied=state.player.reduce((s,c)=>s+used(c),0);openModal('撤离结算',`<span class="result-label">EXTRACTION COMPLETE</span><h3 class="result-title">${forced?'时间到 · 模拟结算':'成功撤离'}</h3><div class="result-profit">+ ${fmt(profit)}</div><span class="result-sub">新增带出估值 · 已扣除开局自带物资</span><div class="result-stats"><div class="result-stat"><span>理包用时</span><strong>${timeStr(state.seconds)}</strong></div><div class="result-stat"><span>新增战利品</span><strong>${loot.length} <small>件</small></strong></div><div class="result-stat"><span>空间利用率</span><strong>${Math.round(occupied/spaces*100)}%</strong></div><div class="result-stat"><span>安全箱估值</span><strong>${short(state.player[2].items.reduce((s,i)=>s+value(i),0))}</strong></div></div>${best?`<div class="result-best"><img src="${best.img}" alt=""><div><span>本局最高价值战利品</span><h4>${best.name}</h4><b>${short(earnings(best))}</b></div></div>`:'<p>还没有带走新物资，下次记得搜搜敌人的背包。</p>'}<p class="save-note" id="copy-status">${forced?'本次为限时训练结算。':'可以返回继续整理，或再清一图。'}</p>`,`<button class="ghost" id="copy-result">复制战绩</button><button class="ghost" id="back-game">继续整理</button><button class="primary" id="result-new">再清一图 →</button>`);$('#result-new').onclick=()=>{newGame();state.mode=settings.mode;save();};$('#back-game').onclick=()=>{state.finished=false;if(forced)state.mode='relax';save();closeModal();};$('#copy-result').onclick=async()=>{const text=`绝密航天清图理包｜${timeStr(state.seconds)} 带出 ${short(profit)}哈夫币｜空间利用率 ${Math.round(occupied/spaces*100)}%｜${location.href}`;try{await navigator.clipboard.writeText(text);$('#copy-status').textContent='战绩已复制，可以发给朋友挑战。';}catch{$('#copy-status').textContent=text;}};}
$('#extract').onclick=()=>result();
$('#fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('当前浏览器不支持全屏，可使用浏览器全屏功能');}};
$('#dismiss-mobile').onclick=()=>$('#mobile-hint').style.display='none';
function timeStr(s){return String(Math.floor(s/60)).padStart(2,'0')+':'+String(Math.floor(s%60)).padStart(2,'0');}
let loaded=false;try{const s=JSON.parse(localStorage.getItem('space-city-v3')||'null');if(s?.version===3){state=s;validate(allContainers());loaded=true;}}catch{}
if(!loaded){newGame();state.mode=settings.mode;save();}else {const images=new Map(catalog.map(i=>[i.id,i.img]));for(const c of allContainers()){for(const i of c.items)i.img=images.get(i.id)||i.img;if(c.equipment)c.equipment.img=images.get(c.equipment.id)||c.equipment.img;}for(const i of [...Object.values(state.equipment),...state.sources.flatMap(s=>Object.values(s.gear))].filter(Boolean))i.img=images.get(i.id)||i.img;state.finished=false;if(state.mode==='challenge'&&state.seconds>=300)state.mode='relax';render();}
let last=performance.now(),secondAcc=0;
setInterval(()=>{const now=performance.now(),dt=Math.min(now-last,250);last=now;if(document.hidden||modalOpen||drag?.moved||state.finished)return;secondAcc+=dt;if(secondAcc>=1000){state.seconds+=Math.floor(secondAcc/1000);secondAcc%=1000;$('#timer').textContent=state.mode==='challenge'?timeStr(Math.max(0,300-state.seconds)):timeStr(state.seconds);if(state.mode==='challenge'&&state.seconds>=300){result(true);return;}}
 if(!state.paused){const revealed=searchStep(currentSource().containers,dt,settings.speed);if(revealed){state.searchCount=(state.searchCount||0)+1;flashUid=revealed.uid;renderLoot();renderTabs();stats();save();flashUid=null;}else updateSearchUI();}
 if(now-lastSaved>2500){save();lastSaved=now;}
},100);
$('#timer').textContent=state.mode==='challenge'?timeStr(Math.max(0,300-state.seconds)):timeStr(state.seconds);
window.addEventListener('pagehide',save);

document.querySelectorAll('[data-mobile-view]').forEach(b=>b.onclick=()=>{document.body.classList.remove('mobile-inventory','mobile-equipment');if(b.dataset.mobileView!=='loot')document.body.classList.add('mobile-'+b.dataset.mobileView);document.querySelectorAll('[data-mobile-view]').forEach(t=>t.classList.toggle('active',t===b));});
