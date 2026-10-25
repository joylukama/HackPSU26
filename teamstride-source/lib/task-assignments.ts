import type {Project,Task,Identity} from './model';
import {estimateTaskMinutes} from './model';
import {recordActivity,invalidateSwaps} from './collaboration';
export const assignmentSnapshot=(project:Project)=>project.tasks.map(task=>({...task,assignees:[...task.assignees]}));
// Move only enough unfinished solo tasks to balance the team's task counts.
// Ties use estimated effort. Shared work, completed work, and task contents stay intact.
export function redistributeTasks(project:Project){
 if(project.status!=='active'||project.members.length<2)return;
 const members=project.members,solo=project.tasks.filter(task=>!task.done&&task.assignees.length===1);
 const count=(id:string)=>solo.filter(task=>task.assignees[0]===id).length;
 const effort=(id:string)=>project.tasks.filter(task=>!task.done&&task.assignees.includes(id)).reduce((sum,task)=>sum+(task.estimatedMinutes??estimateTaskMinutes(task))/task.assignees.length,0);
 for(let step=0;step<solo.length*members.length;step++){
  const sorted=[...members].sort((a,b)=>count(a.id)-count(b.id)||effort(a.id)-effort(b.id));
  const low=sorted[0],high=sorted.at(-1)!;if(count(high.id)-count(low.id)<=1)break;
  const target=(effort(high.id)-effort(low.id))/2;
  const task=solo.filter(task=>task.assignees[0]===high.id).sort((a,b)=>Math.abs((a.estimatedMinutes??estimateTaskMinutes(a))-target)-Math.abs((b.estimatedMinutes??estimateTaskMinutes(b))-target)||a.date.localeCompare(b.date))[0];
  if(!task)break;task.assignees=[low.id];
 }
 invalidateSwaps(project);
}
export function notifyAssignments(project:Project,user:Identity,before:Task[]){
 for(const task of project.tasks){if(task.done)continue;const old=before.find(previous=>previous.id===task.id);const added=task.assignees.filter(id=>!old?.assignees.includes(id));
  const recipients=added.filter(id=>project.members.some(member=>member.id===id));if(recipients.length)recordActivity(project,user,'assignment',`You’ve been assigned “${task.title}” (due ${task.date}).`,task.id,{recipientMemberIds:recipients});
 }
}
