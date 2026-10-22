const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const baseURL=process.env.SIMULATOR_URL||'http://127.0.0.1:8000';
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1,`${actual} differs from ${expected}`);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__audioStarts=0;localStorage.setItem('space-settings',JSON.stringify({sound:true}));const originalPlay=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.__audioStarts++;return originalPlay.call(this);};const C=window.AudioContext;if(C)window.AudioContext=class extends C{constructor(...args){super(...args);window.__audioStarts++;}};});
 await page.goto(baseURL);await page.waitForSelector('.item.searching');
 const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('space-city-v3')));
 const uidSet=s=>{const collect=i=>[i.uid,...(i.attachments||[]).flatMap(collect)];return [...s.player.flatMap(c=>c.items.flatMap(collect)),...Object.values(s.equipment).filter(Boolean).flatMap(collect),...s.sources.flatMap(src=>[...Object.values(src.gear).filter(Boolean).flatMap(collect),...src.containers.flatMap(c=>c.items.flatMap(collect))])].sort();};
 async function startDrag(selector,target=null){
  await page.locator(selector).scrollIntoViewIfNeeded();if(target)await page.locator(target).scrollIntoViewIfNeeded();const r=await page.locator(selector).boundingBox();
  await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2-20,r.y+r.height/2+5,{steps:5});await page.waitForSelector('#drag-ghost:not([hidden])');return r;
 }
 async function drop(selector){const r=await page.locator(selector).boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2,{steps:20});await page.mouse.up();await page.waitForTimeout(270);}
 const before=await read();const helmets='.loot .gear-slot[data-slot="helmet"]';
 // Start from a pre-existing selection to reproduce the reported full-page highlight.
 await page.evaluate(()=>window.getSelection().selectAllChildren(document.querySelector('.app-shell')));
 const source=await startDrag(helmets),ghost=await page.locator('#drag-ghost').boundingBox();near(ghost.width,source.width);near(ghost.height,source.height);assert.equal(await page.evaluate(()=>getSelection().toString()),'');
 await page.screenshot({path:'preview-drag-fixed.png'});await page.keyboard.press('Escape');await page.mouse.up();assert(await page.locator('#drag-ghost').isHidden());assert.deepEqual(uidSet(await read()),uidSet(before));console.log('PASS: source-sized equipment thumbnail, no text selection, Escape cancels without loss');
 // Exercise the actual equipment exchange after cancellation.
 await startDrag(helmets,'.equipment .gear-slot[data-slot="helmet"]');await drop('.equipment .gear-slot[data-slot="helmet"]');let s=await read();assert.equal(s.equipment.helmet.uid,before.sources[0].gear.helmet.uid);assert.deepEqual(uidSet(s),uidSet(before));console.log('PASS: helmet drag swap preserves every item and attachment');
 // Drag a worn helmet into the backpack grid, rather than only supporting a menu action.
 const oldHelmet=s.equipment.helmet.uid;const bagRegion='#player-bag [data-region="0"]';await page.locator(bagRegion).scrollIntoViewIfNeeded();await startDrag('.equipment .gear-slot[data-slot="helmet"]',bagRegion);const br=await page.locator(bagRegion).boundingBox();const grid=s.player[1].regions[0];const cell=br.width/grid.w;
 await page.mouse.move(br.x+cell*2.5,br.y+cell*5.5,{steps:20});await page.mouse.up();await page.waitForTimeout(270);s=await read();assert.equal(s.equipment.helmet,null);assert(s.player[1].items.some(i=>i.uid===oldHelmet));assert.deepEqual(uidSet(s),uidSet(before));console.log('PASS: equipment can be dragged into inventory with ownership preserved');
 // Grid thumbnail rotation preserves its scale, grab position, and stored orientation on cancel.
 const long=s.player[1].items.find(i=>i.w!==i.h);const selector=`#player-bag .item[data-uid="${long.uid}"]`;const ir=await startDrag(selector);let gr=await page.locator('#drag-ghost').boundingBox();near(gr.width,ir.width);near(gr.height,ir.height);await page.keyboard.press('r');gr=await page.locator('#drag-ghost').boundingBox();near(gr.width,ir.height);near(gr.height,ir.width);await page.keyboard.press('Escape');await page.mouse.up();assert.equal((await read()).player[1].items.find(i=>i.uid===long.uid).rotated,long.rotated);console.log('PASS: grid drag and R rotation do not zoom or mutate on cancellation');
 // Release beyond the viewport and lose focus: neither path may leave a stuck drag.
 await startDrag(selector);await page.mouse.move(-5,-5);await page.mouse.up();await page.waitForTimeout(270);assert(await page.locator('#drag-ghost').isHidden());assert.deepEqual(uidSet(await read()),uidSet(before));await startDrag(selector);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();assert(await page.locator('#drag-ghost').isHidden());console.log('PASS: outside release and window blur safely cancel dragging');await page.waitForTimeout(270);
 // Weapons use their current slot tree in the gear slot, gun panel and after reload.
 await page.locator('.equipment [data-slot="weapon1"]').click();await page.locator('[data-action="gunsmith"]').click();assert.equal(await page.locator('.gunsmith-hero .mounted-part').count(),6);const gunBefore=await read();const part=gunBefore.equipment.weapon1.attachments.find(a=>a.attachmentSlot==='optic');const visualBefore=await page.locator('.gunsmith-hero').screenshot();
 await page.locator(`[data-detach="${part.uid}"]`).click();assert.equal(await page.locator('.gunsmith-hero [data-part-slot="optic"]').count(),0);assert.equal(await page.locator('.equipment [data-slot="weapon1"] [data-part-slot="optic"]').count(),0);const visualAfter=await page.locator('.gunsmith-hero').screenshot();assert(!visualBefore.equals(visualAfter));s=await read();assert.deepEqual(uidSet(s),uidSet(before));
 await page.locator(`[data-attach="${part.uid}"]`).click();assert.equal(await page.locator('.gunsmith-hero [data-part-slot="optic"]').count(),1);await page.screenshot({path:'preview-weapon-assembled.png'});await page.locator('.close-modal').click();await page.reload();await page.waitForSelector('.weapon-assembly');assert.equal(await page.locator('.equipment [data-slot="weapon1"] .mounted-part').count(),6);console.log('PASS: mounted optics visibly detach/reattach in all views and survive reload');
 // Run the timer and item search long enough to reveal items; neither should emit audio.
 const baseline=(await read()).searchCount;await page.waitForTimeout(5500);await page.locator('[data-source="1"]').click();assert((await read()).searchCount>baseline);assert.equal(await page.evaluate(()=>window.__audioStarts),0);console.log('PASS: active timer, search and reveal are silent, with no synthesized audio');
 assert.deepEqual(errors,[]);console.log('PASS: no browser runtime errors');await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
