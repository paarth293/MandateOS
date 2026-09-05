# Enterprise Case Studies & Threat Playbooks

Two illustrative deployment profiles — built from the same agent archetypes already seeded into this repo's demo data (`src/server/seed.ts`) — showing how MandateOS's guarantees map onto real operational scenarios. These are worked examples for evaluation purposes, not customer testimonials.

## Case Study 1: CloudOps AI — Autonomous Infrastructure Scaling

**Profile:** A DevOps automation agent authorized to provision and pay for cloud infrastructure — compute instances, storage, bandwidth overages — in response to load spikes, without waiting for human sign-off (the entire point of an auto-scaler is that it doesn't wait).

**The risk without MandateOS:** an auto-scaler that hallucinates a load spike, gets caught in a retry loop against a flaky provisioning API, or is fed a manipulated metrics feed can provision (and pay for) far more infrastructure than any human would have approved — with no hard ceiling except "however much credit is on the card."

**How the mandate is shaped:**

| Control | Setting | What it stops |
| :--- | :--- | :--- |
| Per-transaction cap | ₹10,000 | A single runaway provisioning call can't be catastrophic on its own |
| Daily cap | ₹30,000 | A retry storm across many small calls still hits a hard ceiling within 24h |
| Allowed categories | `Cloud Servers` only | The agent's key can't be repurposed to pay for anything outside its actual job, even if the agent process itself is compromised |
| Max silent retries | 3 | A genuinely flaky provisioning API gets a bounded number of autonomous attempts before it's quarantined for human review, instead of retrying forever |

**Incident playbook — gateway outage during a real traffic spike:** the provisioning payment fails (bank timeout) at the exact moment more capacity is actually needed. MandateOS's recovery workflow (see [ADR-003](./ADR/ADR-003-inngest-durability.md)) retries with exponential backoff, verifies against Razorpay's Orders API before every retry to guarantee no double-provisioning, and — if the retry budget is exhausted — quarantines the transaction to `/review` with the full context (amount, category, failure reason, retry count) rather than either silently failing or silently retrying forever.

## Case Study 2: FinServe AI — Regulated Financial Services Procurement

**Profile:** A procurement agent inside a regulated financial services company, authorized to purchase SaaS subscriptions and data services on the company's behalf, in an environment where every dollar of spend is subject to audit.

**The risk without MandateOS:** a compliance-regulated business can't accept "we trust the agent's system prompt" as an answer to an auditor's question. Prompt-based guardrails aren't just insecure here — they're not even an admissible control, because there's no way to *prove*, after the fact, that a specific transaction was actually within policy at the moment it happened.

**How the mandate is shaped:**

| Control | Setting | What it stops |
| :--- | :--- | :--- |
| Per-transaction cap | ₹2,000 | Deliberately tight — this agent's job is small, recurring purchases, not large one-off contracts |
| Allowed categories | `Data Services`, `Cloud Servers` | Purchases outside the agent's actual mandate (e.g. anything resembling a cash-equivalent purchase) are structurally impossible, not just discouraged |
| Audit requirement | Every transaction sealed into the SHA-256 hash chain (see [ADR-002](./ADR/ADR-002-sha256-hash-chain.md)) | An auditor with zero access to internal systems can independently verify, from a single published anchor hash, that the entire transaction history is intact and untampered |

**Incident playbook — a compromised or jailbroken agent attempts an out-of-policy purchase:** even if the agent's own reasoning is fully compromised — a prompt injection convinces it to try to buy something it shouldn't — Gate 7 (category whitelist) rejects the request before it ever reaches Razorpay. The rejected *attempt itself* is still logged into the audit chain with a `CATEGORY_BLOCKED` reason, which means compliance gets a record of the attempted violation, not just silence. Gemini's advisory layer (never in the enforcement path) then generates a plain-English incident note flagging it for review — turning a security event into a five-second read for a human compliance officer instead of a raw log line.

## Threat Model Summary

| Threat | Defense | Verified by |
| :--- | :--- | :--- |
| Forged / stolen credentials used to sign requests | Ed25519 signature verification against the mandate's public key | `TEST_REPORT.md` Suite 1 |
| Captured packet replayed by a network attacker | Database-level unique-nonce constraint (`23505` → `409`) | `TEST_REPORT.md` Suites 2–3 |
| Delayed-playback of an old, validly-signed packet | ±300s timestamp drift window | `TEST_REPORT.md` Suite 3 |
| Prompt injection convincing the agent to overspend | Deterministic integer caps outside the LLM's reach entirely | `TEST_REPORT.md` Suite 3 |
| Prompt injection convincing the agent to buy the wrong thing | Category whitelist enforced server-side | `TEST_REPORT.md` Suite 3 |
| Gateway outage causing a stuck or duplicated payment | Idempotent, durable recovery via Inngest | [ADR-003](./ADR/ADR-003-inngest-durability.md) |
| Retroactive tampering with the audit history | SHA-256 forward hash chain + external anchors | `TEST_REPORT.md` Suite 2 |
| A malicious *owner* replaying their own past approval | Nonce uniqueness applies regardless of who signs — even the legitimate key holder can't reuse a nonce | Attack Console scenario `REPLAY_FRAUD_OWNER` |
