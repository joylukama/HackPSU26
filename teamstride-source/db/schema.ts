import { sqliteTable, text } from "drizzle-orm/sqlite-core";
export const projects = sqliteTable("projects", { id: text("id").primaryKey(), data: text("data").notNull() });
export const profiles = sqliteTable("profiles", { id: text("id").primaryKey(), data: text("data").notNull() });
