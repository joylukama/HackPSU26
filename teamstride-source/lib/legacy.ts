import type {Project} from './model';
export function upgrade(old:any,user:{userId:string,email:string}):Project{
const members=old.members.map((m:any,i:number)=>typeof m==='string'?{id:'legacy-'+i,name:m,email:i===0?user.email:'',userId:i===0?user.userId:undefined,status:i===0?'active':'pending'}:m);
return {...old,members,creatorId:user.userId,creatorEmail:user.email,theme:'lilac',emoji:'🚀',status:'active',revision:1,tasks:old.tasks.map((t:any)=>({...t,assignees:t.assignees||[members[t.owner||0]?.id||members[0].id],comments:t.comments||[]}))};
}
