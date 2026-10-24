import {z} from 'zod';
import {identity,db,activeMember,failure,HttpError} from '../../../lib/server';
import {projectSchedule,dayKey,type Project} from '../../../lib/model';

export async function GET(){
  try{
    const user=await identity();
    const rows=await db().prepare('SELECT data FROM projects ORDER BY rowid DESC').all<{data:string}>();
    const profile=await db().prepare('SELECT data FROM profiles WHERE id=?').bind(user.userId).first<{data:string}>();
    const read=new Set<string>(profile?JSON.parse(profile.data).notificationReads||[]:[]);
    const items: {id:string;projectId:string;projectTitle:string;taskId?:string;text:string;kind:string;at:string;read:boolean}[]=[];
    for(const row of rows.results){
      const project=JSON.parse(row.data) as Project;
      if(project.deletedAt||!project.creatorId||!activeMember(project,user))continue;
      for(const event of project.activities||[]){
        if(event.actorUserId===user.userId)continue;
        const id=`event:${project.id}:${event.id}`;
        items.push({id,projectId:project.id,projectTitle:project.title,taskId:event.taskId,text:event.text,kind:event.kind,at:event.at,read:read.has(id)});
      }
      const schedule=projectSchedule(project);
      for(const task of schedule.overdue){
        const id=`overdue:${project.id}:${task.id}:${task.date}`;
        items.push({id,projectId:project.id,projectTitle:project.title,taskId:task.id,text:`“${task.title}” missed its ${task.date} deadline. The timeline now forecasts ${schedule.forecasts[task.id]}.`,kind:'risk',at:task.date+'T23:59:59Z',read:read.has(id)});
      }
      if(schedule.beyondDeadline){
        const id=`risk:${project.id}:${dayKey()}:${schedule.projectedEnd}`;
        items.push({id,projectId:project.id,projectTitle:project.title,text:`Project at risk: the current forecast finishes ${schedule.projectedEnd}, after the ${project.end} deadline.`,kind:'risk',at:dayKey()+'T12:00:00Z',read:read.has(id)});
      }
    }
    items.sort((a,b)=>Number(a.read)-Number(b.read)||b.at.localeCompare(a.at));
    return Response.json({items:items.slice(0,150)},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return failure(error)}
}
export async function PATCH(request:Request){
  try{
    const user=await identity();
    const {ids}=z.object({ids:z.array(z.string().min(1).max(300)).max(150)}).parse(await request.json());
    for(let attempt=0;attempt<3;attempt++){
      const row=await db().prepare('SELECT data FROM profiles WHERE id=?').bind(user.userId).first<{data:string}>();
      const profile=row?JSON.parse(row.data):{name:user.fullName||'Teammate',bio:'Making big ideas happen, one small win at a time.',emoji:'🌟'};
      profile.notificationReads=Array.from(new Set([...(profile.notificationReads||[]),...ids])).slice(-600);
      const result=row?await db().prepare('UPDATE profiles SET data=? WHERE id=? AND data=?').bind(JSON.stringify(profile),user.userId,row.data).run():await db().prepare('INSERT OR IGNORE INTO profiles(id,data) VALUES (?,?)').bind(user.userId,JSON.stringify(profile)).run();
      if(result.meta.changes)return Response.json({ok:true});
    }
    throw new HttpError(409,'Your account changed while marking notifications. Please try again.');
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({error:'Choose valid notifications.'},{status:400});
    return failure(error);
  }
}
