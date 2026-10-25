export type Member={id:string;name:string;email:string;userId?:string;status:'active'|'pending'|'left'};
export type Comment={id:string;author:string;text:string;at:string};
export type Task={assignmentFile?:string;assignmentRequirement?:string;id:string;title:string;detail:string;assignees:string[];phase:number;date:string;done:boolean;comments:Comment[];estimatedMinutes?:number;help?:{byUserId:string;byName:string;message:string;at:string}};
export type ProgressReport={text:string;generatedAt:string;generatedBy:string;revision:number};
export type Project={progressReport?:ProgressReport;aiEnabled?:boolean;inviteCode?:string;id:string;title:string;brief:string;members:Member[];start:string;end:string;tasks:Task[];creatorId:string;creatorEmail:string;theme:string;emoji:string;status:'active'|'completed';revision:number;reopened?:boolean;activities?:Activity[];swaps?:TaskSwap[];materials?:ProjectMaterial[];deletedAt?:string;deletedBy?:string;meetings?:ProjectMeeting[]};
export type ProjectMaterial={planningTaskCount?:number;planningStatus?:string;id:string;key:string;name:string;size:number;mime:string;taskId?:string;uploadedBy:string;uploadedByName:string;uploadedAt:string};
export type Activity={id:string;kind:'reminder'|'membership'|'assignment'|'completed'|'help'|'swap'|'schedule'|'material'|'meeting';actorUserId:string;actorName:string;text:string;taskId?:string;at:string;meetingId?:string;recipientMemberIds?:string[]};
export type TaskSwap={id:string;fromTaskId:string;toTaskId:string;fromMemberId:string;toMemberId:string;requestedBy:string;status:'pending'|'accepted'|'declined'|'cancelled';createdAt:string};
export type Profile={name:string;bio:string;emoji:string;notes?:string};
export type Identity={userId:string;email:string;displayName:string};
export const phases=['Discover','Create','Refine','Deliver'];
export const themes=[{id:'lilac',name:'Lilac dreams',color:'#7954cf',pale:'#f0e8ff'},{id:'peach',name:'Peach party',color:'#c66142',pale:'#ffebe1'},{id:'mint',name:'Mint condition',color:'#267969',pale:'#e0f4e8'},{id:'sky',name:'Blue skies',color:'#3d70b7',pale:'#e6f0ff'},{id:'pink',name:'Pink lemonade',color:'#b44982',pale:'#ffe6f2'}];
export const uid=()=>typeof crypto.randomUUID==='function'?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
export function createPlan(title:string,brief:string,members:Member[],start:string,end:string):Task[]{
const text=(title+' '+brief).toLowerCase();
const subject=title.trim().slice(0,80);
let steps:[string,string,number][];
if(/presentation|slides|teach|lesson|organelle/.test(text))steps=[
['Define the audience and learning goals','List what the audience should understand by the end and choose an age-appropriate depth.',0],
['Research the key concepts','Collect reliable explanations, examples, and source links for the subject.',0],
['Outline the story and slide sequence','Draft an opening hook, the main sections, and a concise takeaway.',0],
['Draft the slide content','Write short slide copy and speaker notes for each main concept.',1],
['Create diagrams and visual examples','Make labeled diagrams, illustrations, or comparisons that explain the subject clearly.',1],
['Build an audience activity','Create a short quiz, demonstration, or exercise to check understanding.',1],
['Review accuracy as a team','Check every explanation and visual against the sources and learning goals.',2],
['Rehearse and refine the delivery','Time a full run-through and simplify confusing sections based on feedback.',2],
['Finalize slides and speaker handoffs','Export the final deck, add source credits, and agree on speaking roles.',3],
['Deliver the presentation and gather feedback','Present to the intended audience and record what they learned.',3]];
else if(/website|software|platform|\bapp\b|code|dashboard/.test(text))steps=[
['Map users and core requirements','Define the primary user journey and acceptance criteria for the requested features.',0],
['Sketch screens and data flow','Wireframe the key screens and identify the data each feature needs.',0],
['Set up the application and data model','Configure the project, shared components, and storage needed by the brief.',0],
['Build the main user journey','Implement the primary workflow from entry to a successful outcome.',1],
['Implement supporting features','Build the secondary requirements in the brief and connect them to the main workflow.',1],
['Connect data and handle errors','Add persistence, validation, empty states, and permission checks.',1],
['Test the complete experience together','Run acceptance checks for each requirement, including failure paths.',2],
['Polish accessibility and responsive layouts','Check keyboard use, readable contrast, and small-screen behavior.',2],
['Prepare deployment and usage notes','Build the release, configure hosting, and document setup and limitations.',3],
['Launch and verify the release','Publish the application and verify the core journey in the deployed version.',3]];
else if(/event|workshop|conference|fundrais|party/.test(text))steps=[
['Define the event audience and outcomes','Agree on the intended audience, format, success measures, and budget.',0],
['Confirm venue, date, and resources','Check availability, capacity, accessibility, and the equipment needed.',0],
['Build the agenda and responsibility list','Plan the schedule and assign each operational responsibility.',0],
['Create invitations and registration','Prepare event information and a way for attendees to register.',1],
['Coordinate speakers, supplies, and logistics','Confirm contributors, materials, equipment, and day-of arrangements.',1],
['Promote the event to the audience','Publish the invitation and track registration against capacity.',1],
['Review readiness as a team','Walk through the attendee experience and resolve missing arrangements.',2],
['Prepare contingencies and a run sheet','Document timing, contacts, backup plans, and who handles each issue.',2],
['Deliver the event','Run the agenda and track attendance and participant questions.',3],
['Collect feedback and close out','Summarize outcomes, thank contributors, and reconcile outstanding work.',3]];
else if(/research|experiment|study|report|essay/.test(text))steps=[
['Frame the research question','Define a focused question, scope, and evidence needed to answer it.',0],
['Find and evaluate sources','Collect credible sources and note their relevance and limitations.',0],
['Choose the method and outline','Agree on an analysis method and structure for the final deliverable.',0],
['Gather evidence and record findings','Collect observations, data, or quotations with traceable source notes.',1],
['Analyze the evidence','Compare findings, identify patterns, and record uncertainties.',1],
['Draft the argument and results','Write the main sections with evidence supporting each claim.',1],
['Review reasoning and evidence together','Check whether the findings answer the question and identify gaps.',2],
['Revise and verify citations','Resolve feedback, verify claims, and format references consistently.',2],
['Prepare the final report','Assemble the final document, figures, methods, and references.',3],
['Submit and share the findings','Deliver the report and summarize conclusions and limitations.',3]];
else if(/campaign|sustainab|awareness|market|launch/.test(text))steps=[
['Define the audience and campaign goal','Specify the behavior or outcome the campaign should influence.',0],
['Research audience needs and examples','Gather relevant audience insights and examples of similar campaigns.',0],
['Choose messages, channels, and measures','Agree on the core message, distribution channels, and success measures.',0],
['Draft the campaign materials','Write the messages and calls to action for the intended audience.',1],
['Design the visual assets','Create visuals and supporting materials that fit the campaign message.',1],
['Prepare the launch plan','Coordinate distribution, team responsibilities, and the campaign schedule.',1],
['Review the campaign together','Check clarity, accuracy, audience fit, and the call to action.',2],
['Pilot the materials and refine','Gather feedback from a small audience and revise weak points.',2],
['Launch the campaign','Publish the prepared materials through the chosen channels.',3],
['Measure impact and share results','Compare outcomes with the goals and document lessons learned.',3]];
else steps=[
['Define the specific deliverables','Turn the brief into a checklist of concrete outputs and acceptance criteria.',0],
['Gather inputs and examples','Collect the information, materials, and references required by the brief.',0],
['Outline the deliverable and roles','Agree on the structure of the final result and who owns each part.',0],
['Produce the first deliverable draft','Create a rough version of the main output described in the brief.',1],
['Develop the supporting pieces','Produce the evidence, visuals, or materials the main output depends on.',1],
['Assemble a complete working version','Combine the pieces into a version the team can review end to end.',1],
['Review against the brief together','Evaluate each requirement and record concrete changes.',2],
['Resolve feedback and check quality','Fix the review findings and verify the acceptance criteria.',2],
['Prepare the final delivery','Organize the completed work, references, and handoff instructions.',3],
['Deliver and confirm the outcome','Submit the final work and confirm that the intended outcome was reached.',3]];
if(/cell|organelle/.test(text)&&/presentation|teach|lesson|organelle/.test(text)){
 steps[1]=['Research organelles and their roles','Explain the nucleus, membrane, cytoplasm, mitochondria, and other relevant organelles using age-appropriate sources.',0];
 steps[4]=['Draw and label a cell diagram','Create a clear cell diagram, label the organelles, and pair each with a memorable function or analogy.',1];
 steps[5]=['Create an organelle matching quiz','Design a short matching or labeling activity so the audience can connect each organelle to its job.',1];
}
const requirements=brief.split(/[\n.;]+/).map(v=>v.trim()).filter(Boolean).slice(0,8);
return steps.map(([name,detail,phase],i)=>{
 const date=new Date(start+'T12:00:00Z');const duration=(Date.parse(end+'T12:00:00Z')-date.getTime())/86400000;
 date.setUTCDate(date.getUTCDate()+Math.round(duration*(i+1)/steps.length));
 return {id:uid(),title:(name+' — '+subject).slice(0,180),detail:(detail+'\nProject: '+title+'\nBrief: '+brief+(requirements.length?'\nFocus: '+requirements[i%requirements.length]:'')).slice(0,4000),assignees:i===6?members.map(m=>m.id):[members[i%members.length].id],phase,estimatedMinutes:estimateTaskMinutes({title:name,detail,phase}),date:date.toISOString().slice(0,10),done:false,comments:[]};
});
}

