'use client';
import {useEffect,useState} from 'react';
import {Download,X} from 'lucide-react';
type InstallPrompt=Event & {prompt:()=>Promise<void>;userChoice:Promise<{outcome:'accepted'|'dismissed'}>};
export function PwaInstall(){
 const [prompt,setPrompt]=useState<InstallPrompt|null>(null),[standalone,setStandalone]=useState(false),[help,setHelp]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{
  const media=window.matchMedia('(display-mode: standalone)');const sync=()=>setStandalone(media.matches||!!(navigator as Navigator & {standalone?:boolean}).standalone);
  const capture=(event:Event)=>{event.preventDefault();setPrompt(event as InstallPrompt)};const installed=()=>{setStandalone(true);setPrompt(null);setHelp(false)};
  sync();window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',installed);media.addEventListener('change',sync);
  return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',installed);media.removeEventListener('change',sync)};
 },[]);
 async function install(){if(!prompt){setHelp(value=>!value);return}setBusy(true);setNotice('');try{await prompt.prompt();const choice=await prompt.userChoice;if(choice.outcome==='accepted')setNotice('Installation requested. Look for Teamstride on your home screen or in your apps.')}catch{setHelp(true)}finally{setPrompt(null);setBusy(false)}}
 if(standalone)return null;
 return <div className="pwaInstall"><button className="secondary" disabled={busy} aria-expanded={help} aria-controls={help?'pwa-install-help':undefined} onClick={install}><Download size={16}/>{busy?'Opening installer…':'Install Teamstride'}</button>{notice&&<p className="hint" role="status">{notice}</p>}{help&&<section className="pwaInstallHelp" id="pwa-install-help" aria-label="Install Teamstride instructions"><div><h3>Take your team with you</h3><button className="iconbtn" aria-label="Close install instructions" onClick={()=>setHelp(false)}><X size={17}/></button></div><p>Open <a href="https://www.teamstride.work">www.teamstride.work</a> in your phone’s browser.</p><ul><li><b>iPhone / iPad:</b> In Safari, open Share, choose Add to Home Screen, then Add. Keep Open as Web App enabled if shown.</li><li><b>Android:</b> In Chrome, open the browser menu and choose Install app or Add to Home screen.</li><li><b>Computer:</b> Use the browser’s install icon or app-install menu when available.</li></ul><p className="hint">Tasks, team chat, and AI need an internet connection. Continue signing in with ChatGPT as usual. Reopen the app to receive published updates.</p></section>}</div>;
}
