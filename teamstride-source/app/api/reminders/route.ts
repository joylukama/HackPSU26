import {z} from 'zod';
import {identity,db,load,activeMember,failure,HttpError} from '../../../lib/server';
import type {TaskReminder} from '../../../lib/model';
const bodySchema=z.object({projectId:z.string().min(1).max(100),taskId:z.string().min(1).max(100),daysBefore:z.number().int().min(0).max(365),time:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),timeZone:z.string().max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false}},'Choose a valid time zone.')});
export async function GET(){try{const user=await identity();const row=await db().prepare('SELECT data FROM profiles WHERE id=?').bind(user.userId).first<{data:string}>();return Response.json({reminders:row?JSON.parse(row.data).taskReminders||[]:[]},{headers:{'Cache-Control':'private, no-store'}})}catch(error){return failure(error)}}
async function change(request:Request,remove:boolean){
 try{
  const user=await identity();const input=await request.json();const value=remove?z.object({projectId:z.string().min(1).max(100),taskId:z.string().min(1).max(100)}).parse(input):bodySchema.parse(input);
  if(!remove){const {project}=await load(value.projectId);if(!activeMember(project,user))throw new HttpError(403,'Join this project to set a reminder.');const task=project.tasks.find(task=>task.id===value.taskId);if(!task||task.done||project.status==='completed')throw new HttpError(400,'Choose an unfinished task in an active project.')}
  for(let attempt=0;attempt<3;attempt++){
   const row=await db().prepare('SELECT data FROM profiles WHERE id=?').bind(user.userId).first<{data:string}>();
   const profile=row?JSON.parse(row.data):{name:user.fullName||'Teammate',bio:'Making big ideas happen, one small win at a time.',emoji:'🌟'};
   const reminders:TaskReminder[]=(profile.taskReminders||[]).filter((item:TaskReminder)=>item.projectId!==value.projectId||item.taskId!==value.taskId);
   if(!remove){if(reminders.length>=300)throw new HttpError(400,'You have reached the 300-reminder limit.');reminders.push(value as TaskReminder)}profile.taskReminders=reminders;
   const result=row?await db().prepare('UPDATE profiles SET data=? WHERE id=? AND data=?').bind(JSON.stringify(profile),user.userId,row.data).run():await db().prepare('INSERT OR IGNORE INTO profiles(id,data) VALUES (?,?)').bind(user.userId,JSON.stringify(profile)).run();
   if(result.meta.changes)return Response.json({reminders});
  }
  throw new HttpError(409,'Your account changed while saving. Please try again.');
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message||'Check your reminder.'},{status:400});return failure(error)}
}
export const PUT=(request:Request)=>change(request,false);
export const DELETE=(request:Request)=>change(request,true);
