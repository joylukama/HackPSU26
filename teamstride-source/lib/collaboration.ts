import type {Project,Task,Identity,Activity} from './model';
import {HttpError,admin} from './server';
import {z} from 'zod';

export function recordActivity(project:Project,user:Identity,kind:Activity['kind'],text:string,taskId?:string,extra:{meetingId?:string;recipientMemberIds?:string[]}={}){
  project.activities=[...(project.activities||[]),{id:crypto.randomUUID(),kind,actorUserId:user.userId,actorName:user.displayName,text,taskId,at:new Date().toISOString(),...extra}].slice(-250);
}
const owned=(task:Task,project:Project,user:Identity)=>project.members.some(member=>member.status==='active'&&(member.userId===user.userId||member.email===user.email)&&task.assignees.includes(member.id));
export function applyCollaboration(project:Project,user:Identity,body:Record<string,unknown>){
  if(!['help','swap_request','swap_respond'].includes(String(body.action)))return false;
  if(project.status==='completed')throw new HttpError(400,'Reopen this project before changing its tasks.');
  if(body.action==='help'){
    const task=project.tasks.find(task=>task.id===body.taskId);
    if(!task)throw new HttpError(404,'Task not found.');
    if(!owned(task,project,user)&&!admin(project,user))throw new HttpError(403,'Only the assignee or project admin can flag this task.');
    if(task.done)throw new HttpError(400,'Completed tasks do not need a help flag.');
    const resolve=z.boolean().parse(body.resolve);
    if(resolve){delete task.help;recordActivity(project,user,'help',`${user.displayName} resolved the help request on “${task.title}”.`,task.id)}
    else{
      const message=z.string().trim().min(1).max(1000).parse(body.message);
      task.help={byUserId:user.userId,byName:user.displayName,message,at:new Date().toISOString()};
      recordActivity(project,user,'help',`${user.displayName} needs help with “${task.title}”: ${message}`,task.id);
    }
    return true;
  }
  project.swaps=project.swaps||[];
  if(body.action==='swap_request'){
    const from=project.tasks.find(task=>task.id===body.fromTaskId),to=project.tasks.find(task=>task.id===body.toTaskId);
    if(!from||!to||from.id===to.id)throw new HttpError(400,'Choose two different tasks.');
    if(from.done||to.done||from.assignees.length!==1||to.assignees.length!==1)throw new HttpError(400,'Only unfinished tasks with one assignee can be swapped.');
    if(!owned(from,project,user))throw new HttpError(403,'You can only offer a task assigned to you.');
    const fromMember=project.members.find(member=>member.id===from.assignees[0]);
    const toMember=project.members.find(member=>member.id===to.assignees[0]);
    if(!fromMember||!toMember||fromMember.id===toMember.id||toMember.status!=='active'||!toMember.userId)throw new HttpError(400,'Choose a task belonging to another teammate who has joined.');
    if(project.swaps.some(swap=>swap.status==='pending'&&[swap.fromTaskId,swap.toTaskId].some(id=>id===from.id||id===to.id)))throw new HttpError(409,'One of these tasks already has a pending swap request.');
    project.swaps=project.swaps.filter(swap=>swap.status==='pending').concat(project.swaps.filter(swap=>swap.status!=='pending').slice(-49));
    project.swaps.push({id:crypto.randomUUID(),fromTaskId:from.id,toTaskId:to.id,fromMemberId:fromMember.id,toMemberId:toMember.id,requestedBy:user.userId,status:'pending',createdAt:new Date().toISOString()});
    recordActivity(project,user,'swap',`${user.displayName} offered “${from.title}” to ${toMember.name} in exchange for “${to.title}”.`,from.id);
    return true;
  }
  const swap=project.swaps.find(swap=>swap.id===body.swapId);
  if(!swap||swap.status!=='pending')throw new HttpError(409,'This swap request is no longer pending.');
  const decision=z.enum(['accept','decline','cancel']).parse(body.decision);
  const receiver=project.members.find(member=>member.id===swap.toMemberId);
  if(decision==='cancel'){
    if(swap.requestedBy!==user.userId)throw new HttpError(403,'Only the requester can cancel this swap.');
    swap.status='cancelled';
  }else{
    if(!receiver||receiver.status!=='active'||(receiver.userId!==user.userId&&receiver.email!==user.email))throw new HttpError(403,'Only the receiving teammate can accept or decline.');
    if(decision==='accept'){
      const from=project.tasks.find(task=>task.id===swap.fromTaskId),to=project.tasks.find(task=>task.id===swap.toTaskId);
      if(!from||!to||from.done||to.done||from.assignees.length!==1||to.assignees.length!==1||from.assignees[0]!==swap.fromMemberId||to.assignees[0]!==swap.toMemberId)throw new HttpError(409,'The tasks changed. Cancel this request and make a new one.');
      const sender=project.members.find(member=>member.id===swap.fromMemberId);
      if(swap.fromMemberId===swap.toMemberId||!sender||sender.status!=='active'||sender.userId!==swap.requestedBy)throw new HttpError(409,'The teammates changed. Cancel this request and make a new one.');
      // Replace each ownership list; never append a second assignee. Both transfers
      // are persisted together by the project's compare-and-swap save.
      project.tasks=project.tasks.map(task=>task.id===from.id?{...task,assignees:[swap.toMemberId]}:task.id===to.id?{...task,assignees:[swap.fromMemberId]}:task);
      swap.status='accepted';
    }else swap.status='declined';
  }
  const fromName=project.members.find(member=>member.id===swap.fromMemberId)?.name||'Teammate',toName=receiver?.name||'Teammate';
  const fromTitle=project.tasks.find(task=>task.id===swap.fromTaskId)?.title||'the offered task',toTitle=project.tasks.find(task=>task.id===swap.toTaskId)?.title||'the requested task';
  recordActivity(project,user,'swap',swap.status==='accepted'?`Swap complete: ${toName} now owns “${fromTitle}”; ${fromName} now owns “${toTitle}”.`:`${user.displayName} ${swap.status} a task swap.`,swap.fromTaskId);
  return true;
}
export function invalidateSwaps(project:Project){
  for(const swap of project.swaps||[]){
    if(swap.status!=='pending')continue;
    const from=project.tasks.find(task=>task.id===swap.fromTaskId),to=project.tasks.find(task=>task.id===swap.toTaskId);
    if(project.status==='completed'||!from||!to||from.done||to.done||from.assignees.length!==1||to.assignees.length!==1||from.assignees[0]!==swap.fromMemberId||to.assignees[0]!==swap.toMemberId)swap.status='cancelled';
  }
}
