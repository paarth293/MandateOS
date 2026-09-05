# ADR-002: SHA-256 Forward Hash Chain for the Audit Trail

**Status:** Accepted

## Context

Every policy decision, retry, and settlement needs to be logged somewhere a compliance reviewer — or an external auditor with zero access to our infrastructure — can trust wasn't edited after the fact. A normal database table doesn't provide that: any row can be silently `UPDATE`d, and there'd be no trace.

## Decision

Every audit log entry is chained: `H_n = SHA256(H_{n-1} || payload_n || status_n)`, starting from a fixed genesis hash. Each new block embeds the previous block's hash, so altering *any* byte in *any* historical block changes that block's hash — which no longer matches what the next block recorded, and the mismatch cascades forward through every block after it.

On top of the chain itself, MandateOS periodically **publishes external anchors** (`POST /api/anchors`) — a snapshot hash plus block count, independently verifiable via `GET /api/verify/chain` without needing raw database access. `GET /api/export/chain` produces a signed export (JSON) that a third party can archive and re-verify at any point in the future, even if MandateOS itself goes offline.

## Alternatives Considered

- **A public blockchain / distributed ledger.** Rejected — MandateOS is the sole writer of its own audit trail; there's no multi-party consensus problem to solve, so the complexity, latency, and gas costs of an actual blockchain buy nothing here. A hash chain gives the same tamper-evidence property without needing a network of validators.
- **Mutable audit log rows with a `updated_at` timestamp.** Rejected — this only tells you a row *was* edited if the editor remembered to update the timestamp. It provides no cryptographic guarantee, only a convention that a sufficiently motivated attacker (or careless migration script) can violate silently.
- **A vendor-specific append-only / WORM table feature.** Rejected — ties the audit guarantee to a specific database vendor's feature set (Neon doesn't offer one), and still wouldn't be independently verifiable by an external party without trusting that vendor's access controls.

## Consequences

- **Verification is O(n)** — an auditor recomputing the full chain from genesis has to walk every block in order. At the scale demonstrated in this build (hundreds to low thousands of rows per mandate), that recomputation completes in low single-digit milliseconds; a production deployment at much larger scale would want periodic anchor checkpoints (already implemented) so verification can start from the last trusted anchor instead of genesis every time.
- **Tampering is detectable, not preventable** — the chain doesn't stop someone with raw database access from editing a row; it guarantees that doing so is *immediately provable* the next time anyone verifies the chain. That's the correct guarantee for an audit trail: the goal is "we will know," not "it's physically impossible."
- **The genesis hash and every intermediate hash are public information** — none of this depends on keeping the hash values secret, which is exactly what makes third-party verification possible in the first place.
