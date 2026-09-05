# Judges & Evaluators FAQ

Straight answers to the objections a technical judge is most likely to raise, cross-referenced to the actual code and tests so nothing here is just a claim.

---

**"What actually stops the agent from signing whatever amount it wants?"**

Nothing in the signature scheme itself — the signature only proves the request came from the agent unmodified, it doesn't validate the *content*. The amount is enforced completely separately: after signature verification passes, `evaluateMandatePolicy()` (`src/server/policy.ts`) runs a plain integer comparison against the mandate's per-transaction, daily, and lifetime caps. The agent can sign any request it wants; the firewall simply refuses to execute one that violates policy, regardless of how convincingly it's signed. See the Attack Console's "Spending Cap Breach" scenario for a live demonstration.

---

**"Couldn't a jailbroken or compromised agent just skip MandateOS and call Razorpay directly?"**

Only if it also holds live Razorpay API credentials — and in this architecture, it never does. The agent's *only* credential is its own Ed25519 secret key, used purely for signing requests to MandateOS. The actual Razorpay gateway keys live server-side, inside MandateOS, and are never exposed to the agent. A compromised agent can produce garbage signed requests all day; it has no path to Razorpay that doesn't go through the policy waterfall first.

---

**"Is Gemini in the critical path? What happens if the AI service is down or slow?"**

No — it's explicitly advisory-only, invoked *after* the deterministic verdict is already final (see the Audit Trail's `confidenceScore` / `requiresHumanIntervention` fields, generated post-decision). If the Gemini call fails, times out, or is rate-limited, the transaction's ALLOWED/BLOCKED outcome is completely unaffected — the only thing lost is the plain-English explanation attached to that one audit entry. The eight-gate policy waterfall is 100% deterministic integer/cryptographic logic; nothing about whether a transaction succeeds or fails ever depends on a language model call succeeding.

---

**"What's the actual replay-attack defense — is it just checking a timestamp?"**

No — timestamp drift (±300s) and nonce uniqueness are two independent gates. The nonce defense is a `UNIQUE(mandate_id, nonce)` constraint enforced by Postgres itself (see [ADR-004](./ADR/ADR-004-drizzle-orm.md)), not an application-level lookup — which matters because a lookup-then-insert pattern in application code has a race-condition window; a database constraint doesn't. Try it live: the Attack Console's "Replay Attack" scenario fires the exact same signed packet twice in immediate succession — the first is ALLOWED, the second is rejected with `409 REPLAY_DETECTED`, even though both carry an identical, validly verified signature.

---

**"What's your key-compromise story — what happens if an agent's private key leaks?"**

The blast radius is scoped to exactly that one mandate. Because every agent gets its own keypair and its own independently-capped mandate (not a shared organizational credential), a leaked key lets an attacker spend up to that mandate's caps and nothing more — not the lifetime budget of every agent in the fleet. The mandate can be revoked immediately (status flips to inactive, and every subsequent signature check fails at Gate 1 regardless of validity), and the full audit chain still shows exactly what happened, in order, with cryptographic proof it wasn't altered afterward. There is currently no automatic key-rotation SLA in this build — rotation is a manual "revoke and reissue" today, which is a fair thing to press on and an honest limitation, not a hidden one.

---

**"Does this actually prevent double-spending, or just detect it after the fact?"**

Prevent, not just detect. The nonce-uniqueness constraint means a replayed transaction is rejected *before* it reaches the payment gateway at all — it never gets a chance to double-charge, because the database refuses the second `INSERT` outright. Separately, the recovery workflow checks Razorpay's own Orders API before every retry specifically to confirm a payment wasn't already captured during an outage before attempting it again — so even genuine failure-and-retry cycles are idempotent, not merely "probably fine."

---

**"How is this different from just writing a spending-limit `if` statement in the agent's own code?"**

An `if` statement lives inside the same process, the same prompt context, and the same trust boundary as the agent itself — which means it's exactly as trustworthy as the agent's own (possibly compromised, possibly hallucinating, possibly prompt-injected) reasoning. MandateOS's enforcement is a separate service the agent cannot see, modify, or reason its way around; the check happens after a cryptographic signature has already bound the request to a specific, revocable identity, and the policy limits live in a database the agent has no write access to. The difference is the trust boundary, not the arithmetic.

---

**"Isn't this already solved by Google's AP2, Visa's Trusted Agent Protocol, or Mastercard's Agent Pay?"**

Those protocols (all launched in 2026) solve *authorization* — proving to a card network that an agent is permitted to attempt a transaction at all. MandateOS solves the layer underneath: once an agent is authorized by whatever means, exactly what is it bounded to do, and how is that bound enforced and later provable? The two problems are complementary, not competing — MandateOS is deliberately protocol-agnostic so it can sit behind whichever network-level authorization layer a merchant adopts.

---

**"What's the single hardest technical problem you had to solve?"**

Making the replay shield airtight without introducing a distributed lock. Two near-simultaneous replays of the same signed packet have to result in exactly one ALLOWED and one REJECTED outcome, with no window where both could succeed. Solving that at the database-constraint level (rather than with an application-level "check if seen, then insert" pattern) was the decision documented in [ADR-004](./ADR/ADR-004-drizzle-orm.md) — it's a small-sounding fix, but it's the difference between a demo that *usually* works and a guarantee that always does.
