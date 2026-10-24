import {z} from 'zod';
import {identity,load,admin,failure,HttpError} from '../../../lib/server';
import {sendProjectInvitations} from '../../../lib/invitations';

export async function POST(request:Request){
  try{
    const user=await identity();
    const {projectId}=z.object({projectId:z.string().min(1).max(100)}).parse(await request.json());
    const {project}=await load(projectId);
    if(!admin(project,user))throw new HttpError(403,'Only the project creator can send invitation emails.');
    return Response.json(await sendProjectInvitations(project),{headers:{'Cache-Control':'private, no-store'}});
  }catch(error){
    if(error instanceof z.ZodError)return Response.json({error:'Choose a valid project.'},{status:400});
    return failure(error);
  }
}
