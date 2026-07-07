# BACKLOG

Technical debt and future improvements. Not urgent — do after client demos.

---

## 1. React Query Migration

**What:** Replace all `useEffect + fetch + useState + localStorage cache` patterns with React Query.

**Why:** Currently every page manually manages loading state, caching, and stale checks. React Query handles all of this automatically — stale-while-revalidate, background refetch, cache invalidation, deduplication.

**What moves to React Query:**
- `tasks` + `deps` (Gantt page)
- `projects` list (Overview, Sidebar)
- `documents` list
- `schedule versions`
- `dprs`
- `workspace members`

**What stays in localStorage:**
- `bluq_schedule_job_{id}` — must survive page refresh (job ID only exists client-side)
- `bluq_workspace` — needed before first API call

**Effort:** 2-3 days. Replace page by page.

**References:** https://tanstack.com/query/latest

---

## 2. AWS Bedrock Migration (Claude AI)

**What:** Move all Anthropic API calls from direct `api.anthropic.com` to AWS Bedrock.

**Why:** Client asked "where is my data processed?" Direct Anthropic API sends project data to Anthropic's US servers. Bedrock keeps it within AWS infrastructure — easier to answer enterprise security questions.

**Files to change (7 total):**
- `bluq-api/src/lib/gap-checker.ts`
- `bluq-api/src/lib/novel-task-generator.ts`
- `bluq-api/src/lib/parameter-extractor.ts`
- `bluq-api/src/lib/whatsapp-parser.ts`
- `bluq-api/src/lib/infra/infrastructure-parameter-extractor.ts`
- `bluq-api/src/routes/projects.ts`
- `bluq-api/src/workers/pdf.worker.ts`

**What changes:**
- Replace `@anthropic-ai/sdk` with `@aws-sdk/client-bedrock-runtime`
- Replace API key auth with IAM role
- Update model IDs (e.g. `claude-haiku-4-5-20251001` → `anthropic.claude-haiku-4-5-20251001-v1:0`)
- Set up Bedrock access in AWS console + IAM role on Railway

**Effort:** 2-3 days including AWS setup and testing.

**Trigger:** When a client formally asks for data residency/security compliance.

---

## 3. Redis Backend Caching

**What:** Add server-side Redis cache for expensive DB queries.

**Why:** Currently every API request hits Postgres directly. As user count grows, repeated queries for the same tasks/projects/deps will slow down. Redis sits in front of DB and serves cached responses in <1ms.

**Where Redis already exists:** Upstash Redis is already set up for BullMQ queues and WhatsApp state. Same connection can be used for caching.

**Candidates for caching:**
- `GET /tasks?projectId=X` — called on every Gantt load, same data per project
- `GET /projects?workspaceId=X` — called on every page load
- `GET /schedule-versions?projectId=X` — rarely changes

**Pattern:**
```ts
const cached = await redis.get(`tasks:${projectId}`);
if (cached) return JSON.parse(cached);
const tasks = await db.select().from(tasks).where(...);
await redis.setex(`tasks:${projectId}`, 300, JSON.stringify(tasks)); // 5 min TTL
return tasks;
```

**Cache invalidation:** Clear `tasks:{projectId}` key whenever a task is created/updated/deleted.

**Effort:** 1-2 days.

**Trigger:** When API response times degrade noticeably (>500ms on task fetch).

---

## 4. Auth System Review

**Current:** Better Auth with email+password and email OTP. Session-based (7-day expiry, 24h refresh).

**Potential improvements to evaluate:**

### Option A: Stay on Better Auth, add OAuth
- Add Google login (`provider: "google"`)
- Low effort, good UX for users who prefer SSO
- Effort: 1 day

### Option B: Migrate to Clerk
- Hosted auth UI, user management dashboard, built-in MFA, orgs
- Solves user management UI you'd otherwise build yourself
- Downside: per-user pricing gets expensive at scale, large migration effort
- Trigger: if you need MFA, advanced org management, or audit logs for enterprise clients

