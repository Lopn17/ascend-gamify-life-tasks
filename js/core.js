/* Pure progression and validation. Classic scripts keep file:// support. */
(function (root) {
  'use strict';
  const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const shiftDate = (key, days) => { const date = new Date(`${key}T12:00:00`); date.setDate(date.getDate()+days); return localDate(date); };
  const validDate = key => typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && localDate(new Date(`${key}T12:00:00`)) === key;
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const fresh = () => ({version:2,profile:{name:'The Explorer'},tasks:[],history:[],unlocked:[1],achievements:[],achievementDates:{},settings:{theme:'dark'}});
  const ranks = [[8849,'Summit Seeker'],[6000,'High Altitude'],[3000,'Alpine Explorer'],[1000,'Mountain Walker'],[500,'Skyline Climber'],[100,'City Hiker'],[0,'Trail Starter']];
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
  function validate(raw, categories, badges) {
    const fail = () => { throw new Error('This backup contains invalid or inconsistent expedition data.'); };
    const object = value => value && typeof value === 'object' && !Array.isArray(value);
    const string = (value,limit) => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
    const reward = value => Number.isInteger(value) && value>=1 && value<=15;
    if (!object(raw) || (raw.version !== undefined && raw.version !== 2) || !object(raw.profile) || !string(raw.profile.name,60) || !Array.isArray(raw.tasks) || !Array.isArray(raw.history) || raw.tasks.length>100000 || raw.history.length>100000) fail();
    const s = fresh(); s.profile.name = raw.profile.name.trim();
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
  root.AscendCore = {localDate,shiftDate,validDate,uid,fresh,level,streak,derive,reconcile,validate,taskFields,complete,undoCompletion,buckets};
  if (typeof module!=='undefined') module.exports = root.AscendCore;
})(globalThis);
