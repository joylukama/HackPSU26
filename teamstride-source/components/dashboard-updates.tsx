'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Bell,Sparkles,X,Check} from 'lucide-react';
import type {Project,Identity} from '../lib/model';
import {catchUpProjects,freshNotifications,type AwayWindow} from '../lib/notification-updates';
import type {TeamNotification} from './team-tools';
type Toast=TeamNotification & {expires:number};
export function useNotificationUpdates(user:Identity|null,items:TeamNotification[],loading:boolean){
 const [away,setAway]=useState<AwayWindow>({since:null,until:''}),[toasts,setToasts]=useState<Toast[]>([]);
 const seen=useRef(new Set<string>()),initialized=useRef(false),activeSince=useRef(Date.now());
 useEffect(()=>{
  setToasts([]);seen.current.clear();initialized.current=false;if(!user){setAway({since:null,until:''});return}
  const key='teamstride-last-active:'+user.userId;let last:number|null=null;
  try{const value=Number(localStorage.getItem(key));if(value>0&&value<Date.now())last=value}catch{}
  const now=Date.now();setAway({since:last?new Date(last).toISOString():null,until:new Date(now).toISOString()});activeSince.current=now;
  let hiddenAt=document.visibilityState==='hidden'?now:null;
  const mark=()=>{if(document.visibilityState==='visible')try{localStorage.setItem(key,String(Date.now()))}catch{}};
  const visibility=()=>{if(document.visibilityState==='hidden'){hiddenAt=Date.now();setToasts([])}else{const now=Date.now();if(hiddenAt&&now-hiddenAt>=10000)setAway({since:new Date(hiddenAt).toISOString(),until:new Date(now).toISOString()});hiddenAt=null;activeSince.current=now;mark()}};
  mark();const timer=setInterval(mark,10000);document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',mark);
  return()=>{mark();clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',mark)};
 },[user?.userId]);
 useEffect(()=>{
  if(!user||loading)return;
  if(!initialized.current){items.forEach(item=>seen.current.add(item.id));initialized.current=true;return}
  const fresh=freshNotifications(items,seen.current,activeSince.current);items.forEach(item=>seen.current.add(item.id));if(seen.current.size>1000)seen.current=new Set([...seen.current].slice(-600));
  if(document.visibilityState==='visible'&&fresh.length)setToasts(current=>[...fresh.slice(0,3).map(item=>({...item,expires:Date.now()+10000})),...current].slice(0,3));
 },[items,user?.userId,loading]);
 useEffect(()=>{if(!toasts.length)return;const timer=setInterval(()=>setToasts(current=>current.filter(item=>item.expires>Date.now())),1000);return()=>clearInterval(timer)},[toasts.length]);
 return {away,toasts,dismiss:(id:string)=>setToasts(current=>current.filter(item=>item.id!==id))};
}
export function NotificationPopups({items,onOpen,onDismiss}:{items:Toast[];onOpen:(item:TeamNotification)=>void;onDismiss:(id:string)=>void}){
 if(!items.length)return null;
 return createPortal(<div className="notificationToasts" aria-label="New team updates" aria-live="polite">{items.map(item=><section key={item.id} className="notificationToast"><Bell size={18}/><button className="toastOpen" onClick={()=>{onOpen(item);onDismiss(item.id)}}><b>{item.projectTitle}</b><span>{item.text}</span><small>View update</small></button><button className="toastDismiss" aria-label="Dismiss notification popup" onClick={()=>onDismiss(item.id)}><X size={17}/></button></section>)}</div>,document.body);
}
const summaryCache=new Map<string,string>();
export function DashboardUpdates({items,projects,user,away,onRead,onOpen}:{items:TeamNotification[];projects:Project[];user:Identity|null;away:AwayWindow;onRead:(ids:string[])=>Promise<void>;onOpen:(item:TeamNotification)=>void}){
 const [summary,setSummary]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[showAll,setShowAll]=useState(false);
 const unread=items.filter(item=>!item.read);const shown=(showAll?items:unread).slice(0,10);
 const missed=user&&away.since?catchUpProjects(projects,user,Date.parse(away.since),Date.parse(away.until)):[];
 const key=user?.userId+':'+away.since+':'+away.until+':'+missed.map(project=>project.id).join(',');
 useEffect(()=>{
  setSummary('');setError('');setBusy(false);if(!user||!away.since||!missed.length)return;
  const cached=summaryCache.get(key);if(cached){setSummary(cached);return}let active=true;const controller=new AbortController();setBusy(true);
  fetch('/api/catch-up',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({since:away.since,until:away.until}),signal:controller.signal}).then(async response=>{const data=await response.json() as {text?:string;error?:string};if(!response.ok)throw Error(data.error||'Summary unavailable.');if(active){summaryCache.set(key,data.text||'');if(summaryCache.size>10)summaryCache.delete(summaryCache.keys().next().value!);setSummary(data.text||'')}}).catch(error=>{if(active)setError((error as Error).message)}).finally(()=>{if(active)setBusy(false)});
  return()=>{active=false;controller.abort()};
 },[key,attempt]);
 if(!user)return null;
 return <section className="panel dashboardUpdates" aria-label="While you were gone"><div className="sectionTitle"><div><span className="eyebrow">YOUR TEAM, CAUGHT UP</span><h3><Bell size={19}/> While you were gone</h3><p>{unread.length?`${unread.length} unread team update${unread.length===1?'':'s'}.`:'You’re all caught up.'}</p></div>{unread.length>0&&<button className="textbutton" onClick={()=>onRead(unread.map(item=>item.id))}><Check size={14}/> Mark all as read</button>}</div><div className="catchUpSummary"><h4><Sparkles size={16}/> Your AI catch-up</h4>{busy?<p role="status">Summarizing progress while you were away…</p>:summary?<div className="catchUpText">{summary}</div>:error?<><p role="status">{error}</p><button className="textbutton" onClick={()=>setAttempt(value=>value+1)}>Retry summary</button></>:<p>{!projects.length?'Join a project to see team updates and AI catch-ups.':!away.since?'On your next visit, AI can summarize recorded progress since this browser was last active.':!projects.some(project=>project.aiEnabled!==false)?'AI is disabled for your projects. Your notifications are still available.':'No new progress updates from AI-enabled projects were recorded while you were away.'}</p>}<small>Based on retained updates from AI-enabled projects, up to the last 30 days. Check tasks for the latest details.</small></div><div className="dashboardNotificationTabs"><button className={!showAll?'active':''} onClick={()=>setShowAll(false)}>Unread ({unread.length})</button><button className={showAll?'active':''} onClick={()=>setShowAll(true)}>Recent updates</button></div><div className="dashboardNotificationItems">{!shown.length?<p className="hint">{showAll?'Team updates will appear here.':'No unread updates. Take a little breathing room.'}</p>:shown.map(item=><article key={item.id} className={item.read?'':'unread'}><button onClick={()=>onOpen(item)}><small>{item.projectTitle}</small><p>{item.text}</p><time>{new Date(item.at).toLocaleString()}</time></button>{!item.read&&<button className="textbutton" onClick={()=>onRead([item.id])}>Mark read</button>}</article>)}</div></section>;
}