### Option C: Stay as-is
- Current Better Auth setup works fine
- No refresh tokens (not needed — session-based is correct for this use case)
- Evaluate only if enterprise clients require SSO/SAML

**Current verdict:** No action needed. Revisit when an enterprise client asks for SSO or MFA.

---

## 5. Gantt Double Fetch on Navigation

**What:** Every Gantt navigation triggers two task fetches — one without versionId (baseline lookup), one after `ProjectAwareSubTabs` adds versionId via `router.replace`.

**Fix:** Store `lastVersionId_${projectId}` in localStorage when Gantt loads. Include it in all navigation URLs (sidebar, overview card, project switcher). `ProjectAwareSubTabs` detects versionId already set → skips `router.replace` → one fetch only.

**Effort:** Half a day.

**Trigger:** Performance optimisation — not urgent, data is correct after Bug 1 fix.

---

## 6. Predecessor Dependency Lookup Fails Silently on Import

**What:** When importing a schedule, task dependencies are resolved by matching predecessor names. If a name doesn't match exactly (trailing space, typo, special characters), the dependency is silently skipped — import shows success but Gantt is missing arrows.

**File:** `bluq-api/src/routes/tasks.ts:351`

**Fix:** Collect all unresolved predecessor names and return them in the API response. Frontend shows a warning after import listing which dependencies couldn't be resolved.

**Effort:** Half a day.

**Trigger:** Low priority — only affects imports with predecessor columns. XER/MPP files from Primavera usually have clean names.

---

## 7. Backend Pagination (Do Soon)

**What:** All list endpoints return entire table with no LIMIT.

**Files:**
- `bluq-api/src/routes/tasks.ts:89` — `GET /tasks` no limit
- `bluq-api/src/routes/dprs.ts:18` — `GET /dprs` no limit
- `bluq-api/src/routes/documents.ts:163` — `GET /documents` no limit
- `bluq-api/src/routes/reports.ts:62-65` — fetches ALL tasks + dprs for PDF

**Fix:** Add `.limit(500)` as a safety cap, add cursor-based pagination for lists.

**Effort:** Half a day.

**Trigger:** This one is more urgent than the others — do before the next major demo.

---

## 6. Anthropic API Timeouts

**What:** All 7 Anthropic `fetch()` calls have no timeout. A hung request blocks the worker forever.

**Fix:** Add `signal: AbortSignal.timeout(30_000)` to every fetch call.

**Effort:** 1 hour.

**Trigger:** Do after Alice Technology schedule integration — need real timing data first. Alice schedules can take 3-4+ minutes; a premature 30s timeout would kill valid jobs. Measure p95 response time in production logs, then set timeout to 2x that.

---

## 8. Fix "Accept Gap" route to read from `tasks` table instead of `schedule_json`

`bluq-api/src/routes/schedule.ts` ~line 406

When a user accepts an AI gap suggestion, the backend reads `scheduleJson.tasks` to find the last `endDate` in the target phase and auto-places the new task. Problem: `schedule_json` is the AI's original snapshot — it goes stale if tasks are edited after generation. Should query the `tasks` table instead (`WHERE scheduleVersionId = X AND phase = Y ORDER BY endDate DESC LIMIT 1`).

**Effort:** Half a day.

---

## 9. Backfill `scheduleVersionId = NULL` tasks

Tasks created manually before the versioning fix (June 2026) have `scheduleVersionId = NULL` in the `tasks` table. They won't show up when the Gantt filters by a specific version. Need a one-time migration to assign these orphaned tasks to the correct version for each project.

**Effort:** 1 hour (SQL migration).

---

## 10. Overview Page — Infinite Scroll for Project Cards

**What:** Overview page loads all projects at once. As project count grows, initial load gets heavy.

