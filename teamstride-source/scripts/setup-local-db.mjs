import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Idempotent setup for the two initial tables; never modifies remote storage.
const root=fileURLToPath(new URL('../',import.meta.url));
const result=spawnSync(process.execPath,[
  '--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js',
  'd1','execute','DB','--local','--config','dist/server/wrangler.json',
  '--persist-to','.wrangler/state','--command',
  `CREATE TABLE IF NOT EXISTS projects (id text PRIMARY KEY NOT NULL, data text NOT NULL); CREATE TABLE IF NOT EXISTS profiles (id text PRIMARY KEY NOT NULL, data text NOT NULL); CREATE TABLE IF NOT EXISTS project_messages (id text PRIMARY KEY NOT NULL, project_id text NOT NULL, author_user_id text NOT NULL, author_name text NOT NULL, role text DEFAULT 'user' NOT NULL, body text NOT NULL, created_at text NOT NULL); CREATE TABLE IF NOT EXISTS coach_messages (id text PRIMARY KEY NOT NULL, project_id text NOT NULL, member_id text NOT NULL, author_user_id text NOT NULL, author_name text NOT NULL, role text NOT NULL, body text NOT NULL, created_at text NOT NULL);`,
],{cwd:root,stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
