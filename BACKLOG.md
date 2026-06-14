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
