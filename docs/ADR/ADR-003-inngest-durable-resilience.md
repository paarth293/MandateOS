# ADR-003: Inngest Durable Execution for Gateway Fault Tolerance and Recovery

## Status
**Accepted** (2026-09)

## Context & Problem Statement
In real-world payment infrastructure, upstream banking gateways, acquirers, and network APIs experience transient disruptions, including HTTP 500/502/504 errors, network timeouts, and sudden rate-limit throttling (HTTP 429). 

Traditional naive approaches—such as in-process `try/catch` with `setTimeout` or raw while-loops—introduce catastrophic failure modes:
1. **Server Restart Loss**: If the Node.js process crashes, restarts, or deploys while an in-memory retry loop is active, the transaction state is lost forever.
2. **Double-Spend Risk**: If an agent or worker re-invokes an API after a socket hangup where the gateway actually processed the debit, retrying naively leads to duplicate charges.
3. **Queue Infrastructure Maintenance**: Running Redis + BullMQ or RabbitMQ requires dedicated worker daemons, connection pools, dead-letter queue plumbing, and operational overhead that does not natively integrate with serverless edge architectures (Vercel / Cloudflare).

## Decision Drivers
1. **Zero State Loss**: Every step in a multi-stage payment and reconciliation pipeline must survive process restarts.
2. **Idempotency & Double-Debit Prevention**: Every retry step must memoize previous step outputs and verify gateway transaction status before re-attempting payment capture.
3. **Serverless Portability**: Workflows must execute over standard HTTP webhooks without requiring long-lived stateful TCP worker processes.
4. **Deterministic Observability**: Developers and operators must be able to inspect the exact step-level timeline (Pending → Gateway Call → Timeout → Exponential Backoff → Auto-Recovery).

## Considered Options
1. **In-Process Exponential Retries (`p-retry` / Axios interceptors)**:
   - *Pros*: Trivial to write.
   - *Cons*: Process crash loses all pending retries; cannot coordinate distributed locks; locks up serverless execution budget.
2. **Redis + BullMQ / Celery**:
   - *Pros*: Proven distributed queuing system.
   - *Cons*: Requires running stateful Redis clusters; boilerplate retry and idempotency logic; poor fit for Next.js serverless route handlers.
3. **Temporal.io**:
   - *Pros*: Enterprise-grade durable execution.
   - *Cons*: Heavy operational footprint, requires self-hosting or managing Temporal cluster, gRPC overhead.
4. **Inngest Durable Functions**:
   - *Pros*: Native serverless execution over HTTP; `step.run()` memoization prevents re-executing completed operations; built-in concurrency controls and retries; built-in visual timeline and local DevServer UI; seamless Next.js App Router integration.
   - *Cons*: Requires running the lightweight Inngest dev server locally for local dev (or mock mode in MandateOS).

## Decision Outcome
We adopted **Inngest** (`src/inngest/client.ts` and `src/inngest/functions.ts`) for resilient transaction execution and chaos recovery.

### Workflow Topology:
1. When a transaction encounters an upstream gateway timeout or network failure, an event `mandate/payment.failed` or `mandate/transaction.recover` is dispatched.
2. The Inngest function triggers:
   - `step.run('verify-status')`: Queries the Razorpay Orders/Payments API to verify if the payment was already captured or pending.
   - `step.sleep('wait-for-gateway-cooldown')`: Non-blocking durable sleep with jitter.
   - `step.run('retry-capture-or-reconcile')`: Re-attempts capture with strict idempotency keys.
   - `step.run('audit-recovery-log')`: Appends the recovery event to the SHA-256 tamper-evident hash chain.
3. If recovery fails after 3 attempts, the transaction is transitioned to `QUARANTINED` status and an alert is published to the MandateOS dashboard.

## Consequences
- **Positive**: Complete protection against server crashes during transaction recovery, guaranteed zero duplicate debits, full step-by-step observability in the Chaos Injection Console.
- **Negative**: Adds Inngest SDK dependency; requires webhook endpoint registration (`/api/inngest`).
