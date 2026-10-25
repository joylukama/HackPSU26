import {identity,failure} from '../../../lib/server';
export async function POST(){try{await identity();return Response.json({error:'Email invitations have been removed. Share a project invite code or link.'},{status:410})}catch(error){return failure(error)}}
