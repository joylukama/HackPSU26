import {z} from 'zod';
import {identity,load,save,activeMember,admin,failure,HttpError} from '../../../lib/server';
import {recordActivity} from '../../../lib/collaboration';
import type {ProjectMeeting} from '../../../lib/model';
const zone=z.string().max(100).refine(value=>{try{new Intl.DateTimeFormat('en',{timeZone:value});return true}catch{return false}},'Choose a valid time zone.');
const schema=z.object({projectId:z.string().min(1).max(100),title:z.string().trim().min(1).max(120),startAt:z.string().datetime(),endAt:z.string().datetime(),timeZone:zone,inviteeIds:z.array(z.string().min(1).max(100)).min(1).max(30),location:z.string().max(500).default(''),joinUrl:z.union([z.literal(''),z.string().url().max(2000).refine(value=>{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password},'Use an HTTPS meeting link.')]).default(''),notes:z.string().max(2000).default('')});
export async function POST(request:Request){
 try{
  const user=await identity(),body=schema.parse(await request.json());const {project,raw}=await load(body.projectId);
  if(!activeMember(project,user))throw new HttpError(403,'Join this project before scheduling a meeting.');
  if(project.status==='completed')throw new HttpError(400,'Reopen the project before scheduling a new meeting.');
  const start=Date.parse(body.startAt),end=Date.parse(body.endAt);
  if(start<Date.now()-60000||end<=start||end-start>86400000)throw new HttpError(400,'Choose a future start time and an end time within 24 hours of the start.');
  if(body.inviteeIds.some(id=>!project.members.some(member=>member.id===id&&member.status!=='left')))throw new HttpError(400,'Invite only members of this project.');
  if((project.meetings||[]).length>=200)throw new HttpError(400,'This project has reached its 200-meeting limit.');
  const mine=project.members.find(member=>member.userId===user.userId||member.email===user.email);
  const inviteeIds=Array.from(new Set([...body.inviteeIds,...(mine?[mine.id]:[])]));
  const meeting:ProjectMeeting={...body,id:crypto.randomUUID(),organizerId:user.userId,organizerName:user.displayName,inviteeIds,responses:Object.fromEntries(inviteeIds.map(id=>[id,id===mine?.id?'accepted':'pending'])),status:'scheduled'};
  project.meetings=[...(project.meetings||[]),meeting];
  recordActivity(project,user,'meeting',`${user.displayName} invited you to “${meeting.title}”.`,undefined,{meetingId:meeting.id,recipientMemberIds:inviteeIds});
  return Response.json({project:await save(project,raw),meeting});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:error.issues[0]?.message||'Check the meeting details.'},{status:400});return failure(error)}
}
export async function PATCH(request:Request){
 try{
  const user=await identity();const body=z.object({projectId:z.string().min(1).max(100),meetingId:z.string().min(1).max(100),action:z.enum(['accept','decline','cancel'])}).parse(await request.json());
  const {project,raw}=await load(body.projectId);if(!activeMember(project,user))throw new HttpError(403,'Join this project to respond to meetings.');
  const meeting=project.meetings?.find(item=>item.id===body.meetingId);if(!meeting)throw new HttpError(404,'Meeting not found.');
  if(meeting.status==='cancelled')throw new HttpError(409,'This meeting has been cancelled.');
  if(body.action==='cancel'){
   if(meeting.organizerId!==user.userId&&!admin(project,user))throw new HttpError(403,'Only the organizer or project creator can cancel this meeting.');
   meeting.status='cancelled';recordActivity(project,user,'meeting',`${user.displayName} cancelled “${meeting.title}”.`,undefined,{meetingId:meeting.id,recipientMemberIds:meeting.inviteeIds});
  }else{
   const mine=project.members.find(member=>member.userId===user.userId||member.email===user.email);
   if(!mine||!meeting.inviteeIds.includes(mine.id))throw new HttpError(403,'This meeting invitation is for another teammate.');
   if(meeting.organizerId===user.userId)throw new HttpError(400,'You organize this meeting. Cancel it if you cannot attend.');
   const response=body.action==='accept'?'accepted':'declined';
   if(meeting.responses[mine.id]!==response){meeting.responses[mine.id]=response;const host=project.members.find(member=>member.userId===meeting.organizerId);recordActivity(project,user,'meeting',`${user.displayName} ${response} “${meeting.title}”.`,undefined,{meetingId:meeting.id,recipientMemberIds:host?[host.id]:[]})}
  }
  return Response.json({project:await save(project,raw),meeting});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:'Choose a valid meeting response.'},{status:400});return failure(error)}
}
