# Teamstride

**Make progress, together.**

Teamstride is a collaborative project workspace built for HackPSU. It helps teams turn an idea into a plan, share responsibilities, and track small wins along the way.

## Features

- Create projects with a brief, team members, and a timeline.
- Organize tasks across four phases: Discover, Create, Refine, and Deliver.
- Assign tasks to individual teammates or share them across the team.
- Track completion, deadlines, and overall project progress.
- Discuss tasks and view personal and group workspaces.
- Use built-in task coaching for guidance on next steps. Coaching uses predefined guidance rather than a live AI chat.
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
