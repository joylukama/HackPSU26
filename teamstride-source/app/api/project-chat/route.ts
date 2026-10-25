import {chatMentions} from '../../../lib/chat-mentions';
import {z} from 'zod';
import {identity,db,load,activeMember,failure,HttpError} from '../../../lib/server';
import {projectChatAI,type ProjectChatMessage} from '../../../lib/project-chat';
async function access(projectId:string){const user=await identity();const {project}=await load(projectId);if(!activeMember(project,user))throw new HttpError(403,'Join this project to view or post in its shared chat.');return user}
const columns='id, rowid AS sequence, author_user_id AS authorUserId, author_name AS authorName, role, body, created_at AS createdAt';
export async function GET(request:Request){
 try{
  const url=new URL(request.url);const projectId=z.string().min(1).max(100).parse(url.searchParams.get('projectId'));await access(projectId);
  const before=url.searchParams.get('before');const limit=before?z.coerce.number().int().positive().safe().parse(before):Number.MAX_SAFE_INTEGER;
  const rows=await db().prepare(`SELECT ${columns} FROM project_messages WHERE project_id=? AND rowid<? ORDER BY rowid DESC LIMIT 51`).bind(projectId,limit).all<ProjectChatMessage>();
  const messages=rows.results.slice(0,50);return Response.json({messages:messages.reverse(),nextBefore:rows.results.length>50?messages[0].sequence:null,ai:projectChatAI,aiEnabled:(await load(projectId)).project.aiEnabled!==false},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:'Choose a valid project or history page.'},{status:400});return failure(error)}
}
export async function POST(request:Request){
 try{
  const body=z.object({projectId:z.string().min(1).max(100),id:z.string().uuid(),text:z.string().trim().min(1).max(4000)}).parse(await request.json());
  const user=await access(body.projectId);
  const {project:currentProject}=await load(body.projectId);if(currentProject.aiEnabled===false&&chatMentions(body.text,currentProject).ai)throw new HttpError(403,'AI is disabled for this project. You can still chat with your teammates.');
  const existing=await db().prepare('SELECT project_id,author_user_id,body FROM project_messages WHERE id=?').bind(body.id).first<{project_id:string;author_user_id:string;body:string}>();
  if(existing&&(existing.project_id!==body.projectId||existing.author_user_id!==user.userId||existing.body!==body.text))throw new HttpError(409,'This message changed. Send it as a new message.');
  if(!existing)await db().prepare('INSERT OR IGNORE INTO project_messages(id,project_id,author_user_id,author_name,role,body,created_at) VALUES (?,?,?,?,?,?,?)').bind(body.id,body.projectId,user.userId,user.displayName,'user',body.text,new Date().toISOString()).run();
  const message=await db().prepare(`SELECT ${columns} FROM project_messages WHERE id=? AND project_id=?`).bind(body.id,body.projectId).first<ProjectChatMessage>();
  if(!message||message.authorUserId!==user.userId||message.body!==body.text)throw new HttpError(409,'This message changed. Send it as a new message.');
  const {project}=await load(body.projectId);const mentions=chatMentions(body.text,project);
  return Response.json({message,ai:projectChatAI,aiRequested:project.aiEnabled!==false&&mentions.ai,mentionedMemberIds:mentions.memberIds},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){if(error instanceof z.ZodError)return Response.json({error:'Enter a message of up to 4,000 characters.'},{status:400});return failure(error)}
}
