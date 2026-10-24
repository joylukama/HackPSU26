import {env} from 'cloudflare:workers';
import type {Project} from './model';

export type InvitationDelivery={sent:number;failed:number;message:string};

// Called only after project membership has been saved. A mail failure must never
// make a successfully created project appear to have failed or lose its data.
export async function sendProjectInvitations(project:Project):Promise<InvitationDelivery>{
  const recipients=project.members.filter(member=>member.status==='pending'&&member.email);
  if(!recipients.length)return {sent:0,failed:0,message:'Your project is ready.'};
  const config=env as unknown as {RESEND_API_KEY?:string;INVITE_FROM_EMAIL?:string;PUBLIC_SITE_URL?:string};
  if(!config.RESEND_API_KEY||!config.INVITE_FROM_EMAIL||!config.PUBLIC_SITE_URL){
    return {sent:0,failed:recipients.length,message:'Project and invitations saved. Email delivery needs setup; the site owner must configure the email sender and public site URL. You can retry from Project admin.'};
  }
  try{
    const base=new URL(config.PUBLIC_SITE_URL);
    if(base.protocol!=='https:'||base.username||base.password||['localhost','127.0.0.1','[::1]'].includes(base.hostname)||base.hostname.endsWith('.local'))throw Error('Invalid public site URL');
    const link=new URL('/',base.origin);link.searchParams.set('project',project.id);
    const emails=recipients.map(member=>({
      from:config.INVITE_FROM_EMAIL,
      to:[member.email],
      subject:`You’re invited to ${project.title.replace(/[\r\n]/g,' ')}`,
      text:`Hi ${member.name},\n\nYou’ve been invited to join “${project.title}” on Teamstride.\n\nOpen your project invitation:\n${link.toString()}\n\nSign in with this email address (${member.email}), then choose “Join project” to view the project and your tasks. If this is a private site, the site owner may also need to grant you site access.\n\nOne small win at a time,\nTeamstride`,
    }));
    // A stable key protects retries after a timeout from duplicating emails.
    const body=JSON.stringify(emails);
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body));
    const key=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
    const response=await fetch('https://api.resend.com/emails/batch',{
      method:'POST',headers:{'Authorization':`Bearer ${config.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':`project-invites/${key}`},body,signal:AbortSignal.timeout(15000),
    });
    if(!response.ok)throw Error('Email provider rejected request');
    const result=await response.json() as {data?:{id:string}[]};
    if(!Array.isArray(result.data)||result.data.length!==recipients.length)throw Error('Email provider did not confirm all invitations');
    return {sent:recipients.length,failed:0,message:`Invitation emails queued for ${recipients.length} teammate${recipients.length===1?'':'s'}. They can follow the link and sign in to join.`};
  }catch{
    return {sent:0,failed:recipients.length,message:'Project and invitations saved, but email delivery could not be confirmed. Check the sender settings and retry from Project admin.'};
  }
}
