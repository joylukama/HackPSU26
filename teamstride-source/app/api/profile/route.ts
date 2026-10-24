import {z} from 'zod';
import {identity,db,failure} from '../../../lib/server';

export async function GET(){
  try{
    const user=await identity();
    const row=await db().prepare('SELECT data FROM profiles WHERE id=?').bind(user.userId).first<{data:string}>();
    return Response.json(row?JSON.parse(row.data):{name:user.fullName||'Teammate',bio:'Making big ideas happen, one small win at a time.',emoji:'🌟'},{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){return failure(error)}
}
export async function PUT(req:Request){
  try{
    const user=await identity();
    const profile=z.object({name:z.string().trim().min(1).max(60),bio:z.string().max(300),emoji:z.string().min(1).max(12),notes:z.string().max(10000).optional()}).parse(await req.json());
    // Profile edits preserve notes already saved independently by PATCH.
    await db().prepare("INSERT INTO profiles(id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=json_set(excluded.data, '$.notes', COALESCE(json_extract(profiles.data, '$.notes'),json_extract(excluded.data, '$.notes'),''), '$.notificationReads', json(COALESCE(json_extract(profiles.data, '$.notificationReads'),'[]')))").bind(user.userId,JSON.stringify(profile)).run();
    return GET();
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({error:'Check your profile details.'},{status:400});
    return failure(error);
  }
}
// Save notes independently so a stale profile form cannot overwrite them.
export async function PATCH(req:Request){
  try{
    const user=await identity();
    const {notes}=z.object({notes:z.string().max(10000)}).parse(await req.json());
    const fallback=JSON.stringify({name:user.fullName||'Teammate',bio:'Making big ideas happen, one small win at a time.',emoji:'🌟'});
    await db().prepare("INSERT INTO profiles(id,data) VALUES (?,json_set(?, '$.notes', ?)) ON CONFLICT(id) DO UPDATE SET data=json_set(profiles.data, '$.notes', ?)").bind(user.userId,fallback,notes,notes).run();
    return GET();
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({error:'Notes must be no longer than 10,000 characters.'},{status:400});
    return failure(error);
  }
}
