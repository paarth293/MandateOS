# MandateOS — Bug-Fix & Hardening Plan

Scope: the 8 issues found during the full-project audit, ordered so each phase unblocks the next.
Verification gate after each phase: `npx @biomejs/biome check . && npm run typecheck && npm test`.

---

## Phase 0 — Shared foundations (build first, everything else reuses this)

### 0.1 `src/server/spend.ts` (new) — canonical spend-total query
- Export `getCommittedSpendTotals(mandateId): Promise<{ spentTodayPaise, spentLifetimePaise }>`.
- **Committed status set** (decision, recommended): `SUCCESS, RECOVERED, ORDER_CREATED, PENDING` — i.e. settled **or** funds reserved. FAILED never counts (money wasn't taken).
- Replaces 4 inline SQL copies that currently disagree:
  - `src/app/api/agent/purchase/route.ts` (uses `SUCCESS,RECOVERED,PENDING`)
  - `src/server/inngest/functions.ts` retry path (uses `SUCCESS,RECOVERED,ORDER_CREATED,PENDING`)
  - `src/app/api/policy/simulate/route.ts` (uses `SUCCESS,RECOVERED,PENDING`)
  - `src/app/api/analytics/route.ts` (uses `SUCCESS,RECOVERED` — **keep as reporting-only** "settled" totals, rename/comment to make the difference explicit)

### 0.2 `src/server/recovery.ts` (new) — testable retry engine
- Extract the body of the `execute-retry` step out of `src/server/inngest/functions.ts` into
  `executeRetry(transactionId, mandateId)` (pure-ish: DB + gateway as inputs, returns result).
- This is where Bug 1 gets fixed (real category) and it becomes unit-testable.

### 0.3 `src/server/authz.ts` (new, small)
- `getUserMandateIds(userId): Promise<string[]>` — single query reused by every multi-tenancy fix.

---

## Phase 1 — Correctness bugs (P0)

### Bug 1 — Retry path hardcodes category `"Office Supplies"`
**Files:** `src/server/schema.ts`, `src/server/inngest/functions.ts` → `src/server/recovery.ts`, `src/app/api/agent/purchase/route.ts`, `src/app/actions.ts`, `src/server/seed.ts`, `drizzle/`
1. Add `merchantCategory: varchar("merchant_category", { length: 100 })` (nullable) to `transactions`.
2. Generate migration (`npx drizzle-kit generate`) / push. Nullable so legacy rows migrate cleanly.
3. **Purchase route** (step 11): store the request's validated `category` on the transaction row.
4. **`createPendingTransaction`** (chaos-console path in `src/app/actions.ts`): it fetches `merchants.findFirst()` — set `merchantCategory` from that merchant's `businessCategory`.
5. **Seed** (`src/server/seed.ts`): add `merchantCategory` per transaction template (derive from the merchant's category).
6. **Recovery path** (`src/server/recovery.ts`): use `tx.merchantCategory ?? (merchant.businessCategory)` — merchant looked up by `tx.merchantId` as fallback for legacy rows.
7. **Note (out of scope for this fix):** purchase route always picks `merchants.findFirst()`, never matches merchant by category. Flag for a follow-up: match merchant by `businessCategory` from the request, else `findFirst`.

### Bug 2 — Inconsistent spend-total definitions
**Files:** all 4 sites listed in 0.1
1. Replace the three policy-evaluation copies (`purchase`, `recovery`, `simulate`) with `getCommittedSpendTotals`.
2. `analytics` keeps `SUCCESS,RECOVERED` and documents it as *settled* reporting (not budget enforcement).
3. Add unit test (Phase 3) asserting the helper's status set is the committed one.

### Bug 3 — Multi-tenancy: every user sees everyone's data
**Files:** `src/app/api/mandates/route.ts`, `src/app/api/dashboard/route.ts`, `src/app/api/analytics/route.ts`, `src/app/api/review/route.ts`
1. `GET /api/mandates` → `eq(mandates.userId, user.id)`.
2. `/api/dashboard` → mandates scoped to user; transactions + auditLogs filtered with `inArray(mandateId, getUserMandateIds(user.id))`.
3. `/api/analytics` → same scoping on transactions, purchaseAttempts, and the mandate list.
4. `/api/review` GET → transactions restricted to user's mandates.
5. **Deliberately kept public** (external verifiability is the product's promise — threat model §3.3/§5): `/api/verify/chain`, `/api/export/chain`, `/api/anchors`, `/api/health`, `/api/events/stream`.
   - **Decision point:** if public verify/export is unwanted in prod, add `MANDATE_VERIFY_PUBLIC=false` env to require a session; default stays public for the demo.

---

## Phase 2 — Security & ops hardening

### Bug 4 — In-memory rate limiter → DB-backed (single source of truth)
**Files:** `src/app/api/agent/purchase/route.ts`
1. Delete `rateLimitMap`, `checkRateLimit`, and the two constants.
2. Reorder the request pipeline:
   parse/validate → mandate lookup → timestamp drift → **signature verify** → **insert `purchaseAttempts` row (nonce unique → 409 REPLAY_DETECTED)** → **rate-limit count** → policy → merchant → gateway → tx insert → update attempt outcome.
3. Rate limit = count rows for the mandate with `createdAt >= now - 60s`; ≥ 60 → update row `outcome: "RATE_LIMITED"`, return 429.
4. Outcome now tracked for every signed attempt (`ALLOWED / BLOCKED / RATE_LIMITED / REPLAY / INVALID_SIGNATURE`), and the SSE arena (reads `purchaseAttempts`) automatically shows the new verdicts.
5. Tradeoff (documented): unsigned junk never hits the table (we verify signature first), so rate limiting applies to *signed* attempts only.

### Bug 5 — Unbounded tables → prune cron
**Files:** `src/server/inngest/functions.ts`
1. New cron function `prune-stale-data` (hourly, mirrors `reconcileStaleOrders` pattern):
   - delete `purchaseAttempts` older than 1 h (window 60 s + 5 min drift + margin),
   - delete `sessions` where `expiresAt < now`,
   - delete `auth_attempts` (Bug 8) older than 1 day.

### Bug 6 — Gemini call can hang the worker
**Files:** `src/server/ai.ts`
1. `generateObject({ ..., abortSignal: AbortSignal.timeout(10_000) })` — timeout throws, the existing deterministic fallback already catches errors.
2. Comment the intent (sub-second diagnosis; fallback on timeout).

### Bug 7 — Hardcoded fallback signing key in export route
**Files:** `src/app/api/export/chain/route.ts`, `.github/workflows/ci.yml`, `.env.example`, `README.md`
1. `getAgentSecretKey()` returns `null` when no key is configured (drop the literal secret fallback).
2. Manifest becomes explicit: `signature: null`, `signatureStatus: "UNSIGNED"` (never silently sign with a public-known key).
3. Remove `AGENT_SECRET_KEY` from `ci.yml` (build doesn't need it — key is read at request time).
4. Document `AGENT_KEY_PATH` / `AGENT_SECRET_KEY` as required for signed exports in `.env.example` + README.

### Bug 8 — No login brute-force protection (small, cheap)
**Files:** `src/server/schema.ts`, `src/app/api/auth/login/route.ts`
1. New table `auth_attempts(email, ip, success, createdAt)`.
2. Login: before verifying, count failures for (email, ip) in 15 min; ≥ 5 → generic 429. Record every attempt; prune via Bug 5 cron.

---

## Phase 3 — Tests (written alongside the fixes, not after)

| Fix | Test | Location |
| :-- | :-- | :-- |
| Bug 2 | `getCommittedSpendTotals` returns committed status set (with DB mock, or integration-gated) | `src/server/spend.test.ts` |
| Bug 1 | `resolveRetryCategory(tx, merchant)` pure-function fallback logic | `src/server/recovery.test.ts` |
| Bug 4 | Extract pure `isWithinWindow(timestamps, now, windowMs, max)` → unit test (boundary: 59/60/61) | `src/lib/` (or inline in spend helper file) |
| Webhook | Extract `verifyRazorpayWebhookSignature(rawBody, signature, secret)` into `src/lib/razorpay.ts`; route uses it; test valid/tampered/missing | `src/lib/razorpay.test.ts` |
| Chain | `verifyAuditChain` (already exported): valid chain, tampered block, broken link, bad genesis, empty | `src/app/api/verify/chain/route.test.ts` |
| Stretch | Integration test of purchase route (happy path, replay 409, rate-limit 429) — gated on `DATABASE_URL` presence | `src/server/e2e.test.ts` |

---

## Phase 4 — Verification & rollout

1. Gate per phase: `biome check` → `typecheck` → `vitest` → `next build`.
2. Manual demo checklist (requires DB):
   - `npm run db:push` + `npm run seed` (legacy rows OK — `merchantCategory` nullable)
   - `npm run dev` + `npx inngest-cli@latest dev` + `npm run agent:simulate`
   - Chaos console inject → verify retry re-evaluates policy with the **real** category (not "Office Supplies")
   - Login as `rahul@mandateos.dev` (VIEWER) → confirm he sees **no** mandates/transactions (multi-tenancy)
   - Hammer purchase endpoint → verify 429 with `RATE_LIMITED` attempt rows
   - Export chain with no `agent.key` → verify `signatureStatus: "UNSIGNED"`, no silent fake signature
3. Record decisions made (committed status set, public verify endpoints) at the top of this doc.

---

## Ordering rationale
- **Phase 0** must land first: every later phase (1, 2) consumes the shared helpers.
- **Phase 1** (correctness) before **Phase 2** (hardening): wrong budget math and data leaks matter more than rate limiting.
- **Phase 3** is interleaved with fixes, not a separate milestone — each fix ships with its tests.
- **Bug 8** (login brute force) is optional if time-boxed; Bugs 1–3 and 6 are non-negotiable.