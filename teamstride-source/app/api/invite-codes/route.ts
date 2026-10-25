import {assignmentSnapshot,redistributeTasks,notifyAssignments} from '../../../lib/task-assignments';
import {z} from 'zod';
import {identity,db,load,save,admin,activeMember,failure,HttpError} from '../../../lib/server';
import {newInviteCode,normalizeInviteCode} from '../../../lib/invite-codes';
import type {Project} from '../../../lib/model';
// Six-character bearer invitations. Only creators can replace/revoke them.
export async function POST(request:Request){try{
 const user=await identity();const body=z.object({projectId:z.string().min(1).max(100),disable:z.boolean().optional()}).parse(await request.json());
 const {project,raw}=await load(body.projectId);if(!admin(project,user))throw new HttpError(403,'Only the project creator can manage invite codes.');
 project.inviteCode=body.disable?undefined:await newInviteCode();return Response.json(await save(project,raw),{headers:{'Cache-Control':'private, no-store'}});
}catch(error){if(error instanceof z.ZodError)return Response.json({error:'Choose a valid project.'},{status:400});return failure(error)}}
export async function PUT(request:Request){try{
 const user=await identity();const {code}=z.object({code:z.string().trim().min(1).max(12)}).parse(await request.json());const normalized=normalizeInviteCode(code);
 if(!/^[A-Z2-9]{6}$/.test(normalized))throw new HttpError(404,'This invite code is invalid or no longer available.');
 const rows=await db().prepare('SELECT data FROM projects ORDER BY rowid DESC').all<{data:string}>();
 const found=rows.results.map(row=>JSON.parse(row.data) as Project).find(p=>!p.deletedAt&&p.inviteCode&&normalizeInviteCode(p.inviteCode)===normalized);
 if(!found)throw new HttpError(404,'This invite code is invalid or no longer available.');
 const {project,raw}=await load(found.id);if(!project.inviteCode||normalizeInviteCode(project.inviteCode)!==normalized)throw new HttpError(404,'This invite code is invalid or no longer available.');
 if(activeMember(project,user))return Response.json(project,{headers:{'Cache-Control':'private, no-store'}});
 const beforeAssignments=assignmentSnapshot(project);
 const invited=project.members.find(m=>m.email===user.email&&(m.status==='pending'||m.status==='left'))||(project.status==='active'?project.members.find(m=>m.status==='pending'&&!m.email):undefined);
 if(invited){invited.status='active';invited.userId=user.userId;invited.email=user.email;invited.name=user.displayName.slice(0,60)}else{if(project.members.filter(member=>member.status!=='left').length>=30)throw new HttpError(400,'This project already has 30 members. Ask the project admin to review the team.');project.members.push({id:crypto.randomUUID(),name:user.displayName.slice(0,60),email:user.email,userId:user.userId,status:'active'})}
 redistributeTasks(project);notifyAssignments(project,user,beforeAssignments);
 return Response.json(await save(project,raw),{headers:{'Cache-Control':'private, no-store'}});
}catch(error){if(error instanceof z.ZodError)return Response.json({error:'Enter a valid invite code.'},{status:400});return failure(error)}}
