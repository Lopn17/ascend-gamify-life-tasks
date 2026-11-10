/* Pure progression and validation. Classic scripts keep file:// support. */
(function (root) {
  'use strict';
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const shiftDate = (key, days) => { const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate()+days); return localDate(date); };
  const validDate = key => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && localDate(new Date(`${key}T12:00:00`)) === key;
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const validTime = value => typeof value==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  function reminderFields(input,task=false){
    const reminderTime=input.reminderTime||'',deadline=input.deadline||'';
    if(reminderTime&&!validTime(reminderTime))throw Error('Choose a valid reminder time.');
    if(task&&deadline&&!validDate(deadline))throw Error('Choose a valid deadline date.');
    return {...(task?{deadline}:{}),reminderTime};
  }
  const fresh = () => ({version:2,profile:{name:'The Explorer'},tasks:[],habits:[],habitEvents:[],history:[],unlocked:[1],achievements:[],achievementDates:{},settings:{theme:'dark'}});
  const ranks = [[8849,'Summit Seeker'],[6000,'High Altitude'],[3000,'Alpine Explorer'],[1000,'Mountain Walker'],[500,'Skyline Climber'],[100,'City Hiker'],[0,'Trail Starter']];
  const categoryIconChoices=['code','book','calendar','graduation','language','heart','spark','tasks','target','mountain','flame','trophy','flag','sun','chart'];
  function categoryList(s, defaults, icons={}) {
    if(s.categories) return s.categories.map(c=>({...c}));
    const names=[...defaults];
    // Preserve categories on older records when the default list is edited in data.js.
    for(const record of [...s.tasks,...(s.habits||[]),...s.history]) if(['Mathematics','University','Reading'].includes(record.category)&&!names.includes(record.category)) names.push(record.category);
    return names.map(name=>({name,icon:Object.hasOwn(icons,name)?icons[name]:'tasks'}));
  }
  function saveCategory(s, original, name, icon, defaults, icons={}) {
    name=name.trim();
    if(!name || name.length>40 || name.toLowerCase()==='all') throw Error('Use a category name of 1–40 characters, other than “All”.');
    if(!categoryIconChoices.includes(icon)) throw Error('Choose an icon from the list.');
    const list=categoryList(s,defaults,icons),index=list.findIndex(c=>c.name===original);
    if(original && index<0) throw Error('This category has changed. Reopen the category editor.');
    if(list.some((c,i)=>i!==index&&c.name.toLowerCase()===name.toLowerCase())) throw Error('A category with that name already exists.');
    if(index<0){if(list.length>=100)throw Error('You can create up to 100 categories.');list.push({name,icon});}
    else{
      list[index]={name,icon};
      for(const record of [...s.tasks,...(s.habits||[]),...s.history]) if(record.category===original)record.category=name;
    }
    s.categories=list;
  }
  function deleteCategory(s,name,defaults,icons={}) {
    const list=categoryList(s,defaults,icons);
    if(!list.some(c=>c.name===name))return false;
    if(list.length<=1)throw Error('Keep at least one category.');
    if([...s.tasks,...(s.habits||[]),...s.history].some(r=>r.category===name))throw Error('This category is used in tasks, habits, or activity history. You can rename it instead.');
    s.categories=list.filter(c=>c.name!==name);
  }
  // Thresholds: 0, 50, 120, 220, 350, 510…; every level has a larger interval.
  function level(x) {
    let level = 1, previous = 0, next = 50;
    while (x >= next) { previous = next; level++; next += 40 + 30*(level-1); }
    return {level,previous,next,progress:x-previous,percent:100*(x-previous)/(next-previous),rank:ranks.find(([minimum])=>x>=minimum)[1]};
  }
  function streak(history, today = localDate()) {
    const days = [...new Set(history.map(h=>h.date))].sort();
    let longest = 0, run = 0, last;
    for (const day of days) { run = last && shiftDate(last,1) === day ? run+1 : 1; longest = Math.max(longest,run); last = day; }
    return {activeDays:days,streak:last === today || last === shiftDate(today,-1) ? run : 0,longestStreak:longest};
  }
  function derive(s, today = localDate()) {
    const distance = s.history.reduce((sum,h)=>sum+h.reward,0);
    return {...s,distance,xp:distance,...level(distance),...streak(s.history,today)};
  }
  function reconcile(s, checkpoints, badges, today = localDate()) {
    const result = derive(s,today);
    result.unlocked = [...new Set([...s.unlocked,...checkpoints.filter(c=>c.altitude<=result.distance).map(c=>c.id)])].sort((a,b)=>a-b);
    result.achievements = [...s.achievements]; result.achievementDates = {...s.achievementDates};
    for (const badge of badges) if (badge.test(result) && !result.achievements.includes(badge.id)) {
      result.achievements.push(badge.id); result.achievementDates[badge.id] = today;
    }
    return result;
  }
  function validate(raw, categories, badges, defaultIcons={}) {
    const fail = () => { throw new Error('This backup contains invalid or inconsistent expedition data.'); };
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const string = (value,limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
    const reward = value => Number.isInteger(value) && value>=1 && value<=15;
    if (!object(raw) || (raw.version !== undefined && raw.version !== 2) || !object(raw.profile) || !string(raw.profile.name,60) || !Array.isArray(raw.tasks) || !Array.isArray(raw.history) || raw.tasks.length>100000 || raw.history.length>100000) fail();
    if(raw.habits!==undefined&&(!Array.isArray(raw.habits)||raw.habits.length>10000))fail();
    if(raw.habitEvents!==undefined&&(!Array.isArray(raw.habitEvents)||raw.habitEvents.length>100000))fail();
    const s = fresh(); s.profile.name = raw.profile.name.trim();
    if(raw.categories!==undefined && (!Array.isArray(raw.categories)||!raw.categories.length||raw.categories.length>100))fail();
    s.categories=raw.categories!==undefined?raw.categories:categoryList(raw,categories,defaultIcons);
    const categoryNames=new Set();
    s.categories=s.categories.map(c=>{
      if(!object(c)||!string(c.name,40)||c.name!==c.name.trim()||c.name.toLowerCase()==='all'||categoryNames.has(c.name.toLowerCase())||!categoryIconChoices.includes(c.icon))fail();
      categoryNames.add(c.name.toLowerCase());return {name:c.name,icon:c.icon};
    });
    categories=s.categories.map(c=>c.name);
    const ids = new Set(), transactions = new Set(), completed = new Map();
    for (const h of raw.history) {
      if (!object(h) || !string(h.id,100) || !string(h.taskId,100) || !string(h.title,160) || !categories.includes(h.category) || !reward(h.reward) || !validDate(h.date) || ids.has(h.id) || transactions.has(h.taskId)) fail();
      ids.add(h.id); transactions.add(h.taskId); completed.set(h.taskId,h);
      if(h.source!==undefined&&h.source!=='habit')fail();
      if(h.source==='habit'&&(!string(h.habitId,100)||!string(h.habitEventId,100)))fail();
      s.history.push({id:h.id,taskId:h.taskId,title:h.title,category:h.category,reward:h.reward,date:h.date,...(h.source==='habit'?{source:'habit',habitId:h.habitId,habitEventId:h.habitEventId}:{})});
    }
    ids.clear();
    for (const t of raw.tasks) {
      if (!object(t) || !string(t.id,100) || ids.has(t.id) || !string(t.title,160) || !categories.includes(t.category) || !['Very Easy','Easy','Normal','Hard','Very Hard','Epic'].includes(t.difficulty) || !reward(t.reward) || !['pending','completed'].includes(t.status) || typeof t.createdAt!=='string' || !Number.isFinite(Date.parse(t.createdAt)) || (t.description !== undefined && (typeof t.description!=='string' || t.description.length>2000))) fail();
      if ((t.status === 'completed') !== completed.has(t.id)) fail();
      const h = completed.get(t.id);
      if (h && (h.reward!==t.reward || h.title!==t.title || h.category!==t.category)) fail();
      ids.add(t.id);
      s.tasks.push({id:t.id,title:t.title,description:t.description||'',category:t.category,difficulty:t.difficulty,reward:t.reward,status:t.status,createdAt:t.createdAt,...(h?{completedAt:validDate(t.completedAt?.slice(0,10))?t.completedAt:`${h.date}T12:00:00`}:{})});
      if(t.deadline!==undefined){if(typeof t.deadline!=='string'||t.deadline&&!validDate(t.deadline))fail();s.tasks.at(-1).deadline=t.deadline;}
      if(t.reminderTime!==undefined){if(typeof t.reminderTime!=='string'||t.reminderTime&&!validTime(t.reminderTime))fail();s.tasks.at(-1).reminderTime=t.reminderTime;}
    }
    const habitIds=new Set();
    for(const h of raw.habits||[]){
      if(!object(h)||!string(h.id,100)||habitIds.has(h.id)||!string(h.name,160)||!categories.includes(h.category)||!['good','bad'].includes(h.type)||!['Very Easy','Easy','Normal','Hard','Very Hard','Epic'].includes(h.difficulty)||!reward(h.reward)||!validDate(h.startDate)||(h.description!==undefined&&(typeof h.description!=='string'||h.description.length>2000))||(h.archived!==undefined&&typeof h.archived!=='boolean'))fail();
      if(!object(h.schedule)||!['daily','days','weekly'].includes(h.schedule.mode)||h.type==='bad'&&h.schedule.mode!=='daily')fail();
      let schedule;
      if(h.schedule.mode==='days'){
        if(!Array.isArray(h.schedule.days)||!h.schedule.days.length||h.schedule.days.length>7||h.schedule.days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(h.schedule.days).size!==h.schedule.days.length)fail();
        schedule={mode:'days',days:[...h.schedule.days].sort((a,b)=>a-b)};
      }else if(h.schedule.mode==='weekly'){
        if(!Number.isInteger(h.schedule.target)||h.schedule.target<1||h.schedule.target>7)fail();
        schedule={mode:'weekly',target:h.schedule.target};
      }else schedule={mode:'daily'};
      if(h.archived&&(!validDate(h.endDate)||h.endDate<h.startDate))fail();
      habitIds.add(h.id);s.habits.push({id:h.id,name:h.name.trim(),description:(h.description||'').trim(),category:h.category,type:h.type,difficulty:h.difficulty,reward:h.reward,schedule,startDate:h.startDate,createdAt:typeof h.createdAt==='string'&&Number.isFinite(Date.parse(h.createdAt))?h.createdAt:`${h.startDate}T12:00:00`,...(h.archived?{archived:true,endDate:h.endDate}:{})});
      if(h.reminderTime!==undefined){if(typeof h.reminderTime!=='string'||h.reminderTime&&!validTime(h.reminderTime))fail();s.habits.at(-1).reminderTime=h.reminderTime;}
    }
    const eventIds=new Set(),badDates=new Set(),habitById=new Map(s.habits.map(h=>[h.id,h]));
    for(const event of raw.habitEvents||[]){
      const habit=habitById.get(event?.habitId);
      if(!object(event)||!string(event.id,100)||eventIds.has(event.id)||!habit||!['checkin','failure','clean'].includes(event.type)||!validDate(event.date)||event.date<habit.startDate||event.date>(habit.endDate||'9999-12-31'))fail();
      if(event.type==='checkin'&&habit.type!=='good'||event.type!=='checkin'&&habit.type!=='bad')fail();
      const eventReward=event.type==='failure'?0:event.reward;
      if(event.type==='failure'?(event.reward!==0&&event.reward!==undefined):!reward(eventReward))fail();
      const key=`${event.habitId}:${event.date}`;
      if(habit.type==='bad'&&badDates.has(key))fail();
      if(habit.type==='bad')badDates.add(key);
      if(event.type!=='failure'&&!string(event.historyId,100))fail();
      const linked=event.type==='failure'?null:s.history.find(h=>h.id===event.historyId&&h.source==='habit'&&h.habitId===event.habitId&&h.habitEventId===event.id&&h.date===event.date&&h.reward===eventReward);
      if(event.type!=='failure'&&!linked)fail();
      eventIds.add(event.id);s.habitEvents.push({id:event.id,habitId:event.habitId,type:event.type,date:event.date,reward:eventReward,...(linked?{historyId:event.historyId}:{}),createdAt:typeof event.createdAt==='string'&&Number.isFinite(Date.parse(event.createdAt))?event.createdAt:`${event.date}T12:00:00`});
    }
    if(s.history.some(h=>h.source==='habit'&&!eventIds.has(h.habitEventId)))fail();
    if (raw.settings !== undefined && (!object(raw.settings) || !['dark','light'].includes(raw.settings.theme))) fail();
    s.settings.theme = raw.settings?.theme || 'dark';
    if (raw.unlocked !== undefined && (!Array.isArray(raw.unlocked) || raw.unlocked.some(id=>!Number.isInteger(id)||id<1||id>50))) fail();
    s.unlocked = [...new Set(raw.unlocked || [1])];
    if (raw.achievements !== undefined && (!Array.isArray(raw.achievements) || raw.achievements.some(id=>!string(id,100) || (badges && !badges.some(b=>b.id===id))))) fail();
    s.achievements = [...new Set(raw.achievements || [])];
    if (raw.achievementDates !== undefined) {
      if (!object(raw.achievementDates)) fail();
      for (const id of s.achievements) { const date = raw.achievementDates[id]; if (date !== undefined && date !== null && !validDate(date)) fail(); if (date) s.achievementDates[id] = date; }
    }
    return s;
  }
  function taskFields(input, categories, difficulties) {
    const range = Object.hasOwn(difficulties,input.difficulty) ? difficulties[input.difficulty] : null;
    if (!input.title?.trim() || input.title.trim().length>160) throw Error('Give your task a title of 1–160 characters.');
    if (!categories.includes(input.category) || !range) throw Error('Choose a valid category and difficulty.');
    const reward = Number(input.reward);
    if (!Number.isInteger(reward) || reward<range[0] || reward>range[1]) throw Error(`Choose a reward from ${range[0]} to ${range[1]} m for this difficulty.`);
    if ((input.description||'').length>2000) throw Error('Keep your notes under 2,000 characters.');
    return {title:input.title.trim(),description:(input.description||'').trim(),category:input.category,difficulty:input.difficulty,reward,...reminderFields(input,true)};
  }
  function complete(s,id,date = localDate()) {
    const t = s.tasks.find(t=>t.id===id);
    if (!t || t.status==='completed' || s.history.some(h=>h.taskId===id)) return false;
    t.status='completed'; t.completedAt=new Date().toISOString();
    s.history.push({id:uid(),taskId:id,title:t.title,category:t.category,reward:t.reward,date});
    return true;
  }
  // Undo only the completion the user saw, not a later re-completion in another tab.
  function undoCompletion(s, id, completionId) {
    const task = s.tasks.find(t=>t.id===id);
    if (!task || task.status!=='completed' || !completionId) return false;
    const index = s.history.findIndex(h=>h.taskId===id && h.id===completionId);
    if (index<0) return false;
    s.history.splice(index,1);
    task.status='pending';
    delete task.completedAt;
    return true;
  }
  function habitFields(input, categories, difficulties) {
    const range=Object.hasOwn(difficulties,input.difficulty)?difficulties[input.difficulty]:null,type=input.type;
    if(!input.name?.trim()||input.name.trim().length>160)throw Error('Give your habit a name of 1–160 characters.');
    if(!['good','bad'].includes(type)||!categories.includes(input.category)||!range)throw Error('Choose a valid habit type, category, and difficulty.');
    const reward=Number(input.reward);
    if(!Number.isInteger(reward)||reward<range[0]||reward>range[1])throw Error(`Choose a reward from ${range[0]} to ${range[1]} m for this difficulty.`);
    if((input.description||'').length>2000)throw Error('Keep your notes under 2,000 characters.');
    if(!validDate(input.startDate))throw Error('Choose a valid tracking start date.');
    let schedule={mode:'daily'};
    if(type==='good'&&input.scheduleMode==='days'){
      const days=[...new Set((input.days||[]).map(Number))].sort((a,b)=>a-b);
      if(!days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6))throw Error('Choose at least one scheduled day.');
      schedule={mode:'days',days};
    }else if(type==='good'&&input.scheduleMode==='weekly'){
      const target=Number(input.weeklyTarget);
      if(!Number.isInteger(target)||target<1||target>7)throw Error('Choose a weekly target from 1 to 7.');
      schedule={mode:'weekly',target};
    }else if(type==='good'&&input.scheduleMode!=='daily')throw Error('Choose a valid schedule.');
    return {name:input.name.trim(),description:(input.description||'').trim(),category:input.category,type,difficulty:input.difficulty,reward,schedule,startDate:input.startDate,...reminderFields(input)};
  }
  function addHabitReward(s,habit,type,date) {
    const eventId=uid(),historyId=uid();
    s.habitEvents.push({id:eventId,habitId:habit.id,type,date,reward:habit.reward,historyId,createdAt:new Date().toISOString()});
    s.history.push({id:historyId,taskId:`habit:${eventId}`,title:type==='clean'?`Avoided ${habit.name}`:habit.name,category:habit.category,reward:habit.reward,date,source:'habit',habitId:habit.id,habitEventId:eventId});
    return eventId;
  }
  function habitCheckIn(s,id,date=localDate(),today=localDate()) {
    const habit=s.habits.find(h=>h.id===id&&!h.archived);
    if(!habit||habit.type!=='good'||!validDate(date)||date>today||date<habit.startDate)return false;
    return addHabitReward(s,habit,'checkin',date);
  }
  function recordBadHabitFailure(s,id,date=localDate(),today=localDate()) {
    const habit=s.habits.find(h=>h.id===id&&!h.archived);
    if(!habit||habit.type!=='bad'||!validDate(date)||date>today||date<habit.startDate)return false;
    const existing=s.habitEvents.find(e=>e.habitId===id&&e.date===date);
    if(existing?.type==='failure')return false;
    if(existing){s.habitEvents=s.habitEvents.filter(e=>e.id!==existing.id);s.history=s.history.filter(h=>h.id!==existing.historyId);}
    const eventId=uid();s.habitEvents.push({id:eventId,habitId:id,type:'failure',date,reward:0,createdAt:new Date().toISOString()});return eventId;
  }
  function removeHabitEvent(s,eventId,today=localDate()) {
    const event=s.habitEvents.find(e=>e.id===eventId),habit=event&&s.habits.find(h=>h.id===event.habitId);
    if(!event||!habit||event.type==='clean')return false;
    s.habitEvents=s.habitEvents.filter(e=>e.id!==eventId);
    if(event.historyId)s.history=s.history.filter(h=>h.id!==event.historyId);
    if(event.type==='failure'&&event.date<today)addHabitReward(s,habit,'clean',event.date);
    return true;
  }
  function settleBadHabits(s,today=localDate()) {
    const yesterday=shiftDate(today,-1);let changed=false;
    for(const habit of s.habits.filter(h=>h.type==='bad')){
      let end=yesterday;if(habit.archived&&habit.endDate<=today)end=shiftDate(habit.endDate,-1);
      if(end<habit.startDate)continue;
      const recorded=new Set(s.habitEvents.filter(e=>e.habitId===habit.id).map(e=>e.date));
      let date=habit.startDate,guard=0;
      while(date<=end&&guard++<100000){if(!recorded.has(date)){addHabitReward(s,habit,'clean',date);changed=true;}date=shiftDate(date,1);}
    }
    return changed;
  }
  function archiveHabit(s,id,today=localDate()) {
    const habit=s.habits.find(h=>h.id===id&&!h.archived);if(!habit)return false;
    habit.archived=true;habit.endDate=today;return true;
  }
  const weekStart=date=>shiftDate(date,-((new Date(`${date}T12:00:00`).getDay()+6)%7));
  function habitStreak(habit,events,today=localDate()) {
    const own=events.filter(e=>e.habitId===habit.id),checkins=new Set(own.filter(e=>e.type==='checkin').map(e=>e.date));
    const outcomes=[];let unit='days';
    const activeEnd=habit.archived&&habit.endDate<=today?shiftDate(habit.endDate,-1):today;
    if(activeEnd<habit.startDate)return {current:0,longest:0,unit};
    if(habit.type==='bad'){
      const failures=new Set(own.filter(e=>e.type==='failure').map(e=>e.date)),end=activeEnd<today?activeEnd:shiftDate(today,-1);
      for(let date=habit.startDate,guard=0;date<=end&&guard++<100000;date=shiftDate(date,1))outcomes.push(!failures.has(date));
      if(!habit.archived&&failures.has(today))outcomes.push(false);
    }else if(habit.schedule.mode==='weekly'){
      unit='weeks';const first=weekStart(habit.startDate),current=weekStart(activeEnd);
      for(let start=first,guard=0;start<=current&&guard++<20000;start=shiftDate(start,7)){
        const end=shiftDate(start,6),count=own.filter(e=>e.type==='checkin'&&e.date>=start&&e.date<=end).length,done=count>=habit.schedule.target;
        if(start===current&&!done&&!habit.archived)break;
        outcomes.push(done);
      }
    }else{
      const due=date=>habit.schedule.mode==='daily'||habit.schedule.days.includes(new Date(`${date}T12:00:00`).getDay());
      for(let date=habit.startDate,guard=0;date<=activeEnd&&guard++<100000;date=shiftDate(date,1))if(due(date)){
        const done=checkins.has(date);if(date===today&&!done&&!habit.archived)break;outcomes.push(done);
      }
    }
    let current=0,longest=0,run=0;for(const done of outcomes){run=done?run+1:0;longest=Math.max(longest,run);}current=run;
    return {current,longest,unit};
  }
  function monthlySummaries(history, today = localDate()) {
    const months=new Map();
    const ensure=key=>{if(!months.has(key))months.set(key,{month:key,distance:0,days:new Set()});return months.get(key);};
    // Include recent empty months, plus every older month containing activity.
    const current=new Date(`${today.slice(0,7)}-01T12:00:00`);
    for(let i=0;i<6;i++){const date=new Date(current);date.setMonth(date.getMonth()-i);ensure(localDate(date).slice(0,7));}
    for(const entry of history){
      if(entry.date>today)continue;
      const month=ensure(entry.date.slice(0,7));month.distance+=entry.reward;month.days.add(entry.date);
    }
    return [...months.values()].sort((a,b)=>b.month.localeCompare(a.month)).map(({month,distance,days})=>({month,distance,activeDays:days.size,average:days.size?distance/days.size:0}));
  }
  function buckets(history, mode, today = localDate()) {
    const count = mode==='daily'?14:mode==='weekly'?8:6;
    const end = new Date(`${today}T12:00:00`);
    if (mode==='weekly') end.setDate(end.getDate()-((end.getDay()+6)%7));
    if (mode==='monthly') end.setDate(1);
    return Array.from({length:count},(_,i)=>{
      const d = new Date(end); const offset=count-i-1;
      if (mode==='monthly') d.setMonth(d.getMonth()-offset); else d.setDate(d.getDate()-offset*(mode==='weekly'?7:1));
      const start=localDate(d), next=new Date(d);
      if (mode==='monthly') next.setMonth(next.getMonth()+1); else next.setDate(next.getDate()+(mode==='weekly'?7:1));
      const finish=localDate(next);
      return {start,end:finish,label:d.toLocaleDateString('en',{month:'short',...(mode!=='monthly'?{day:'numeric'}:{})}),value:history.filter(h=>h.date>=start && h.date<finish).reduce((sum,h)=>sum+h.reward,0)};
    });
  }
  function dueReminders(s,now=new Date()){
    const today=localDate(now),time=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,items=[];
    for(const t of s.tasks){
      if(t.status!=='pending')continue;
      const overdue=!!t.deadline&&t.deadline<today,due=!!t.deadline&&t.deadline===today;
      if(!overdue&&!due&&(!t.reminderTime||time<t.reminderTime))continue;
      items.push({key:`task:${t.id}:${today}`,id:t.id,kind:'task',title:t.title,detail:overdue?`Overdue since ${t.deadline} · Complete whenever you can`:due?'Due today · No penalty for finishing later':'Still on your to-do list',notify:time>=(t.reminderTime||'09:00')});
    }
    for(const h of s.habits||[]){
      if(h.archived||h.startDate>today||!h.reminderTime||time<h.reminderTime)continue;
      const events=(s.habitEvents||[]).filter(e=>e.habitId===h.id);
      if(events.some(e=>e.date===today&&(e.type==='checkin'||e.type==='failure')))continue;
      if(h.type==='good'&&h.schedule.mode==='days'&&!h.schedule.days.includes(now.getDay()))continue;
      if(h.type==='good'&&h.schedule.mode==='weekly'&&events.filter(e=>e.type==='checkin'&&e.date>=weekStart(today)&&e.date<=today).length>=h.schedule.target)continue;
      items.push({key:`habit:${h.id}:${today}`,id:h.id,kind:'habit',title:h.name,detail:h.type==='bad'?'Keep avoiding this habit today. Only log it if it happens.':h.schedule.mode==='weekly'?'Your weekly target is still in progress':'Your scheduled check-in is waiting',notify:true});
    }
    return items;
  }
  root.AscendCore = {localDate,shiftDate,validDate,uid,fresh,level,streak,derive,reconcile,validate,taskFields,complete,undoCompletion,habitFields,habitCheckIn,recordBadHabitFailure,removeHabitEvent,settleBadHabits,archiveHabit,habitStreak,buckets,monthlySummaries,categoryList,categoryIconChoices,saveCategory,deleteCategory,dueReminders};
  if (typeof module!=='undefined') module.exports = root.AscendCore;
})(globalThis);
