// Shared chat persistence is independent of an AI provider. A future server-side
// adapter can return assistant messages using the same schema; clients must never
// supply trusted assistant roles or credentials. No model is called in this version.
export const projectChatAI={status:'not_configured',message:'AI replies are not connected yet. Messages are saved and shared with your project team.'} as const;
export type ProjectChatMessage={id:string;sequence:number;authorUserId:string;authorName:string;role:'user'|'assistant';body:string;createdAt:string};
