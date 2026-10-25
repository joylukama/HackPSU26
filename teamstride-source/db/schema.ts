import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const projects = sqliteTable("projects", { id: text("id").primaryKey(), data: text("data").notNull() });
export const profiles = sqliteTable("profiles", { id: text("id").primaryKey(), data: text("data").notNull() });

export const projectMessages = sqliteTable("project_messages", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  authorUserId: text("author_user_id").notNull(),
  authorName: text("author_name").notNull(),
  role: text("role").notNull().default("user"),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});
