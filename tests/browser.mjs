// Dependency-free real-browser checks using Chrome DevTools Protocol.
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,mkdir,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'..');
const browser=process.env.ASCEND_BROWSER||'C:/Program Files/Google/Chrome/Application/chrome.exe';
const profile=await mkdtemp(join(tmpdir(),'ascend-browser-'));
const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
let ws,serial=0;const waiting=new Map(),errors=[];
try{
  const endpoint=await new Promise((ok,fail)=>{let stderr='';const timer=setTimeout(()=>fail(Error('Browser startup timed out')),20000);child.on('error',fail);child.stderr.on('data',data=>{stderr+=data;const match=stderr.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);ok(match[1]);}});});
  ws=new WebSocket(endpoint);await new Promise((ok,fail)=>{ws.onopen=ok;ws.onerror=fail;});
  ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const p=waiting.get(message.id);if(p){waiting.delete(message.id);message.error?p.reject(Error(JSON.stringify(message.error))):p.resolve(message.result);}}else if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);};
  ws.onclose=()=>{for(const p of waiting.values())p.reject(Error('Browser connection closed unexpectedly.'));waiting.clear();};
  const send=(method,params={},sessionId)=>new Promise((resolve,reject)=>{const id=++serial;waiting.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  const cdp=(method,params)=>send(method,params,sessionId);
  const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw Error(`Timed out: ${expression}`);};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const route=async name=>{await evaluate(`location.hash=${JSON.stringify(name)}`);await until(`document.querySelector('#breadcrumb').textContent===${JSON.stringify(({profile:'Basecamp'})[name]||name[0].toUpperCase()+name.slice(1))}`);};
  const screenshot=async name=>{await evaluate(`document.querySelector('#toast-stack').replaceChildren()`);await new Promise(r=>setTimeout(r,150));const {data}=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(join(root,'test-results',name),Buffer.from(data,'base64'));};
  await cdp('Runtime.enable');await cdp('Page.enable');await cdp('Page.bringToFront');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:pathToFileURL(join(root,'index.html')).href});await until(`document.querySelector('h1')!==null`);
  await mkdir(join(root,'test-results'),{recursive:true});
  assert.equal(await evaluate('state.distance'),0);
  // Pagination is applied after filtering and clamps when the last page disappears.
  await route('tasks');
  await evaluate(`window.paginationOriginal=structuredClone(state);state.tasks=Array.from({length:41},(_,i)=>({id:'pagination-'+i,title:'Pagination task '+i,description:'',category:CATEGORIES[i%2],difficulty:'Normal',reward:5,status:'pending',createdAt:C.localDate()}));render()`);
  assert.equal(await evaluate('document.querySelectorAll(".task-row").length'),20);
  assert.equal(await evaluate(`document.querySelector('[data-task-page="0"]').disabled`),true);
  await click('[data-task-page="2"]');
  assert.equal(await evaluate('document.querySelector(".task-copy strong").textContent'),'Pagination task 20');
  await click('[data-task-page="3"]');
  assert.equal(await evaluate('document.querySelectorAll(".task-row").length'),1);
  assert.equal(await evaluate(`document.querySelector('[data-task-page="4"]').disabled`),true);
  await evaluate(`state.tasks.pop();render()`);
  assert.equal(await evaluate('taskPage'),2);
  await evaluate(`document.querySelector('#task-search').value='Pagination task 1';document.querySelector('#task-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate('taskPage'),1);
  assert.equal(await evaluate('document.querySelectorAll(".task-row").length'),11);
  await evaluate(`document.querySelector('#task-search').value='';document.querySelector('#task-search').dispatchEvent(new Event('input',{bubbles:true}))`);
  await click('[data-task-page="2"]');
  await evaluate(`document.querySelector('#category-filter').value=CATEGORIES[0];document.querySelector('#category-filter').dispatchEvent(new Event('change',{bubbles:true}))`);
  assert.equal(await evaluate('taskPage'),1);
  assert.equal(await evaluate('document.querySelectorAll(".task-row").length'),20);
  assert.equal(await evaluate('document.querySelector(".task-pagination")'),null);
  await click('[data-filter="completed"]');
  assert.equal(await evaluate('document.querySelectorAll(".task-row").length'),0);
  await evaluate(`state=window.paginationOriginal;delete window.paginationOriginal;taskPage=1;taskFilter='pending';categoryFilter='all';taskSearch='';render()`);
  await route('overview');
  await screenshot('overview-desktop.png');
  // Match a zoomed desktop: compact whitespace, keep the profile visible, and retain card padding.
  await cdp('Emulation.setDeviceMetricsOverride',{width:1536,height:728,deviceScaleFactor:1,mobile:false});
  assert(await evaluate(`(()=>{const sidebar=document.querySelector('.sidebar');return sidebar.scrollHeight<=sidebar.clientHeight+1 && document.querySelector('.sidebar-profile').getBoundingClientRect().bottom<=innerHeight})()`),'Sidebar fits a zoomed desktop without pushing the profile below the viewport');
  assert(await evaluate(`(()=>{const card=document.querySelector('.sidebar-destination'),meter=document.querySelector('#sidebar-progress .meter');return card.scrollHeight<=card.clientHeight+1 && card.getBoundingClientRect().bottom-meter.getBoundingClientRect().bottom>=19})()`),'North Star keeps its bottom padding and does not clip progress');
  assert(await evaluate(`Number(getComputedStyle(document.querySelector('.sidebar-distance')).fontWeight)>=700`));
  await screenshot('north-star-short-window.png');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});await evaluate(`document.querySelector('.sidebar').scrollTop=0`);
  await click('[data-action="quick"]');await until(`!!document.querySelector('dialog[open]')`);
  assert.equal(await evaluate('document.activeElement.name'),'title');
  await evaluate(`document.querySelector('[name=title]').value='Read <img src=x onerror=alert(1)> & reflect';document.querySelector('#task-form').requestSubmit()`);
  await until('state.distance===5&&!document.querySelector("dialog")');
  assert.equal(await evaluate('state.history.length'),1);
  assert.equal(await evaluate('document.querySelectorAll(".activity-row img").length'),0);
  await cdp('Page.reload');await until('typeof state!=="undefined"&&state.distance===5');
  // An accidentally logged activity becomes an ordinary pending task, including after a reload.
  await route('tasks');await click('[data-filter="completed"]');await click('[data-undo]');
  await until('state.distance===0&&taskFilter==="pending"');assert.equal(await evaluate('state.xp'),0);assert.equal(await evaluate('state.streak'),0);assert.equal(await evaluate('state.tasks[0].status'),'pending');
  assert.equal(await evaluate('document.querySelectorAll(".task-row").length'),1);
  await cdp('Page.reload');await until('typeof state!=="undefined"&&state.distance===0&&document.querySelector("[data-complete]")');
  await click('[data-complete]');await until('state.distance===5');assert.equal(await evaluate('state.history.length'),1);
  await route('tasks');await click('[data-action="plan"]');
  await evaluate(`document.querySelector('[name=title]').value='Planned coding session';document.querySelector('#difficulty').value='Hard';document.querySelector('#difficulty').dispatchEvent(new Event('change',{bubbles:true}))`);
  assert.equal(await evaluate('document.querySelector("#reward-range").min'),'6');assert.equal(await evaluate('document.querySelector("#reward-range").max'),'8');
  await evaluate(`document.querySelector('#task-form').requestSubmit()`);await until('state.tasks.length===2&&!document.querySelector("dialog")');assert.equal(await evaluate('state.distance'),5);
  await click('[data-edit]');await evaluate(`document.querySelector('[name=title]').value='Edited coding session';document.querySelector('#task-form').requestSubmit()`);await until('state.tasks[0].title==="Edited coding session"&&!document.querySelector("dialog")');
  await evaluate(`const completeButton=document.querySelector('[data-complete]');completeButton.click();completeButton.click()`);await until('state.distance===13');assert.equal(await evaluate('state.history.length'),2);assert.equal(await evaluate('state.streak'),1);
  await click('[data-filter="completed"]');assert.equal(await evaluate('document.querySelectorAll(".task-row").length'),2);
  await screenshot('tasks-undo-desktop.png');
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await screenshot('tasks-undo-mobile.png');assert(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'));
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  await evaluate(`const undoButton=document.querySelector('[data-undo]');undoButton.click();undoButton.click()`);await until('state.distance===5&&taskFilter==="pending"');assert.equal(await evaluate('state.history.length'),1);
  await click('[data-complete]');await until('state.distance===13');await click('[data-filter="completed"]');
  await evaluate(`document.querySelector('#task-search').value='Edited';document.querySelector('#task-search').dispatchEvent(new Event('input',{bubbles:true}))`);assert.equal(await evaluate('document.querySelectorAll(".task-row").length'),1);
  await click('[data-delete]');await click('[data-action^="delete:"]');await until('state.tasks.length===1');assert.equal(await evaluate('state.distance'),13);
  await route('journey');assert.equal(await evaluate('document.querySelectorAll(".map-stop").length'),50);
  const overlapping=await evaluate(`(()=>{const a=[...document.querySelectorAll('.map-stop')].map(e=>e.getBoundingClientRect());return a.some((r,i)=>i&&r.top<a[i-1].bottom)})()`);assert.equal(overlapping,false);
  await click('[data-action="locate"]');await screenshot('journey-desktop.png');
  await click('#stop-50');assert.equal(await evaluate('document.querySelector("#modal-title").textContent'),'Mount Everest Summit');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});await until('!document.querySelector("dialog")');
  await route('statistics');
  assert.equal(await evaluate('document.querySelectorAll(".statistics-metrics .metric").length'),5);
  assert.equal(await evaluate('document.querySelector(".statistics-metrics .metric:first-child strong").textContent'),'13m');
  assert.equal(await evaluate('document.querySelector(".statistics-metrics .metric:last-child strong").textContent'),'13.0m');
  assert.equal(await evaluate('document.querySelector(".monthly-table .current-month td:last-child").textContent'),'13.0 m');
  for(const mode of ['daily','weekly','monthly']){await click(`[data-chart="${mode}"]`);assert.equal(await evaluate('document.querySelectorAll(".bar-column").length'),({daily:14,weekly:8,monthly:6})[mode]);}
  await screenshot('statistics-desktop.png');
  await route('profile');await click('[data-action="theme"]');await until('document.documentElement.dataset.theme==="light"');await route('overview');await screenshot('overview-light.png');
  await click('[data-action="theme"]');await until('document.documentElement.dataset.theme==="dark"');
  // Simulated file selection exercises actual input handler and import confirmation.
  await route('profile');const exported=await evaluate('JSON.stringify(state)');
  const downloads=await mkdtemp(join(tmpdir(),'ascend-downloads-'));
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:downloads});await click('[data-action="export"]');
  let files=[];for(let i=0;i<60;i++){files=(await readdir(downloads)).filter(f=>f.endsWith('.json'));if(files.length)break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(files.length,1,'Export button downloads a JSON file');assert.equal(JSON.parse(await readFile(join(downloads,files[0]),'utf8')).distance,13);
  await evaluate(`(()=>{const file=new File([${JSON.stringify(exported)}],'backup.json',{type:'application/json'}),dt=new DataTransfer();dt.items.add(file);const input=document.querySelector('#file-input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);await until('!!document.querySelector("[data-action=import-confirm]")');assert.equal(await evaluate('state.distance'),13);await click('[data-action="import-confirm"]');await until('!document.querySelector("dialog")');assert.equal(await evaluate('state.distance'),13);
  await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File(['{"profile":{},"history":[],"tasks":[]}'],'bad.json'));const input=document.querySelector('#file-input');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);await until('!!document.querySelector(".toast.error")');assert.equal(await evaluate('state.distance'),13);
  for(const width of [390,320,768,1024]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
    for(const name of Object.keys({overview:1,journey:1,tasks:1,achievements:1,statistics:1,profile:1})){
      await route(name);await new Promise(r=>setTimeout(r,80));assert(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),`No horizontal overflow on ${name} at ${width}`);
      if(width===390)await screenshot(`${name}-mobile.png`);
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await route('profile');await new Promise(r=>setTimeout(r,150));
  await click('#mobile-menu');assert.equal(await evaluate('document.querySelector("#mobile-menu").getAttribute("aria-expanded")'),'true');await click('[data-action="close-menu"]');assert.equal(await evaluate('document.querySelector(".sidebar").inert'),true);
  // A failed write must not change in-memory rewards or persisted history.
  await evaluate(`window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')}`);
  await route('overview');await click('[data-action="quick"]');await evaluate(`document.querySelector('[name=title]').value='Must not save';document.querySelector('#task-form').requestSubmit()`);await until('busy===false');assert.equal(await evaluate('state.distance'),13);assert.equal(await evaluate('JSON.parse(localStorage.getItem("ascend-v1")).history.length'),2);
  await evaluate('Storage.prototype.setItem=window.savedSetItem');await click('[data-action="close"]');
  await route('tasks');await evaluate(`taskSearch='';categoryFilter='all';taskFilter='completed';render();Storage.prototype.setItem=function(){throw new DOMException('quota','QuotaExceededError')}`);
  await click('[data-undo]');await until('busy===false');assert.equal(await evaluate('state.distance'),13);assert.equal(await evaluate('state.tasks[0].status'),'completed');
  assert.equal(await evaluate('JSON.parse(localStorage.getItem("ascend-v1")).history.length'),2);await evaluate('Storage.prototype.setItem=window.savedSetItem');
  // Both tabs try the same task concurrently: the second writer must re-read the first transaction.
  await route('tasks');await click('[data-action="plan"]');await evaluate(`document.querySelector('[name=title]').value='One reward across two tabs';document.querySelector('#task-form').requestSubmit()`);await until('state.tasks.some(t=>t.title==="One reward across two tabs")&&!document.querySelector("dialog")');
  const concurrentId=await evaluate(`state.tasks.find(t=>t.title==='One reward across two tabs').id`);
  const secondTarget=await send('Target.createTarget',{url:pathToFileURL(join(root,'index.html')).href}),secondSession=await send('Target.attachToTarget',{targetId:secondTarget.targetId,flatten:true});
  const evalSecond=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},secondSession.sessionId);if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  for(let i=0;i<100;i++){if(await evalSecond('typeof state!=="undefined"'))break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(await evaluate('!!navigator.locks'),true);
  const completeExpression=`commit(s=>C.complete(s,${JSON.stringify(concurrentId)}))`;
  await Promise.all([evaluate(completeExpression),evalSecond(completeExpression)]);await until('state.distance===18');assert.equal(await evalSecond('state.distance'),18);assert.equal(await evaluate('state.history.length'),3);
  const completionId=await evaluate(`state.history.find(h=>h.taskId===${JSON.stringify(concurrentId)}).id`);
  const undoExpression=`commit(s=>C.undoCompletion(s,${JSON.stringify(concurrentId)},${JSON.stringify(completionId)}))`;
  await Promise.all([evaluate(undoExpression),evalSecond(undoExpression)]);await until('state.distance===13');assert.equal(await evalSecond('state.distance'),13);assert.equal(await evaluate('state.history.length'),2);
  await evaluate(completeExpression);await until('state.distance===18');assert.equal(await evalSecond(undoExpression),false);assert.equal(await evaluate('state.distance'),18);
  await send('Target.closeTarget',{targetId:secondTarget.targetId});await cdp('Page.bringToFront');
  // Summit completion must clamp percentage and remaining meters while retaining earned XP.
  await evaluate(`(()=>{const s=C.fresh();s.profile.name='Summit Explorer';s.history=Array.from({length:590},(_,i)=>({id:'summit-'+i,taskId:'summit-task-'+i,title:'Expedition effort',category:'Exercise',reward:15,date:C.localDate()}));AscendStorage.write(s)})()`);
  await cdp('Page.reload');await until('typeof state!=="undefined"&&state.distance===8850');await route('overview');assert.equal(await evaluate('state.unlocked.length'),50);assert.equal(await evaluate('percent()'),100);assert(await evaluate('document.querySelector(".hero-scale").textContent.includes("0 m to the summit")'));
  await route('journey');await click('#stop-50');assert(await evaluate('document.querySelector(".checkpoint-detail-altitude").textContent.includes("Reached")'));await click('[data-action="close"]');
  // Category settings are used by the real task form and persist across reloads.
  await route('profile');await click('[data-action="add-category"]');
  await evaluate(`document.querySelector('#category-form [name=name]').value='Music';document.querySelector('#category-form [value=heart]').checked=true;document.querySelector('#category-form').requestSubmit()`);
  await until('!document.querySelector("dialog")&&state.categories.some(c=>c.name==="Music")');
  await click('[data-category-edit="Music"]');await evaluate(`document.querySelector('#category-form [name=name]').value='Piano practice';document.querySelector('#category-form [value=spark]').checked=true;document.querySelector('#category-form').requestSubmit()`);
  await until('!document.querySelector("dialog")&&state.categories.some(c=>c.name==="Piano practice")');
  await route('tasks');await click('[data-action="quick"]');
  await evaluate(`document.querySelector('#task-form [name=title]').value='Practice scales';document.querySelector('#task-form [name=category]').value='Piano practice';document.querySelector('#task-form').requestSubmit()`);await until('state.distance===8855');
  await cdp('Page.reload');await until('typeof state!=="undefined"&&state.distance===8855');assert.equal(await evaluate(`categoryIcon('Piano practice')`),'spark');
  await route('profile');assert.equal(await evaluate(`document.querySelector('[data-category-delete="Piano practice"]').disabled`),true);
  await click('[data-category-edit="Piano practice"]');await evaluate(`document.querySelector('#category-form [name=name]').value='Music lessons';document.querySelector('#category-form').requestSubmit()`);
  await until('!document.querySelector("dialog")&&state.tasks[0].category==="Music lessons"');assert.equal(await evaluate('state.history.at(-1).category'),'Music lessons');assert.equal(await evaluate('state.distance'),8855);
  await click('[data-action="add-category"]');await evaluate(`document.querySelector('#category-form [name=name]').value='Temporary';document.querySelector('#category-form').requestSubmit()`);await until('!document.querySelector("dialog")');
  await click('[data-category-delete="Temporary"]');await click('[data-action="delete-category:Temporary"]');await until('!document.querySelector("dialog")');assert.equal(await evaluate('state.categories.some(c=>c.name==="Temporary")'),false);
  // Corrupt data is preserved, surfaced, and never silently replaced.
  await evaluate(`localStorage.setItem('ascend-v1','{broken')`);await cdp('Page.reload');await until('document.querySelector("#storage-alert")&&!document.querySelector("#storage-alert").hidden');assert.equal(await evaluate('localStorage.getItem("ascend-v1")'),'{broken');
  assert.deepEqual(errors,[],'No uncaught browser exceptions');
  console.log('PASS: real-browser task flows, quick/planned completion undo, re-completion, undo refresh persistence, duplicate/stale/cross-tab undo, failed writes, North Star padding in short windows, actual JSON download/import, XSS escaping, 50 checkpoints, charts, themes, keyboard dialog, responsive pages, and summit completion.');
  console.log(`Screenshots: ${join(root,'test-results')}`);
  await send('Browser.close');
}finally{ws?.close();child.kill();}
