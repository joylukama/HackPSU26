import {getChatGPTUser} from '../../chatgpt-auth';

// Account state must remain available even if workspace storage is unavailable.
export async function GET(){
  const user=await getChatGPTUser();
  return Response.json({user:user?{userId:user.userId,email:user.email.toLowerCase(),displayName:user.displayName}:null},{headers:{'Cache-Control':'private, no-store'}});
}
