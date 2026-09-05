# ADR-003: Inngest for Durable Payment Recovery

**Status:** Accepted

## Context

Payment gateways fail transiently — a bank timeout, a dropped webhook, a 504 from an upstream processor. The naive fix (retry the call inline, in the same request handler) has two failure modes that are unacceptable for money movement: the retry state is lost if the server process restarts mid-backoff, and two concurrent retries for the same transaction can both succeed, causing a double debit.

## Decision

Recovery runs as an **Inngest v4** durable function (`recover-failed-payment`), triggered on payment failure:

1. **Atomic retry-budget claim** — `UPDATE transactions SET retry_count = retry_count + 1 WHERE id = ? AND retry_count < max_silent_retries` (see `src/server/recovery.ts`). Because the increment and the guard are one atomic SQL statement, two parallel workers racing to retry the same transaction can never both win the claim.
2. **Exponential backoff with jitter** before each retry attempt, to avoid a thundering-herd retry storm against an already-struggling upstream gateway.
3. **Idempotency check against Razorpay's own Orders API** before retrying — MandateOS confirms the order wasn't actually captured on Razorpay's side during the outage before attempting to recreate it, which is what makes "zero double-debits" an enforced property rather than a hope.
4. **Quarantine on exhaustion** — once `retryCount >= maxSilentRetries` (mandate-configurable, default 3), the transaction stops retrying automatically and is routed to the `/review` queue for a human compliance decision, with the reason recorded (`"Retry budget exhausted (X/Y). Quarantined for review."`).
5. A **gateway circuit breaker** (`CLOSED → OPEN → HALF_OPEN`) trips after a threshold of consecutive upstream failures and halts outbound traffic for a cooldown window, so a genuinely down gateway doesn't get hammered by every in-flight retry simultaneously.

## Alternatives Considered

- **A Redis-backed job queue (e.g. BullMQ).** Rejected for this build — it works, but requires standing up and operating a Redis instance as an extra piece of infrastructure. Inngest's local dev server runs with a single `npx` command and zero configuration, which matters both for a hackathon judge reproducing the demo locally and for keeping the infra footprint small in general.
- **A cron job polling for `FAILED` transactions.** Rejected — adds a polling-interval floor to recovery latency and puts continuous read load on the transactions table even when nothing has failed recently.
- **Retry inline inside the original request handler (`try`/`catch` with `setTimeout`).** Rejected outright — retry state lives only in process memory. A server restart, deploy, or crash mid-backoff simply loses the retry, and the transaction silently stalls forever with no record of why.

## Consequences

- **Adds one more local process for judges to run** (`npx inngest-cli@latest dev`) — documented explicitly in the demo setup, since a missing worker is the single most likely thing to make the recovery segment look broken on stage.
- **Recovery survives process restarts**, because each step of the Inngest function is checkpointed durably rather than living only in memory — this is the actual point of choosing Inngest over a plain retry loop.
- **Recovery has a visible, replayable run history** in the Inngest dashboard, which is useful both for debugging in production and for a judge who wants to inspect exactly what happened during a chaos-injection demo.
