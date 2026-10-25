'use client';

import {useEffect,useState,type ReactNode} from 'react';
import {TeamCalendar,type MeetingFocus} from './team-calendar';
import {Project,Task,progress,type Identity} from '../lib/model';
import './workspace-overview.css';

type Props={view:string;projects:Project[];sample:Project;onSelect:(id:string)=>void;renderTask:(task:Task,project:Project)=>ReactNode;user?:Identity|null;onProject?:(project:Project)=>void;onNotifications?:()=>void;meetingFocus?:MeetingFocus|null;onMeetingFocusClear?:()=>void};
export function WorkspaceOverview({view,projects,sample,onSelect,renderTask,user=null,onProject=()=>{},onNotifications=()=>{},meetingFocus,onMeetingFocusClear=()=>{}}:Props){
  const active=projects.filter(p=>p.status==='active');
  const completed=projects.filter(p=>p.status==='completed');
  const visible=projects.length?active:[sample];
  const tasks=visible.flatMap(project=>project.tasks.map(task=>({task,project})));
  const pending=tasks.filter(({task})=>!task.done).sort((a,b)=>a.task.date.localeCompare(b.task.date));
  const today=new Date().toLocaleDateString('en-CA');
  function cards(list:Project[]){return <div className="projectCards">{list.map(project=><button className="projectCard" key={project.id} onClick={()=>onSelect(project.id)}><span className="cardemoji">{project.emoji}</span><span className="statusTag">{project.status==='completed'?'COMPLETED ✓':project.id==='demo'?'EXAMPLE PROJECT':'IN PROGRESS'}</span><h3>{project.title}</h3><p>{project.brief}</p><div className="overviewProgress"><i style={{width:`${progress(project)}%`}}/></div><small>{progress(project)}% complete · {project.tasks.filter(t=>!t.done).length} tasks remaining</small><span className="projectCardLink">Open project ↗</span></button>)}</div>}
  if(view==='Completed projects')return <section aria-label="Completed projects"><div className="sectionTitle"><div><h3>Your wall of wins 🎉</h3><p>Finished projects, all in one place. Open a project to review its work or reopen it from Project admin.</p></div></div>{completed.length?cards(completed):<div className="empty"><span>🏆</span><h3>Your next win belongs here</h3><p>Projects move here automatically when every task is complete. The project admin can reopen a project from Project admin.</p></div>}</section>;
  if(view==='Dashboard')return <section aria-label="Workspace dashboard">{!projects.length&&<p className="overviewDemo">You’re exploring the example project. Create a project to track your team’s work.</p>}<div className="stats dashboardStats"><Metric label="Active projects" value={visible.length}/><Metric label="Open tasks" value={pending.length}/><Metric label="Overdue tasks" value={pending.filter(({task})=>task.date<today).length}/><Metric label="Completed projects" value={completed.length}/></div><div className="sectionTitle"><div><h3>Next small wins</h3><p>Upcoming tasks across your active projects, with overdue work first.</p></div></div>{pending.length?<div className="taskList">{pending.slice(0,8).map(({task,project})=><div className="overviewTask" key={project.id+task.id}><button className="overviewProject" onClick={()=>onSelect(project.id)}>{project.emoji} {project.title}</button>{renderTask(task,project)}</div>)}</div>:<div className="empty"><span>✨</span><h3>All caught up</h3><p>No open tasks. Completed projects are waiting on your wall of wins.</p></div>}<div className="sectionTitle"><div><h3>Projects in motion</h3><p>Pick up where your team left off.</p></div></div>{cards(visible)}</section>;
  return <TeamCalendar projects={projects} sample={sample} user={user} onSelect={onSelect} renderTask={renderTask} onProject={onProject} onNotifications={onNotifications} focus={meetingFocus} onFocusClear={onMeetingFocusClear}/>;
}
function Metric({label,value}:{label:string;value:number}){return <div className="stat"><div><small>{label}</small><b>{value}</b></div></div>}
export function TaskConfetti({burst}:{burst:number}){
  const [visible,setVisible]=useState(false);
  useEffect(()=>{if(!burst)return;setVisible(true);const timer=setTimeout(()=>setVisible(false),2200);return()=>clearTimeout(timer)},[burst]);
  if(!visible)return null;
  return <><span className="celebrationMessage" role="status">Task complete. One more small win! 🎉</span><div key={burst} className="taskConfetti" aria-hidden="true">{Array.from({length:54},(_,i)=><i key={i} style={{left:`${(i*37)%100}%`,background:['#8762ce','#edb84e','#458f7c','#dd83b2','#4e82c4'][i%5],animationDelay:`${(i%9)*35}ms`,'--drift':`${(i%2?1:-1)*(40+i%110)}px`,'--spin':`${(i%2?1:-1)*720}deg`} as React.CSSProperties}/>)}</div></>;
}
