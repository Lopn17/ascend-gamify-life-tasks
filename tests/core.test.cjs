const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const C=require('../js/core.js');
const data=vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../data.js'),'utf8')+'; ({CHECKPOINTS,CATEGORIES,DIFFICULTIES,ACHIEVEMENTS})');
const {CHECKPOINTS,CATEGORIES,DIFFICULTIES,ACHIEVEMENTS}=data;
function task(id='task-1',reward=5){return {id,title:'Practice calculus',description:'',category:'Study',difficulty:'Normal',reward,status:'pending',createdAt:'2026-11-01T12:00:00.000Z'};}
const activity=(date,reward=5,id=date)=>({id:`activity-${id}`,taskId:`task-${id}`,title:'Practice calculus',category:'Study',reward,date});
test('50 strictly ordered checkpoints reach exactly Everest',()=>{assert.equal(CHECKPOINTS.length,50);assert.equal(CHECKPOINTS[0].altitude,0);assert.equal(CHECKPOINTS.at(-1).altitude,8849);assert(CHECKPOINTS.every((c,i)=>!i||c.altitude>CHECKPOINTS[i-1].altitude));});
test('planned tasks earn nothing and completion earns exactly once',()=>{const s=C.fresh();s.tasks.push(task());assert.equal(C.derive(s).distance,0);assert(C.complete(s,'task-1','2026-11-01'));assert.equal(C.complete(s,'task-1','2026-11-01'),false);assert.equal(C.derive(s).distance,5);assert.equal(s.history.length,1);});
test('transaction deduplication also guards a stale pending task',()=>{const s=C.fresh();s.tasks.push(task());C.complete(s,'task-1');s.tasks[0].status='pending';assert.equal(C.complete(s,'task-1'),false);assert.equal(s.history.length,1);});
test('deleting a completed task keeps its historical altitude',()=>{const s=C.fresh();s.tasks.push(task());C.complete(s,'task-1');s.tasks=[];assert.equal(C.derive(C.validate(s,CATEGORIES)).distance,5);});
test('level thresholds progress smoothly and match the original brief',()=>{const thresholds=[0,50,120,220,350,510];thresholds.forEach((xp,i)=>{assert.equal(C.level(xp).level,i+1);assert.equal(C.level(xp).progress,0);if(xp)assert.equal(C.level(xp-1).level,i);});assert(C.level(8849).percent<100);});
test('local dates use the local calendar at the UTC boundary',()=>{process.env.TZ='Asia/Taipei';assert.equal(C.localDate(new Date('2026-11-06T16:10:00Z')),'2026-11-07');assert.equal(C.shiftDate('2026-03-01',-1),'2026-02-28');});
test('multiple tasks in one day count once; yesterday preserves a streak',()=>{const s=C.streak([activity('2026-11-01'),activity('2026-11-02'),activity('2026-11-02',5,'duplicate-day')],'2026-11-03');assert.equal(s.streak,2);assert.equal(s.activeDays.length,2);assert.equal(s.longestStreak,2);});
test('missing a day resets current streak but keeps all rewards and longest streak',()=>{const s=C.fresh();s.history=[activity('2026-11-01'),activity('2026-11-02')];const d=C.derive(s,'2026-11-04');assert.equal(d.streak,0);assert.equal(d.longestStreak,2);assert.equal(d.distance,10);});
test('checkpoints unlock at their exact thresholds and are retained',()=>{const s=C.fresh();s.history=[activity('2026-11-01',3)];let d=C.reconcile(s,CHECKPOINTS,ACHIEVEMENTS,'2026-11-01');assert(d.unlocked.includes(2));assert(!d.unlocked.includes(3));d.unlocked.push(3);d=C.reconcile(d,CHECKPOINTS,ACHIEVEMENTS);assert(d.unlocked.includes(3));});
test('achievements unlock once and dates remain stable',()=>{const s=C.fresh();s.tasks=[task()];C.complete(s,'task-1','2026-11-01');const a=C.reconcile(s,CHECKPOINTS,ACHIEVEMENTS,'2026-11-01'),b=C.reconcile(a,CHECKPOINTS,ACHIEVEMENTS,'2026-11-02');assert.equal(b.achievementDates['first-step'],'2026-11-01');assert.equal(b.achievements.length,new Set(b.achievements).size);assert.equal(a.achievements.length,b.achievements.length);});
test('new rewards must fit each difficulty; whitespace-only titles fail',()=>{for(const [difficulty,[min,max]] of Object.entries(DIFFICULTIES)){assert.equal(C.taskFields({...task(),difficulty,reward:min},CATEGORIES,DIFFICULTIES).reward,min);assert.throws(()=>C.taskFields({...task(),difficulty,reward:max+1},CATEGORIES,DIFFICULTIES));}assert.throws(()=>C.taskFields({...task(),title:'   '},CATEGORIES,DIFFICULTIES));});
test('legacy backups retain name, theme, reward history, and unlocks',()=>{const legacy={profile:{name:'The Explorer'},tasks:[{...task('old',15),status:'completed'}],history:[{...activity('2026-11-01',15),taskId:'old'}],distance:999,xp:999,settings:{theme:'light'},unlocked:[1,2,3],achievements:['first-step']};const s=C.validate(legacy,CATEGORIES);assert.equal(s.tasks[0].reward,15);assert.equal(C.derive(s).distance,15);assert.equal(s.settings.theme,'light');assert.equal(s.profile.name,'The Explorer');assert.equal(s.achievements[0],'first-step');});
test('JSON export/import round trip retains transactions',()=>{const s=C.fresh();s.tasks=[task()];C.complete(s,'task-1');const a=C.reconcile(s,CHECKPOINTS,ACHIEVEMENTS),b=C.reconcile(C.validate(JSON.parse(JSON.stringify(a)),CATEGORIES),CHECKPOINTS,ACHIEVEMENTS);assert.equal(a.distance,b.distance);assert.deepEqual(a.history,b.history);assert.deepEqual(a.achievementDates,b.achievementDates);});
test('reject malformed data, duplicate transactions, invalid dates and broken task/history links',()=>{const s=C.fresh();s.tasks=[task()];C.complete(s,'task-1');for(const mutate of [x=>x.history.push(x.history[0]),x=>x.history[0].reward=500,x=>x.history[0].date='2026-02-30',x=>x.history[0].category='__proto__',x=>x.tasks[0].reward=10,x=>x.tasks[0].status='pending',x=>x.profile.name={},x=>x.settings.theme='banana']){const bad=structuredClone(s);mutate(bad);assert.throws(()=>C.validate(bad,CATEGORIES));}});
test('daily, weekly and monthly bins cross month/year boundaries correctly',()=>{const h=[activity('2025-12-31',5),activity('2026-01-01',3),activity('2026-01-05',8)];assert.equal(C.buckets(h,'daily','2026-01-05').at(-1).value,8);assert.equal(C.buckets(h,'weekly','2026-01-05').at(-1).value,8);assert.equal(C.buckets(h,'weekly','2026-01-05').at(-2).value,8);assert.equal(C.buckets(h,'monthly','2026-01-05').at(-1).value,11);});
test('unknown achievement IDs cannot enter a validated backup',()=>{const s=C.fresh();s.achievements=['__proto__'];assert.throws(()=>C.validate(s,CATEGORIES,ACHIEVEMENTS));});
test('unknown difficulty cannot bypass ranges through inherited object keys',()=>{assert.throws(()=>C.taskFields({...task(),difficulty:'toString'},CATEGORIES,DIFFICULTIES));});
test('monthly averages isolate each month and count distinct active dates, not tasks',()=>{
  const history=[activity('2025-12-31',15),activity('2026-01-01',5),activity('2026-01-01',3,'second-task'),activity('2026-01-03',10),activity('2026-02-01',15)];
  const months=C.monthlySummaries(history,'2026-01-15');
  assert.deepEqual(months[0],{month:'2026-01',distance:18,activeDays:2,average:9});
  assert.deepEqual(months[1],{month:'2025-12',distance:15,activeDays:1,average:15});
  assert.equal(months.some(m=>m.month==='2026-02'),false);
});
test('monthly summary handles empty months and retains activity older than six months',()=>{
  const months=C.monthlySummaries([activity('2024-02-29',7)],'2026-01-15');
  assert.deepEqual(months[0],{month:'2026-01',distance:0,activeDays:0,average:0});
  assert.deepEqual(months.at(-1),{month:'2024-02',distance:7,activeDays:1,average:7});
  assert.equal(C.monthlySummaries([],'2026-01-15').length,6);
});
test('custom category rename updates completed tasks and history while retaining rewards and icons in backups',()=>{
  const s=C.fresh();C.saveCategory(s,'','Music','heart',CATEGORIES);s.tasks=[{...task(),category:'Music'}];C.complete(s,'task-1');
  C.saveCategory(s,'Music','Piano practice','spark',CATEGORIES);
  const restored=C.validate(JSON.parse(JSON.stringify(s)),CATEGORIES,ACHIEVEMENTS);
  assert.equal(restored.tasks[0].category,'Piano practice');assert.equal(restored.history[0].category,'Piano practice');assert.equal(C.derive(restored).distance,5);
  assert.equal(restored.categories.find(c=>c.name==='Piano practice').icon,'spark');
  assert.throws(()=>C.deleteCategory(restored,'Piano practice',CATEGORIES));
});
test('category editor rejects duplicate/invalid names and icons, and removes only unused categories',()=>{
  const s=C.fresh();C.saveCategory(s,'','Music','heart',CATEGORIES);
  assert.throws(()=>C.saveCategory(s,'','music','heart',CATEGORIES));assert.throws(()=>C.saveCategory(s,'','  ','heart',CATEGORIES));assert.throws(()=>C.saveCategory(s,'','All','heart',CATEGORIES));assert.throws(()=>C.saveCategory(s,'','Test','invalid',CATEGORIES));
  C.deleteCategory(s,'Music',CATEGORIES);assert(!s.categories.some(c=>c.name==='Music'));
});
test('legacy records using removed default categories still load after editing data.js defaults',()=>{
  const s=C.fresh();s.tasks=[{...task(),category:'Mathematics'}];C.complete(s,'task-1');
  const restored=C.validate(s,CATEGORIES,ACHIEVEMENTS,{Mathematics:'target',Study:'book'});
  assert(restored.categories.some(c=>c.name==='Study'&&c.icon==='book'));
  assert(restored.categories.some(c=>c.name==='Mathematics'&&c.icon==='target'));
  assert.equal(C.derive(restored).distance,5);
});
test('undo removes only the selected reward and restores the intact task to pending',()=>{
  const s=C.fresh(),original={...task(),description:'Keep my notes'};s.tasks=[structuredClone(original),task('other')];
  C.complete(s,'task-1','2026-11-01');C.complete(s,'other','2026-11-02');
  const completionId=s.history[0].id,other=structuredClone(s.history[1]);
  assert(C.undoCompletion(s,'task-1',completionId));assert.deepEqual(s.tasks[0],original);
  assert.deepEqual(s.history,[other]);assert.equal(C.derive(s).distance,5);assert.equal(C.derive(s).xp,5);
  assert.equal(C.undoCompletion(s,'task-1',completionId),false);assert.equal(C.derive(s).distance,5);
  assert.doesNotThrow(()=>C.validate(s,CATEGORIES,ACHIEVEMENTS));
});
test('undo of the only activity resets distance, XP, streak, and chart without removing collected milestones',()=>{
  let s=C.fresh();s.tasks=[task()];C.complete(s,'task-1','2026-11-01');s=C.reconcile(s,CHECKPOINTS,ACHIEVEMENTS,'2026-11-01');
  const milestones=structuredClone(s.unlocked),badges=structuredClone(s.achievements);
  assert(C.undoCompletion(s,'task-1',s.history[0].id));s=C.reconcile(s,CHECKPOINTS,ACHIEVEMENTS,'2026-11-01');
  assert.equal(s.distance,0);assert.equal(s.xp,0);assert.equal(s.streak,0);assert.equal(s.longestStreak,0);assert.equal(s.activeDays.length,0);
  assert.equal(C.buckets(s.history,'daily','2026-11-01').at(-1).value,0);assert.deepEqual(s.unlocked,milestones);assert.deepEqual(s.achievements,badges);
});
test('re-completion after undo is rewarded once, on its new date; a stale undo cannot cancel it',()=>{
  const s=C.fresh();s.tasks=[task()];C.complete(s,'task-1','2026-11-01');const oldId=s.history[0].id;
  assert(C.undoCompletion(s,'task-1',oldId));assert(C.complete(s,'task-1','2026-11-03'));
  assert.equal(C.complete(s,'task-1','2026-11-03'),false);assert.equal(C.undoCompletion(s,'task-1',oldId),false);
  assert.equal(s.history.length,1);assert.equal(s.history[0].date,'2026-11-03');assert.equal(C.derive(s).distance,5);
  assert.notEqual(s.history[0].id,oldId);
});
test('undo updates level thresholds and survives a JSON round trip',()=>{
  const s=C.fresh();s.tasks=[task()];s.history=[activity('2026-10-28',15),activity('2026-10-29',15),activity('2026-10-30',15)];
  C.complete(s,'task-1','2026-11-01');assert.equal(C.derive(s).level,2);
  C.undoCompletion(s,'task-1',s.history.at(-1).id);const restored=C.derive(C.validate(JSON.parse(JSON.stringify(s)),CATEGORIES,ACHIEVEMENTS),'2026-11-01');
  assert.equal(restored.distance,45);assert.equal(restored.level,1);assert.equal(restored.tasks[0].status,'pending');assert.equal(restored.streak,0);
});
test('invalid, deleted, pending, or mismatched undo requests leave state unchanged',()=>{
  const s=C.fresh();s.tasks=[task()];const before=JSON.stringify(s);
  assert.equal(C.undoCompletion(s,'task-1','missing'),false);assert.equal(JSON.stringify(s),before);
  C.complete(s,'task-1');const completed=JSON.stringify(s);
  assert.equal(C.undoCompletion(s,'task-1','wrong-id'),false);assert.equal(C.undoCompletion(s,'missing',s.history[0].id),false);assert.equal(C.undoCompletion(s,'task-1'),false);
  assert.equal(JSON.stringify(s),completed);
  s.tasks=[];const deleted=JSON.stringify(s);assert.equal(C.undoCompletion(s,'task-1',s.history[0].id),false);assert.equal(JSON.stringify(s),deleted);
});
