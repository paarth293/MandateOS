# MandateOS — Hackathon Demo Flow (5-Minute Version)

**Target runtime:** `npm run dev` (Next.js) + `npx inngest-cli@latest dev` (Inngest local) + `npm run seed` (DB + agent.key).
**Demo credential:** `priya@mandateos.dev` / `MandateOS@2026`.

> An interactive, timer-driven version of this script — with auto-scrolling active-section highlighting, a pre-flight checklist, and a copy-paste judge handout — is also maintained as a live companion page for the presenter. This file is the source of truth for content; treat the two as kept in sync.

---

## Pre-demo checklist

1. **Database seeded?**
   ```bash
   npm run seed
   ```
   Look for: `🎉 MANDATEOS V3 SEED COMPLETED SUCCESSFULLY!` and the agent secret key printed at the bottom. This writes `agent.key` (the Ed25519 private key) and populates users, merchants, mandates, transactions, audit logs, and anchors — including a pre-existing agent named **"AutoGPT Procurement Agent"**. Do not reuse that exact name when issuing a live mandate below; use **"VendorOps Purchasing Agent"** instead, or the two will look like a duplicate on screen.

2. **Services running?**
   - Terminal 1: `npm run dev` on `http://localhost:3000`
   - Terminal 2: `npx inngest-cli@latest dev` (required for the recovery segment)
   - Sanity check (Windows PowerShell): `(Invoke-RestMethod http://localhost:3000/api/health).status` should print `HEALTHY`
     — on macOS/Linux/WSL instead: `curl -s http://localhost:3000/api/health | grep -o '"status":"[A-Z]*"'`

