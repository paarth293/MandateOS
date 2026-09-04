# MandateOS 🛡️

**Cryptographically Secure Policy Engine for Autonomous AI Agents**

MandateOS is the security and governance control plane for agentic commerce. It acts as a deterministic, mathematically verifiable firewall between an AI (like AutoGPT, LangChain, or custom autonomous agents) and payment gateways (like Razorpay).

---

## 🚀 Key Architectural Pillars

1. **Deterministic Policy Engine**: Humans establish immutable mandate policies (e.g., maximum transaction amount, daily/lifetime spend caps, approved merchant categories, and silent retry ceilings). Policies are evaluated deterministically in pure code, preventing AI hallucinations from draining funds.
2. **Deterministic & Resilient Gateway (`GATEWAY_MODE`)**: Supports both live Razorpay processing and zero-dependency offline simulation (`GATEWAY_MODE=mock`). In mock mode, failures (`BANK_TIMEOUT`, `INSUFFICIENT_FUNDS`) and recoveries operate deterministically for offline demonstrations.
3. **Durable Chaos & Recovery (Inngest)**: Catches downstream gateway failures, executes intelligent backoff cooldowns, and performs silent retries with idempotency without disrupting the AI Agent.
4. **Cryptographic Hash Chain & AI Audit Trail**: Every system action and failure analysis from Google Gemini is hashed into an append-only SHA-256 chain linked to the previous block's hash. Any modification breaks verification across all subsequent blocks.

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
