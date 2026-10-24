import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import type {Project} from './model';
export async function identity(){const u=await getChatGPTUser();if(!u)throw new HttpError(401,'Sign in with ChatGPT to open your workspace.');return {...u,email:u.email.toLowerCase()}}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export const db=()=>{if(!env.DB)throw new HttpError(503,'Workspace storage is unavailable.');return env.DB};
export const activeMember=(p:Project,u:{userId:string,email:string})=>p.creatorId===u.userId||p.members.some(m=>m.status==='active'&&(m.userId===u.userId||m.email===u.email));
export const admin=(p:Project,u:{userId:string})=>p.creatorId===u.userId;
export function failure(e:unknown){return Response.json({error:e instanceof HttpError?e.message:'Something went wrong. Please try again.'},{status:e instanceof HttpError?e.status:500})}
export async function load(id:string){const r=await db().prepare('SELECT data FROM projects WHERE id=?').bind(id).first<{data:string}>();if(!r)throw new HttpError(404,'Project not found.');return {raw:r.data,project:JSON.parse(r.data) as Project}}
export async function save(p:Project,raw:string){p.revision=(p.revision||0)+1;const result=await db().prepare('UPDATE projects SET data=? WHERE id=? AND data=?').bind(JSON.stringify(p),p.id,raw).run();if(!result.meta.changes)throw new HttpError(409,'A teammate just updated this project. Refresh and try again.');return p}
