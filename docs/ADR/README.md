# Architecture Decision Records

Each ADR below documents a load-bearing technical decision in MandateOS: the problem it solves, the alternatives we ruled out, and the trade-off we accepted. They're written for a technical judge who wants to know *why*, not just *what*.

| ADR | Decision | Status |
| :--- | :--- | :--- |
| [ADR-001](./ADR-001-ed25519-detached-signatures.md) | Ed25519 detached signatures for every agent request | Accepted |
| [ADR-002](./ADR-002-sha256-hash-chain.md) | SHA-256 forward hash chain for the audit trail | Accepted |
| [ADR-003](./ADR-003-inngest-durability.md) | Inngest for durable payment recovery | Accepted |
| [ADR-004](./ADR-004-drizzle-orm.md) | Drizzle ORM + a database-level uniqueness constraint for replay defense | Accepted |

Each record follows the same shape: **Context → Decision → Alternatives Considered → Consequences**, so you can skim the table above and go straight to the section that answers your question.
