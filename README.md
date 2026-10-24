# Teamstride

**Make progress, together.**

Teamstride is a collaborative project workspace built for HackPSU. It helps teams turn an idea into a plan, share responsibilities, and track small wins along the way.

## Features

- Create projects with a brief, team members, and a timeline.
- Organize tasks across four phases: Discover, Create, Refine, and Deliver.
- Assign tasks to individual teammates or share them across the team.
- Track completion, deadlines, and overall project progress.
- Discuss tasks and view personal and group workspaces.
- Use built-in task coaching for guidance on next steps. Coaching uses the OpenAI API when a server API key is configured.
- Explore an example project before signing in.

## Tech stack

- React and TypeScript
- Vinext and Vite, using the Next.js App Router structure
- Tailwind CSS and shadcn/ui components
- Cloudflare Workers and D1
- Drizzle ORM

## Run locally

Install Node.js **22.13.0 or newer**, then run:

```sh
git clone https://github.com/joylukama/HackPSU26.git
cd HackPSU26/teamstride-source
npm install --legacy-peer-deps
npm run dev
```

Open **http://localhost:5173** in your browser. If that port is occupied, use the address printed in the terminal.

### Local sign-in

In portable local development, open:

```text
http://localhost:5173/signin-with-chatgpt?return_to=/
```

This uses the simulated development identity `seedy@sites.test`. Hosted sign-in is provided by the Sites hosting platform.

### Local database setup

To use saved projects and profiles, build the app and apply the included migrations to the local D1 database:

```sh
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_yummy_wendell_vaughn.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_confused_thundra.sql
```

Run these from `teamstride-source/` and apply each migration only once per local database. Restart the development server after setup.

## Project structure

```text
teamstride-source/
├── app/          Pages, layouts, and API routes
├── components/   Shared interface components
├── db/           Database connection and schema
├── drizzle/      Database migrations
├── lib/          Project models, helpers, and server logic
├── public/       Static assets
├── scripts/      Development and build tooling
└── worker/       Cloudflare Worker entry point
```

## Commands

Run these from `teamstride-source/`:

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm start` | Preview the built Worker locally |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate migrations after schema changes |

Local environment files, dependencies, generated builds, and runtime files are excluded from Git. See the [source documentation](teamstride-source/README.md) for additional hosting and authentication details.

## AI task coaches

Task coaches use the OpenAI Responses API with the selected teammate’s assignments and the current conversation. Configure the server locally by creating `teamstride-source/.dev.vars`:

```dotenv
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4.1-mini
```

Restart `npm run dev` after adding the key. Never commit `.dev.vars` or expose the key through a `NEXT_PUBLIC_` variable. For a hosted deployment, configure the same values as server environment variables/secrets. Without a key, the coach shows a configuration message instead of a scripted reply. Private brain-dump notes and teammate email addresses are not included in coach context.

If local sign-in succeeds but workspace data cannot load, run `npm run build` followed by `npm run db:setup` from `teamstride-source/`. The setup command creates missing local tables without deleting existing records.

## Project invitations by email

When creating a project, enter each teammate’s name and account email. Their invitation is saved with the project, and the server attempts to email a join link automatically. Teammates sign in with their invited email and choose **Join project**. Existing private-site access requirements still apply.

Configure these server values in `.dev.vars` locally, or as environment variables/secrets on your host:

```dotenv
RESEND_API_KEY=your-resend-api-key
INVITE_FROM_EMAIL=Teamstride <no-reply@your-verified-domain.com>
PUBLIC_SITE_URL=https://your-published-teamstride-site.com
```

A no-reply sender works; it does not need a monitored inbox. Its domain must be verified with the email provider. Invitations require a public HTTPS site URL, since teammates cannot open your computer’s localhost address. The implementation uses [Resend’s email API](https://resend.com/docs/api-reference/emails/send-email).

If sending fails or configuration is missing, the project and invitations remain saved. Configure the sender and use **Send pending invitation emails** in Project admin to retry. Retry requests use idempotency keys to reduce duplicate emails. “Queued” confirms the email provider accepted the request, rather than guaranteeing inbox delivery.

Projects move into **Completed projects** automatically when their last task is checked off. Admins can reopen them to make changes. Switching projects in the sidebar or mobile project picker keeps the current workspace tab.

## Workspace and teamwork tools

The main menu is **My dashboard → Projects → Calendar → Profile**. My dashboard contains personal tasks and private notes. Projects contains a selector and the selected project’s dashboard, timeline, team, and admin tools. Profile includes completed projects.

New projects receive a built-in task plan based on their title and brief, with different plans for presentations, software, events, research, campaigns, and other deliverables. Existing project tasks are preserved.

Open a task to flag a blocker and ask the team for help, or offer a task swap. Swaps apply only to unfinished tasks with a single assignee and require the receiving teammate to accept. Assignments change together in one saved project update; completed or reassigned tasks invalidate pending requests.

The notification center shows other teammates’ task completions, help requests, swaps, and deadline risks. Updates refresh every 15 seconds while the app is open. Read markers are private to the signed-in account.

When an unfinished task misses its deadline, the timeline shifts its recovery forecast and the remaining schedule while retaining the original deadlines. The project shows a warning if the projected finish exceeds its deadline. Forecasts are estimates, not changes to the agreed dates.

System settings provide **Light**, **Dark**, and **System** appearance plus reduced animations. These preferences are saved on the current device; system follows the operating system’s theme.

## Project materials, deletion, and estimates

- Choose project materials in the creation form, or upload later from **Projects → Materials** or an individual task. Joined teammates can download shared files. Uploads can be general project materials or linked to one task; the uploader or project creator can change that assignment.
- Files are stored privately in the Site’s R2 bucket (`BUCKET`). Downloads check project membership. Each file must be non-empty and no larger than 10 MB, with up to 100 files per project. Files are downloaded as attachments rather than executed in the Site.
- Uploads begin after the project is saved. If any fail, the project is retained and the page offers a retry for the failed files.
- **Projects → Project admin → Delete project** moves a project to Trash after confirming its name. Only the creator can delete or restore it. Restore from **Profile → Deleted projects**. Trashed projects are hidden from teammates, notifications, calendars, and invitation access; their tasks, discussions, and materials are retained for restoration.
- New generated and manually created tasks receive an estimated active work time. Estimates are visible on task cards and can be adjusted in the task editor. Existing tasks show a fallback estimate without replacing their saved content. Estimates are planning aids rather than guaranteed completion times.
