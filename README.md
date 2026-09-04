# MandateOS 🛡️

**Cryptographically Secure Policy Engine for Autonomous AI Agents**

MandateOS is the infrastructure layer that allows humans to safely give AI Agents money. It acts as a deterministic, mathematically verifiable firewall between an AI (like AutoGPT or LangChain) and a payment gateway (like Razorpay). 

## 🚀 The Architecture

1. **Deterministic Policy Engine**: Humans set strict, immutable rules (e.g., "Only buy Cloud Servers, maximum ₹5,000, max 3 silent retries"). AI Agents cannot hallucinate their way past this firewall.
2. **The Chaos Engine (Resiliency)**: Built on **Inngest**, MandateOS handles catastrophic gateway failures (like a `504 BANK_TIMEOUT`) by safely putting the transaction to sleep and executing a "Silent Retry" 30 seconds later, completely abstracting the failure away from the AI.
3. **Cryptographic Hash Chain**: Every action the system takes is verified by **Google Gemini** (generating a plain-English explanation) and then mathematically locked into a SHA-256 Hash Chain. If a single byte of the audit log is tampered with, the entire chain breaks.

## 🛠️ Tech Stack
- **Framework**: Next.js 15 (App Router) + React
- **Database**: Neon Postgres (Serverless) + Drizzle ORM
- **Durability/Jobs**: Inngest (Serverless Queues)
- **AI**: Google Gemini (Vercel AI SDK)
- **Cryptography**: Ed25519 (TweetNaCl) + SHA-256

## 💻 Local Setup
1. Clone the repository
2. `npm install`
3. Add your `.env` variables (Neon, Razorpay, Gemini, Inngest)
4. `npm run db:push` to sync the schema
5. `npm run db:seed` to populate the dashboard
6. `npm run dev` to start the application
