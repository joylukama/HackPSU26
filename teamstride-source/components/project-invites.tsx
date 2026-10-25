'use client';
import {useState,useEffect,useRef} from 'react';
import {Plus,X,Copy,Check} from 'lucide-react';
import type {Project,Identity} from '../lib/model';
async function request(method:string,body:unknown){const response=await fetch('/api/invite-codes',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json() as Project & {error?:string};if(!response.ok)throw Error(data.error||'Could not update invitation.');return data as Project}
export function JoinProjectCode({user,onJoined}:{user:Identity|null;onJoined:(project:Project)=>void}){
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 return <section className="panel inviteCodePanel"><h3>Have a project invite code?</h3><p>Sign in, then enter the code your teammate shared.</p><form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try{const project=await request('PUT',{code});onJoined(project);setCode('')}catch(error){setError((error as Error).message)}finally{setBusy(false)}}}><label>Project invite code<input aria-label="Project invite code" autoComplete="off" maxLength={6} minLength={6} required value={code} onChange={event=>setCode(event.target.value.toUpperCase())} placeholder="ABC234" disabled={!user||busy}/></label><button className="secondary" disabled={!user||busy||!code.trim()}>{busy?'Joining…':'Join with code'}</button></form>{error&&<p role="alert" className="banner error">{error}</p>}</section>;
}
export function ProjectInviteCode({project,isAdmin,onProject}:{project:Project;isAdmin:boolean;onProject:(project:Project)=>void}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 async function change(disable=false){setBusy(true);setNotice('');try{onProject(await request('POST',{projectId:project.id,disable}));setNotice(disable?'Code disabled. Links containing this code can no longer be used to join.':'New code ready. Previous codes no longer work.')}catch(error){setNotice((error as Error).message)}finally{setBusy(false)}}
 return <section className="panel inviteCodePanel"><h3>Project invite code</h3><p>Anyone signed in with this code can join your project. Share it only with your teammates.</p>{project.inviteCode?<><code className="projectInviteCode">{project.inviteCode}</code><button className="secondary" onClick={async()=>{try{await navigator.clipboard.writeText(project.inviteCode!);setNotice('Code copied.')}catch{setNotice('Select and copy the code above.')}}}>Copy code</button></>:<p>No active code.</p>}{isAdmin&&<div><button className="textbutton" disabled={busy} onClick={()=>change()}>{project.inviteCode?'Replace code':'Create code'}</button>{project.inviteCode&&<button className="textbutton" disabled={busy} onClick={()=>change(true)}>Disable code</button>}</div>}<p role="status">{notice}</p></section>;
}

export function NewProjectMenu({user,onCreate,onJoined}:{user:Identity|null;onCreate:()=>void;onJoined:(project:Project)=>void}){
 const [open,setOpen]=useState(false),[joining,setJoining]=useState(false);
 return <div className="newProjectMenu"><button className="primary" onClick={()=>{setJoining(false);setOpen(true)}}><Plus size={17}/> New Project</button>{open&&<div className="overlay" onClick={()=>setOpen(false)}><section className="dialog" role="dialog" aria-modal="true" aria-label="Create or join a project" onClick={event=>event.stopPropagation()}><button className="close" aria-label="Close project menu" onClick={()=>setOpen(false)}><X size={20}/></button><span className="eyebrow">YOUR NEXT GOOD THING</span><h2>{joining?'Join a project':'Start something together'}</h2>{joining?<><JoinProjectCode user={user} onJoined={project=>{setOpen(false);onJoined(project)}}/><button className="textbutton" onClick={()=>setJoining(false)}>Back to project options</button></>:<div className="projectMenuOptions"><button className="secondary" onClick={()=>{setOpen(false);onCreate()}}>Create project</button><button className="secondary" onClick={()=>setJoining(true)}>Join project</button></div>}</section></div>}</div>;
}

export function CopyProjectLink({project}:{project:Project}){
 const [status,setStatus]=useState<'idle'|'copying'|'copied'|'manual'|'unavailable'>('idle');
 const [link,setLink]=useState('');const input=useRef<HTMLInputElement>(null);
 useEffect(()=>{if(status==='manual'){input.current?.focus();input.current?.select()}},[status]);
 async function copy(){
  if(!project.inviteCode){setStatus('unavailable');return}
  const local=['localhost','127.0.0.1','[::1]'].includes(window.location.hostname);const url=new URL('/',local?window.location.origin:'https://www.teamstride.work');url.searchParams.set('project',project.id);url.searchParams.set('join',project.inviteCode);setLink(url.toString());setStatus('copying');
  try{await navigator.clipboard.writeText(url.toString());setStatus('copied')}catch{setStatus('manual')}
 }
 return <div className="copyProjectLink"><button type="button" aria-live="polite" disabled={status==='copying'} onClick={copy}>{status==='copied'?<Check size={13}/>:<Copy size={13}/>} {status==='copied'?'link copied!':status==='copying'?'Copying…':'Copy invite link'}</button><span className="copyLinkStatus" role="status" aria-live="polite">{status==='manual'?'Automatic copying was blocked. Copy the selected invite link below.':status==='unavailable'?'Ask the project admin to create an invite code first.':''}</span>{status==='manual'&&<input ref={input} aria-label="Project invite link to copy" readOnly value={link} onFocus={event=>event.target.select()}/>}</div>;
}
