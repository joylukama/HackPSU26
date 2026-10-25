import {uid,estimateTaskMinutes,type Task,type Member} from './model';
export type AssignmentSource={fileName:string;text:string};
export function assignmentRequirements(sources:AssignmentSource[]){
 const result:{fileName:string;requirement:string}[]=[];const seen=new Set<string>();
 for(const source of sources)for(const raw of source.text.replace(/\r/g,'').split(/\n+|(?<=[.!?;])\s+/)){
  const requirement=raw.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').replace(/\s+/g,' ').trim();
  if(requirement.length<12||requirement.length>700||!/(?:\b(?:must|required|submit|create|include|write|analy[sz]e|compare|present|design|build|research|explain|minimum|deliver|implement|evaluate|prepare|demonstrate|develop|discuss|identify|describe|provide|cite|complete|essay|report|presentation|slides|rubric|criteria|requirements|pages|words|citations)|at least)/i.test(requirement))continue;
  const key=source.fileName+'\n'+requirement.toLowerCase();if(seen.has(key))continue;seen.add(key);result.push({fileName:source.fileName,requirement});if(result.length>=30)return result;
 }
 return result;
}
export function assignmentTasks(title:string,members:Member[],start:string,end:string,sources:AssignmentSource[],existing:Task[]=[]){
 members=members.filter(member=>member.status!=='left');
 const requirements=assignmentRequirements(sources);const known=new Set(existing.filter(task=>task.assignmentFile&&task.assignmentRequirement).map(task=>task.assignmentFile+'\n'+task.assignmentRequirement!.toLowerCase()));
 return requirements.filter(item=>!known.has(item.fileName+'\n'+item.requirement.toLowerCase())).map((item,index):Task=>{
  const subject=title.trim().slice(0,80);const prefix='Complete: '+item.requirement;const name=prefix.slice(0,Math.max(1,177-subject.length))+' — '+subject;
  const loads=members.map(member=>({member,minutes:[...existing].filter(task=>!task.done&&task.assignees.includes(member.id)).reduce((sum,task)=>sum+(task.estimatedMinutes??estimateTaskMinutes(task))/task.assignees.length,0)}));
  // Spread newly extracted requirements through the existing project schedule.
  const date=new Date(start+'T12:00:00Z');const duration=(Date.parse(end+'T12:00:00Z')-date.getTime())/86400000;date.setUTCDate(date.getUTCDate()+Math.round(duration*(index+1)/(requirements.length+1)));
  const member=[...loads].sort((a,b)=>a.minutes-b.minutes)[index%members.length]?.member||members[index%members.length];
  const detail=`Assignment requirement from ${item.fileName}:\n${item.requirement}\n\nComplete this deliverable and check it against the original assignment. Review the source file for full context, formatting, and submission instructions.`;
  return {id:uid(),title:name,detail,assignmentFile:item.fileName,assignmentRequirement:item.requirement,assignees:[member.id],phase:1,date:date.toISOString().slice(0,10),done:false,comments:[],estimatedMinutes:estimateTaskMinutes({title:prefix,detail,phase:1})};
 });
}
export function renameTaskTitles(tasks:Task[],oldName:string,newName:string){
 if(oldName===newName||!oldName.trim())return;
 const escaped=oldName.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const pattern=new RegExp('(?<![\\p{L}\\p{N}])'+escaped+'(?![\\p{L}\\p{N}])','giu');
 for(const task of tasks){const suffix=' — '+oldName.trim().slice(0,80);if(task.title.endsWith(suffix)){const subject=newName.trim().slice(0,80);task.title=task.title.slice(0,-suffix.length).replace(pattern,()=>newName).slice(0,177-subject.length)+' — '+subject}else task.title=task.title.replace(pattern,()=>newName).slice(0,180)}
}
