'use client';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import type {AssignmentSource} from './assignment-plan';
export const readableAssignment=(file:File)=>/\.(txt|md|csv|pdf|docx)$/i.test(file.name)||file.type.startsWith('text/');
export async function readAssignmentFile(file:File):Promise<AssignmentSource>{
 if(file.size===0||file.size>10*1024*1024)throw Error('Choose a non-empty assignment of 10 MB or smaller.');
 let text='';
 if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc=pdfWorkerUrl;
  const loading=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true});
  try{const document=await loading.promise;if(document.numPages>40)throw Error('Use an assignment PDF of 40 pages or fewer.');for(let page=1;page<=document.numPages;page++){const content=await (await document.getPage(page)).getTextContent();text+=content.items.map(item=>'str' in item?item.str+('hasEOL' in item&&item.hasEOL?'\n':' '):'').join('')+'\n';if(text.length>20000)throw Error('The assignment contains too much text. Upload a shorter assignment or paste its key requirements into the brief.')}}finally{await loading.destroy()}
 }else if(/\.docx$/i.test(file.name)){
  const {unzipSync,strFromU8}=await import('fflate');const files=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>entry.name==='word/document.xml'&&entry.originalSize<=2*1024*1024});const xml=files['word/document.xml'];if(!xml)throw Error('This Word file could not be read. Use a DOCX file or export it as a text-based PDF.');
  const document=new DOMParser().parseFromString(strFromU8(xml),'application/xml');if(document.querySelector('parsererror'))throw Error('This Word document could not be read.');text=Array.from(document.getElementsByTagNameNS('*','p')).map(paragraph=>Array.from(paragraph.getElementsByTagNameNS('*','t')).map(node=>node.textContent||'').join('')).join('\n');
 }else if(readableAssignment(file))text=await file.text();else throw Error('Task planning supports text-based PDF, DOCX, TXT, Markdown, and CSV assignments.');
 text=text.replace(/\u0000/g,'').trim();if(text.length<12)throw Error('No readable assignment text was found. For scanned images/PDFs, paste the assignment requirements into the project brief.');if(text.length>20000)throw Error('Use a shorter assignment (up to 20,000 text characters) or paste key requirements into the brief.');
 return {fileName:file.name.slice(0,200),text};
}
export async function readAssignmentFiles(files:File[]){
 const readable=files.filter(readableAssignment);if(readable.length>10)throw Error('Use up to 10 assignment documents when creating a plan.');const sources:AssignmentSource[]=[];for(const file of readable){try{sources.push(await readAssignmentFile(file))}catch(error){throw Error(`${file.name}: ${(error as Error).message}`)}}if(sources.reduce((sum,source)=>sum+source.text.length,0)>60000)throw Error('Assignment documents can contain up to 60,000 text characters in total.');return sources;
}