3. **Build green?**
   ```bash
   npm run typecheck && npm test
   ```
   All 53 tests pass, typecheck clean (a full production `npm run build` is worth one dry run before recording, but isn't required for `npm run dev`).

---

## 0:00–0:30 — The Hook

**On screen:** Dashboard (`/`) with the "LIVE STREAM" badge, KPI row, and audit trail already populated from seed data.

> "Every major agent framework — LangChain, AutoGPT, CrewAI — can already write code and call APIs on its own. The capability everyone's racing toward next is payments — Google, Visa, and Mastercard all shipped their own agent-payment protocols this year. But every one of those solves 'is this agent allowed to transact at all.' None of them answer: once it can, what exactly can it do, and how do you prove it never did more?
>
> MandateOS is that layer — a cryptographic financial operating system that sits between an AI agent and Razorpay, and makes overspending, replay attacks, and prompt injection mathematically impossible. Not policy-discouraged. Impossible.
>
> This board's been running the whole time we've been building — real agent transactions, real blocked attempts, all cryptographically accounted for in real time."

---

## 0:30–1:10 — Issuing a Mandate

**On screen:** `/mandates`

**Action:** Click **"+ Issue New Mandate"** and fill in:

| Field | Value |
|---|---|
| Agent Name | `VendorOps Purchasing Agent` |
| Per-Transaction Cap | ₹5,000 |
| Daily Cap | ₹25,000 |
| Lifetime Budget | ₹1,00,000 |
| Allowed Categories | `Cloud Servers, AI Inference, Developer Tools` |
| Max Silent Retries | 3 |

> "An agent can't move a single rupee without a Mandate — a cryptographically signed policy contract a human administrator issues to it, once, up front."

After clicking **Issue Mandate**, the success screen reveals the Ed25519 keypair:

> "That's an Ed25519 asymmetric keypair, generated on the spot. The agent gets the private key — every purchase request it ever makes must carry a valid signature from that exact key, or the firewall drops it before it touches the gateway. No key, no spend. Period."

---

## 1:10–3:00 — The Attack Gauntlet

**On screen:** `/attack`

> "Let's try to break it. The console ships six real attack scenarios fired straight at the live policy engine — the same tools a real adversary would reach for. We'll run five live."

Budget ~18s per attack: launch, let the verdict land, one sentence, move on.

| # | Scenario | Verdict | Say |
|---|---|---|---|
| 1 | Forged Signature ⚠ | `BLOCKED · INVALID_SIGNATURE` (HTTP 401) | "Garbage hex instead of a real signature. Ed25519 verification failed instantly — gate one." |
| 2 | Spending Cap Breach 💸 | `BLOCKED · LIMIT_EXCEEDED` (HTTP 403) | "₹5,000 cap, ₹9,99,999.99 requested. Deterministic integer math — no model to prompt-inject." |
| 3 | Unauthorized Category 🚫 | `BLOCKED · CATEGORY_BLOCKED` (HTTP 403) | "Luxury Sports Cars isn't whitelisted. Blocked before any gateway call." |
| 4 | Stale Timestamp ⏰ | `BLOCKED · STALE_REQUEST` (HTTP 401) | "±300 second freshness window. A ten-minute-old packet is dead on arrival." |
| 5 | Replay Attack 🔁 (**wow moment**) | `ALLOWED` then `REPLAY_DETECTED` (HTTP 409) | "First shot's legitimate. Second is a byte-for-byte replay — same nonce, same signature — and the unique-nonce constraint catches it instantly. A perfectly valid signature still can't be reused." |

> "Five attack vectors, five different cryptographic gates, five blocked verdicts — zero LLMs anywhere in that decision path. Pure deterministic policy math, averaging 3.2 milliseconds. There's a sixth scenario in here too, a malicious-owner replay, for anyone who wants to dig in after the demo."

---

## 3:00–3:45 — Autonomous Recovery

**On screen:** `/` — scroll to the Chaos Console. *(Requires the Inngest dev worker running.)*

> "What happens when Razorpay itself fails — a bank timeout, a dropped webhook? In most agent stacks, that either double-debits the customer or silently loses the transaction."

**Action:** Click **Inject Catastrophic Failure** (pre-set to Bank Timeout) → Live Transaction Feed shows `FAILED` → flips to `RECOVERED` after ~30s.

> "Watch the chain: PAYMENT_FAILED → SILENT_RETRY → SILENT_RETRY_SUCCESS. Every event gets sealed into the hash chain, retried with exponential backoff and jitter, and checked against Razorpay's own Orders API before we ever retry — so there's no double debit. The agent never even knew there was an outage."

**Fallback if 30s feels too long on camera:** inject the chaos failure back during the mandate-issuance section instead; it'll already read `RECOVERED` by the time you get here.

---

## 3:45–4:40 — Audit Chain & AI Diagnostics

**On screen:** `/trust`, then back to `/` for the Audit Trail card.

> "Every event — approvals, blocks, retries, settlements — gets sealed into a SHA-256 hash chain, each block carrying the hash of the one before it. Tamper with a single byte anywhere in that history and the chain shatters."

**Action:** Click **Publish State Anchor Now** → copy the anchor hash into the **Public Chain Verifier** → **Verify Integrity** → expect "Cryptographic anchor verified — chain intact" → **Export Signed Chain**.

> "An external auditor can verify this entire chain with zero access to our systems — just the anchor hash. Every export carries the mandate's own Ed25519 signature, so a compliance team knows it wasn't tampered with in transit either."

Then, on the dashboard's Audit Trail card, open any BLOCKED or FAILED entry:

> "On top of the deterministic firewall, every failure or block also gets read by Gemini 2.0 Flash, which turns it into a plain-English incident note. To be clear — that AI layer is advisory. It explains; it doesn't decide. The policy waterfall already made the deterministic call in three milliseconds."

**Fallback if Gemini is unavailable:** the deterministic fallback note still populates the audit entry — say "and Gemini would normally narrate this in plain English here."

---

## 4:40–5:00 — The Close

```typescript
import { MandateOSClient } from "mandateos";

const client = new MandateOSClient({ mandateId, secretKey });
await client.purchase({ amountPaise: 450000, category: "Cloud Infrastructure" });
```

> "Any agent framework — LangChain, AutoGPT, CrewAI — drops into MandateOS in three lines of TypeScript: Ed25519 signing, an eight-layer deterministic policy waterfall, durable Inngest-powered recovery, a tamper-evident audit chain, and Gemini diagnostics, all wired natively into Razorpay.
>
> Autonomous agents are the future of enterprise software. MandateOS is how the world hands them money and still sleeps at night. Thank you."

**60-second reset, if you're badly over time:** "MandateOS gives AI agents cryptographically signed spending mandates — Ed25519 signatures, replay-proof nonces, and hard integer spending caps — so overspending and replay attacks aren't discouraged, they're mathematically impossible. When the payment gateway itself fails, Inngest recovers automatically with zero double-debits, and every action is sealed into a tamper-evident, publicly verifiable audit chain. Three lines of code secures any agent framework."

---

## Backup plan: `npm run agent:simulate`

If the live Attack Console doesn't work for any reason (e.g. `agent.key` missing, DB not seeded), run the scripted simulation instead and narrate the terminal output live:

```bash
npm run agent:simulate
```

---

## Known demo dependencies

| Feature | Requires | Fallback |
|---------|----------|----------|
| Attack Console (live attacks) | `agent.key` (from `npm run seed`), seeded DB | `npm run agent:simulate` |
| Inngest recovery (FAILED → RECOVERED) | Inngest dev server running, seeded DB | Pre-seed the failure earlier in the flow and revisit already-`RECOVERED` |
| Gemini AI audit explanations | `GEMINI_API_KEY` set | Deterministic fallback kicks in automatically |
| Live SSE stream on dashboard | Dev server running, authenticated session | Dashboard polls every 30s as fallback |
| Chain verification | Seeded audit logs | Works with seed data; empty chain verifies as intact |
| Signed export | `agent.key` available | Export is emitted as UNSIGNED if key missing (explicitly labeled) |

---

## Timing cheat sheet

| Window | Section | Page | Key beat |
|---|---|---|---|
| 0:00–0:30 | Hook | `/` | Live stream badge + populated KPIs |
| 0:30–1:10 | Issue Mandate | `/mandates` | Create agent, reveal Ed25519 keypair |
| 1:10–3:00 | Attack Gauntlet | `/attack` | 5 live attacks, all BLOCKED |
| 3:00–3:45 | Recovery | `/` | Inject timeout → watch RECOVERED |
| 3:45–4:40 | Audit & AI | `/trust` | Publish + verify anchor, Gemini note |
| 4:40–5:00 | Close | `/` | 3-line SDK + closing line |

---

## Further reading

- [`docs/JUDGES-FAQ.md`](./JUDGES-FAQ.md) — straight answers to the objections judges are most likely to raise
- [`docs/CASE-STUDIES.md`](./CASE-STUDIES.md) — worked deployment scenarios and the threat model summary
- [`docs/ADR/`](./ADR/) — why each core technical decision was made, and what was ruled out
- [`docs/BUSINESS-CASE.md`](./BUSINESS-CASE.md) — market sizing and monetization model
