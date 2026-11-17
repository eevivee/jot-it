# Jot It

A personal, phone-first journal with moods, intentions, and conversational goal reflections.

## Run & Operate

- `pnpm --filter @workspace/jot-it run dev` — managed Jot It frontend workflow
- `pnpm --filter @workspace/jot-it run typecheck` — check the journal
- See `artifacts/jot-it/README.md` for Google authorization and GitHub Pages setup.
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

- Jot It must work as a static GitHub Pages website, without the shared API or
  database. The scaffolded backend is not the journal's storage.
- The private Google Sheets connection uses Google's browser OAuth token model.
  A Replit connector would not authorize the separately hosted GitHub website.
  Only a public OAuth client ID is configured; never add a client secret.
- Local data is not encrypted. Do not describe the app as end-to-end encrypted.
- Cloud synchronization is explicit; never claim device-only saves reached Sheets.

## Product

Phone-first journaling, emoji moods, dated entries, daily greetings, tomorrow /
weekly / quarterly / yearly goals, overdue achievement reflections, searchable
collapsible archives, favorites, draft recovery, JSON export, and private Sheets
sync. Weeks run Monday through Sunday. No app-store distribution is needed.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
