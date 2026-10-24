import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {identity,load,save,activeMember,admin,failure,HttpError} from '../../../lib/server';
import {recordActivity} from '../../../lib/collaboration';
import type {Project,Identity} from '../../../lib/model';

const MAX_BYTES=10*1024*1024;
async function boundedFormData(request:Request){
  if(!request.body)throw new HttpError(400,'Choose a file to upload.');
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>MAX_BYTES+65536){await reader.cancel();throw new HttpError(413,'Each file must be 10 MB or smaller.')}chunks.push(chunk.value)}}finally{reader.releaseLock()}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  return new Response(bytes,{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
}
function bucket(){if(!env.BUCKET)throw new HttpError(503,'Project file storage is unavailable. Please try again later.');return env.BUCKET}
function authorize(project:Project,user:Identity){if(!activeMember(project,user))throw new HttpError(403,'Join this project to access its materials.')}
function checkTask(project:Project,taskId?:string){if(taskId&&!project.tasks.some(task=>task.id===taskId))throw new HttpError(400,'Choose a task in this project.')}
export async function GET(request:Request){
  try{
    const user=await identity();const url=new URL(request.url);
    const id=z.string().min(1).max(100).parse(url.searchParams.get('projectId'));
    const {project}=await load(id);authorize(project,user);
    const fileId=url.searchParams.get('fileId');
    if(!fileId)return Response.json({materials:project.materials||[]},{headers:{'Cache-Control':'private, no-store'}});
    const material=project.materials?.find(file=>file.id===fileId);
    if(!material)throw new HttpError(404,'Material not found.');
    const object=await bucket().get(material.key);if(!object)throw new HttpError(404,'This file is no longer available.');
    // Always download user uploads; never execute HTML/SVG on the Site origin.
    return new Response(object.body,{headers:{
      'Content-Type':'application/octet-stream',
      'Content-Disposition':`attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(material.name).replace(/['()*]/g,char=>'%'+char.charCodeAt(0).toString(16))}`,
      'Content-Length':String(material.size),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",
    }});
  }catch(error){if(error instanceof z.ZodError)return Response.json({error:'Choose a valid project.'},{status:400});return failure(error)}
}
export async function POST(request:Request){
  try{
    const user=await identity();
    if(Number(request.headers.get('content-length')||0)>MAX_BYTES+65536)throw new HttpError(413,'Each file must be 10 MB or smaller.');
    const form=await boundedFormData(request);const id=z.string().min(1).max(100).parse(form.get('projectId'));
    const {project,raw}=await load(id);authorize(project,user);
    if(project.status==='completed')throw new HttpError(400,'Reopen the project before uploading new materials.');
    if((project.materials||[]).length>=100)throw new HttpError(400,'This project has reached its 100-file limit.');
    const file=form.get('file');
    if(!file||typeof file==='string'||typeof file.arrayBuffer!=='function')throw new HttpError(400,'Choose a file to upload.');
    if(file.size===0||file.size>MAX_BYTES)throw new HttpError(413,'Choose a non-empty file of 10 MB or smaller.');
    const taskId=z.string().max(100).parse(form.get('taskId')||'')||undefined;checkTask(project,taskId);
    const fileId=crypto.randomUUID();const key=`projects/${project.id}/${fileId}`;
    const material={id:fileId,key,name:file.name.replace(/[\u0000-\u001f\u007f/\\]/g,'_').slice(0,200)||'Project material',size:file.size,mime:file.type||'application/octet-stream',taskId,uploadedBy:user.userId,uploadedByName:user.displayName,uploadedAt:new Date().toISOString()};
    const storage=bucket();await storage.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:'application/octet-stream'}});
    project.materials=[...(project.materials||[]),material];recordActivity(project,user,'material',`${user.displayName} shared “${material.name}”.`,taskId);
    try{return Response.json({project:await save(project,raw),material})}
    catch(error){try{await storage.delete(key)}catch{}throw error}
  }catch(error){if(error instanceof z.ZodError)return Response.json({error:'Check the project and task.'},{status:400});return failure(error)}
}
export async function PATCH(request:Request){
  try{
    const user=await identity();const body=z.object({projectId:z.string().min(1).max(100),fileId:z.string().min(1).max(100),taskId:z.string().max(100).optional()}).parse(await request.json());
    const {project,raw}=await load(body.projectId);authorize(project,user);
    if(project.status==='completed')throw new HttpError(400,'Reopen the project before changing materials.');
    const material=project.materials?.find(file=>file.id===body.fileId);if(!material)throw new HttpError(404,'Material not found.');
    if(material.uploadedBy!==user.userId&&!admin(project,user))throw new HttpError(403,'Only the uploader or project creator can reassign this material.');
    checkTask(project,body.taskId||undefined);material.taskId=body.taskId||undefined;
    return Response.json({project:await save(project,raw)});
  }catch(error){if(error instanceof z.ZodError)return Response.json({error:'Choose a valid material and task.'},{status:400});return failure(error)}
}
