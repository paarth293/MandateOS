# MandateOS: The Winning 3-Minute Hackathon Pitch & Live Demo Script

---

## 1. The Hook (0:00 - 0:30)
*Action: Stand confidently, display the MandateOS Live Dashboard on the big screen with dark mode styling and real-time metric cards.*

> "Right now, autonomous AI agents are writing code, negotiating contracts, and orchestrating cloud infrastructure. But the moment you give an agent financial autonomy—access to corporate credit cards, bank APIs, or UPI rails—you face the trillion-dollar **Agent Safety Dilemma**: 
> 
> *How do you mathematically guarantee an autonomous agent won't hallucinate and drain your company treasury?*
> 
> Today, enterprise teams either handicap their agents with manual human approvals, or gamble on fuzzy LLM system prompts that can be jailbroken with a single trick.
> 
> The solution is **MandateOS**—the world's first cryptographically verified, deterministic policy firewall and autonomous financial operating system for AI agents."

---

## 2. The Cryptographic Trust Core (0:30 - 1:00)
*Action: Click into the **Mandates** page (`/mandates`). Show the Ed25519 keypair and spend policies.*

> "MandateOS establishes a mathematical barrier between autonomous agents and payment gateways.
> 
> When a human administrator provisions an agent, MandateOS issues an **Ed25519 cryptographic keypair**. Every purchase request from the agent must be canonically serialized, signed with its private key, timestamped within 300 seconds, and stamped with a unique cryptographic nonce.
> 
> Our backend enforces zero-trust policy evaluation:
> 1. **Signature Verification**: Zero-knowledge validation via detached Ed25519 signatures.
> 2. **Replay Attack Shield**: Nonces are atomically tracked at the database layer—replaying any signed packet produces an immediate `409 REPLAY_DETECTED` block.
> 3. **Mathematical Caps**: Hard deterministic limits on per-transaction amounts, 24-hour daily spend ceilings, and lifetime limits. Prompt injections cannot change integer math."

---

## 3. Live Agent Commerce & Attack Demo (1:00 - 1:45)
*Action: Split screen between terminal and browser. Run the live simulation script:*
```bash
npm run agent:simulate
```

> "Watch the live interaction.
> 
> **Scenario 1: Legitimate Purchase**  
> The agent signs an authorized ₹2,500 Cloud Servers purchase. The signature verifies, spend limits pass, and the Razorpay gateway order is instantly minted.
> 
> **Scenario 2: Prompt Injection / Out-of-Bounds Category**  
> An attacker tricks the agent into buying a luxury vehicle. The deterministic policy firewall blocks it cold before any bank API is touched.
> 
> **Scenario 3: Replay Attack**  
> An eavesdropper sniffs the valid packet and replays it. The database idempotency engine flags `REPLAY_DETECTED` and quarantines the transaction.
> 
> **Scenario 4: Spend Cap Breach**  
> The agent attempts a ₹10,000 transaction that breaches its daily spend ceiling. The mathematical guardrail enforces hard rejection."

---

## 4. Resiliency, Circuit Breakers & Inngest State Machine (1:45 - 2:20)
*Action: Switch back to the **Chaos Console** on the Dashboard. Click "Inject Catastrophic Failure".*

> "Now, what happens when the real world fails? Payment gateways suffer bank timeouts, webhook drops, and 504 gateway errors.
> 
> In traditional systems, agents panic and spam retries, triggering fraud blocks. In MandateOS, **Inngest** powers a resilient payment state machine:
> 
> - **Atomic Retry Budget Claim**: Prevents race conditions and double-spending across parallel workers.
> - **Exponential Backoff with Jitter**: Protects banking APIs against thundering herds.
> - **Gateway Circuit Breaker**: Automatically trips after consecutive upstream bank failures, halting traffic until recovery.
> - **Quarantine Review Queue**: Exhausted transactions seamlessly flow into our Human Review Portal (`/review`) where compliance teams can inspect and approve retries with one click."

---

## 5. Verifiable Audit Chains & External Anchors (2:20 - 2:50)
*Action: Point to the **Cryptographic Audit Trail** on the Dashboard with the green "Chain Verified ✓" badge. Click "Re-verify".*

> "Finally, enterprise compliance requires absolute auditability.
> 
> Every policy check, retry, and settlement is analyzed by **Google Gemini** for plain-English incident explanations and sealed into a **SHA-256 Cryptographic Hash Chain**.
> 
> Notice this badge: **Chain Verified ✓**. Our verification engine recomputes every block from genesis (`0000...`). If a malicious actor tampers with a single byte in the database, the hash chain shatters instantly.
> 
> Furthermore, MandateOS periodically publishes external **Audit Anchors** via `/api/anchors`, creating immutable cryptographic checkpoints that external regulators and auditors can independently verify without access to internal systems."

---

## 6. The Close (2:50 - 3:00)
*Action: Open the TypeScript SDK code snippet.*

> "MandateOS turns reckless agent commerce into provably secure, enterprise-ready transactions. With our plug-and-play TypeScript SDK (`MandateOSClient`), any AI agent framework—from LangChain to AutoGPT—can be secured in three lines of code.
> 
> Autonomous agents are the future of work. MandateOS is how the world will trust them with money.
> 
> Thank you."

---

## Quick Demo Cheat Sheet for Presenters

| Step | Action | Expected Visual |
| :--- | :--- | :--- |
| **1** | Open `http://localhost:3000` | Authenticated Dashboard with real-time KPI metrics & active policies |
| **2** | Navigate to `/mandates` | Provisioned mandates, Ed25519 keys, and spend caps |
| **3** | Click "+ Issue New Mandate" | Instant Ed25519 keypair generation modal with secret key reveal |
| **4** | Run `npm run agent:simulate` | 5 real scenarios: legitimate purchase, category block, replay block, cap breach |
| **5** | Click "Inject Failure" on Chaos Console | Transaction transitions to FAILED, Gemini explains failure in plain English |
| **6** | Watch Inngest auto-recovery | 30s exponential cooldown with jitter -> badge flips to RECOVERED |
| **7** | View `/review` queue | Quarantined transaction review portal with "Approve Retry" action |
| **8** | Click "Verify Chain" on Audit Trail | Recomputes SHA-256 hashes from genesis -> "Chain Verified ✓ (N blocks)" |
