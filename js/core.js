/* Pure progression and validation. Classic scripts keep file:// support. */
(function (root) {
  'use strict';
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const shiftDate = (key, days) => { const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate()+days); return localDate(date); };
  const validDate = key => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && localDate(new Date(`${key}T12:00:00`)) === key;
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const fresh = () => ({version:2,profile:{name:'The Explorer'},tasks:[],history:[],unlocked:[1],achievements:[],achievementDates:{},settings:{theme:'dark'}});
  const ranks = [[8849,'Summit Seeker'],[6000,'High Altitude'],[3000,'Alpine Explorer'],[1000,'Mountain Walker'],[500,'Skyline Climber'],[100,'City Hiker'],[0,'Trail Starter']];
  const categoryIconChoices=['code','book','calendar','graduation','language','heart','spark','tasks','target','mountain','flame','trophy','flag','sun','chart'];
  function categoryList(s, defaults, icons={}) {
    if(s.categories) return s.categories.map(c=>({...c}));
    const names=[...defaults];
    // Preserve categories on older records when the default list is edited in data.js.
    for(const record of [...s.tasks,...s.history]) if(['Mathematics','University','Reading'].includes(record.category)&&!names.includes(record.category)) names.push(record.category);
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
      for(const record of [...s.tasks,...s.history]) if(record.category===original)record.category=name;
    }
    s.categories=list;
  }
  function deleteCategory(s,name,defaults,icons={}) {
    const list=categoryList(s,defaults,icons);
    if(!list.some(c=>c.name===name))return false;
    if(list.length<=1)throw Error('Keep at least one category.');
    if([...s.tasks,...s.history].some(r=>r.category===name))throw Error('This category is used in tasks or activity history. You can rename it instead.');
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
      s.history.push({id:h.id,taskId:h.taskId,title:h.title,category:h.category,reward:h.reward,date:h.date});
    }
    ids.clear();
    for (const t of raw.tasks) {
      if (!object(t) || !string(t.id,100) || ids.has(t.id) || !string(t.title,160) || !categories.includes(t.category) || !['Very Easy','Easy','Normal','Hard','Very Hard','Epic'].includes(t.difficulty) || !reward(t.reward) || !['pending','completed'].includes(t.status) || typeof t.createdAt!=='string' || !Number.isFinite(Date.parse(t.createdAt)) || (t.description !== undefined && (typeof t.description!=='string' || t.description.length>2000))) fail();
      if ((t.status === 'completed') !== completed.has(t.id)) fail();
      const h = completed.get(t.id);
      if (h && (h.reward!==t.reward || h.title!==t.title || h.category!==t.category)) fail();
      ids.add(t.id);
      s.tasks.push({id:t.id,title:t.title,description:t.description||'',category:t.category,difficulty:t.difficulty,reward:t.reward,status:t.status,createdAt:t.createdAt,...(h?{completedAt:validDate(t.completedAt?.slice(0,10))?t.completedAt:`${h.date}T12:00:00`}:{})});
    }
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
    return {title:input.title.trim(),description:(input.description||'').trim(),category:input.category,difficulty:input.difficulty,reward};
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
  root.AscendCore = {localDate,shiftDate,validDate,uid,fresh,level,streak,derive,reconcile,validate,taskFields,complete,undoCompletion,buckets,monthlySummaries,categoryList,categoryIconChoices,saveCategory,deleteCategory};
  if (typeof module!=='undefined') module.exports = root.AscendCore;
})(globalThis);