**Why infinite scroll (not pagination):** Project cards are visually dense (status badges, dates, member avatars). Tapping through page numbers to find a project is poor UX on mobile. Infinite scroll feels native.

**Rules:**
1. **Batch size: 10–15 cards.** A phone screen shows 2–3 cards at once; 10 cards = enough to scroll immediately without over-fetching.
2. **Backend: add `limit` + `cursor` params to `GET /projects`.** Return `nextCursor` in response. Frontend requests next batch when user nears bottom.

**Frontend implementation:**
- Use `IntersectionObserver` on a sentinel div at bottom of list (or a "Load more" trigger)
- Append new cards to existing list — do not replace
- Show skeleton cards while next batch loads

**Exception — archived/old projects:** Do not use infinite scroll to surface 3-year-old closed projects. Instead, add a "Status" filter (`Active / Closed / Archived`) at top of overview. Closed projects go behind the filter, not in the main scroll.

**Files to touch:**
- `bluq-api/src/routes/projects.ts` — add `limit`/`cursor` query params
- `src/lib/api-client.ts` — update `fetchProjects` to accept cursor
- `src/app/dashboard/overview/page.tsx` — replace single fetch with paginated load

**Effort:** 1 day.

**Trigger:** When a workspace has 20+ active projects and overview load time becomes noticeable.

---

## 11. Element-Level Task Tracking (Drill-Down Gantt)

**What:** Two-layer task system — scheduling grain (work packages, Gantt rows) + tracking grain (individual elements like columns, beams, chainage segments).

**Why:** Site supervisors think in element IDs ("poured C-14 and C-15 today"), not percentages. Currently the Gantt has no way to track which specific element is done vs. pending. WhatsApp updates are already parsed — the missing piece is element-level tasks to update.

**How it works:**

Main Gantt stays clean — one bar per work package. Clicking a task opens a drill-down panel:

```
Main Gantt:
  L3 Column Formwork    ████████░░░░  48%  [↓]
  L3 Column Rebar       ██████░░░░░░  35%  [↓]

Click [↓]:
  ← L3 Column Formwork (47 elements)
  C-01  Grid A/1  ✅ Done
  C-02  Grid A/2  ✅ Done
  C-03  Grid B/1  🔄 In Progress
  C-14  Grid C/3  ⚠️  Delayed
  ...
```

% complete on Gantt = elements done / total elements (auto-computed).

**Where element IDs come from:**
- Structural drawings: column schedule (C-01 to C-N), beam schedule (B-01 to B-N)
- Road/infra: chainage segments (0+000→0+100, etc.) — already element-granular
- Extracted by Claude during work package extraction if drawing has element schedule

**WhatsApp integration:** "done C-03 and C-04 today" → two elements flip to ✅ → task % updates → Gantt bar updates live via Socket.IO.

**Schema change needed:**
- New `elements` table: `id, taskId, elementCode, label, gridRef, status, updatedAt`
- `tasks.percentComplete` computed from `elements` count when elements exist; manual otherwise

**Files to touch:**
- `bluq-api/src/db/schema.ts` — add `elements` table
- `bluq-api/src/lib/infra/infrastructure-parameter-extractor.ts` — extract element IDs from structural schedules during parameter extraction
- `bluq-api/src/lib/whatsapp-parser.ts` — parse element codes from field messages
- `bluq-api/src/routes/tasks.ts` — GET /tasks/:id/elements, PATCH /tasks/:id/elements/:elementId
- `src/app/dashboard/schedule/gantt/` — drill-down panel component

**Effort:** 3-4 days.

**Trigger:** After Phase 3 optimizer is live and Gantt is stable. Needed before scaling to large structural projects (30+ floor buildings, long road corridors).

---

## 12. Drawing Vision Extraction (Spatial Constraints from Drawings)

**What:** Use Claude Vision to extract spatial constraints directly from engineering drawings (cross-sections, pile layout plans, site layout plans) rather than relying solely on text descriptions.

