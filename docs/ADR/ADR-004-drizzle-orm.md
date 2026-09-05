# ADR-004: Drizzle ORM + a Database-Level Constraint for Replay Defense

**Status:** Accepted

## Context

Replay protection — rejecting a nonce that's already been used — has to be *atomic*. If the check ("has this nonce been seen?") and the write ("record this nonce") are two separate steps in application code, two near-simultaneous requests carrying the same replayed packet can both pass the check before either one writes, and both get allowed through. The defense has to live where race conditions can't reach it: the database's own constraint engine.

## Decision

Schema and queries are defined with **Drizzle ORM** against Neon serverless Postgres. The `purchase_attempts` table carries a **`UNIQUE` constraint on `(mandate_id, nonce)`**. A replayed request's `INSERT` doesn't fail a slow application-level lookup — it fails the database's own constraint check (Postgres error code `23505`), which Postgres guarantees is atomic and consistent even under concurrent connections. The route handler catches exactly that error code and returns `409 REPLAY_DETECTED` (see `src/app/api/agent/purchase/route.ts` and the mirrored logic in the Attack Console's `src/app/api/agent/attack/route.ts`).

Drizzle was chosen specifically because its query builder maps directly onto hand-written SQL and its schema-first migrations (`drizzle-kit push` / `migrate`) make a constraint like this a first-class, version-controlled part of the schema — not an afterthought bolted on with a manual `ALTER TABLE`.

## Alternatives Considered

- **Prisma.** Rejected for this project — Prisma's generated client and query engine add meaningful cold-start overhead, which matters more than usual here because Neon's serverless Postgres already has its own connection-establishment latency; stacking a second cold-start cost on top works against the sub-5ms policy-latency target.
- **A raw `pg` driver with hand-written SQL.** Rejected — workable, but loses compile-time type safety across roughly a dozen interrelated tables (mandates, transactions, purchase attempts, audit logs, anchors). At this schema size, a typo in a column name becomes a runtime bug instead of a compiler error.
- **TypeORM (Active Record pattern).** Rejected specifically because Active Record encourages exactly the "load an entity, check a condition, then save it" pattern that reintroduces the check-then-act race this ADR exists to eliminate. A schema-level constraint doesn't care what pattern the calling code used to insert the row; it can't be bypassed by writing the query wrong.

## Consequences

- **Replay protection is a database guarantee, not an application promise** — verified directly in `TEST_REPORT.md` (Suite 2: Tamper-Evident Hash Chain; Suite 3: End-to-End System Integration) rather than relying on application-level test coverage alone.
- **Schema changes are migrations, not manual SQL** — every constraint, including the one this ADR is about, is reviewable in version control (`drizzle-kit` migration files) rather than living only in a production database someone once configured by hand.
- **Type safety extends from the schema to every query site** — a renamed column is a compile error across the whole codebase, not a silent runtime failure discovered in production.
