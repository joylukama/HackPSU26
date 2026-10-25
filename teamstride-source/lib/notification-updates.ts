import type {Project,Identity} from './model';
export type AwayWindow={since:string|null;until:string};
export function catchUpProjects(projects:Project[],user:Identity,since:number,until:number){
 return projects.filter(project=>!project.deletedAt&&project.aiEnabled!==false).map(project=>{
  const mine=project.members.find(member=>member.userId===user.userId||member.email===user.email);
  const events=(project.activities||[]).filter(event=>{const at=Date.parse(event.at);return at>since&&at<=until&&event.actorUserId!==user.userId&&(!event.recipientMemberIds||!!mine&&event.recipientMemberIds.includes(mine.id))}).slice(-40).map(event=>({kind:event.kind,text:event.text,at:event.at,taskId:event.taskId}));
  return {id:project.id,title:project.title,deadline:project.end,events};
 }).filter(project=>project.events.length).slice(0,20);
}
export function freshNotifications<T extends {id:string;read:boolean;at:string;kind?:string}>(items:T[],seen:Set<string>,activeSince:number){return items.filter(item=>!item.read&&!seen.has(item.id)&&(Date.parse(item.at)>=activeSince||item.kind==='risk'))}
