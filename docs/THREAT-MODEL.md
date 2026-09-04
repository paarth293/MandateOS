# MandateOS Threat Model & Cryptographic Security Architecture

## 1. Executive Summary

MandateOS is an autonomous financial operating system and security firewall designed for AI agents executing real-world commercial purchases via Razorpay payment rails. Autonomous agents operate with non-deterministic behavior, making traditional static API keys or unrestricted corporate cards unacceptably vulnerable to prompt injection, hallucinated spend orders, supply chain hijack, and replay attacks.

MandateOS provides a zero-trust cryptographic perimeter enforcing deterministic policy gates, non-repudiable audit trails, and resilient gateway execution.

---

## 2. Threat Actor Taxonomy

| Actor Type | Description | Motivation | Attack Vectors |
| :--- | :--- | :--- | :--- |
| **External Adversary** | Unauthenticated network attacker | Financial fraud, credential theft, DoS | Replay attacks, signature forgery, brute force |
| **Compromised Agent / Prompt Injection** | Legitimate agent manipulated via untrusted LLM context | Resource diversion, luxury goods exfiltration | Category drift, limit escalation, burst spend |
| **Rogue Internal User** | Insider with partial system access | Audit evasion, unauthorized policy relaxation | Tampering audit logs, bypassing spend caps |
| **Failing Upstream Rail** | Flaky banking gateway / network timeouts | Cascading failures | Cascading retries, double-debits, race conditions |

---

## 3. STRIDE Threat Analysis & Defense Matrix

### 3.1 Spoofing (Identity & Authenticity)
- **Threat:** An adversary impersonates an AI agent and submits unauthorized purchase orders to `/api/agent/purchase`.
- **Defense Mechanism:**
  - **Ed25519 Detached Digital Signatures:** Every purchase request requires an asymmetric cryptographic signature generated with the agent's private key (`x-mandate-signature`).
  - **Canonical Serialization:** All payload fields (`amountPaise`, `category`, `mandateId`, `nonce`, `timestamp`) are normalized using deterministic recursive key sorting (`canonicalStringify`) prior to signing.
  - **Public Key Binding:** Signatures are evaluated against the immutable public key stored in the cryptographically anchored mandate.

### 3.2 Tampering (Data Integrity)
- **Threat:** An attacker intercepts an in-flight purchase request and modifies the transaction amount, merchant category, or mandate recipient.
- **Defense Mechanism:**
  - Any modification of payload bytes invalidates the Ed25519 signature, returning `401 INVALID_SIGNATURE`.
  - **Audit Log SHA-256 Hash Chaining:** Every state transition generates a block hashed with `generateAuditHash(action, details, previousHash)` linking each event to the unbroken genesis block.
  - **Merkle State Anchors:** Periodic or on-demand anchors commit the current head hash and block count into immutable anchor records.

### 3.3 Repudiation (Non-Repudiation)
- **Threat:** A compromised agent or rogue operator claims a disputed charge was never authorized or was manipulated by the server.
- **Defense Mechanism:**
  - Asymmetric cryptographic signatures provide mathematical non-repudiation. Only the holder of the agent's private key could have produced the signature.
  - Audit logs are exportable as signed manifests (`/api/export/chain`) containing cryptographic hashes and signatures verifiable by third-party auditors with zero server credentials.

### 3.4 Information Disclosure (Confidentiality)
- **Threat:** Leaking sensitive banking credentials, private keys, or API tokens.
- **Defense Mechanism:**
  - Agent private keys are strictly kept on the agent's runtime environment (`agent.key` or HSM/KMS) and never transmitted to or stored on MandateOS servers.
  - MandateOS stores only public keys.
  - Upstream gateway secrets (`RAZORPAY_KEY_SECRET`) are server-only environment variables never sent to client bundles.

### 3.5 Denial of Service (Availability)
- **Threat:** An agent stuck in a recursive loop floods the gateway, or an adversary launches volumetric attacks.
- **Defense Mechanism:**
  - **Sliding-Window Rate Limiting:** Enforces a strict 60 req/minute per-mandate ceiling on `/api/agent/purchase`.
  - **Gateway Circuit Breaker:** Protects upstream Razorpay rails from cascading failure. Trips from `CLOSED` to `OPEN` after 5 consecutive failures, halting subsequent calls until a cooldown recovery period passes.
  - **Max Silent Retries:** Enforces a hard cap (e.g. 2-3 retries) with exponential backoff to prevent gateway storms.

### 3.6 Elevation of Privilege (Authorization & Policy Enforcement)
- **Threat:** An agent approved for "Cloud Infrastructure" attempts spending on "Luxury Vehicles" or exceeds its daily ₹15,000 budget.
- **Defense Mechanism:**
  - **Deterministic Policy Engine:** Pure functional evaluation checking:
    1. Expiry date countdown
    2. Mandate status (`ACTIVE`)
    3. Per-transaction limit
    4. Daily UTC spend ceiling (aggregated server-side via SQL)
    5. Lifetime spend ceiling
    6. Category whitelist validation
    7. Silent retry threshold
  - Unapproved categories or cap breaches result in immediate `POLICY_FIREWALL_BLOCKED` and escalate to human review quarantine.

---

## 4. Replay & Clock Drift Protection

### 4.1 Nonce Freshness
- Every purchase request requires a globally unique cryptographic nonce (`x-nonce`).
- Upon receiving a request, the nonce is inserted into a database table with a `UNIQUE` constraint.
- Replaying the same request produces database violation error code `23505`, triggering immediate `409 REPLAY_DETECTED` interception.

### 4.2 Timestamp Drift Window
- Every request includes a Unix timestamp (`x-timestamp`).
- The server validates `|currentTime - timestamp| <= 300,000 ms` (5-minute drift allowance).
- Expired or stale requests are immediately rejected (`401 STALE_REQUEST`), preventing long-term capture-and-delayed-playback attacks.

---

## 5. Trust Boundaries & Assumptions

### 5.1 In-Scope Protections
- Defense against prompt-injected or hallucinating autonomous agents.
- Interception of replay attacks and forged requests.
- Containment of upstream banking timeouts via autonomous exponential backoff.
- Tamper-evident audit chain with zero-knowledge external verifiability.

### 5.2 Out-of-Scope Risks & Mitigations
- **Physical Key Theft on Agent Host:** If the host machine running the agent is compromised and `agent.key` is extracted, the attacker can sign purchases within the mandate's spending limits.
  - *Mitigation:* Mandate caps strictly bound worst-case exposure (e.g. max ₹5,000 per txn, ₹15,000 daily). Owners can trigger instant kill-switch revocation via `PATCH /api/mandates` to invalidate the public key immediately.
- **Upstream Razorpay Infrastructure Outage:** A total national failure of banking rails.
  - *Mitigation:* Circuit breaker trips to `OPEN`, preserving funds and quarantining pending transactions for reconciliation.