**Why:** The infrastructure parameter extractor currently reads only text documents (DPR, BOQ, technical specs). Spatial constraints like formation width, cutting dimensions, pile cap sizes, and access road widths are often only in drawings — not described in text. This means `maxConcurrentActivities` per section defaults to norm-based estimates when the actual geometry is available in drawings.

**How it works:**
1. User uploads drawings alongside text documents (PDF or image)
2. Backend converts each PDF page to an image
3. Claude Vision call per drawing: extract formation widths, zone dimensions, access road widths, pile layouts
4. Merge drawing-extracted dimensions with text-extracted parameters — drawing values override defaults for `maxConcurrentActivities` and `accessRoute`

**What Claude Vision can read:**
- Road cross-sections → formation width, cutting depth, embankment height → max machines per section
- Pile layout plans → pile cap size, pile spacing → piling rigs per pier
- Tunnel cross-sections → bore diameter → heading crew count
- Site layout plans → zone boundaries, access road widths → concurrent activity limits

**Files to touch:**
- `bluq-api/src/lib/infra/infrastructure-parameter-extractor.ts` — add `extractSpatialFromDrawings(imageBase64[])` function
- `bluq-api/src/routes/schedule.ts` — accept drawing file uploads alongside text documents
- Frontend upload UI — allow attaching drawing PDFs to schedule generation

**Effort:** 2-3 days.

**Trigger:** When projects have poor spatial constraint extraction — planner overrides `maxConcurrentActivities` manually more than once per project. Drawing upload is a premium feature; text-only extraction is good enough for most projects.

---

## 13. Revert: Switch BullMQ Redis Back to Upstash (from Railway Redis)

**What happened (2026-07-08):** Upstash account's payment lapsed, DB got rate-limited (`ERR Your database has been temporarily rate-limited`), which broke all BullMQ queues (ai-scheduler, whatsapp-processor, pdf-generator, cron) since they share one Redis connection. To keep testing without paying Upstash yet, switched the queue backend to a free Railway Redis plugin (plain `redis://`, no TLS) added to the `bluq-api` Railway project.

**Code change made:** [bluq-api/src/lib/redis.ts](bluq-api/src/lib/redis.ts) — TLS config is now conditional on URL scheme:
```ts
const useTls = redisUrl.startsWith("rediss://");
export const redisConnection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  ...(useTls ? { tls: { rejectUnauthorized: false } } : {}),
});
```
Previously `tls: { rejectUnauthorized: false }` was always forced — that only works for Upstash's `rediss://` URL, not Railway's plain `redis://`.

**Env var change made:** Railway → `bluq-api` service → Variables → `UPSTASH_REDIS_URL` was repointed from the Upstash `rediss://...` connection string to the Railway Redis plugin's `redis://...` URL.

**To revert once Upstash is paid again (before onboarding paid clients):**
1. Railway → `bluq-api` service → Variables → set `UPSTASH_REDIS_URL` back to the original Upstash `rediss://...` connection string (find it in Upstash console, or Railway variable history if not overwritten).
2. Code in `redis.ts` does **not** need to be reverted — the conditional TLS logic works correctly for both `rediss://` (Upstash) and `redis://` (Railway) automatically. Safe to leave as-is permanently.
3. Optional cleanup: remove the Railway Redis plugin service from the Railway project once confirmed Upstash is working again (avoids paying for/running an unused service).
4. Note: `src/lib/flow-engine.ts` (WhatsApp conversation state, Vercel frontend) uses `@upstash/redis` REST client (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`) — this was **never switched** to Railway (Railway Redis has no REST API, incompatible with that client). It stayed on Upstash the whole time and was broken during the rate-limit period. No action needed here on revert — it'll just start working again once Upstash is paid.

**Trigger:** When first paid client is onboarded, or as soon as Upstash payment/plan is sorted — don't run production client traffic on a free Railway Redis plugin long-term (no SLA, not the intended use).
