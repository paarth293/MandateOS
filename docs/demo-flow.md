# MandateOS — Hackathon Demo Flow

**Target runtime:** `npm run dev` (Next.js) + `npx inngest-cli@latest dev` (Inngest local) + `npm run seed` (DB + agent.key).
**Demo credential:** `priya@mandateos.dev` / `MandateOS@2026`.

---

## Pre-demo checklist (30 seconds)

1. **Database seeded?**
   ```bash
   npm run seed
   ```
   Look for: `🎉 MANDATEOS V3 SEED COMPLETED SUCCESSFULLY!` and the agent secret key printed at the bottom. This writes `agent.key` (the Ed25519 private key) and populates users, merchants, mandates, transactions, audit logs, and anchors.

2. **Env file present?** Copy `.env.example` → `.env` if not already done. Ensure `DATABASE_URL` points at the seeded Neon DB, `GATEWAY_MODE=mock`, and `AGENT_KEY_PATH=./agent.key`.

3. **Services running?**
   - Terminal 1: `npm run dev` on `http://localhost:3000`
   - Terminal 2: `npx inngest-cli@latest dev` (local Inngest dev server)
   - Terminal 3 (optional): `npm run agent:simulate` — only if you want the pre-scripted attack demo as a backup.

4. **Build green?**
   ```bash
   npm run typecheck && npm test && npm run build
   ```
   All 53 tests pass, typecheck clean, production build completes.

---

## Opening (0:00–0:30) — The Hook

**On screen:** Dashboard (`http://localhost:3000`) with the live "LIVE STREAM" badge, KPI row, volume chart, and audit trail showing "Chain Verified ✓".

**Talking points:**
> "Right now, autonomous AI agents are writing code, negotiating contracts, and orchestrating cloud infrastructure. But the moment you give an agent financial autonomy — access to corporate credit cards, bank APIs, or UPI rails — you face the trillion-dollar Agent Safety Dilemma: *how do you mathematically guarantee an autonomous agent won't hallucinate and drain your treasury?*
>
> Most teams either handicap their agents with manual human approvals, or gamble on fuzzy LLM system prompts that can be jailbroken with a single trick.
>
> The solution is **MandateOS** — the world's first cryptographically verified, deterministic policy firewall and autonomous financial operating system for AI agents."

**Show:**
- The **Health Strip** at the top (green dot, "All Systems Operational").
- The **LIVE STREAM** badge pulsing green (SSE connected).

---

## The Cryptographic Trust Core (0:30–1:00)

**On screen:** `/mandates` page.

**Action:** Click "+ Issue New Mandate" → fill the modal:
- Agent name: `AutoGPT Procurement Agent`
- Per-Txn Cap: `5000`
- Daily Cap: `25000`
- Lifetime Cap: `100000`
- Allowed Categories: `Cloud Servers, AI Inference, APIs`
- Max Silent Retries: `3`
- Retry Delay: `30s`

Click **Issue Mandate**.

**Show:**
- The modal flips to "Mandate Issued Successfully" with the **Ed25519 Secret Key** displayed. This is the agent's signing key — the agent must hold it to spend *anything*.
- Point to the **Public Key** shown on the mandate card. "Every purchase request the agent sends must be signed with this key pair. No key, no spend."

**Talking points:**
> "When a human administrator provisions an agent, MandateOS issues an Ed25519 cryptographic keypair. Every purchase request must be canonically serialized, signed with the private key, timestamped within 300 seconds, and stamped with a unique cryptographic nonce.
>
> Our backend enforces zero-trust policy evaluation: signature verification, replay attack shield via database-level nonce uniqueness, and mathematical caps that prompt injections cannot change because it's integer math — not an LLM."

---

## Live Agent Commerce & Attack Demo (1:00–1:45)

**Primary demo path:** Use the **Attack Console** (new page, `/attack`) — this is the interactive moment where judges can *try to break it themselves*.

**On screen:** `/attack` page (or the Attack Console embedded on the dashboard).

**Step 1: Legitimate purchase via the SDK (if time permits)**
If the agent script is running in Terminal 3:
```
Scenario 1 — SDK INTEGRATION DEMO
   -> SDK verdict: ✅ AUTHORIZED (HTTP 200)
```
This shows the 3-line SDK integration working.

