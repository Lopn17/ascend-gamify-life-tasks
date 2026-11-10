/* Local reminders: the page must be open; permission is requested only on a click. */
(function(root){
  'use strict';
  const preferenceKey='ascend-notifications-enabled',receiptKey='ascend-reminder-receipts';
  const trigger=document.createElement('button');
  trigger.className='secondary reminder-trigger';trigger.dataset.action='reminders';
  $('.topbar').append(trigger);
  let running=false;
  const enabled=()=>{try{return localStorage.getItem(preferenceKey)==='true';}catch{return false;}};
  const supported=()=>typeof Notification!=='undefined';
  function decorateForm(dialog){
    const form=dialog.querySelector('#task-form,#habit-form');if(!form)return;
    const task=form.id==='task-form',record=(task?state.tasks:state.habits).find(x=>x.id===form.dataset.id)||{};
    if(task&&form.dataset.quick==='true')return;
    const section=document.createElement('fieldset');section.className='reminder-fields';
    section.innerHTML=`<legend>Reminders${task?' & deadline':''}</legend><div class="form-grid">${task?`<label>Deadline <span class="optional">optional</span><input type="date" name="deadline" value="${esc(record.deadline||'')}"></label>`:''}<label>Daily reminder time <span class="optional">optional</span><input type="time" name="reminderTime" value="${esc(record.reminderTime||'')}"></label></div><p>${task?'A deadline is a gentle nudge, with no penalty. Due and overdue tasks notify at 09:00 unless you choose another time. A daily reminder also works without a deadline.':'Good-habit reminders follow your schedule and stop after a check-in or a completed weekly target. Bad-habit reminders encourage avoidance; no check-in is required.'} Times use your device’s local clock. Clear the time to turn daily reminders off${task?' (deadline reminders stay active)':''}.</p>`;
    form.querySelector('.form-error').before(section);
  }
  function refresh(){
    const items=C.dueReminders(state);
    trigger.innerHTML=`${icon('calendar')}<span>Reminders</span><b>${items.length}</b>`;
    trigger.setAttribute('aria-label',`Reminders: ${items.length} pending`);
    const content=$('#reminder-items');if(content)content.innerHTML=reminderItems(items);
  }
  function reminderItems(items){return items.length?items.map(item=>`<article class="reminder-item"><div><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></div><button class="secondary" data-reminder-open="${esc(item.id)}" data-kind="${item.kind}">Open ${item.kind}</button></article>`).join(''):'<p class="reminder-empty">All caught up for now. Set a deadline or reminder time when creating or editing a task or habit.</p>';}
  function show(){
    const status=!supported()?'Browser notifications are unavailable here. In-app reminders still work.':Notification.permission==='denied'?'Notifications are blocked. You can allow them in your browser’s site settings.':enabled()&&Notification.permission==='granted'?'Browser notifications are on.':'Browser notifications are off.';
    openModal(`<p class="eyebrow">A GENTLE NUDGE</p><h2 id="modal-title">Your reminders</h2><p class="modal-description">Due tasks and scheduled habits that need your attention. Nothing is deducted for missing a deadline.</p><div class="reminder-settings"><p>${status}</p><button class="secondary" data-action="notification-toggle" ${!supported()?'disabled':''}>${enabled()?'Turn notifications off':'Enable browser notifications'}</button><small>Keep this page open for automatic reminders. Background tabs may delay notifications; reminders catch up when you return. Closing the page stops notifications. Each item notifies at most once per local day.</small></div><div id="reminder-items">${reminderItems(C.dueReminders(state))}</div>`);
  }
  async function check(){
    refresh();if(running||busy||storageError)return;running=true;
    const run=()=>{
      const latest=AscendStorage.read();if(latest.error)return;
      const items=C.dueReminders(latest.state).filter(i=>i.notify);if(!items.length)return;
      let receipts;
      try{receipts=JSON.parse(localStorage.getItem(receiptKey)||'{}');if(!receipts||typeof receipts!=='object'||Array.isArray(receipts))receipts={};}catch{receipts={};}
      const today=C.localDate(),pending=items.filter(i=>receipts[i.key]!==today);if(!pending.length)return;
      // Claim the daily batch under a Web Lock so other tabs do not notify twice.
      const next=Object.fromEntries(Object.entries(receipts).filter(([,day])=>day===today));
      pending.forEach(i=>next[i.key]=today);
      try{localStorage.setItem(receiptKey,JSON.stringify(next));}catch{return;}
      const message=pending.length===1?`${pending[0].title} — ${pending[0].detail}`:`${pending.length} reminders waiting: ${pending.slice(0,3).map(i=>i.title).join(', ')}${pending.length>3?'…':''}`;
      toast(message);
      if(enabled()&&supported()&&Notification.permission==='granted'){
        try{
          const notification=new Notification('ASCEND · Your next steps',{body:message,tag:`ascend-reminders-${today}`});
          notification.onclick=()=>{window.focus();show();notification.close();};
        }catch{toast('Browser notification could not be shown. Your reminders are available here.','error');}
      }
    };
    try{if(navigator.locks)await navigator.locks.request('ascend-reminder-delivery',run);else run();}finally{running=false;}
  }
  document.addEventListener('click',async event=>{
    const el=event.target.closest('button');if(!el)return;
    if(el.dataset.action==='reminders')show();
    if(el.dataset.action==='notification-toggle'){
      if(!supported())return;el.disabled=true;
      try{
        if(enabled())localStorage.setItem(preferenceKey,'false');
        else{
          const permission=await Notification.requestPermission();
          if(permission==='granted')localStorage.setItem(preferenceKey,'true');
          else toast('Permission was not granted. In-app reminders remain available.');
        }
        show();
      }catch{toast('Could not enable browser notifications here. In-app reminders remain available.','error');el.disabled=false;}
    }
    if(el.dataset.reminderOpen){
      closeModal();workMode=el.dataset.kind==='habit'?'habits':'tasks';
      if(workMode==='habits'){habitFilter='today';habitDate=C.localDate();}
      else{taskFilter='pending';categoryFilter='all';taskSearch='';taskPage=Math.floor(filteredTasks().findIndex(t=>t.id===el.dataset.reminderOpen)/TASKS_PER_PAGE)+1;}
      if(location.hash!=='#tasks')location.hash='tasks';else{page='tasks';render();}
    }
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
  window.addEventListener('focus',()=>check());
  root.AscendReminders={decorateForm,refresh,check};
  refresh();setTimeout(check,1500);setInterval(check,30000);
})(globalThis);
