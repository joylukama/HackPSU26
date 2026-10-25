import {db,HttpError} from './server';
const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalizeInviteCode=(value:string)=>value.replace(/[\s-]/g,'').toUpperCase();
export async function newInviteCode(){
 for(let attempt=0;attempt<10;attempt++){
  const code=Array.from(crypto.getRandomValues(new Uint8Array(6)),byte=>alphabet[byte%alphabet.length]).join('');
  const existing=await db().prepare("SELECT id FROM projects WHERE json_extract(data,'$.inviteCode')=?").bind(code).first();
  if(!existing)return code;
 }
 throw new HttpError(503,'Could not create a unique invite code. Please try again.');
}