**Step 2: Forged Signature attack**
- In the Attack Console, select **"Forged Signature ⚠"**.
- Click **Launch Attack**.
- **Expected verdict:** `BLOCKED` — `INVALID_SIGNATURE: Asymmetric cryptographic signature mismatch` (HTTP 401).
- **Show the signature field:** `ffffffffffffffffffffffff…` — garbage hex. "The agent didn't have the real key, so it submitted garbage. The firewall verified the detached Ed25519 signature against the mandate's public key and rejected it immediately."

**Step 3: Spending Cap Breach**
- Select **"Spending Cap Breach 💸"**.
- Click **Launch Attack** (uses the pre-filled ₹999,999.99 or adjust).
- **Expected verdict:** `BLOCKED` — `LIMIT_EXCEEDED: …` (HTTP 403).
- **Show the policy detail dropdown:** per-tx cap ₹5,000 vs requested ₹999,999.99. "Deterministic integer math enforces the limit. No prompt injection can change it."

**Step 4: Unauthorized Category**
- Select **"Unauthorized Category 🚫"**.
- Click **Launch Attack** (pre-filled "Luxury Sports Cars").
- **Expected verdict:** `BLOCKED` — `CATEGORY_BLOCKED: Merchant category 'Luxury Sports Cars' is not authorized.` (HTTP 403).

**Step 5: Stale Timestamp**
- Select **"Stale Timestamp ⏰"**.
- Click **Launch Attack**.
- **Expected verdict:** `BLOCKED` — `STALE_REQUEST: Request timestamp is outside the allowed 300-second verification window` (HTTP 401).
- **Show the policy detail:** timestamp drift 400s (limit 300s).

**Step 6: Replay Attack (the wow moment)**
- Select **"Replay Attack 🔁"**.
- Click **Launch Attack** — the console fires a nominal packet, then immediately re-submits it with the same nonce.
- **Expected verdict on the second attempt:** `REPLAY_DETECTED` (HTTP 409).
- **Show the nonce:** the same value was used twice. "The database unique-nonce constraint detects the replay. Even if an attacker intercepts a valid packet and replays it verbatim, MandateOS returns 409 REPLAY_DETECTED."

**Talking points (between attacks):**
> "Six attack scenarios, six different firewall layers, six blocked verdicts. No LLM in the loop — just deterministic Ed25519 verification, database-enforced replay protection, integer spending caps, category whitelisting, and timestamp drift checks."

---

## Resiliency, Circuit Breakers & Inngest State Machine (1:45–2:20)

**On screen:** Dashboard, then **Chaos Console**.

**Action:**
1. On the dashboard, point to the **Live Transaction Feed** — it's currently empty or showing seed data.
2. Open the **Chaos Console** (on the dashboard, below the Attack Console, or at `/`).
3. Click **"Inject Catastrophic Failure"** (pre-set to BANK_TIMEOUT).
4. **Expected:** A toast appears: "Failure injected on transaction … Inngest will silently retry it after a 30s backoff. Watch the live feed."
5. **Watch the Live Feed** — after ~30 seconds, the transaction transitions from FAILED → RECOVERED.
6. Point to the audit trail — a new block appears: `PAYMENT_FAILED` → `SILENT_RETRY` → `SILENT_RETRY_SUCCESS`, each cryptographically chained.

**Talking points:**
> "Now, what happens when the real world fails? Payment gateways suffer bank timeouts, webhook drops, and 504 gateway errors.
>
> In traditional systems, agents panic and spam retries, triggering fraud blocks. In MandateOS, **Inngest** powers a resilient payment state machine: exponential backoff with jitter, gateway circuit breaker that trips after 5 consecutive failures, and a quarantine review queue where compliance teams can inspect and approve retries with one click."

**Fallback if the 30s wait is too long for the demo:**
- Trigger the chaos injection earlier in the flow.
- While waiting, continue with the audit chain demo (next section).
- Come back to the RECOVERED transaction at the end.

---

## Verifiable Audit Chains & External Anchors (2:20–2:50)

**On screen:** `/trust` — the Cryptographic Trust & Anchor Explorer.

**Action:**
1. Click **"Publish State Anchor Now"**.
2. Show the anchor appearing in the chain: HEAD ANCHOR with its SHA-256 anchor hash.
3. Copy the anchor hash.
4. Go to the **Public Chain Verifier** input at the top of the Trust page.
5. Paste the anchor hash, click **Verify Integrity**.
6. **Expected:** "Cryptographic anchor verified. SHA-256 block chain integrity is intact." with the anchor details below.

