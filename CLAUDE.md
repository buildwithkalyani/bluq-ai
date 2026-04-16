







# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend (Next.js — root)
```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint check
```

### Backend (Fastify — /bluq-api)
```bash
cd bluq-api && npm run dev    # Start backend with tsx watch (port 3001)
cd bluq-api && npm run build  # Compile TypeScript → dist/
cd bluq-api && npm start      # Run compiled dist/index.js
```

### Full setup from scratch
```bash
npm run setup   # npm install root + cd bluq-api && npm install
```

### Database (Drizzle — run from root)
```bash
npx drizzle-kit generate    # Generate migration from schema changes
npx drizzle-kit migrate     # Apply migrations to Supabase
npx drizzle-kit studio      # Open Drizzle Studio GUI
```

No test suite exists yet.

## Architecture

### Two-service structure (not a monorepo)
- **Root `/`** — Next.js 14 (App Router), deployed on Vercel
- **`/bluq-api`** — Fastify 5 backend, deployed on Railway
- Frontend calls backend via `FASTIFY_API_URL` (SSR) and `NEXT_PUBLIC_BACKEND_URL` (client/Socket.IO)
- Root `tsconfig.json` explicitly excludes `bluq-api`

### Auth flow
- **Better Auth** handles auth on both sides
- Frontend: `/api/auth/[...all]` route handler (`src/app/api/auth/[...all]`)
- Session stored in cookie `better-auth.session_token`
- Middleware (`src/middleware.ts`) protects `/dashboard/*` and other routes, redirects to `/login`
- Backend: `verifySession` Fastify pre-handler (`bluq-api/src/lib/verifySession.ts`) validates token on all protected routes by calling Better Auth

### Database
- **Drizzle ORM** + **PostgreSQL** (Supabase)
- Schema: `src/db/schema.ts` (frontend) mirrors `bluq-api/src/db/schema.ts` (backend) — keep in sync
- Connection string: `SUPABASE_DATABASE_URL`
- Key tables: `orgs`, `users`, `workspace_members`, `projects`, `tasks`, `dprs`, `dpr_photos`, `whatsapp_updates`, `audit_events`, `project_members`, `share_tokens`

### Real-time (Socket.IO)
- Server: `bluq-api/src/lib/socket.ts`
- Client hook: `src/hooks/useTaskSocket.ts`
- Used for live Gantt chart updates and task status changes

### Background jobs (BullMQ + Upstash Redis)
Workers in `bluq-api/src/workers/`:
- `ai-scheduler.worker.ts` — AI-powered schedule generation (Anthropic SDK)
- `whatsapp.worker.ts` — Processes inbound WhatsApp messages
- `pdf.worker.ts` — DPR PDF generation
- `cron.worker.ts` — Morning/evening automated reports

Queues defined in `bluq-api/src/lib/queues.ts`. Frontend cron triggers via `/api/cron/*` routes protected by `CRON_SECRET`.

### AI integration (Anthropic / Claude)
- Backend only, via `ANTHROPIC_API_KEY`
- Used in: `novel-task-generator.ts`, `ai-scheduler.worker.ts`, route handlers for project briefings and report generation
- Frontend never calls Anthropic directly

### Frontend data flow
- API calls to backend use `src/lib/api-client.ts`
- Auth client: `src/lib/auth-client.ts` (Better Auth React client)
- Workspace state: `src/context/workspace.tsx` (active org, project selection)
- UI components: shadcn/ui (style: radix-nova) in `src/components/ui/`

### WhatsApp integration
- Webhook: `bluq-api/src/routes/whatsapp.ts` receives Meta webhook events
- Parsing: `bluq-api/src/lib/whatsapp-parser.ts` + `parameter-extractor.ts`
- Sending: `bluq-api/src/lib/whatsapp-send.ts`
- Frontend bot UI: `src/app/dashboard/whatsapp-bot/` and `whatsapp-feed/`
- Flow logic: `src/lib/flow-engine.ts`

### Schedule parsing
`bluq-api/src/lib/parsers.ts` handles import of `.xer` (Primavera), `.mpp` (MS Project), `.xlsx` files for schedule ingestion.
