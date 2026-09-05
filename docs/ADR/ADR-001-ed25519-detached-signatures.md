# ADR-001: Ed25519 Detached Signatures for Every Agent Request

**Status:** Accepted

## Context

An AI agent needs to prove, on every single purchase request, that the request genuinely came from it and hasn't been altered in transit — without MandateOS ever holding a secret that could impersonate the agent, and without paying the latency cost of a heavyweight signature scheme on every request in a policy path that has to stay under 5ms.

## Decision

Every mandate is issued as an **Ed25519 keypair** (via TweetNaCl). The agent retains the private key; MandateOS stores only the public key. Each purchase request is canonically serialized (`{ mandateId, amountPaise, category, nonce, timestamp }`, with deterministic key ordering — see `canonicalStringify` in `src/lib/crypto.ts`) and signed with a **detached** signature, verified against the mandate's public key before any other check runs (Gate 1 of the policy waterfall).

Detached (rather than inline/attached) signatures mean the payload and the signature travel separately — the server verifies the exact bytes it received against the exact signature provided, with no ambiguity about what was actually signed.

## Alternatives Considered

- **HMAC with a shared secret.** Rejected — a shared secret must exist on both the agent and the server. A server-side breach or log leak exposes a value that can *forge* requests, not just read them. Ed25519 keeps the forging capability exclusively with the agent.
- **RSA-2048 signatures.** Rejected on latency and size — RSA verification typically runs 1–2ms and produces ~256-byte signatures, versus Ed25519's measured **~0.8ms verification** (see `TEST_REPORT.md`, Suite 1) and 64-byte signatures. At a target of <5ms total policy latency, that gap matters.
- **JWT (RS256) bearer tokens.** Rejected — JWTs are built for *session* authorization, not *per-transaction* integrity. Reusing one token across many purchases would reintroduce exactly the replay risk Gate 2 exists to close.
- **Plain API keys.** Rejected outright — a static key has no per-request binding to the payload. Any request signed with it is as good as any other; there's no way to detect that a request's amount or category was altered after the fact.

## Consequences

- **Key custody becomes the agent operator's responsibility.** Losing the private key means the mandate must be revoked and reissued — there is no "password reset" for a signing key, by design.
- **Public key rotation requires a new mandate**, not an in-place update — this is intentional; a mandate is meant to be an immutable, auditable grant, not a mutable credential.
- **Verification is fast enough to sit in the hot path** of every transaction: the 8-gate waterfall averages 3.2ms end-to-end with Ed25519 verification alone at ~0.8ms (`TEST_REPORT.md`).
- **No party other than the agent can ever produce a valid signature**, including MandateOS itself — the system can *block* a transaction it disagrees with, but it can never forge one it likes.
