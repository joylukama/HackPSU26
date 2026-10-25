// Chat roles and author identities are assigned by the server. Provider failures
// preserve human messages; Claude replies use the same shared history schema.
export const projectChatAI={status:'not_configured',message:'AI replies are not connected yet. Messages are saved and shared with your project team.'} as const;
export type ProjectChatMessage={id:string;sequence:number;authorUserId:string;authorName:string;role:'user'|'assistant';body:string;createdAt:string};
