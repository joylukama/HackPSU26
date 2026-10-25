import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import ts from 'typescript';
import * as zod from 'zod';
const sqlite=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+file,'utf8'));
const binding={prepare(sql){let args=[];return {bind(...v){args=v;return this},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},async run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}}}};
let current=null;
let emailRequests=[],emailFails=false;
let aiRequest=null,aiReply='Let’s split the research into two short steps.';
const context=vm.createContext({console,Response,Request,crypto,Date,JSON,Array,Error,Uint8Array,AbortSignal,URL,TextEncoder,fetch:async(url,options)=>{if(url==='https://api.resend.com/emails/batch'){emailRequests.push({body:JSON.parse(options.body),key:options.headers['Idempotency-Key']});return emailFails?Response.json({error:'provider failure'},{status:503}):Response.json({data:JSON.parse(options.body).map((_,i)=>({id:'mail-'+i}))})}assert.equal(url,'https://api.openai.com/v1/responses');aiRequest=JSON.parse(options.body);return Response.json({output:[{type:'message',content:[{type:'output_text',text:aiReply}]}]})}});
const env={DB:binding,LEGACY_OWNER_EMAIL:'owner@example.com'};
const cache=new Map();
function synthetic(key,exports){const m=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v]of Object.entries(exports))this.setExport(k,v)},{context,identifier:key});cache.set(key,m);return m}
synthetic('cloudflare:workers',{env});synthetic('zod',zod);synthetic('auth',{getChatGPTUser:async()=>current});
async function moduleFor(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;const m=new vm.SourceTextModule(source,{context,identifier:file});cache.set(file,m);await m.link(async(spec,parent)=>{if(spec==='cloudflare:workers'||spec==='zod')return cache.get(spec);if(spec.includes('chatgpt-auth'))return cache.get('auth');return moduleFor(path.resolve(path.dirname(parent.identifier),spec+'.ts'))});return m}
const routes=await moduleFor('app/api/projects/route.ts');await routes.evaluate();const profiles=await moduleFor('app/api/profile/route.ts');await profiles.evaluate();const server=cache.get(path.resolve('lib/server.ts')).namespace;
const owner={userId:'owner-id',email:'owner@example.com',displayName:'Owner',fullName:'Owner'};
const member={userId:'member-id',email:'member@example.com',displayName:'Member',fullName:'Member'};
const outsider={userId:'outsider',email:'outsider@example.com',displayName:'Outsider'};
const req=data=>new Request('https://example.test/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
async function call(method,data,status=200){const r=await routes.namespace[method](data?req(data):undefined);const body=await r.json();assert.equal(r.status,status,JSON.stringify(body));return body}
await call('GET',null,401);current=owner;
const data={title:'Gene therapy presentation',brief:'Prepare a research presentation',start:'2026-10-24',end:'2026-11-18',theme:'mint',emoji:'🧬',status:'active',members:[{id:'a',name:'Owner',email:owner.email,status:'active'},{id:'b',name:'Member',email:member.email,status:'active'}],tasks:[{id:'t1',title:'Research',detail:'Collect sources',assignees:['b'],phase:0,date:'2026-10-27',done:false,comments:[]},{id:'t2',title:'Review',detail:'Team review',assignees:['a'],phase:2,date:'2026-11-15',done:false,comments:[]}]};
const project=await call('POST',data);assert.equal(project.creatorId,owner.userId);assert.equal(project.members[1].status,'pending');
current=outsider;let list=await call('GET');assert.equal(list.projects.length,0);await call('PATCH',{id:project.id,action:'settings',settings:data},403);
current=member;list=await call('GET');assert.equal(list.projects.length,0);assert.equal(list.invites.length,1);await call('PATCH',{id:project.id,action:'accept'});list=await call('GET');assert.equal(list.projects.length,1);
await call('PATCH',{id:project.id,action:'settings',settings:data},403);await call('PATCH',{id:project.id,action:'task',task:{...data.tasks[0],title:'Research updated'}});await call('PATCH',{id:project.id,action:'task',task:{...data.tasks[0],assignees:['a']}},403);await call('PATCH',{id:project.id,action:'task',task:data.tasks[1]},403);await call('PATCH',{id:project.id,action:'toggle',taskId:'t2',done:true},403);await call('PATCH',{id:project.id,action:'toggle',taskId:'t1',done:true});
const commented=await call('PATCH',{id:project.id,action:'comment',taskId:'t1',text:'Sources are ready!'});assert.equal(commented.tasks[0].comments[0].author,'Member');
current=owner;await call('PATCH',{id:project.id,action:'settings',settings:{...data,status:'completed'}},400);await call('PATCH',{id:project.id,action:'task',task:{...data.tasks[1],assignees:['a','b']}});
current=member;const automaticallyCompleted=await call('PATCH',{id:project.id,action:'toggle',taskId:'t2',done:true});assert.equal(automaticallyCompleted.status,'completed');assert.equal((await call('GET')).projects.find(p=>p.id===project.id).status,'completed');current=owner;const finished=await call('PATCH',{id:project.id,action:'settings',settings:{...data,status:'completed'}});assert.equal(finished.status,'completed');
await call('PATCH',{id:project.id,action:'invite',name:'Duplicate',email:member.email},400);
let r=await profiles.namespace.PUT(req({name:'Owner',bio:'Builder',emoji:'🌟',notes:'My private notes'}));assert.equal(r.status,200);current=member;r=await profiles.namespace.GET();assert.equal((await r.json()).notes,undefined);current=owner;r=await profiles.namespace.GET();assert.equal((await r.json()).notes,'My private notes');
const loaded=await server.load(project.id);await server.save(loaded.project,loaded.raw);await assert.rejects(server.save(loaded.project,loaded.raw),e=>e.status===409);
await call('PATCH',{id:project.id,action:'settings',settings:{...data,status:'active'}});assert.equal((await call('GET')).projects.find(p=>p.id===project.id).status,'active');await call('PATCH',{id:project.id,action:'task',task:{...data.tasks[0],date:'2027-01-01'}},400);
const legacy={id:'legacy-project',title:'Original project',brief:'Keep existing data',members:['Owner','Teammate'],start:data.start,end:data.end,tasks:[{id:'legacy-task',title:'Original task',detail:'Saved content',owner:0,phase:0,date:'2026-10-27',done:true}]};sqlite.prepare('INSERT INTO projects VALUES (?,?)').run(legacy.id,JSON.stringify(legacy));list=await call('GET');const migrated=list.projects.find(x=>x.id===legacy.id);assert.equal(migrated.creatorId,owner.userId);assert.equal(migrated.tasks[0].done,true);assert.equal(migrated.tasks[0].detail,'Saved content');
// Notes must survive stale profile edits, refreshes, and saves of an empty draft.
r=await profiles.namespace.PATCH(req({notes:'Updated notes'}));assert.equal(r.status,200);
r=await profiles.namespace.PUT(req({name:'Owner renamed',bio:'Builder',emoji:'🌟',notes:'Stale notes'}));assert.equal((await r.json()).notes,'Updated notes');
r=await profiles.namespace.PATCH(req({notes:''}));assert.equal((await r.json()).notes,'');
current=member;r=await profiles.namespace.GET();assert.equal((await r.json()).notes,undefined);
// Coach access is scoped to project membership, and follow-ups carry real history.
const coaches=await moduleFor('app/api/coach/route.ts');await coaches.evaluate();
const question={projectId:project.id,memberId:'a',messages:[{role:'user',content:'Help me research this topic'}]};
current=null;r=await coaches.namespace.POST(req(question));assert.equal(r.status,401);
current=outsider;r=await coaches.namespace.POST(req(question));assert.equal(r.status,403);
current=owner;r=await coaches.namespace.POST(req(question));assert.equal(r.status,503);
env.OPENAI_API_KEY='test-only-not-a-real-key';
r=await coaches.namespace.POST(req(question));assert.equal(r.status,200);assert.equal((await r.json()).text,aiReply);assert.equal(aiRequest.store,false);assert.equal(aiRequest.input.at(-1).content,question.messages[0].content);assert.ok(!JSON.stringify(aiRequest).includes('owner@example.com'));
aiReply='Use the first step to find two primary sources.';
const followup={...question,messages:[...question.messages,{role:'assistant',content:'Let’s split the research into two short steps.'},{role:'user',content:'Explain the first step'}]};
r=await coaches.namespace.POST(req(followup));assert.equal((await r.json()).text,aiReply);assert.equal(aiRequest.input.length,4);assert.equal(aiRequest.input.at(-1).content,'Explain the first step');
r=await coaches.namespace.POST(req({...question,memberId:'missing'}));assert.equal(r.status,404);
console.log('PASS: notes-only saving, stale-profile preservation, empty notes, coach authorization, missing API configuration, project context, and multi-turn history.');
console.log('PASS: authentication, creator roles, email invitations, acceptance, assignment permissions, shared tasks, comments, completed projects, private profiles/notes, date validation, concurrent updates, and legacy preservation.');

// Existing finished projects are collected automatically; empty plans stay active.
current=owner;
const previouslyFinished={...data,id:'previously-finished',creatorId:owner.userId,creatorEmail:owner.email,revision:1,tasks:data.tasks.map(task=>({...task,done:true}))};
sqlite.prepare('INSERT INTO projects VALUES (?,?)').run(previouslyFinished.id,JSON.stringify(previouslyFinished));
assert.equal((await call('GET')).projects.find(p=>p.id===previouslyFinished.id).status,'completed');
assert.equal(JSON.parse(sqlite.prepare('SELECT data FROM projects WHERE id=?').get(previouslyFinished.id).data).status,'completed');
const emptyPlan=await call('POST',{...data,tasks:[]});assert.equal(emptyPlan.status,'active');
// Real email requests are replaced by a provider stub in this test.
const mailRoutes=await moduleFor('app/api/invitations/route.ts');await mailRoutes.evaluate();
let mailResult=await mailRoutes.namespace.POST(req({projectId:emptyPlan.id}));assert.equal((await mailResult.json()).failed,1);assert.equal(emailRequests.length,0);
env.RESEND_API_KEY='test-only-resend-key';env.INVITE_FROM_EMAIL='Teamstride <no-reply@example.test>';env.PUBLIC_SITE_URL='https://teamstride.example.test';
const invitedProject=await call('POST',data);assert.equal(invitedProject.invitationDelivery.sent,1);assert.equal(emailRequests.length,1);
assert.deepEqual(emailRequests[0].body[0].to,[member.email]);assert.ok(emailRequests[0].body[0].text.includes('https://teamstride.example.test/?project='+invitedProject.id));assert.ok(!emailRequests[0].body[0].text.includes('localhost'));
mailResult=await mailRoutes.namespace.POST(req({projectId:invitedProject.id}));assert.equal((await mailResult.json()).sent,1);assert.equal(emailRequests[0].key,emailRequests[1].key);
current=outsider;mailResult=await mailRoutes.namespace.POST(req({projectId:invitedProject.id}));assert.equal(mailResult.status,403);assert.equal(emailRequests.length,2);
current=owner;emailFails=true;const savedDespiteEmailFailure=await call('POST',data);assert.equal(savedDespiteEmailFailure.invitationDelivery.failed,1);assert.ok((await call('GET')).projects.some(p=>p.id===savedDespiteEmailFailure.id));
emailFails=false;env.PUBLIC_SITE_URL='http://localhost:5173';const before=emailRequests.length;mailResult=await mailRoutes.namespace.POST(req({projectId:invitedProject.id}));assert.equal((await mailResult.json()).failed,1);assert.equal(emailRequests.length,before);
console.log('PASS: automatic completion on final task, persisted completed section, existing finished projects, reopening, empty plans, saved member emails, automatic invitations, public join links, authorized retries, idempotency keys, and project preservation after mail failure.');

// Collaboration changes are authorized and saved atomically with the project.
current=owner;delete env.RESEND_API_KEY;
const teamwork=await call('POST',{...data,title:'Cell organelles lesson',brief:'Teach younger kids about cell organelles using diagrams and a quiz.',tasks:[
{...data.tasks[0],id:'collab-owner',assignees:['a'],done:false},
{...data.tasks[1],id:'collab-member',assignees:['b'],done:false},
{...data.tasks[1],id:'collab-extra',assignees:['a'],done:false},
]});
current=member;await call('PATCH',{id:teamwork.id,action:'accept'});
current=owner;let collaboration=await call('PATCH',{id:teamwork.id,action:'help',taskId:'collab-owner',resolve:false,message:'I need a source for the diagram.'});assert.equal(collaboration.tasks[0].help.message,'I need a source for the diagram.');
current=member;await call('PATCH',{id:teamwork.id,action:'help',taskId:'collab-owner',resolve:true},403);
const notificationRoute=await moduleFor('app/api/notifications/route.ts');await notificationRoute.evaluate();
r=await notificationRoute.namespace.GET();let notifications=(await r.json()).items;assert.ok(notifications.some(item=>item.projectId===teamwork.id&&item.kind==='help'));
current=owner;collaboration=await call('PATCH',{id:teamwork.id,action:'swap_request',fromTaskId:'collab-owner',toTaskId:'collab-member'});let swap=collaboration.swaps[0];assert.equal(collaboration.tasks[0].assignees[0],'a');
await call('PATCH',{id:teamwork.id,action:'swap_respond',swapId:swap.id,decision:'accept'},403);
current=member;collaboration=await call('PATCH',{id:teamwork.id,action:'swap_respond',swapId:swap.id,decision:'accept'});assert.equal(collaboration.tasks[0].assignees[0],'b');assert.equal(collaboration.tasks[1].assignees[0],'a');assert.equal(collaboration.swaps[0].status,'accepted');
await call('PATCH',{id:teamwork.id,action:'toggle',taskId:'collab-member',done:true},403);
collaboration=await call('PATCH',{id:teamwork.id,action:'toggle',taskId:'collab-owner',done:true});assert.equal(collaboration.tasks[0].help,undefined);
current=owner;r=await notificationRoute.namespace.GET();notifications=(await r.json()).items;const completion=notifications.find(item=>item.projectId===teamwork.id&&item.kind==='completed');assert.ok(completion);assert.equal(completion.read,false);
r=await notificationRoute.namespace.PATCH(req({ids:[completion.id]}));assert.equal(r.status,200);
r=await profiles.namespace.PATCH(req({notes:'Keep my notes while marking notifications'}));assert.equal(r.status,200);
r=await profiles.namespace.PUT(req({name:'Owner',bio:'Builder',emoji:'🌟'}));assert.equal((await r.json()).notes,'Keep my notes while marking notifications');
r=await notificationRoute.namespace.GET();assert.equal((await r.json()).items.find(item=>item.id===completion.id).read,true);
current=outsider;r=await notificationRoute.namespace.GET();assert.ok(!(await r.json()).items.some(item=>item.projectId===teamwork.id));
current=member;collaboration=await call('PATCH',{id:teamwork.id,action:'swap_request',fromTaskId:'collab-member',toTaskId:'collab-extra'},403);
current=owner;collaboration=await call('PATCH',{id:teamwork.id,action:'swap_request',fromTaskId:'collab-member',toTaskId:'collab-owner'},400);
const models=cache.get(path.resolve('lib/model.ts')).namespace;
const presentationPlan=models.createPlan('Cell organelles lesson','Teach younger kids with cell diagrams and a quiz.',teamwork.members,data.start,data.end);
const softwarePlan=models.createPlan('Campus rides app','Build an app for ride requests and driver matching.',teamwork.members,data.start,data.end);
assert.equal(presentationPlan.length,10);assert.ok(presentationPlan.some(task=>task.title.includes('slide')));assert.ok(softwarePlan.some(task=>task.title.includes('user journey')));assert.ok(presentationPlan.every(task=>task.detail.includes('cell diagrams')&&task.date>=data.start&&task.date<=data.end));
assert.ok(!presentationPlan.some(task=>softwarePlan.some(other=>other.title===task.title)));
const generated=await call('POST',{...data,title:'Cell organelles lesson',brief:'Teach younger kids about cell organelles.',generatePlan:true,tasks:undefined});assert.ok(generated.tasks.some(task=>task.title.includes('slide')));
const schedule=models.projectSchedule({...teamwork,tasks:[{...teamwork.tasks[0],date:'2026-10-20'},{...teamwork.tasks[1],date:'2026-10-24'}],end:'2026-10-25'},'2026-10-24');assert.equal(schedule.shift,4);assert.equal(schedule.forecasts['collab-member'],'2026-10-28');assert.equal(schedule.beyondDeadline,true);assert.equal(teamwork.tasks[0].date,'2026-10-27');
console.log('PASS: help permissions, accepted two-party swaps, post-swap ownership, completion notifications, private read markers, notes/profile preservation, project-specific plan generation, and adaptive risk forecasts without overwriting original dates.');

// Files remain private to the joined team and survive reversible project deletion.
const fileObjects=new Map();let bucketReads=0,bucketPuts=0;
env.BUCKET={async put(key,value){bucketPuts++;fileObjects.set(key,new Uint8Array(value));return {}},async get(key){bucketReads++;const value=fileObjects.get(key);return value?{body:value}:null},async delete(key){fileObjects.delete(key)}};
const materialsRoute=await moduleFor('app/api/materials/route.ts');await materialsRoute.evaluate();
const materialReq=(projectId,file,taskId='')=>{const form=new FormData();form.set('projectId',projectId);form.set('taskId',taskId);form.set('file',file);return new Request('https://example.test/api/materials',{method:'POST',body:form})};
const materialGet=(projectId,fileId='')=>new Request(`https://example.test/api/materials?projectId=${projectId}${fileId?'&fileId='+fileId:''}`);
current=owner;const fileProject=await call('POST',{...data,title:'Shared materials project'});
assert.ok(fileProject.tasks.every(task=>Number.isInteger(task.estimatedMinutes)&&task.estimatedMinutes>0));
current=member;r=await materialsRoute.namespace.POST(materialReq(fileProject.id,new File(['private brief'],'brief.txt')));assert.equal(r.status,403);assert.equal(bucketPuts,0);
current=owner;r=await materialsRoute.namespace.POST(materialReq(fileProject.id,new File(['private brief'],'brief.txt',{type:'text/plain'})));assert.equal(r.status,200);const firstMaterial=(await r.json()).material;assert.equal(firstMaterial.taskId,undefined);
current=outsider;r=await materialsRoute.namespace.GET(materialGet(fileProject.id,firstMaterial.id));assert.equal(r.status,403);assert.equal(bucketReads,0);
current=member;r=await materialsRoute.namespace.GET(materialGet(fileProject.id,firstMaterial.id));assert.equal(r.status,403);await call('PATCH',{id:fileProject.id,action:'accept'});
r=await materialsRoute.namespace.GET(materialGet(fileProject.id,firstMaterial.id));assert.equal(r.status,200);assert.equal(await r.text(),'private brief');assert.ok(r.headers.get('content-disposition').startsWith('attachment;'));assert.equal(r.headers.get('x-content-type-options'),'nosniff');
r=await materialsRoute.namespace.POST(materialReq(fileProject.id,new File(['task reference'],'reference.md'),'t1'));assert.equal(r.status,200);const secondMaterial=(await r.json()).material;assert.equal(secondMaterial.taskId,'t1');
current=owner;r=await materialsRoute.namespace.PATCH(req({projectId:fileProject.id,fileId:secondMaterial.id,taskId:'t2'}));assert.equal(r.status,200);
current=member;r=await materialsRoute.namespace.PATCH(req({projectId:fileProject.id,fileId:firstMaterial.id,taskId:'t1'}));assert.equal(r.status,403);
current=owner;const putCount=bucketPuts;r=await materialsRoute.namespace.POST(materialReq(fileProject.id,new File(['x'],'bad.txt'),'not-a-task'));assert.equal(r.status,400);assert.equal(bucketPuts,putCount);
r=await materialsRoute.namespace.POST(materialReq(fileProject.id,new File([''],'empty.txt')));assert.equal(r.status,413);
// Failure to save metadata cleans up only the newly uploaded object.
const originalRun=binding.prepare;const objectCount=fileObjects.size;
binding.prepare=(sql)=>{const prepared=originalRun(sql);if(sql.startsWith('UPDATE projects SET data='))prepared.run=async()=>({meta:{changes:0}});return prepared};
r=await materialsRoute.namespace.POST(materialReq(fileProject.id,new File(['conflict'],'conflict.txt')));assert.equal(r.status,409);assert.equal(fileObjects.size,objectCount);binding.prepare=originalRun;
const deleteReq=id=>new Request('https://example.test/api/projects?id='+id,{method:'DELETE'});
current=member;r=await routes.namespace.DELETE(deleteReq(fileProject.id));assert.equal(r.status,403);
current=owner;r=await routes.namespace.DELETE(deleteReq(fileProject.id));assert.equal(r.status,200);
list=await call('GET');assert.ok(!list.projects.some(p=>p.id===fileProject.id));assert.ok(list.trash.some(p=>p.id===fileProject.id));
r=await materialsRoute.namespace.GET(materialGet(fileProject.id,firstMaterial.id));assert.equal(r.status,404);await call('PATCH',{id:fileProject.id,action:'toggle',taskId:'t1',done:true},404);
current=member;list=await call('GET');assert.ok(!list.projects.some(p=>p.id===fileProject.id));assert.ok(!list.trash.some(p=>p.id===fileProject.id));await call('PATCH',{id:fileProject.id,action:'restore'},403);
current=owner;const restored=await call('PATCH',{id:fileProject.id,action:'restore'});assert.equal(restored.materials.length,2);assert.equal(restored.tasks.length,2);
current=member;r=await materialsRoute.namespace.GET(materialGet(fileProject.id,firstMaterial.id));assert.equal(await r.text(),'private brief');
current=owner;let edited=await call('PATCH',{id:fileProject.id,action:'task',task:{...restored.tasks[0],estimatedMinutes:150}});assert.equal(edited.tasks[0].estimatedMinutes,150);
const withoutEstimate={...edited.tasks[0]};delete withoutEstimate.estimatedMinutes;edited=await call('PATCH',{id:fileProject.id,action:'task',task:withoutEstimate});assert.equal(edited.tasks[0].estimatedMinutes,150);
await call('PATCH',{id:fileProject.id,action:'task',task:{...edited.tasks[0],estimatedMinutes:0}},400);
console.log('PASS: task estimates on creation and editing, joined-team file sharing, general/task attachments, safe downloads, upload validation, conflict cleanup, creator-only deletion and restoration, and retained materials after restore.');

// Team meetings target invitation notifications and authorize responses.
current=owner;const calendarTeam=await call('POST',{...data,title:'Calendar and chat team'});
current=member;await call('PATCH',{id:calendarTeam.id,action:'accept'});
const meetingsRoute=await moduleFor('app/api/meetings/route.ts');await meetingsRoute.evaluate();
const meetingDraft={projectId:calendarTeam.id,title:'Project check-in',startAt:'2030-10-25T14:00:00.000Z',endAt:'2030-10-25T15:00:00.000Z',timeZone:'America/New_York',inviteeIds:['a','b'],location:'Team room',joinUrl:'https://example.test/meeting',notes:'Discuss next steps.'};
current=outsider;r=await meetingsRoute.namespace.POST(req(meetingDraft));assert.equal(r.status,403);
current=owner;r=await meetingsRoute.namespace.POST(req({...meetingDraft,inviteeIds:['not-a-member']}));assert.equal(r.status,400);
r=await meetingsRoute.namespace.POST(req(meetingDraft));assert.equal(r.status,200);const meeting=(await r.json()).meeting;assert.equal(meeting.responses.a,'accepted');assert.equal(meeting.responses.b,'pending');
current=member;r=await notificationRoute.namespace.GET();assert.ok((await r.json()).items.some(item=>item.meetingId===meeting.id&&item.kind==='meeting'));
r=await meetingsRoute.namespace.PATCH(req({projectId:calendarTeam.id,meetingId:meeting.id,action:'accept'}));assert.equal(r.status,200);assert.equal((await r.json()).meeting.responses.b,'accepted');
r=await meetingsRoute.namespace.PATCH(req({projectId:calendarTeam.id,meetingId:meeting.id,action:'cancel'}));assert.equal(r.status,403);
current=owner;r=await meetingsRoute.namespace.PATCH(req({projectId:calendarTeam.id,meetingId:meeting.id,action:'cancel'}));assert.equal(r.status,200);assert.equal((await r.json()).meeting.status,'cancelled');
// Personal reminders are private and follow deadline changes rather than fixed dates.
const remindersRoute=await moduleFor('app/api/reminders/route.ts');await remindersRoute.evaluate();
const reminderValue={projectId:calendarTeam.id,taskId:'t1',daysBefore:365,time:'00:00',timeZone:'America/New_York'};
current=outsider;r=await remindersRoute.namespace.PUT(req(reminderValue));assert.equal(r.status,403);
current=owner;r=await remindersRoute.namespace.PUT(req(reminderValue));assert.equal(r.status,200);
r=await notificationRoute.namespace.GET();let personalReminder=(await r.json()).items.find(item=>item.projectId===calendarTeam.id&&item.kind==='reminder');assert.ok(personalReminder);
current=member;r=await remindersRoute.namespace.GET();assert.ok(!(await r.json()).reminders.some(item=>item.projectId===calendarTeam.id));r=await notificationRoute.namespace.GET();assert.ok(!(await r.json()).items.some(item=>item.projectId===calendarTeam.id&&item.kind==='reminder'));
current=owner;r=await profiles.namespace.PATCH(req({notes:'Notes must survive reminder saves'}));assert.equal(r.status,200);r=await profiles.namespace.PUT(req({name:'Owner',bio:'Builder',emoji:'🌟'}));assert.equal(r.status,200);r=await remindersRoute.namespace.GET();assert.ok((await r.json()).reminders.some(item=>item.projectId===calendarTeam.id));
const twoDays={...reminderValue,daysBefore:2,time:'09:00'};
assert.equal(models.reminderIsDue(data.tasks[0],twoDays,new Date('2026-10-25T12:59:00Z')),false);assert.equal(models.reminderIsDue(data.tasks[0],twoDays,new Date('2026-10-25T13:00:00Z')),true);assert.equal(models.reminderIsDue({...data.tasks[0],date:'2026-10-29'},twoDays,new Date('2026-10-25T13:00:00Z')),false);
await call('PATCH',{id:calendarTeam.id,action:'toggle',taskId:'t1',done:true});r=await notificationRoute.namespace.GET();assert.ok(!(await r.json()).items.some(item=>item.projectId===calendarTeam.id&&item.kind==='reminder'));
current=member;r=await notificationRoute.namespace.GET();assert.ok((await r.json()).items.some(item=>item.projectId===calendarTeam.id&&item.kind==='completed'));
current=owner;r=await remindersRoute.namespace.DELETE(req(reminderValue));assert.equal(r.status,200);
// The shared chat saves real team history without an API call or assistant impersonation.
const chatRoute=await moduleFor('app/api/project-chat/route.ts');await chatRoute.evaluate();
const chatGet=before=>new Request('https://example.test/api/project-chat?projectId='+calendarTeam.id+(before?'&before='+before:''));
current=outsider;r=await chatRoute.namespace.GET(chatGet());assert.equal(r.status,403);
current=owner;const chatDraft={projectId:calendarTeam.id,id:crypto.randomUUID(),text:'How should we approach this project?',role:'assistant'};const previousAI=aiRequest;
r=await chatRoute.namespace.POST(req(chatDraft));assert.equal(r.status,200);const chatResponse=await r.json();assert.equal(chatResponse.message.role,'user');assert.equal(chatResponse.ai.status,'not_configured');assert.equal(aiRequest,previousAI);
r=await chatRoute.namespace.POST(req(chatDraft));assert.equal(r.status,200);assert.equal(sqlite.prepare('SELECT COUNT(*) AS n FROM project_messages WHERE id=?').get(chatDraft.id).n,1);
current=member;r=await chatRoute.namespace.GET(chatGet());let sharedMessages=(await r.json()).messages;assert.equal(sharedMessages[0].body,chatDraft.text);assert.equal(sharedMessages[0].authorName,owner.displayName);
r=await chatRoute.namespace.POST(req({projectId:calendarTeam.id,id:crypto.randomUUID(),text:'I can research the first topic.'}));assert.equal(r.status,200);
current=owner;r=await chatRoute.namespace.GET(chatGet());assert.equal((await r.json()).messages.length,2);
for(let i=0;i<52;i++)sqlite.prepare('INSERT INTO project_messages(id,project_id,author_user_id,author_name,role,body,created_at) VALUES (?,?,?,?,?,?,?)').run(crypto.randomUUID(),calendarTeam.id,owner.userId,'Owner','user','History '+i,new Date().toISOString());
r=await chatRoute.namespace.GET(chatGet());const latestPage=await r.json();assert.equal(latestPage.messages.length,50);assert.ok(latestPage.nextBefore);r=await chatRoute.namespace.GET(chatGet(latestPage.nextBefore));assert.equal((await r.json()).messages.length,4);
r=await routes.namespace.DELETE(deleteReq(calendarTeam.id));assert.equal(r.status,200);r=await chatRoute.namespace.GET(chatGet());assert.equal(r.status,404);await call('PATCH',{id:calendarTeam.id,action:'restore'});r=await chatRoute.namespace.GET(chatGet());assert.equal((await r.json()).messages.length,50);
console.log('PASS: meeting creation/invitations/RSVP/cancellation, targeted meeting notifications, private deadline-relative reminders, completion notifications for other teammates, shared chat authorization/history/pagination/idempotency, and chat retention after delete/restore without any AI provider.');

// Project codes add a join path without changing email/link invitations.
const codeRoute=await moduleFor('app/api/invite-codes/route.ts');await codeRoute.evaluate();
current=owner;const coded=await call('POST',{...data,title:'Code invitations'});assert.match(coded.inviteCode,/^[A-HJ-NP-Z2-9]{6}$/);
current=null;r=await codeRoute.namespace.PUT(req({code:coded.inviteCode}));assert.equal(r.status,401);
current=outsider;r=await codeRoute.namespace.PUT(req({code:'ZZZZZZ'}));assert.equal(r.status,404);
r=await codeRoute.namespace.POST(req({projectId:coded.id}));assert.equal(r.status,403);
r=await codeRoute.namespace.PUT(req({code:coded.inviteCode.toLowerCase().replaceAll('-',' ')}));assert.equal(r.status,200);let joined=await r.json();assert.equal(joined.members.find(m=>m.userId===outsider.userId).status,'active');assert.equal(joined.tasks.length,coded.tasks.length);
r=await codeRoute.namespace.PUT(req({code:coded.inviteCode}));assert.equal((await r.json()).members.length,3);
current=member;r=await codeRoute.namespace.PUT(req({code:coded.inviteCode}));assert.equal(r.status,200);joined=await r.json();assert.equal(joined.members.length,3);assert.equal(joined.members.find(m=>m.userId===member.userId).id,'b');
current=owner;r=await codeRoute.namespace.POST(req({projectId:coded.id}));assert.equal(r.status,200);const rotated=await r.json();assert.notEqual(rotated.inviteCode,coded.inviteCode);
current=outsider;r=await codeRoute.namespace.PUT(req({code:coded.inviteCode}));assert.equal(r.status,404);
current=owner;r=await codeRoute.namespace.POST(req({projectId:coded.id,disable:true}));assert.equal(r.status,200);
current=outsider;r=await codeRoute.namespace.PUT(req({code:rotated.inviteCode}));assert.equal(r.status,404);
current=owner;await call('PATCH',{id:coded.id,action:'invite',name:'Link invite',email:'link@example.com'});current={userId:'link-user',email:'link@example.com',displayName:'Link member'};await call('PATCH',{id:coded.id,action:'accept'});
current=owner;r=await codeRoute.namespace.POST(req({projectId:coded.id}));const deleteCode=(await r.json()).inviteCode;await routes.namespace.DELETE(deleteReq(coded.id));current=outsider;r=await codeRoute.namespace.PUT(req({code:deleteCode}));assert.equal(r.status,404);
// Mentions notify only named members, exclude the author, and persist read state.
current=owner;const taggedId=crypto.randomUUID();r=await chatRoute.namespace.POST(req({projectId:calendarTeam.id,id:taggedId,text:'@Member, please review. @AI what should we do next?'}));assert.equal(r.status,200);const tagged=await r.json();assert.equal(tagged.aiRequested,true);assert.ok(tagged.mentionedMemberIds.includes('b'));assert.equal(tagged.ai.status,'not_configured');assert.equal(aiRequest,previousAI);
current=member;r=await notificationRoute.namespace.GET();const mentionNotification=(await r.json()).items.find(item=>item.id===`mention:${calendarTeam.id}:${taggedId}`);assert.ok(mentionNotification);assert.equal(mentionNotification.kind,'mention');
r=await notificationRoute.namespace.PATCH(req({ids:[mentionNotification.id]}));assert.equal(r.status,200);r=await notificationRoute.namespace.GET();assert.equal((await r.json()).items.find(item=>item.id===mentionNotification.id).read,true);
current=owner;r=await notificationRoute.namespace.GET();assert.ok(!(await r.json()).items.some(item=>item.id===mentionNotification.id));
const mentions=cache.get(path.resolve('lib/chat-mentions.ts')).namespace;const mentionProject={...calendarTeam,members:[{id:'space',name:'Jane Doe'},{id:'regex',name:'A+B'}]};assert.ok(mentions.chatMentions('Hi @Jane Doe, thanks',mentionProject).memberIds.includes('space'));assert.ok(mentions.chatMentions('@A+B!',mentionProject).memberIds.includes('regex'));assert.equal(mentions.chatMentions('hello@example.com @MemberElse',calendarTeam).memberIds.length,0);assert.equal(mentions.chatMentions('email@AI.com',calendarTeam).ai,false);
// Completion notifications: other members receive them; author does not; retry is idempotent.
current=owner;const completionProject=await call('POST',{...data,title:'Completion delivery check'});current=member;await call('PATCH',{id:completionProject.id,action:'accept'});await call('PATCH',{id:completionProject.id,action:'toggle',taskId:'t1',done:true});await call('PATCH',{id:completionProject.id,action:'toggle',taskId:'t1',done:true});r=await notificationRoute.namespace.GET();assert.equal((await r.json()).items.filter(item=>item.projectId===completionProject.id&&item.kind==='completed').length,0);
current=owner;r=await notificationRoute.namespace.GET();let completions=(await r.json()).items.filter(item=>item.projectId===completionProject.id&&item.kind==='completed');assert.equal(completions.length,1);r=await notificationRoute.namespace.PATCH(req({ids:[completions[0].id]}));assert.equal(r.status,200);r=await notificationRoute.namespace.GET();assert.equal((await r.json()).items.find(item=>item.id===completions[0].id).read,true);
await call('PATCH',{id:completionProject.id,action:'task',task:{...data.tasks[1],done:true}});current=member;r=await notificationRoute.namespace.GET();assert.ok((await r.json()).items.some(item=>item.projectId===completionProject.id&&item.taskId==='t2'&&item.kind==='completed'));assert.equal((await call('GET')).projects.find(p=>p.id===completionProject.id).status,'completed');
console.log('PASS: code join/authentication/rotation/revocation/deleted projects/duplicate membership/email-link preservation, member and AI tags, targeted mention notifications/read markers, and task completion delivery by toggle and edit including final-project completion.');

// Existing long codes shorten without losing project records or task data.
current=owner;const oldCodeProject=await call('POST',{...data,title:'Legacy long invite'});const oldCodeData=JSON.parse(sqlite.prepare('SELECT data FROM projects WHERE id=?').get(oldCodeProject.id).data);oldCodeData.inviteCode='1234-5678-ABCD-EF01-2345-6789';sqlite.prepare('UPDATE projects SET data=? WHERE id=?').run(JSON.stringify(oldCodeData),oldCodeProject.id);const shortened=(await call('GET')).projects.find(p=>p.id===oldCodeProject.id);assert.equal(shortened.inviteCode.length,6);assert.equal(shortened.tasks.length,oldCodeProject.tasks.length);assert.equal(shortened.members.length,oldCodeProject.members.length);current=outsider;r=await codeRoute.namespace.PUT(req({code:shortened.inviteCode}));assert.equal(r.status,200);
console.log('PASS: six-character codes and safe shortening of existing long codes.');

// Adding a teammate balances unfinished solo tasks, retaining all other task data.
current=owner;const balancing=await call('POST',{...data,title:'Balanced workload',members:[data.members[0]],tasks:Array.from({length:7},(_,i)=>({...data.tasks[0],id:'balance-'+i,title:'Work '+i,assignees:['a'],done:i===6,estimatedMinutes:30+i*15,comments:[]})).concat([{...data.tasks[1],id:'balance-shared',assignees:['a'],done:false}])});
const beforeBalance=(await server.load(balancing.id)).project;const unchanged=JSON.stringify(beforeBalance.tasks.find(t=>t.done));
let redistributed=await call('PATCH',{id:balancing.id,action:'invite',name:member.displayName,email:member.email});const invitedId=redistributed.members.find(m=>m.email===member.email).id;assert.equal(redistributed.tasks.filter(t=>!t.done&&t.assignees.includes(invitedId)).length,3);assert.equal(JSON.stringify(redistributed.tasks.find(t=>t.done)),unchanged);assert.equal(redistributed.tasks.length,beforeBalance.tasks.length);
current=member;redistributed=await call('PATCH',{id:balancing.id,action:'accept'});r=await notificationRoute.namespace.GET();let assignedNotices=(await r.json()).items.filter(item=>item.projectId===balancing.id&&item.kind==='assignment');assert.equal(assignedNotices.length,3);assert.ok(assignedNotices.every(item=>redistributed.tasks.find(t=>t.id===item.taskId).assignees.includes(invitedId)));
const stableAssignees=JSON.stringify(redistributed.tasks.map(t=>t.assignees));r=await codeRoute.namespace.PUT(req({code:redistributed.inviteCode}));assert.equal(JSON.stringify((await r.json()).tasks.map(t=>t.assignees)),stableAssignees);
current=outsider;r=await codeRoute.namespace.PUT(req({code:redistributed.inviteCode}));assert.equal(r.status,200);redistributed=await r.json();const counts=redistributed.members.map(m=>redistributed.tasks.filter(t=>!t.done&&t.assignees.length===1&&t.assignees[0]===m.id).length);assert.ok(Math.max(...counts)-Math.min(...counts)<=1);r=await notificationRoute.namespace.GET();assert.ok((await r.json()).items.some(item=>item.projectId===balancing.id&&item.kind==='assignment'));assert.equal(JSON.stringify(redistributed.tasks.find(t=>t.done)),unchanged);
// Manual assignments notify only newly assigned people, including new task creation.
current=owner;const manual=redistributed.tasks.find(t=>!t.done&&t.assignees[0]!==invitedId);await call('PATCH',{id:balancing.id,action:'task',task:{...manual,assignees:[invitedId]}});current=member;r=await notificationRoute.namespace.GET();assert.ok((await r.json()).items.some(item=>item.projectId===balancing.id&&item.taskId===manual.id&&item.kind==='assignment'));
current=owner;const sharedPreserve=await call('PATCH',{id:balancing.id,action:'task',task:{...manual,id:'shared-preserve',assignees:['a',invitedId],comments:[]}});const sharedBefore=JSON.stringify(sharedPreserve.tasks.find(t=>t.id==='shared-preserve'));await call('PATCH',{id:balancing.id,action:'invite',name:'Fourth',email:'fourth@example.com'});assert.equal(JSON.stringify((await server.load(balancing.id)).project.tasks.find(t=>t.id==='shared-preserve')),sharedBefore);
// Per-project AI permission is enforced server-side and never disables human chat.
current=owner;const noAI=await call('POST',{...data,title:'Human-only team',aiEnabled:false});assert.equal(noAI.aiEnabled,false);current=member;await call('PATCH',{id:noAI.id,action:'accept'});await call('PATCH',{id:noAI.id,action:'settings',settings:{...data,aiEnabled:true}},403);
r=await coaches.namespace.POST(req({...question,projectId:noAI.id}));assert.equal(r.status,403);
r=await chatRoute.namespace.POST(req({projectId:noAI.id,id:crypto.randomUUID(),text:'@AI please help'}));assert.equal(r.status,403);
r=await chatRoute.namespace.POST(req({projectId:noAI.id,id:crypto.randomUUID(),text:'@Owner we can discuss this as a team.'}));assert.equal(r.status,200);
current=owner;const enabled=await call('PATCH',{id:noAI.id,action:'settings',settings:{...data,aiEnabled:true}});assert.equal(enabled.aiEnabled,true);r=await chatRoute.namespace.POST(req({projectId:noAI.id,id:crypto.randomUUID(),text:'@AI please help'}));assert.equal(r.status,200);assert.equal((await r.json()).aiRequested,true);
await call('PATCH',{id:noAI.id,action:'settings',settings:{...data,aiEnabled:false}});const stillDisabled=await call('PATCH',{id:noAI.id,action:'settings',settings:{...data,title:'Still human only'}});assert.equal(stillDisabled.aiEnabled,false);assert.equal((await server.load(project.id)).project.aiEnabled,true);
console.log('PASS: balanced new-member workloads by invite/code, idempotent joins, assignment delivery including the joining actor, retained completed/shared work, manual assignment alerts, and admin-only AI permission with human chat preserved.');
