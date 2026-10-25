import {z} from 'zod';
import type {Project,Identity} from './model';
import {admin,HttpError} from './server';
import {recordActivity,invalidateSwaps} from './collaboration';
import {assignmentSnapshot,notifyAssignments} from './task-assignments';
import {estimateTaskMinutes} from './model';
export function leaveProject(project:Project,user:Identity,nextOwnerId?:unknown){
 const leaving=project.members.find(member=>member.status==='active'&&(member.userId===user.userId||member.email===user.email));if(!leaving)throw new HttpError(403,'You are not an active member of this project.');
 const others=project.members.filter(member=>member.status==='active'&&member.id!==leaving.id&&member.userId&&member.userId!==user.userId);
 if(admin(project,user)){
  if(!others.length){project.deletedAt=new Date().toISOString();project.deletedBy=user.userId;return {archived:true}}
  const id=z.string().min(1).parse(nextOwnerId);const successor=others.find(member=>member.id===id);if(!successor)throw new HttpError(400,'Choose a joined teammate to become the project admin.');project.creatorId=successor.userId!;project.creatorEmail=successor.email;
 }
 const before=assignmentSnapshot(project);leaving.status='left';
 const remaining=project.members.filter(member=>member.status==='active');if(!remaining.length)throw new HttpError(409,'A remaining project admin is required.');
 for(const task of project.tasks){if(task.done||!task.assignees.includes(leaving.id))continue;task.assignees=task.assignees.filter(id=>id!==leaving.id);if(!task.assignees.length){const assignee=[...remaining].sort((a,b)=>project.tasks.filter(t=>!t.done&&t.assignees.includes(a.id)).reduce((sum,t)=>sum+(t.estimatedMinutes??estimateTaskMinutes(t))/t.assignees.length,0)-project.tasks.filter(t=>!t.done&&t.assignees.includes(b.id)).reduce((sum,t)=>sum+(t.estimatedMinutes??estimateTaskMinutes(t))/t.assignees.length,0))[0];task.assignees=[assignee.id]}}
 for(const swap of project.swaps||[])if(swap.status==='pending'&&(swap.fromMemberId===leaving.id||swap.toMemberId===leaving.id))swap.status='cancelled';invalidateSwaps(project);
 for(const meeting of project.meetings||[])if(meeting.status==='scheduled'&&meeting.startAt>new Date().toISOString()){if(meeting.organizerId===user.userId)meeting.status='cancelled';else{meeting.inviteeIds=meeting.inviteeIds.filter(id=>id!==leaving.id);delete meeting.responses[leaving.id]}}
 notifyAssignments(project,user,before);recordActivity(project,user,'membership',`${leaving.name} left the project. Unfinished tasks remain with the team.`);return {archived:false};
}
