# ADR-001: Detached Ed25519 Signatures for Autonomous Agent Transactions

## Status
**Accepted** (2026-09)

## Context & Problem Statement
Autonomous AI agents in enterprise and fintech ecosystems execute financial transactions via REST APIs. Because agent runtimes (LLMs, LangChain nodes, AutoGPT scripts) are inherently non-deterministic and susceptible to prompt injection, memory poisoning, or compromised sandbox execution environments, the central payment gateway cannot trust the agent's identity via shared secrets (such as API keys or HMAC symmetric secrets) or session cookies alone.

If an attacker intercepts or extracts a shared HMAC secret, they gain the ability to forge arbitrary transaction requests across the entire lifespan of the secret. Furthermore, symmetric keys do not provide non-repudiation: if a fraudulent dispute occurs between an enterprise tenant and the gateway, neither side can cryptographically prove whether the agent originated the payload or if the server forged it.

## Decision Drivers
1. **Asymmetric Proof & Non-Repudiation**: The agent signs with its private key; the gateway verifies against the stored public key. The private key never leaves the agent's secure enclave / memory space.
2. **Speed & Minimal Compute Overhead**: Verification must occur in sub-millisecond time (<1ms) to keep the total policy evaluation overhead under 5ms.
3. **Resilience to Side-Channel Attacks**: Signature verification must be constant-time and immune to branch prediction attacks.
4. **Compact Payload Size**: Signatures should not bloat HTTP headers or webhook payloads.

## Considered Options
1. **HMAC-SHA256 (Symmetric)**:
   - *Pros*: Extremely fast, simple implementation.
   - *Cons*: Shared secret vulnerability. If the gateway DB is compromised, all agent signatures can be forged. No cryptographic non-repudiation between agent and merchant.
2. **RSA-2048 / RSA-4096 (Asymmetric)**:
   - *Pros*: Widely established standard.
   - *Cons*: Large key and signature sizes (256–512 bytes), slow key generation and verification times (high CPU consumption under high concurrency).
3. **ECDSA (secp256k1 or secp256r1)**:
   - *Pros*: Industry standard in web3 and TLS.
   - *Cons*: Requires a cryptographically secure random nonce ($k$) during signature generation; weak randomness leaks the private key entirely (e.g., Sony PS3 hack). More complex and prone to side-channel timing attacks if not strictly constant-time.
4. **Ed25519 (EdDSA over Curve25519)**:
   - *Pros*: High performance (sub-millisecond verification), 64-byte deterministic detached signatures, 32-byte public keys, collision-resistant, immune to timing side-channels, deterministic signing (no per-signature random number generation vulnerability).
   - *Cons*: Slightly newer standard than RSA, but natively supported in Node.js `crypto` and modern web crypto APIs.

## Decision Outcome
We selected **Ed25519 Detached Signatures** (`ed25519` via standard Node.js `crypto.verify` / `@noble/curves`).

### Implementation Details:
- Each Mandate stores the agent's public key (hex or base64 encoded).
- The agent computes a deterministic canonical serialization of the transaction payload:
  `canonicalPayload = `${mandateId}:${merchantId}:${amount}:${currency}:${nonce}:${timestamp}``
- The agent signs this canonical string with its Ed25519 private key.
- The HTTP request carries headers:
  - `X-Mandate-Id`: UUID of the active mandate
  - `X-Agent-Signature`: 64-byte Ed25519 detached signature
  - `X-Agent-Nonce`: Unique UUID v4 or cryptographic nonce
  - `X-Agent-Timestamp`: ISO 8601 epoch timestamp
- Gate 1 of the MandateOS security waterfall decodes the public key, reconstructs the canonical message, and executes constant-time Ed25519 verification. Any byte alteration in the payload, nonce, or timestamp immediately triggers `ERR_SIG_INVALID` with rejection in <1.2ms.

## Consequences
- **Positive**: Complete non-repudiation, zero risk of server-side secret leakage causing forgeability, tiny 64-byte signature overhead, deterministic verification.
- **Negative**: Agent SDK must manage the private key securely (e.g., in environment variables, TPM, or AWS KMS).
