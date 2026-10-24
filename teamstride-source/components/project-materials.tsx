'use client';
import {useState} from 'react';
import {Upload,Paperclip,Download,X,Clock,Trash2,RotateCcw} from 'lucide-react';
import {type Project,type Task,type Identity,estimateTaskMinutes,formatEstimate} from '../lib/model';
import './project-materials.css';

export const MAX_FILE_BYTES=10*1024*1024;
const sizeLabel=(bytes:number)=>bytes>=1024*1024?`${(bytes/1024/1024).toFixed(1)} MB`:`${Math.max(1,Math.ceil(bytes/1024))} KB`;
export function TaskEstimate({task}:{task:Task}){return <span className="taskEstimate" title="Estimated active work time; editable in task settings"><Clock size={11}/> Est. {formatEstimate(task.estimatedMinutes??estimateTaskMinutes(task))}</span>}
export function CreationMaterials({files,onChange}:{files:File[];onChange:(files:File[])=>void}){
  return <section className="creationMaterials"><h3><Paperclip size={17}/> Project materials</h3><p className="hint">Optional briefs, slides, research, images, and other files. The team can access these after joining. Assign files to tasks once your plan is created.</p><label className="filePicker"><Upload size={18}/><span>Choose project files<small>Up to 10 MB per file · uploaded after your project is saved</small></span><input aria-label="Project materials to upload" type="file" multiple onChange={event=>{onChange([...files,...Array.from(event.target.files||[])]);event.target.value=''}}/></label><SelectedFiles files={files} onChange={onChange}/></section>;
}
function SelectedFiles({files,onChange}:{files:File[];onChange:(files:File[])=>void}){
  return <div className="selectedFiles">{files.map((file,index)=><div key={`${file.name}-${index}`}><Paperclip size={13}/><span>{file.name}<small>{sizeLabel(file.size)}{file.size===0||file.size>MAX_FILE_BYTES?' · Choose a non-empty file of 10 MB or smaller':''}</small></span><button type="button" className="iconbtn" aria-label={`Remove selected file ${file.name}`} onClick={()=>onChange(files.filter((_,i)=>i!==index))}><X size={15}/></button></div>)}</div>;
}
export async function uploadMaterialFiles(projectId:string,files:File[],onProject:(project:Project)=>void,taskId=''){
  const failed:File[]=[],errors:string[]=[];let uploaded=0;
  for(const file of files){
    try{
      if(file.size===0||file.size>MAX_FILE_BYTES)throw Error('Choose a non-empty file of 10 MB or smaller.');
      const form=new FormData();form.set('projectId',projectId);form.set('taskId',taskId);form.set('file',file);
      const response=await fetch('/api/materials',{method:'POST',body:form});
      const result=await response.json() as {project:Project;error?:string};
      if(!response.ok)throw Error(result.error||'Could not upload this file.');
      onProject(result.project);uploaded++;
    }catch(error){failed.push(file);errors.push(`${file.name}: ${(error as Error).message}`)}
  }
  return {uploaded,failed,errors};
}
export function ProjectMaterials({project,user,taskId,busy,onBusy,onProject}:{project:Project;user:Identity|null;taskId?:string;busy:boolean;onBusy:(busy:boolean)=>void;onProject:(project:Project)=>void}){
  const [files,setFiles]=useState<File[]>([]),[assignment,setAssignment]=useState(taskId||''),[scope,setScope]=useState('all'),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const materials=project.materials||[];
  const visible=materials.filter(file=>taskId?file.taskId===taskId||!file.taskId:scope==='all'||(scope==='general'?!file.taskId:file.taskId===scope));
  const writable=!!user&&project.id!=='demo'&&project.status==='active';
  async function upload(event:React.FormEvent){
    event.preventDefault();onBusy(true);setError('');setNotice('');
    try{const result=await uploadMaterialFiles(project.id,files,onProject,assignment);setFiles(result.failed);setNotice(result.uploaded?`${result.uploaded} file${result.uploaded===1?'':'s'} shared with the team.`:'');setError(result.errors.join('\n'))}finally{onBusy(false)}
  }
  async function reassign(fileId:string,nextTaskId:string){
    onBusy(true);setError('');
    try{const response=await fetch('/api/materials',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:project.id,fileId,taskId:nextTaskId})});const result=await response.json() as {project:Project;error?:string};if(!response.ok)throw Error(result.error||'Could not assign this material.');onProject(result.project);setNotice('Material assignment updated.')}catch(error){setError((error as Error).message)}finally{onBusy(false)}
  }
  return <section className="projectMaterials" aria-label={taskId?'Task materials':'Project materials'}><div className="sectionTitle"><div><h3><Paperclip size={18}/> {taskId?'Task materials':'Shared project materials'}</h3><p>{taskId?'Files linked to this task, plus general project references.':'A shared shelf for your brief, references, and working files.'}</p></div><span className="statusTag">{materials.length} FILES</span></div>{!taskId&&materials.length>0&&<label className="materialFilter">Show<select aria-label="Filter project materials" value={scope} onChange={event=>setScope(event.target.value)}><option value="all">All materials</option><option value="general">General project materials</option>{project.tasks.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>}{error&&<div className="banner error materialError" role="alert">{error}</div>}{notice&&<p role="status" className="materialNotice">{notice}</p>}<div className="materialList">{visible.map(file=><article className="materialCard" key={file.id}><div className="materialFileIcon"><Paperclip size={19}/></div><div className="materialInfo"><b>{file.name}</b><small>{sizeLabel(file.size)} · Shared by {file.uploadedByName}</small><span>{file.taskId?project.tasks.find(task=>task.id===file.taskId)?.title||'Task material':'General project material'}</span>{writable&&(user.userId===file.uploadedBy||user.userId===project.creatorId)&&<label>Assign to<select aria-label={`Assign ${file.name} to task`} disabled={busy} value={file.taskId||''} onChange={event=>reassign(file.id,event.target.value)}><option value="">General project materials</option>{project.tasks.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>}</div><a className="secondary" download href={`/api/materials?projectId=${encodeURIComponent(project.id)}&fileId=${encodeURIComponent(file.id)}`} aria-label={`Download ${file.name}`}><Download size={14}/><span>Download</span></a></article>)}{!visible.length&&<div className="materialsEmpty"><Paperclip size={24}/><p>{taskId?'No materials linked yet. Upload a file here or attach an existing project file from Materials.':'Your project’s materials will live here.'}</p></div>}</div>{writable?<form className="materialUpload" onSubmit={upload}><label className="filePicker"><Upload size={19}/><span>Choose files to share<small>Up to 10 MB each · up to 100 files per project</small></span><input aria-label={taskId?'Upload task materials':'Upload shared project materials'} type="file" multiple disabled={busy} onChange={event=>{setFiles([...files,...Array.from(event.target.files||[])]);event.target.value=''}}/></label><SelectedFiles files={files} onChange={setFiles}/><label>Attach to<select aria-label="Attach uploaded materials to" value={assignment} disabled={busy} onChange={event=>setAssignment(event.target.value)}><option value="">General project materials</option>{project.tasks.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label><button className="primary" disabled={busy||!files.length||files.some(file=>file.size===0||file.size>MAX_FILE_BYTES)}><Upload size={15}/>{busy?'Saving…':'Upload & share'}</button></form>:<p className="hint">{project.id==='demo'?'Create a project to upload shared materials.':project.status==='completed'?'Materials remain available to your team. Reopen the project to add or reassign files.':'Sign in and join this project to share materials.'}</p>}</section>;
}
export type TrashedProject={id:string;title:string;emoji:string;deletedAt:string};
export function ProjectTrash({items,busy,onRestore}:{items:TrashedProject[];busy:boolean;onRestore:(id:string)=>void}){
  if(!items.length)return null;
  return <section className="projectTrash"><details><summary><Trash2 size={17}/> Deleted projects <span>{items.length}</span></summary><p className="hint">Only projects you created appear here. Restore a project with its tasks, discussions, and materials.</p>{items.map(project=><article key={project.id}><span>{project.emoji}</span><b>{project.title}</b><small>Deleted {new Date(project.deletedAt).toLocaleDateString()}</small><button className="secondary" disabled={busy} onClick={()=>onRestore(project.id)}><RotateCcw size={13}/> Restore</button></article>)}</details></section>;
}
