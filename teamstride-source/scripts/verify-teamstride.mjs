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
const context=vm.createContext({console,Response,Request,crypto,Date,JSON,Array,Error,Uint8Array});
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
current=member;await call('PATCH',{id:project.id,action:'toggle',taskId:'t2',done:true});current=owner;const finished=await call('PATCH',{id:project.id,action:'settings',settings:{...data,status:'completed'}});assert.equal(finished.status,'completed');
await call('PATCH',{id:project.id,action:'invite',name:'Duplicate',email:member.email},400);
let r=await profiles.namespace.PUT(req({name:'Owner',bio:'Builder',emoji:'🌟',notes:'My private notes'}));assert.equal(r.status,200);current=member;r=await profiles.namespace.GET();assert.equal((await r.json()).notes,undefined);current=owner;r=await profiles.namespace.GET();assert.equal((await r.json()).notes,'My private notes');
const loaded=await server.load(project.id);await server.save(loaded.project,loaded.raw);await assert.rejects(server.save(loaded.project,loaded.raw),e=>e.status===409);
await call('PATCH',{id:project.id,action:'settings',settings:{...data,status:'active'}});await call('PATCH',{id:project.id,action:'task',task:{...data.tasks[0],date:'2027-01-01'}},400);
const legacy={id:'legacy-project',title:'Original project',brief:'Keep existing data',members:['Owner','Teammate'],start:data.start,end:data.end,tasks:[{id:'legacy-task',title:'Original task',detail:'Saved content',owner:0,phase:0,date:'2026-10-27',done:true}]};sqlite.prepare('INSERT INTO projects VALUES (?,?)').run(legacy.id,JSON.stringify(legacy));list=await call('GET');const migrated=list.projects.find(x=>x.id===legacy.id);assert.equal(migrated.creatorId,owner.userId);assert.equal(migrated.tasks[0].done,true);assert.equal(migrated.tasks[0].detail,'Saved content');
console.log('PASS: authentication, creator roles, email invitations, acceptance, assignment permissions, shared tasks, comments, completed projects, private profiles/notes, date validation, concurrent updates, and legacy preservation.');
