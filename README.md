# MandateOS 🛡️

### The Cryptographic Financial Operating System for Razorpay Agent Commerce

[![Tests](https://img.shields.io/badge/Tests-53%2F53%20Passing%20(100%25)-emerald?style=flat-square)](TEST_REPORT.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict%20Mode-blue?style=flat-square)](package.json)
[![Biome](https://img.shields.io/badge/Code%20Style-Biome%20Clean-purple?style=flat-square)](biome.json)
[![Policy Latency](https://img.shields.io/badge/Avg%20Policy%20Decision-3.2ms-success?style=flat-square)](TEST_REPORT.md)
[![Crypto Engine](https://img.shields.io/badge/Security-Ed25519%20%2B%20SHA--256-indigo?style=flat-square)](docs/ADR/ADR-001-ed25519-detached-signatures.md)
[![Gateway](https://img.shields.io/badge/Razorpay-Native%20Integration-0C2340?style=flat-square&logo=razorpay)](https://razorpay.com)

MandateOS is the deterministic security, governance, and autonomous recovery control plane for AI Agent Commerce. It sits as a high-speed cryptographic firewall between autonomous AI agents (LangChain, AutoGPT, CrewAI, custom LLM runtimes) and payment rails (Razorpay), mathematically guaranteeing that agents cannot overspend, double-spend, get hijacked by prompt injections, or corrupt audit logs.

---

## 📑 Strategic Documentation Hub

| Document | Purpose & Target Audience |
| :--- | :--- |
| 💼 **[Business Case & Monetization Model](docs/BUSINESS-CASE.md)** | TAM breakdown, Razorpay ecosystem monetization, unit economics, and 3–5 bps fee model. |
| 🏢 **[Enterprise Case Studies & Scenarios](docs/CASE-STUDIES.md)** | Production deployment profiles (CloudOps AI, FinServe AI) and threat incident playbooks. |
| ⚖️ **[Architecture Decision Records (ADRs)](docs/ADR/)** | Deep architectural rationale (Ed25519 signatures, SHA-256 forward chains, Inngest durability, Drizzle ORM). |
| 🎯 **[Judges & Evaluators FAQ](docs/JUDGES-FAQ.md)** | Pre-answered security objections: prompt injection immunity, key compromise SLA, double-spending. |
| 📊 **[Formal Test Report & Benchmarks](TEST_REPORT.md)** | 53 automated unit/E2E test breakdown, P99 latency benchmarks (<5ms), and threat mitigation matrix. |
| 🎬 **[Demo Flow Guide](docs/demo-flow.md)** | Step-by-step judge demonstration script with live terminal commands and UI checkpoints. |

---

## 🏗️ Architecture & Request Flow

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
│   Gate 4: Per-Transaction Limit Cap (paise)          → 400 on limit breach      │
│   Gate 5: Daily UTC Rolling Spend Ceiling             → 400 on daily cap breach  │
│   Gate 6: Lifetime Budget Ceiling                     → 400 on lifetime breach   │
│   Gate 7: Merchant Category Whitelist                 → 403 on unapproved sector │
│   Gate 8: Circuit Breaker & Razorpay Gateway Call     → 503 on upstream outage   │
└──────────────┬───────────────────────────────────────────────┬───────────────┘
               │ ✅ All 8 Gates Pass (<3.2ms)                  │ ❌ Blocked at any gate
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
│   Fork-proof via PostgreSQL constraint: UNIQUE(mandate_id, previous_hash)    │
│   • /api/verify/chain  — Auditor recomputes every block from genesis in ms   │
│   • /api/anchors       — Periodic Merkle root notarization                   │
│   • /api/export/chain  — Cryptographically signed compliance exports (CSV/JSON)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🥊 Competitive Advantage Matrix

| Feature / Dimension | MandateOS | DIY Guards | LLM Prompts / NeMo | External Proxy |
| :--- | :---: | :---: | :---: | :---: |
| **Mathematical Enforcement** | **100% Deterministic (Ed25519 + Integer Math)** | ❌ Ad-hoc code | ❌ Probabilistic / Hallucinates | ⚠️ Black-box |
| **Prompt Injection Defense** | **Immune by Design** (Outside LLM context) | ❌ Bypassable | ❌ Prone to jailbreaks | ⚠️ Partial |
| **Replay Protection** | **DB Unique Nonce Constraint** | ⚠️ Custom code | ❌ None | ⚠️ Session-based |
| **Tamper-Evident Ledger** | **SHA-256 Hash Chain** | ❌ Mutable DB rows | ❌ None | ⚠️ CloudWatch logs |
| **Network Failure Handling** | **Durable Inngest Workflows** | ❌ Naive `try/catch` | ❌ Crash on restart | ⚠️ Basic retries |
| **Policy Decision Latency** | **3.2 ms Average** | 10–50 ms | 800–2,500 ms (LLM lag) | 80–200 ms |
| **Double-Spend Protection** | **Atomic SQL + Nonce Check** | ⚠️ Race conditions | ❌ Non-existent | ⚠️ Redis lock |
| **Developer Onboarding** | **3-Line TypeScript SDK** | Weeks of dev | Days of prompting | Custom API client |

---

## ⚡ 3-Line Agent Integration SDK

Any autonomous agent can be secured with MandateOS in minutes:

```typescript
import { MandateOSClient } from "@mandateos/sdk";

// 1. Initialize client with mandate credentials
const client = new MandateOSClient({
  mandateId: "mnd_8f190e2a_c41b_4892",
  secretKey: process.env.AGENT_ED25519_SECRET_KEY!,
});

// 2. Execute deterministic, cryptographically signed transaction
const response = await client.purchase({
  merchantId: "merch_aws_cloud_infrastructure",
  amountPaise: 450000, // ₹4,500.00
  currency: "INR",
  category: "Cloud Infrastructure",
});

// 3. Handle deterministic outcome
if (response.ok) {
  console.log("Payment settled via Razorpay:", response.transactionId);
} else {
  console.error("Blocked by MandateOS Waterfall:", response.reason);
}
```

---

## 🛠️ Tech Stack & Foundations

- **Application Framework**: Next.js 16 (App Router, Turbopack) + React 19
- **Database & Persistence**: Neon Serverless PostgreSQL + Drizzle ORM
- **Durable Workflows**: Inngest v4
- **Cryptography**: Ed25519 (Detached Signatures via TweetNaCl) + SHA-256
- **UI & Motion**: Tailwind CSS v4 + Framer Motion (Glassmorphism & Animated Counters)
- **AI Diagnostics**: Google Gemini 2.0 Flash via Vercel AI SDK
- **Testing & Verification**: Vitest v4 (53 tests) + Biome v2 (Strict formatting & linting)

---

## 🚀 Quick Start

### Option A: 1-Command Docker Setup
```bash
# Clone the repository
git clone https://github.com/paarth293/MandateOS.git
cd MandateOS

# Launch MandateOS, PostgreSQL, and Inngest in one command
docker-compose up -d
```
Visit **http://localhost:3000** in your browser.

---

### Option B: Local Development

#### 1. Install Dependencies
```bash
npm install
```

#### 2. Configure Environment
Create a `.env` file (or copy from `.env.example`):
```env
DATABASE_URL=postgresql://neondb_owner:...@ep-....aws.neon.tech/neondb?sslmode=require
GATEWAY_MODE=mock
RAZORPAY_KEY_ID=rzp_test_mock
RAZORPAY_KEY_SECRET=rzp_secret_mock
RAZORPAY_WEBHOOK_SECRET=mock_webhook_secret
GEMINI_API_KEY=your_gemini_api_key
ADMIN_TOKEN=mandateos_secure_admin_token
```

#### 3. Push Schema & Seed DB
```bash
# Push schema migrations
npm run db:push

# Seed database with mandates, demo agents, and initial hash chains
npm run seed
```

#### 4. Run the Dev Server
```bash
npm run dev
```

#### 5. Verify Full Test Suite
```bash
npm run check      # Biome linter & formatter (0 errors)
npm run typecheck  # TypeScript strict compiler (0 errors)
npm test           # Vitest test suite (53/53 passed)
```

---

## 🛡️ License

MandateOS is released under the **MIT License**. Built for the **Razorpay Buildathon 2026**.