export const dayKey=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const addDays=(date:string,days:number)=>new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
export function projectSchedule(project:Project,asOf=dayKey()){
 const pending=project.status==='completed'?[]:project.tasks.filter(task=>!task.done);
 const overdue=pending.filter(task=>task.date<asOf);
 const oldest=overdue.map(task=>task.date).sort()[0];
 const shift=oldest?Math.round((Date.parse(asOf+'T12:00:00Z')-Date.parse(oldest+'T12:00:00Z'))/86400000):0;
 const forecasts=Object.fromEntries(project.tasks.map(task=>[task.id,task.done?task.date:addDays(task.date,shift)]));
 const projectedEnd=pending.map(task=>forecasts[task.id]).sort().at(-1)||project.end;
 const help=pending.filter(task=>task.help);
 return {overdue,shift,forecasts,projectedEnd,help,atRisk:overdue.length>0||help.length>0||projectedEnd>project.end,beyondDeadline:projectedEnd>project.end};
}
export const progress=(p:Project)=>p.tasks.length?Math.round(p.tasks.filter(t=>t.done).length/p.tasks.length*100):0;

export function estimateTaskMinutes(task:{title:string;detail?:string;phase?:number}){
 const text=(task.title+' '+(task.detail||'')).toLowerCase();
 if(/quiz|outline|checklist|goal|audience|handoff|submit|confirm|deliver the presentation/.test(text))return 45;
 if(/build|implement|application|prototype|analy[sz]|research|experiment/.test(text))return 120;
 if(/draft|write|diagram|design|slides|visual|content|rehearse/.test(text))return 90;
 if(/review|test|polish|verify|feedback/.test(text))return 60;
 return [45,90,60,45][task.phase??0]||60;
}
export function formatEstimate(minutes:number){const hours=Math.floor(minutes/60),rest=minutes%60;return hours?`${hours}h${rest?` ${rest}m`:''}`:`${minutes}m`}

export type ProjectMeeting={id:string;title:string;startAt:string;endAt:string;timeZone:string;organizerId:string;organizerName:string;inviteeIds:string[];responses:Record<string,'pending'|'accepted'|'declined'>;location:string;joinUrl:string;notes:string;status:'scheduled'|'cancelled'};
export type TaskReminder={projectId:string;taskId:string;daysBefore:number;time:string;timeZone:string};
export function reminderIsDue(task:Task,reminder:TaskReminder,now=new Date()){
 if(task.done)return false;
 try{const parts=new Intl.DateTimeFormat('en-CA',{timeZone:reminder.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);const value=(type:string)=>parts.find(part=>part.type===type)?.value||'';const date=`${value('year')}-${value('month')}-${value('day')}`;const time=`${value('hour')}:${value('minute')}`;const target=addDays(task.date,-reminder.daysBefore);return date>target||date===target&&time>=reminder.time}catch{return false}
}
