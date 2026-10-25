import type {Project} from './model';
// Stable member IDs keep mentions correct even when teammates share a name.
export const memberMention=(member:{id:string;name:string})=>`@[${member.name.replace(/[\[\]\r\n]/g,'')}](${encodeURIComponent(member.id)})`;
export function chatMentions(body:string,project:Project){
 const ids=new Set<string>();for(const match of body.matchAll(/@\[[^\]\r\n]+\]\(([^)\s]+)\)/g)){try{const id=decodeURIComponent(match[1]);if(project.members.some(m=>m.id===id))ids.add(id)}catch{}}
 for(const member of project.members){const escaped=member.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');if(new RegExp('(^|\\s)@'+escaped+'(?=$|[\\s,.!?;:])','i').test(body))ids.add(member.id)}
 return {memberIds:[...ids],ai:/(^|\s)@AI\b/i.test(body)};
}
export const displayChatText=(body:string)=>body.replace(/@\[([^\]\r\n]+)\]\(([^)\s]+)\)/g,'@$1');
