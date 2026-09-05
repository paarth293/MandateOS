# MandateOS 🛡️

**Cryptographically Secure Policy Engine for Autonomous AI Agents**

MandateOS is the security and governance control plane for agentic commerce. It acts as a deterministic, mathematically verifiable firewall between an AI (like AutoGPT, LangChain, or custom autonomous agents) and payment gateways (like Razorpay).

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            AI AGENT (LangChain / AutoGPT)                    │
│                                                                              │
│      const client = new MandateOSClient({ mandateId, secretKey });          │
│      await client.purchase({ amountPaise, category });   ← 3-line SDK       │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │  Ed25519-signed request
                               │  (canonical payload + nonce + timestamp)
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         MANDATEOS POLICY FIREWALL                            │
│                                                                              │
│   1. Signature verification (Ed25519, detached)          → 401 on forgery   │
│   2. Timestamp drift window (±300s)                      → 401 on stale     │
│   3. Nonce replay shield (DB unique constraint)          → 409 on replay    │
│   4. Sliding-window rate limit (60 req/min/mandate)      → 429 on flood     │
│   5. Deterministic policy engine (pure code, no LLM):                       │
│        • per-transaction cap        • daily spend ceiling                    │
│        • lifetime spend ceiling     • merchant category whitelist            │
│        • retry budget               • mandate expiry/status                  │
└──────────────┬───────────────────────────────────────────────┬───────────────┘
               │ authorized                                     │ blocked/quarantined
               ▼                                                ▼
┌──────────────────────────────┐                ┌──────────────────────────────┐
│   PAYMENT GATEWAY            │                │   HUMAN REVIEW QUEUE         │
│   Razorpay (live) or mock    │                │   /review — approve retry    │
│   + circuit breaker          │                │   or acknowledge incident    │
└──────────────┬───────────────┘                └──────────────────────────────┘
               │ payment.captured / payment.failed (HMAC-verified webhook)
               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                      INNGEST DURABLE WORKFLOWS                               │
│   • recover-failed-payment: exponential backoff + jitter, atomic retry       │
│     budget claim, silent recovery                                            │
│   • generate-audit-log: Gemini plain-English diagnosis → hash chain          │
│   • reconcile-stale-orders (cron): resolves hung gateway orders              │
│   • publish-audit-anchor (cron): Merkle checkpoint per mandate                │
│   • prune-stale-data (cron): bounds rate-limit/nonce/session tables          │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                 CRYPTOGRAPHIC AUDIT TRAIL (SHA-256 chain)                    │
│   Append-only blocks, fork-proof via UNIQUE (mandate_id, previous_hash).    │
│   • /api/verify/chain  — recompute every block from genesis                  │
│   • /api/anchors       — external checkpoints for third-party auditors       │
│   • /api/export/chain  — signed (Ed25519) CSV/JSON export for compliance     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏆 Why This Wins

**Most agentic-payment demos trust the LLM. MandateOS never does.** Policy evaluation is pure deterministic integer math — prompt injection, jailbreaks, and hallucinated amounts cannot change what the firewall enforces.

| Property | How it's guaranteed |
| :--- | :--- |
| Agents can't overspend | Hard caps in paise (integer math) enforced before any gateway call |
| Attackers can't replay | Database-level nonce uniqueness — survives restarts & multiple instances |
| Attackers can't forge | Ed25519 detached signatures over a canonically-serialized payload |
| Logs can't be tampered | SHA-256 chain; forks made impossible by a DB unique index |
| Auditors don't trust us | They recompute the chain themselves via the public verifier & signed exports |
| Failures self-heal | Inngest durable workflows with atomic retry budgets — no double spends |
| Humans stay in control | Quarantine queue for exhausted retries; revoke = hard block in <1s |

---

## 🚀 Key Architectural Pillars

1. **Deterministic Policy Engine**: Humans establish immutable mandate policies (e.g., maximum transaction amount, daily/lifetime spend caps, approved merchant categories, and silent retry ceilings). Policies are evaluated deterministically in pure code, preventing AI hallucinations from draining funds.
2. **Deterministic & Resilient Gateway (`GATEWAY_MODE`)**: Supports both live Razorpay processing and zero-dependency offline simulation (`GATEWAY_MODE=mock`). In mock mode, failures (`BANK_TIMEOUT`, `INSUFFICIENT_FUNDS`) and recoveries operate deterministically for offline demonstrations.
3. **Durable Chaos & Recovery (Inngest)**: Catches downstream gateway failures, executes intelligent backoff cooldowns, and performs silent retries with idempotency without disrupting the AI Agent.
4. **Cryptographic Hash Chain & AI Audit Trail**: Every system action and failure analysis from Google Gemini is hashed into an append-only SHA-256 chain linked to the previous block's hash. Any modification breaks verification across all subsequent blocks.
5. **Fork-Proof Chain Writes**: A unique `(mandate_id, previous_hash)` index makes hash-chain forks physically impossible at the database level — concurrent audit writers (Inngest workers, revocations) can never race each other into a broken chain.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router) + React 19
- **Database**: Neon Postgres (Serverless) + Drizzle ORM
- **Workflow & Queues**: Inngest v4
- **AI & Schemas**: Google Gemini (Vercel AI SDK) + Zod
- **Cryptography**: Ed25519 (TweetNaCl) + SHA-256
- **Styling & Motion**: Tailwind CSS v4 + Framer Motion

---

## 💻 Local Setup & Development

### 1. Clone & Install
```bash
git clone https://github.com/paarth293/MandateOS.git
cd MandateOS
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=postgresql://neondb_owner:...@ep-....aws.neon.tech/neondb?sslmode=require

# Gateway Mode (mock for offline demo, live for real Razorpay)
GATEWAY_MODE=mock
RAZORPAY_KEY_ID=rzp_test_mock
RAZORPAY_KEY_SECRET=mock_secret
RAZORPAY_WEBHOOK_SECRET=mock_webhook_secret

# AI Audit Trail
GEMINI_API_KEY=your_gemini_api_key

# Inngest (Optional locally with Inngest Dev Server)
INNGEST_EVENT_KEY=local
INNGEST_SIGNING_KEY=local
```

### 3. Database Schema & Seed
```bash
# Push schema to database
npm run db:push

# Populate database with demo users, mandates, and historical transactions
npm run seed
```

### 4. Run the Application
```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Inngest local dev server
npx inngest-cli@latest dev

# Terminal 3: Simulate AI Agent purchase requests
npx tsx src/scripts/simulateAgent.ts
```
