/* Read-only child-card model. Calendar and bonus rules are shared with schedule-editor.html. */
(function(global){
'use strict';
const TZ='Asia/Vladivostok',STORE='culibin-schedule-prototype-v1';
const DAYS=[{id:1,short:'Пн',name:'Понедельник',plural:'понедельникам'},{id:2,short:'Вт',name:'Вторник',plural:'вторникам'},{id:3,short:'Ср',name:'Среда',plural:'средам'},{id:4,short:'Чт',name:'Четверг',plural:'четвергам'},{id:5,short:'Пт',name:'Пятница',plural:'пятницам'},{id:6,short:'Сб',name:'Суббота',plural:'субботам'},{id:0,short:'Вс',name:'Воскресенье',plural:'воскресеньям'}];
const CHILDREN=[{id:'c1',name:'Петров Александр Сергеевич',emoji:'🦾',balance:420},{id:'c2',name:'Иванов Артём Михайлович',emoji:'🚀',balance:180},{id:'c3',name:'Сидоров Никита Андреевич',emoji:'🔧',balance:330},{id:'c4',name:'Иванов Максим Дмитриевич',emoji:'🧩',balance:250},{id:'c5',name:'Петров Даниил Романович',emoji:'🦉',balance:200},{id:'c6',name:'Сидоров Михаил Олегович',emoji:'🐢',balance:80},{id:'c7',name:'Петров Илья Александрович',emoji:'🛰️',balance:500},{id:'c8',name:'Сидоров Андрей Павлович',emoji:'⚡',balance:200}];
const DAY_STATUS_LABELS={excluded:'Не учитывать в подсчете',lesson:'Учитывать в подсчете',homework:'Учитывать в подсчете как ДЗ'};
let state,today;
function groupNow(){return state.groups[0]}
function bonusFor(month,group=groupNow()){return ruleFor(group,month).bonus}
function todayISO(now=new Date()){const p=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),v=t=>p.find(x=>x.type===t).value;return v('year')+'-'+v('month')+'-'+v('day')}
function monthShift(month,delta){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-1+delta,1)).toISOString().slice(0,7)}
function monthTitle(month){return new Date(month+'-15T12:00:00Z').toLocaleDateString('ru',{month:'long',year:'numeric',timeZone:'UTC'}).replace(' г.','')}
function dateTitle(date,year=false){return new Date(date+'T12:00:00Z').toLocaleDateString('ru',{day:'numeric',month:'long',...(year?{year:'numeric'}:{}),timeZone:'UTC'})}
function normalizeWeekdays(values){return [...new Set((Array.isArray(values)?values:[values]).filter(v=>v!==null&&v!==undefined&&v!=='').map(Number).filter(v=>Number.isInteger(v)&&v>=0&&v<=6))].sort((a,b)=>(a+6)%7-(b+6)%7)}
function weekdaysText(weekdays,plural=false){const selected=normalizeWeekdays(weekdays);return DAYS.filter(d=>selected.includes(d.id)).map(d=>plural?d.plural:d.name).join(', ')}
function weekdayOn(date){const day=new Date(date+'T12:00:00Z').getUTCDay();return DAYS.find(d=>d.id===day).name}
function datesInMonth(month,weekdays){const selected=new Set(normalizeWeekdays(weekdays)),[y,m]=month.split('-').map(Number),last=new Date(Date.UTC(y,m,0)).getUTCDate(),out=[];for(let d=1;d<=last;d++){const date=new Date(Date.UTC(y,m-1,d));if(selected.has(date.getUTCDay()))out.push(date.toISOString().slice(0,10))}return out}
function dayKey(groupId,date){return groupId+'|'+date}
function dayStatus(group,date,rule=ruleFor(group,date.slice(0,7))){const custom=state.dayOverrides[dayKey(group.id,date)];if(Object.hasOwn(DAY_STATUS_LABELS,custom))return custom;const weekday=new Date(date+'T12:00:00Z').getUTCDay();return rule.weekdays.includes(weekday)?'lesson':'excluded'}
function countedDates(group,month,rule=ruleFor(group,month)){return datesInMonth(month,[1,2,3,4,5,6,0]).filter(date=>dayStatus(group,date,rule)!=='excluded')}
function validISODate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;try{return new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value}catch{return false}}
function shortDate(date){return date.slice(8,10)+'.'+date.slice(5,7)}
function accrualsFor(group,date,childId){return Object.values(state.botAccruals).filter(e=>e.groupId===group.id&&e.childId===childId&&e.lessonDate===date&&e.creditedOn<=today)}
function completionInfo(group,date,childId){
 const key=markKey(group.id,date,childId),homework=dayStatus(group,date)==='homework';
 if(homework){const done=state.homework[key]==='present';return{status:done?'present':'',kind:'homework',label:done?'ДЗ выполнено':'ДЗ не отмечено',note:done?'ДЗ':'',completedOn:done?(state.homeworkCompletedOn[key]||date):null}}
 const receipts=accrualsFor(group,date,childId);
 if(receipts.length)return{status:'present',kind:'bot',label:'КК начислены в чат-боте',note:'',completedOn:receipts.map(e=>e.creditedOn).sort()[0]};
 const makeup=state.makeups[key];
 if(makeup?.type==='other-day'&&validISODate(makeup.date)&&makeup.date<=today&&makeup.date!==date)return{status:'present',kind:'makeup-day',label:'Отработал: посетил занятие '+dateTitle(makeup.date,true),note:shortDate(makeup.date),completedOn:makeup.date};
 if(makeup?.type==='homework'&&validISODate(makeup.completedOn)&&makeup.completedOn<=today)return{status:'present',kind:'makeup-homework',label:'Отработал как ДЗ',note:'ДЗ',completedOn:makeup.completedOn};
 return{status:'',kind:'uncredited',label:'КК не начислены на занятии',note:'',completedOn:null};
}
function completionStatus(group,date,childId){return completionInfo(group,date,childId).status}
function markKey(groupId,date,childId){return groupId+'|'+date+'|'+childId}
function awardKey(groupId,month,childId){return groupId+'|'+month+'|'+childId}
function ruleFor(group,month){return [...group.rules].sort((a,b)=>a.from.localeCompare(b.from)).filter(r=>r.from<=month).at(-1)}
function createDemo(today){const month=today.slice(0,7),previous=monthShift(month,-1);const groups=[{id:'g1',name:'Шк34-1',members:['c1','c2','c5','c6'],rules:[{from:'0000-01',weekdays:[4],bonus:20}]},{id:'g2',name:'Шк34-3',members:['c1','c4','c8'],rules:[{from:'0000-01',weekdays:[1],bonus:20}]},{id:'g3',name:'Шк12-2',members:['c3','c5','c7'],rules:[{from:'0000-01',weekdays:[6],bonus:20}]}];const data={version:5,groups,attendance:{},homework:{},dayOverrides:{},awards:{},botAccruals:{},makeups:{},homeworkCompletedOn:{}};for(const group of groups){for(const m of [previous,month]){const dates=datesInMonth(m,ruleFor(group,m).weekdays).filter(d=>d<=today);group.members.forEach((id,index)=>dates.forEach((date,i)=>{let status='present';if(index===1&&i===1)status=null;if(index===group.members.length-1&&i===dates.length-1)status=null;if(status)data.attendance[markKey(group.id,date,id)]=status}))}}return migrateState(data)}
function migrateState(data){
 if(!data||![1,2,3,4,5].includes(data.version)||!Array.isArray(data.groups)||!data.groups.length||!data.attendance||!data.awards)throw Error('Invalid data');
 for(const group of data.groups){
  const oldRules=[...group.rules].sort((a,b)=>a.from.localeCompare(b.from));
  if(data.version===2){
   // Preserve each historical schedule and common amount as group-specific rules.
   if(!Array.isArray(data.bonusRules)||!data.bonusRules.length)throw Error('Missing bonus rules');
   const oldBonuses=[...data.bonusRules].sort((a,b)=>a.from.localeCompare(b.from));
   const periods=[...new Set([...oldRules.map(r=>r.from),...oldBonuses.map(r=>r.from)])].sort();
   group.rules=periods.map(from=>{const r=oldRules.filter(r=>r.from<=from).at(-1)||oldRules[0],bonus=oldBonuses.filter(r=>r.from<=from).at(-1)||oldBonuses[0];return{from,weekdays:normalizeWeekdays(r.weekdays??r.weekday),bonus:bonus.amount}});
  }else{
   group.rules=oldRules.map(r=>({from:r.from,weekdays:normalizeWeekdays(r.weekdays??r.weekday),bonus:Number(r.bonus??20)}));
  }
  if(group.rules.some(r=>!r.weekdays.length))throw Error('Missing weekdays');
 }
 delete data.bonusRules;data.homework=data.homework||{};data.dayOverrides=data.dayOverrides||{};
 data.botAccruals=data.botAccruals||{};data.makeups=data.makeups||{};data.homeworkCompletedOn=data.homeworkCompletedOn||{};
 // Legacy green marks become demo bot receipts; obsolete absence marks are removed.
 for(const [key,status] of Object.entries(data.attendance)){
  if(status!=='present'){delete data.attendance[key];continue}
  const [groupId,lessonDate,childId]=key.split('|');
  if(!Object.values(data.botAccruals).some(e=>e.groupId===groupId&&e.lessonDate===lessonDate&&e.childId===childId)){
   data.botAccruals['legacy|'+key]={id:'legacy|'+key,groupId,lessonDate,childId,amount:0,creditedOn:lessonDate,includeInBalance:false,source:'demo'};
  }
 }
 for(const [key,status] of Object.entries(data.homework))if(status!=='present'){delete data.homework[key];delete data.homeworkCompletedOn[key]}
 data.version=5;
 return data;
}
function attendanceFor(group,month,childId){
 const rule=ruleFor(group,month),dates=countedDates(group,month),homeworkCount=dates.filter(d=>dayStatus(group,d)==='homework').length;
 const present=dates.filter(d=>d<=today&&completionStatus(group,d,childId)==='present').length;
 let streak=0;for(const d of dates.filter(d=>d<=today)){if(completionStatus(group,d,childId)==='present')streak++;else streak=0}
 return{rule,bonus:bonusFor(month,group),dates,present,streak,homeworkCount,lessonCount:dates.length-homeworkCount,hasHomework:homeworkCount>0,complete:dates.length>0&&present===dates.length,award:state.awards[awardKey(group.id,month,childId)]||null};
}
function reconcileAwards(){const old=JSON.stringify(state.awards),months=new Set([...Object.keys(state.attendance),...Object.keys(state.homework),...Object.keys(state.dayOverrides),...Object.keys(state.makeups)].map(k=>k.split('|')[1].slice(0,7)));for(const award of Object.values(state.awards))months.add(award.month);for(const group of state.groups){for(const month of months){if(month>today.slice(0,7))continue;for(const id of group.members){const a=attendanceFor(group,month,id),key=awardKey(group.id,month,id);if(a.complete&&a.dates.at(-1)<=today){if(!state.awards[key])state.awards[key]={id:key,groupId:group.id,childId:id,month,amount:a.bonus,date:[a.dates.at(-1),...a.dates.map(d=>completionInfo(group,d,id).completedOn||d)].sort().at(-1)};}else delete state.awards[key]}}}return old!==JSON.stringify(state.awards)}
function balanceFor(child){return child.balance+Object.values(state.awards).filter(a=>a.childId===child.id).reduce((sum,a)=>sum+a.amount,0)+Object.values(state.botAccruals).filter(e=>e.childId===child.id&&e.includeInBalance).reduce((sum,e)=>sum+e.amount,0)}
// Replace one untouched demo receipt with a homework makeup, preserving progress and balance.
function addDemoHomeworkExample(data){
 if(data.demoHomeworkExample)return;
 const group=data.groups.find(g=>g.id==='g1'&&g.members.includes('c1'));if(!group)return;
 for(const date of datesInMonth(today.slice(0,7),ruleFor(group,today.slice(0,7)).weekdays).filter(d=>d<=today)){
  const key=markKey(group.id,date,'c1'),receiptId='legacy|'+key;
  const receipts=Object.values(data.botAccruals).filter(e=>e.groupId===group.id&&e.childId==='c1'&&e.lessonDate===date);
  if(receipts.length!==1||receipts[0].id!==receiptId||receipts[0].source!=='demo'||receipts[0].amount!==0||receipts[0].includeInBalance)continue;
  if(Object.hasOwn(data.dayOverrides,dayKey(group.id,date))||data.makeups[key]||data.homework[key])continue;
  delete data.attendance[key];delete data.botAccruals[receiptId];
  data.makeups[key]={type:'homework',completedOn:date};data.demoHomeworkExample=key;return;
 }
}
function refresh(){
 today=todayISO();let raw=null;
 try{raw=localStorage.getItem(STORE);state=migrateState(JSON.parse(raw))}catch{state=createDemo(today)}
 addDemoHomeworkExample(state);reconcileAwards();
 try{const serialized=JSON.stringify(state);if(raw!==serialized)localStorage.setItem(STORE,serialized)}catch{}
}
function memberships(childId,month=today.slice(0,7)){
 return state.groups.filter(group=>group.members.includes(childId)).map(group=>({id:group.id,weekdays:[...ruleFor(group,month).weekdays],bonus:bonusFor(month,group),label:weekdaysText(ruleFor(group,month).weekdays)}));
}
function account(childId){
 const child=CHILDREN.find(c=>c.id===childId);if(!child)return null;
 return{balance:balanceFor(child),credits:Object.values(state.botAccruals).filter(e=>e.childId===childId&&e.includeInBalance).map(e=>({...e})),awards:Object.values(state.awards).filter(a=>a.childId===childId).map(a=>({...a}))};
}
function motivationFor(group){return{title:typeof group.motivation?.title==='string'&&group.motivation.title.trim()?group.motivation.title.trim():'Твой путь к бонусу',content:typeof group.motivation?.content==='string'?group.motivation.content:''}}
function calendar(childId,groupId,month=today.slice(0,7)){
 const group=state.groups.find(g=>g.id===groupId&&g.members.includes(childId));if(!group)return null;
 const summary=attendanceFor(group,month,childId),entries={};
 for(const date of datesInMonth(month,[1,2,3,4,5,6,0])){
  const kind=dayStatus(group,date),info=completionInfo(group,date,childId),included=kind!=='excluded';
  entries[date]={date,kind,included,excluded:!included&&Object.hasOwn(state.dayOverrides,dayKey(group.id,date)),done:included&&date<=today&&info.status==='present',future:date>today,label:info.label,note:info.note,completedOn:info.completedOn,proof:info.kind};
 }
 return{today,month,groupId,motivation:motivationFor(group),completed:summary.present,total:summary.dates.length,reward:summary.bonus,streak:summary.streak,paid:summary.award?{...summary.award}:null,entries,dates:[...summary.dates],hasHomework:summary.hasHomework,lastDate:summary.dates.at(-1)||null};
}
// Combine the child's schedules for display; each group's bonus is still calculated separately.
function calendarAll(childId,month=today.slice(0,7)){
 const calendars=memberships(childId,month).map(group=>calendar(childId,group.id,month));
 if(!calendars.length)return null;
 const entries={};
 for(const date of Object.keys(calendars[0].entries)){
  const sessions=calendars.filter(c=>c.entries[date].included).map(c=>({...c.entries[date],groupId:c.groupId}));
  const completed=sessions.filter(s=>s.done).length,included=sessions.length>0,done=included&&completed===sessions.length;
  const homework=sessions.some(s=>s.kind==='homework');
  entries[date]={...calendars[0].entries[date],sessions,included,done,partial:completed>0&&!done,
   excluded:!included&&calendars.some(c=>c.entries[date].excluded),kind:included?(homework?'homework':'lesson'):'excluded',
   label:sessions.length===1?sessions[0].label:'Подтверждено '+completed+' из '+sessions.length+' занятий',
   note:sessions.length>1?(date>today?sessions.length+' зан.':completed+'/'+sessions.length):(sessions[0]?.note||'')};
 }
 const active=calendars.filter(c=>c.total>0),awards=active.map(c=>c.paid).filter(Boolean),earned=awards.reduce((sum,a)=>sum+a.amount,0);
 let streak=0;for(const day of Object.values(entries).filter(d=>d.included&&!d.future)){streak=day.done?streak+day.sessions.length:0}
 return{today,month,entries,calendars,streak,dates:Object.values(entries).filter(d=>d.included).map(d=>d.date),
  completed:active.reduce((sum,c)=>sum+c.completed,0),total:active.reduce((sum,c)=>sum+c.total,0),
  reward:active.reduce((sum,c)=>sum+(c.paid?.amount??c.reward),0),earned,hasHomework:active.some(c=>c.hasHomework),
  paid:active.length&&awards.length===active.length?{amount:earned,date:awards.map(a=>a.date).sort().at(-1)}:null};
}
refresh();
global.CulibinAttendance=Object.freeze({refresh,memberships,account,calendar,calendarAll,getToday:()=>today,storageKey:STORE,monthShift,monthTitle,dateTitle});
})(window);