**Show:**
- The **Public Chain Verifier** — zero credentials required. "External auditors don't need access to our internal systems. They can independently verify the chain integrity using only the anchor hash."
- Click **Export Signed Chain** (top right of Trust page) → downloads a JSON file with the full audit chain, manifest hash, and signature status.

**Talking points:**
> "Every policy check, retry, and settlement is analyzed by Google Gemini for plain-English incident explanations and sealed into a SHA-256 Cryptographic Hash Chain.
>
> Notice the 'Chain Verified ✓' badge. Our verification engine recomputes every block from genesis. If a malicious actor tampers with a single byte in the database, the hash chain shatters instantly.
>
> Furthermore, MandateOS periodically publishes external **Audit Anchors** — immutable cryptographic checkpoints that external regulators and auditors can independently verify without access to internal systems."

**Fallback if Gemini is unavailable:**
- The AI analysis has a deterministic fallback (already in the code). The audit log will still show a structured entry, just with a synthetic summary instead of a Gemini-generated one. This is fine for the demo — the hash chain integrity is independent of the AI layer.

---

## The Close (2:50–3:00)

**On screen:** Return to the dashboard, or show the SDK code snippet.

**Action:** If the mandate issuance modal is still open, point to the SDK snippet at the bottom:
```typescript
import { MandateOSClient } from "mandateos";
const client = new MandateOSClient({ mandateId, secretKey });
await client.purchase({ amountPaise, category });
```

**Talking points:**
> "MandateOS turns reckless agent commerce into provably secure, enterprise-ready transactions. With our plug-and-play TypeScript SDK, any AI agent framework — from LangChain to AutoGPT — can be secured in three lines of code.
>
> Autonomous agents are the future of work. MandateOS is how the world will trust them with money.
>
> Thank you."

---

## Backup plan: `npm run agent:simulate`

If the live Attack Console doesn't work for some reason (e.g., agent.key missing, DB not seeded), run the scripted simulation as a backup:

```bash
npm run agent:simulate
```

This fires 6 pre-scripted scenarios against the seeded mandate and prints the verdicts in the terminal. You can narrate along while the terminal output shows the results. The script now uses the **MandateOSClient SDK** for the legitimate purchase (Scenario 1) and raw crypto for the attack scenarios, exactly matching the pitch.

**Pre-scripted scenarios in the simulate script:**
1. Legitimate purchase via SDK (should succeed)
2. Spending limit exceeded (should block — LIMIT_EXCEEDED)
3. Unauthorized category (should block — CATEGORY_BLOCKED)
4. Stale timestamp (should block — STALE_REQUEST)
5. Tampered signature forgery (should block — INVALID_SIGNATURE)
6. Replay attack (should block — REPLAY_DETECTED)

---

## Known demo dependencies

| Feature | Requires | Fallback |
|---------|----------|----------|
| Attack Console (live attacks) | `agent.key` (from `npm run seed`), seeded DB | Use `npm run agent:simulate` script instead |
| Inngest recovery (CHAOS → RECOVERED) | Inngest dev server running, seeded DB with a FAILED transaction | Pre-seed a FAILED transaction in the DB; narrate the expected flow if the 30s wait is too long |
| Gemini AI audit explanations | `GEMINI_API_KEY` set | Deterministic fallback kicks in automatically (code already handles this) |
| Live SSE stream on dashboard | Dev server running, authenticated session | Dashboard polls every 30s as fallback |
| Chain verification | Seeded audit logs | Works with seed data; empty chain verifies as intact |
| Signed export | `agent.key` available | Export is emitted as UNSIGNED if key missing (explicitly labeled) |
| HMAC session cookies | `SESSION_SECRET` set in production | Dev fallback used in local demos (documented in `.env.example`) |

---

## Timing cheat sheet

| Section | Duration | Page/Screen | Key action |
|---------|----------|-------------|------------|
| Hook | 0:00–0:30 | Dashboard (`/`) | Show LIVE STREAM badge, Health Strip |
| Cryptographic Trust Core | 0:30–1:00 | `/mandates` | Issue new mandate, show Ed25519 keypair |
| Live Agent Commerce & Attacks | 1:00–1:45 | `/attack` or Dashboard Attack Console | Launch 6 attacks, show BLOCKED verdicts |
| Resiliency & Inngest | 1:45–2:20 | Dashboard Chaos Console | Inject failure, watch RECOVERED after 30s |
| Verifiable Audit Chains | 2:20–2:50 | `/trust` | Publish anchor, verify in public verifier, export chain |
| Close | 2:50–3:00 | Dashboard or SDK snippet | Three-line SDK integration pitch |
