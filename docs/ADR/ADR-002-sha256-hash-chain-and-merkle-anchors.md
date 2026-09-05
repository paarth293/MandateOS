# ADR-002: SHA-256 Cryptographic Hash Chaining for Tamper-Evident Audit Trails

## Status
**Accepted** (2026-09)

## Context & Problem Statement
In financial systems, traditional database audit logs (e.g., standard SQL tables with timestamps or external logging systems like CloudWatch/Datadog) suffer from a critical vulnerability: **mutability by privileged actors**. An insider with database administrative access (DBA, rogue developer, compromised service role) can run an `UPDATE` or `DELETE` statement, altering payment amounts, recipient addresses, or policy check statuses to cover up malicious actions.

For autonomous agent commerce, regulatory bodies (RBI, SEBI, PCI-DSS Level 1) require non-repudiable proof that the transactions recorded match exactly what was evaluated at execution time, with mathematical proof that historical records have never been rewritten or retroactively inserted.

## Decision Drivers
1. **Tamper-Evidence**: Any retroactive alteration, insertion, or deletion of an audit record must immediately and demonstrably break the mathematical integrity of all subsequent records.
2. **Deterministic Verification**: Any auditor or compliance officer must be able to verify millions of records in seconds without trusting the application layer.
3. **Storage & Write Overhead**: Audit log writes must add <1.5ms to transaction execution latency.
4. **Independent Auditability**: The audit chain must be exportable in JSON/CSV and verifiable offline with standard command-line tools (`shasum`, `openssl`).

## Considered Options
1. **Traditional Append-Only SQL Table**:
   - *Pros*: Native to RDBMS, zero computational overhead.
   - *Cons*: Vulnerable to DBA manipulation. No mathematical proof of append-only property.
2. **Public Blockchain (Ethereum / Solana / Polygon)**:
   - *Pros*: Decentralized immutability.
   - *Cons*: High gas fees, unpredictable transaction finality latency (seconds to minutes), privacy concerns with financial data on public ledgers, unnecessary complexity for enterprise private mandates.
3. **Full Distributed Merkle Tree with Distributed Witness**:
   - *Pros*: Efficient logarithmic proofs of membership.
   - *Cons*: Complex tree rebalancing on continuous high-frequency streaming writes.
4. **Linear SHA-256 Forward Hash Chain with Genesis Seeding**:
   - *Pros*: Instant $O(1)$ computation per write, sub-millisecond overhead (<0.5ms), forward-link cryptographic integrity ($H_n = \text{SHA256}(H_{n-1} \parallel \text{data}_n)$), easy linear $O(N)$ verification pass, simple export and anchoring.
   - *Cons*: Verification is sequential, but easily batches thousands of records per millisecond in memory.

## Decision Outcome
We selected a **Linear SHA-256 Forward Hash Chain** (`src/server/audit.ts`) with unique database constraints:

### Implementation Architecture:
1. **Genesis Block**: Each mandate initializes with a known genesis hash `GENESIS_0000000000000000000000000000000000000000000000000000000000000000` or a mandate-creation hash.
2. **Chained Hashing**: For each transaction or policy event $n$:
   $$\text{payloadHash} = \text{SHA256}(\text{canonicalJSON}(\text{payload}))$$
   $$\text{currentHash} = \text{SHA256}(H_{n-1} \parallel \text{payloadHash} \parallel \text{action} \parallel \text{status} \parallel \text{timestamp} \parallel \text{mandateId})$$
3. **Database Constraints**:
   - Index on `(mandate_id, created_at)`
   - Unique constraint `(mandate_id, previous_hash)` ensuring no two events can branch off the same predecessor hash, preventing fork/split attacks.
4. **Verification Engine**: The verification endpoint (`GET /api/audit/verify`) traverses the chain from Genesis to tip, recalculates every hash, and flags any mismatch down to the exact row and timestamp.
5. **Merkle Anchoring Compatibility**: The tip hash ($H_n$) of each 24-hour window can be anchored to cold storage or signed by an authorized notary key.

## Consequences
- **Positive**: Cryptographically bulletproof audit trail; database tampering is impossible to conceal; zero blockchain gas cost; offline verifiable.
- **Negative**: Database re-indexing requires maintaining strictly sequential `previous_hash` chains; concurrent writes per single mandate require serial locks (mitigated by mandate-level sharding).
