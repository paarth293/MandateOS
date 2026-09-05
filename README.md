# MandateOS 🛡️

### The Cryptographic Financial Operating System for Razorpay Agent Commerce

[![Live Demo](https://img.shields.io/badge/Live%20Demo-mandate--os--lovat.vercel.app-black?style=flat-square&logo=vercel)](https://mandate-os-lovat.vercel.app/)
[![Tests](https://img.shields.io/badge/Tests-53%2F53%20Passing%20(100%25)-emerald?style=flat-square)](TEST_REPORT.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue?style=flat-square)](package.json)
[![Biome](https://img.shields.io/badge/Code%20Style-Biome%20Clean-purple?style=flat-square)](biome.json)
[![Policy Latency](https://img.shields.io/badge/Avg%20Policy%20Decision-3.2ms-success?style=flat-square)](TEST_REPORT.md)
[![Crypto Engine](https://img.shields.io/badge/Security-Ed25519%20%2B%20SHA--256-indigo?style=flat-square)](docs/ADR/ADR-001-ed25519-detached-signatures.md)
[![Gateway](https://img.shields.io/badge/Razorpay-Native%20Integration-0C2340?style=flat-square&logo=razorpay)](https://razorpay.com)
[![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](#license)

MandateOS is the deterministic security, governance, and autonomous recovery control plane for AI Agent Commerce. It sits as a high-speed cryptographic firewall between autonomous AI agents (LangChain, AutoGPT, CrewAI, custom LLM runtimes) and payment rails (Razorpay), mathematically guaranteeing that agents cannot overspend, double-spend, get hijacked by prompt injections, or corrupt audit logs.

**No language model ever sits in the enforcement decision.** Every purchase is a cryptographically signed packet checked against deterministic integer math and database-level constraints — the same way a bank's core ledger works, not the way a chatbot's guardrails work.

---

## 🚀 Live Demo

**➡️ [mandate-os-lovat.vercel.app](https://mandate-os-lovat.vercel.app/)**

| Role | Email | Password | What it can do |
| :--- | :--- | :--- | :--- |
| **Owner** | `priya@mandateos.dev` | `MandateOS@2026` | Full access — issue mandates, launch attacks, inject chaos, publish/verify audit anchors |
| **Viewer** | `rahul@mandateos.dev` | `Viewer@2026` | Read-only — dashboards, transaction history, audit trail, no mutating actions |

The deployed instance runs against a seeded, populated database (three demo agent mandates, transaction history, an audit chain already several blocks deep) so the dashboard, charts, and attack console all have real data from the moment you log in — nothing to configure. For a guided walkthrough of exactly what to click and in what order, see the [**Demo Flow Guide**](docs/demo-flow.md).

> **Running your own attacks?** The live deployment's Attack Console targets whichever mandate you issue — `GATEWAY_MODE=mock`, so nothing ever touches a real Razorpay account.

---

## 📋 Table of Contents

- [The Problem](#-the-problem)
- [What Is a Mandate](#-what-is-a-mandate)
- [Key Features](#-key-features)
- [Architecture & Request Flow](#️-architecture--request-flow)
- [The 8-Gate Security Waterfall](#-the-8-gate-security-waterfall)
- [Try It Yourself: The Attack Console](#-try-it-yourself-the-attack-console)
- [Data Model](#-data-model)
- [Tech Stack](#️-tech-stack--foundations)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Testing & Quality](#-testing--quality)
- [API Reference](#-api-reference)
- [3-Line Agent Integration SDK](#-3-line-agent-integration-sdk)
- [Competitive Advantage Matrix](#-competitive-advantage-matrix)
- [Documentation Hub](#-documentation-hub)
- [Roadmap](#-roadmap)
- [License](#license)

---

## 🎯 The Problem

Every major agent framework — LangChain, AutoGPT, CrewAI — can already write code, provision infrastructure, and call APIs autonomously. The next capability everyone is racing toward is **payments**. In 2026 alone, Google shipped **AP2 (Agent Payments Protocol)**, Visa shipped its **Trusted Agent Protocol**, and Mastercard shipped **Agent Pay** — three independent, well-capitalized bets that agent-initiated transactions are about to become real volume, not a novelty.

All three solve the same narrow problem: **proving an agent is authorized to transact at all.** None of them answer the harder question — once an agent *is* authorized, exactly what is it bounded to do, and how do you *prove*, after the fact, that it never did more?

Today, teams answer that with one of two bad options:

- **Prompt-based guardrails** ("please don't spend more than ₹5,000") — probabilistic, jailbreakable with a single cleverly-worded injection, and unauditable, because there's no cryptographic proof the guardrail was ever actually checked.
- **Human-in-the-loop approval** for every transaction — safe, but defeats the entire point of giving an agent autonomy in the first place.

MandateOS is the layer underneath both approaches: a policy contract enforced by cryptography and integer math, not by asking a language model nicely.

---

## 🔑 What Is a Mandate

A **Mandate** is a signed, bounded, revocable grant of spending authority issued once by a human administrator to one specific agent. Issuing a mandate generates an **Ed25519 asymmetric keypair** — MandateOS keeps the public key, the agent keeps the private key, and it is never seen again after the issuance screen closes.

From that point on, every purchase request the agent makes must be:

1. **Signed** with that exact private key (detached Ed25519 signature over a canonically-serialized payload)
2. **Fresh** — timestamped within a ±300 second window
3. **Unique** — carrying a nonce that has never been used before, enforced by a database-level `UNIQUE` constraint
4. **Within policy** — under the mandate's per-transaction, daily, and lifetime spend caps, and restricted to its whitelisted merchant categories

Fail any one of those four checks and the request is rejected before it ever reaches Razorpay — and the attempt itself is still logged into the tamper-evident audit chain, whether it succeeded or not.

---

## ✨ Key Features

| Feature | What it does |
| :--- | :--- |
| 🔐 **Ed25519 Cryptographic Mandates** | Every agent gets its own asymmetric keypair; no shared secrets, no API keys that can be silently reused |
| 🧮 **8-Gate Deterministic Policy Waterfall** | Signature → replay → timestamp → per-tx cap → daily cap → lifetime cap → category whitelist → circuit breaker, all pure integer/cryptographic logic |
| 🔁 **Database-Level Replay Shield** | A `UNIQUE(mandate_id, nonce)` constraint means even a byte-perfect replay of a validly signed packet is rejected — atomically, with no race-condition window |
| ⚡ **Live Attack Console** | Fire 6 real attack scenarios — forged signature, cap breach, category breach, stale timestamp, replay, malicious-owner replay — against the running policy engine and watch it defend itself |
| ♻️ **Durable Autonomous Recovery** | Inngest-powered retry workflow with exponential backoff + jitter, idempotency-checked against Razorpay's own Orders API before every retry — zero double-debits |
| 🧯 **Gateway Circuit Breaker** | Trips after consecutive upstream failures and halts outbound traffic for a cooldown window instead of hammering a struggling gateway |
| 📒 **SHA-256 Tamper-Evident Audit Chain** | Every event forward-hash-chained from genesis; publish external anchors and let anyone verify chain integrity with zero access to internal systems |
| 🧾 **Signed, Exportable Compliance Trail** | One-click signed JSON export of the full audit chain for auditors and regulators |
| ✨ **Gemini-Powered Incident Diagnostics** | Google Gemini 2.0 Flash turns every failure/block into a plain-English note for a human compliance officer — strictly advisory, never in the enforcement path |
| 👥 **Role-Based Access** | Owner vs. Viewer roles, per-mandate ownership scoping — a viewer can watch, not spend |
| 🕹️ **Battle Arena & Chaos Console** | Inject synthetic gateway failures on demand and watch the recovery machinery handle them live |
| 📡 **Real-Time Dashboard** | Server-Sent Events push every policy verdict and transaction change to the UI instantly, with a 30s poll fallback if the stream drops |

---

## 🏗️ Architecture & Request Flow

<details open>
<summary><b>Show the full request-flow diagram</b></summary>

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            AI AGENT (LangChain / AutoGPT)                    │
│                                                                              │
│      const client = new MandateOSClient({ mandateId, secretKey });          │
│      await client.purchase({ amountPaise: 250000, category: "Cloud" });     │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │  Detached Ed25519 Signature Header
                               │  Canonical serialization: {mandateId, amount, nonce, timestamp}
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                   MANDATEOS 8-LAYER DETERMINISTIC WATERFALL                  │
│                                                                              │
│   Gate 1: Ed25519 Detached Signature Verify           → 401 on signature forgery  │
│   Gate 2: Nonce Replay Prevention (DB Unique Index)   → 409 on replayed packet   │
│   Gate 3: Timestamp Drift Window (±300s window)       → 401 on stale playback    │
│   Gate 4: Per-Transaction Limit Cap (paise)          → 403 on limit breach      │
│   Gate 5: Daily UTC Rolling Spend Ceiling             → 403 on daily cap breach  │
│   Gate 6: Lifetime Budget Ceiling                     → 403 on lifetime breach   │
│   Gate 7: Merchant Category Whitelist                 → 403 on unapproved sector │
│   Gate 8: Circuit Breaker & Razorpay Gateway Call     → 503 on upstream outage   │
└──────────────┬───────────────────────────────────────────────┬───────────────┘
               │ ✅ All 8 Gates Pass (<3.2ms avg)              │ ❌ Blocked at any gate
               ▼                                                ▼
┌──────────────────────────────┐                ┌──────────────────────────────┐
│   RAZORPAY PAYMENT GATEWAY   │                │   INSTANT REJECTION / LOG    │
│   Orders API + Capture       │                │   Persisted to Hash Chain    │
│   HMAC-SHA256 Webhook Sec    │                │   Surfaced in Battle Arena   │
└──────────────┬───────────────┘                └──────────────────────────────┘
               │ upstream failure / timeout (502/504)
               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      INNGEST DURABLE RECOVERY WORKFLOW                       │
│   • recover-failed-payment: exponential backoff + jitter                     │
│   • verify-status: checks Razorpay Orders API before retrying (0 double debits)│
│   • silent auto-recovery: restores transient transactions within retry budget│
│   • dead-letter quarantine: halts unrecoverable transactions for admin review│
└──────────────────────────────┬───────────────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 TAMPER-EVIDENT CRYPTOGRAPHIC AUDIT TRAIL                     │
│   SHA-256 Forward Hash Chain: H_n = SHA256(H_n-1 || payload || status)       │
│   Every block embeds the previous block's hash — tamper one byte, shatter    │
│   every hash after it                                                        │
│   • /api/verify/chain  — Auditor recomputes every block from genesis in ms   │
│   • /api/anchors       — Periodic external notarization checkpoints         │
│   • /api/export/chain  — Cryptographically signed compliance exports (JSON) │
└──────────────────────────────────────────────────────────────────────────────┘
```

</details>

Full rationale for the four load-bearing technical decisions in this diagram — with alternatives considered and trade-offs accepted — lives in [`docs/ADR/`](docs/ADR/).

---

## 🧱 The 8-Gate Security Waterfall

| Gate | Layer | Enforces | Blocked response |
| :-: | :--- | :--- | :--- |
| 1 | Ed25519 Signature Verify | The request genuinely came from this exact agent, unmodified | `401 INVALID_SIGNATURE` |
| 2 | Nonce Replay Prevention | This exact packet has never been submitted before (DB-level `UNIQUE` constraint) | `409 REPLAY_DETECTED` |
| 3 | Timestamp Drift Window | The packet is fresh — signed within the last 300 seconds | `401 STALE_REQUEST` |
| 4 | Per-Transaction Cap | The amount doesn't exceed this mandate's single-transaction ceiling | `403 LIMIT_EXCEEDED` |
| 5 | Daily UTC Rolling Cap | Cumulative spend today (UTC) plus this transaction stays under the daily ceiling | `403 DAILY_LIMIT_EXCEEDED` |
| 6 | Lifetime Budget Ceiling | Cumulative lifetime spend plus this transaction stays under the mandate's total budget | `403 LIFETIME_LIMIT_EXCEEDED` |
| 7 | Merchant Category Whitelist | The merchant's category is one this mandate was explicitly authorized for | `403 CATEGORY_BLOCKED` |
| 8 | Circuit Breaker + Gateway Call | The Razorpay gateway isn't already tripped from consecutive failures, then the order is placed | `503 CIRCUIT_BREAKER_OPEN` |

Average end-to-end decision latency across all 8 gates: **~3.2ms** (Ed25519 verification alone: **~0.8ms**) — see [`TEST_REPORT.md`](TEST_REPORT.md) for the measured benchmarks.

---

## 🎮 Try It Yourself: The Attack Console

The `/attack` page is a live-fire test harness — fire real attacks at the real policy engine running against the real database, and watch each one get blocked at a different gate.

| # | Scenario | What it tests | Result |
| :-: | :--- | :--- | :--- |
| 1 | **Forged Signature** | Garbage hex instead of a real Ed25519 signature | `BLOCKED` · `401` |
| 2 | **Spending Cap Breach** | A purchase far exceeding the per-transaction cap | `BLOCKED` · `403` |
| 3 | **Unauthorized Category** | A purchase from a merchant category not on the whitelist | `BLOCKED` · `403` |
| 4 | **Stale Timestamp** | A validly-signed packet timestamped outside the freshness window | `BLOCKED` · `401` |
| 5 | **Replay Attack** | The exact same signed packet fired twice — first is legitimate, second is a byte-for-byte replay | `ALLOWED` then `BLOCKED` · `409` |
| 6 | **Malicious Owner Replay** | Even the legitimate mandate owner can't reuse a nonce from their own past approval | `BLOCKED` · `409` |

No LLM is involved in evaluating any of these — every verdict is deterministic integer/cryptographic logic. A CLI fallback (`npm run agent:simulate`) fires the same scenarios from the terminal if you'd rather watch the raw output.

---

## 🗂️ Data Model

| Table | Purpose |
| :--- | :--- |
| `users` | Authenticated administrators, with `OWNER` / `VIEWER` roles and scrypt-hashed passwords |
| `sessions` | HMAC-signed session tokens |
| `mandates` | The signed policy contracts — caps, categories, Ed25519 public key, status |
| `merchants` | The authorized merchant catalog, one business category each |
| `transactions` | Settled/failed/recovering purchases, denormalized with the category they were authorized under |
| `purchase_attempts` | Every request the policy engine ever evaluated, allowed or blocked — carries the `UNIQUE(mandate_id, nonce)` constraint that makes replay prevention atomic |
| `auth_attempts` | Login attempt log, for brute-force rate limiting |
| `audit_logs` | The SHA-256 forward hash chain — every entry embeds the previous entry's hash |
| `anchors` | Periodically published external checkpoints of the audit chain, independently verifiable |

Schema and migrations are managed with **Drizzle ORM** (`drizzle-kit push` / `migrate`) — see [ADR-004](docs/ADR/ADR-004-drizzle-orm.md) for why the replay constraint specifically lives at the database layer rather than in application code.

---

## 🛠️ Tech Stack & Foundations

| Layer | Choice |
| :--- | :--- |
| Application Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Language | TypeScript, strict mode |
| Database & ORM | Neon Serverless PostgreSQL + Drizzle ORM |
| Durable Workflows | Inngest v4 (exponential backoff, idempotent recovery) |
| Cryptography | Ed25519 detached signatures (TweetNaCl) + SHA-256 hash chain |
| Payments | Razorpay (Orders API, HMAC-SHA256 webhook verification, mock mode for demo) |
| AI Diagnostics | Google Gemini 2.0 Flash via Vercel AI SDK (`@ai-sdk/google`) |
| UI | Tailwind CSS v4 (CSS-first `@theme`, no JS config) + Framer Motion |
| Charts | Recharts |
| Data Fetching | TanStack Query, with an SSE live-update channel |
| Validation | Zod |
| Testing | Vitest v4 (53 tests, 8 suites) |
| Linting / Formatting | Biome v2 |
| Deployment | Vercel |

---

## 📁 Project Structure

<details>
<summary><b>Show the high-level file tree</b></summary>

```
mandate_os/
├── docs/
│   ├── ADR/                     # Architecture decision records
│   ├── BUSINESS-CASE.md         # Market sizing & monetization model
│   ├── CASE-STUDIES.md          # Worked deployment scenarios + threat model
│   ├── JUDGES-FAQ.md            # Straight answers to technical objections
│   ├── demo-flow.md             # Presenter-facing demo script
│   └── fix-plan.md              # Historical bug-fix log
├── src/
│   ├── app/
│   │   ├── (app)/                # Authenticated app shell
│   │   │   ├── page.tsx          # Dashboard
│   │   │   ├── mandates/         # Issue & manage mandates
│   │   │   ├── attack/           # Live Attack Console
│   │   │   ├── trust/            # Audit chain explorer & public verifier
│   │   │   ├── transactions/     # Transaction history
│   │   │   ├── review/           # Quarantined transaction review queue
│   │   │   ├── arena/            # Battle Arena live event stream
│   │   │   └── settings/         # Account & danger-zone settings
│   │   ├── (auth)/login/         # Sign-in page
│   │   └── api/                  # All route handlers (see API Reference)
│   ├── components/                # Attack console, audit trail, sidebar, etc.
│   │   └── dashboard/             # KPI row, charts, budget bars, health strip
│   ├── lib/
│   │   ├── crypto.ts               # Ed25519 sign/verify, canonical stringify
│   │   ├── chain.ts                 # Hash chain construction & verification
│   │   ├── razorpay.ts              # Gateway client + circuit breaker
│   │   ├── rateLimit.ts             # Sliding-window rate limiter
│   │   └── sdk/                     # The MandateOSClient SDK
│   ├── server/
│   │   ├── policy.ts                 # evaluateMandatePolicy — the deterministic core
│   │   ├── recovery.ts               # Inngest recovery workflow logic
│   │   ├── ai.ts                     # Gemini incident diagnostics
│   │   ├── auth.ts, authz.ts         # Session auth & per-mandate ownership scoping
│   │   ├── schema.ts                 # Drizzle table definitions
│   │   └── seed.ts                   # Demo data seeding script
│   └── scripts/simulateAgent.ts       # CLI attack simulation (SDK fallback demo)
├── TEST_REPORT.md                     # Full test suite breakdown & benchmarks
└── presentation.md                    # Original 3-minute pitch script
```

</details>

---

## 🚀 Getting Started

### Option A: 1-Command Docker Setup

```bash
git clone https://github.com/paarth293/MandateOS.git
cd MandateOS
docker-compose up -d
```

Visit **http://localhost:3000**.

### Option B: Local Development

**1. Install dependencies**

```bash
npm install
```

**2. Configure environment** — copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql://neondb_owner:...@ep-....aws.neon.tech/neondb?sslmode=require
GATEWAY_MODE=mock
RAZORPAY_KEY_ID=rzp_test_mock
RAZORPAY_KEY_SECRET=rzp_secret_mock
RAZORPAY_WEBHOOK_SECRET=mock_webhook_secret
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
```

> The Gemini variable name matters — it must be exactly `GOOGLE_GENERATIVE_AI_API_KEY`, since that's what `@ai-sdk/google`'s default provider reads internally. Get one at [aistudio.google.com](https://aistudio.google.com/). If it's missing, the app still works — a deterministic fallback summary is used instead of a genuinely AI-generated one.

**3. Push schema & seed the database**

```bash
npm run db:push
npm run seed
```

Look for `🎉 MANDATEOS V3 SEED COMPLETED SUCCESSFULLY!` — this writes `agent.key` (the demo agent's Ed25519 private key, needed for the Attack Console) and populates users, merchants, mandates, transactions, and audit logs.

**4. Run the dev server**

```bash
npm run dev
```

**5. (Optional, for the recovery demo) Run the Inngest dev worker**

```bash
npx inngest-cli@latest dev
```

**6. Verify everything's green**

```bash
npm run check      # Biome linter & formatter
npm run typecheck  # TypeScript strict compiler
npm test           # Vitest (53/53)
```

---

## ✅ Testing & Quality

**53 / 53 tests passing across 8 suites** — cryptographic engine, hash chain integrity, end-to-end policy enforcement, the agent SDK, rate limiting, and more. Full breakdown, including per-test descriptions and measured latency benchmarks, is in [`TEST_REPORT.md`](TEST_REPORT.md).

```bash
npm run typecheck   # 0 errors, strict mode
npm run check       # Biome — 0 warnings
npm test            # Vitest — 53/53 passing
npm run build       # Production Turbopack build
```

---

## 🔌 API Reference

<details>
<summary><b>Show all route handlers</b></summary>

| Method | Route | Purpose |
| :--- | :--- | :--- |
| `POST` | `/api/agent/purchase` | The production purchase endpoint — full signature/replay/timestamp/policy waterfall |
| `POST` | `/api/agent/attack` | Attack Console backend — fires the 6 scripted attack scenarios against the live policy engine |
| `GET` | `/api/health` | Health probe — DB latency, gateway mode, Inngest status, policy engine status |
| `GET` / `POST` | `/api/mandates` | List / issue mandates |
| `GET` | `/api/dashboard` | Dashboard summary data (mandates, transactions, audit logs) |
| `GET` | `/api/analytics` | KPI summary, daily volume, category breakdown, per-agent budget utilization |
| `GET` / `POST` | `/api/anchors` | List / publish external audit chain anchors |
| `GET` | `/api/verify/chain` | Recompute and verify the hash chain from genesis (or from an anchor) |
| `GET` | `/api/export/chain` | Signed JSON export of the full audit chain |
| `POST` | `/api/chaos/trigger` | Inject a synthetic gateway failure (Chaos Console) |
| `GET` | `/api/review` | Quarantined transactions awaiting human review |
| `GET` | `/api/events/stream` | Server-Sent Events channel powering the live dashboard |
| `POST` | `/api/policy/simulate` | Dry-run a policy decision without persisting anything |
| `POST` | `/api/auth/login` / `/logout` | Session auth |
| `GET` | `/api/auth/me` | Current session user |
| `POST` | `/api/webhooks/razorpay` | Razorpay webhook receiver (HMAC-SHA256 verified) |
| `PUT` | `/api/inngest` | Inngest function registration endpoint |

</details>

---

## ⚡ 3-Line Agent Integration SDK

```typescript
import { MandateOSClient } from "mandateos";

// 1. Initialize with the mandate's credentials
const client = new MandateOSClient({
  mandateId: "mnd_8f190e2a_c41b_4892",
  secretKey: process.env.AGENT_ED25519_SECRET_KEY!,
});

// 2. Execute a deterministic, cryptographically signed transaction
const response = await client.purchase({
  amountPaise: 450000, // ₹4,500.00
  category: "Cloud Infrastructure",
});

// 3. Handle the deterministic outcome
if (response.ok) {
  console.log("Payment settled via Razorpay:", response.transactionId);
} else {
  console.error("Blocked by MandateOS Waterfall:", response.reason);
}
```

The SDK handles canonical serialization, Ed25519 signing, nonce generation, and timestamping internally — see `src/lib/sdk/index.ts`.

---

## 🥊 Competitive Advantage Matrix

| Dimension | MandateOS | DIY Guards | LLM Prompts / Guardrails | External Proxy |
| :--- | :---: | :---: | :---: | :---: |
| Mathematical enforcement | **100% deterministic (Ed25519 + integer math)** | ❌ Ad-hoc code | ❌ Probabilistic / hallucinates | ⚠️ Black-box |
| Prompt injection defense | **Immune by design** (outside the LLM's reach entirely) | ❌ Bypassable | ❌ Prone to jailbreaks | ⚠️ Partial |
| Replay protection | **DB-level unique-nonce constraint** | ⚠️ Custom code | ❌ None | ⚠️ Session-based |
| Tamper-evident ledger | **SHA-256 hash chain** | ❌ Mutable rows | ❌ None | ⚠️ Plain logs |
| Network failure handling | **Durable Inngest workflows** | ❌ Naive `try/catch` | ❌ Crashes on restart | ⚠️ Basic retries |
| Policy decision latency | **~3.2ms average** | 10–50ms | 800–2,500ms (LLM lag) | 80–200ms |
| Double-spend protection | **Atomic SQL + nonce check** | ⚠️ Race conditions | ❌ Non-existent | ⚠️ Redis lock |
| Developer onboarding | **3-line TypeScript SDK** | Weeks of dev | Days of prompting | Custom API client |

---

## 📚 Documentation Hub

| Document | What's in it |
| :--- | :--- |
| 🎬 [**Demo Flow Guide**](docs/demo-flow.md) | Full presenter script with timing, talking points, and fallbacks |
| 🎯 [**Judges & Evaluators FAQ**](docs/JUDGES-FAQ.md) | 9 direct answers to the technical objections judges raise most, each cross-referenced to code |
| 🏢 [**Enterprise Case Studies**](docs/CASE-STUDIES.md) | Two worked deployment scenarios plus a full threat-model table |
| ⚖️ [**Architecture Decision Records**](docs/ADR/) | Why Ed25519, SHA-256 chaining, Inngest, and Drizzle were chosen — alternatives ruled out, trade-offs accepted |
| 💼 [**Business Case & Monetization Model**](docs/BUSINESS-CASE.md) | TAM model grounded in Razorpay's reported scale, monetization strategy, go-to-market sequencing |
| 📊 [**Formal Test Report**](TEST_REPORT.md) | All 53 tests, suite-by-suite, with measured latency benchmarks |

---

## 🗺️ Roadmap

- **Mandate delegation** — an agent issuing a narrower sub-mandate to another agent it spawns, with the child's caps mathematically bounded by the parent's remaining budget
- **Automated key rotation** — an SLA-backed rotation flow instead of today's manual revoke-and-reissue
- **Protocol adapters** for Google AP2 / Visa Trusted Agent Protocol / Mastercard Agent Pay, so MandateOS can sit natively behind any of them as the enforcement layer
- **Multi-gateway support** beyond Razorpay

---

## License

MandateOS is released under the **MIT License**. Built for the **Razorpay Buildathon 2026**.
