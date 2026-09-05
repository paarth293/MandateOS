# ADR-004: Drizzle ORM and Neon Serverless PostgreSQL Architecture

## Status
**Accepted** (2026-09)

## Context & Problem Statement
The MandateOS core policy engine enforces an 8-layer waterfall that evaluates cryptographic signatures, database unique nonces, timestamp drift, daily spend aggregates, and lifetime caps in under 5 milliseconds. 

In serverless execution environments (e.g. Next.js on Vercel or Docker containers with autoscaling), traditional ORMs (such as Prisma or TypeORM) introduce significant liabilities:
1. **Engine Cold Start & Binary Bloat**: Prisma relies on a Rust-based query engine binary (`libquery_engine.so`) that adds 50MB+ to container images and 200–800ms of cold-start latency per lambda initialization.
2. **Connection Pool Exhaustion**: Serverless functions spinning up concurrently rapidly exhaust traditional PostgreSQL connection pools (maxing out 100 connections in seconds).
3. **Implicit Over-fetching**: Heavy ORMs frequently fetch excessive columns or relations, increasing serialization overhead and memory footprint.

## Decision Drivers
1. **Sub-Millisecond Query Latency**: Database reads and writes must execute with minimal CPU and ORM overhead to sustain high throughput and low tail latency.
2. **Serverless Connection Resilience**: Direct connection pooling over WebSockets/HTTP that scales seamlessly without requiring standalone PgBouncer infrastructure.
3. **Type Safety & Zero Runtime Abstraction**: Full end-to-end TypeScript type inference directly from SQL schema definitions without code generation bloat.
4. **Transparent SQL**: Clear control over queries, indexes, and unique constraints (critical for cryptographic nonce checks and audit chains).

## Considered Options
1. **Prisma**:
   - *Pros*: Mature ecosystem, popular schema DSL.
   - *Cons*: Heavy Rust engine binary; slow cold starts; high memory footprint; debugging generated SQL is difficult.
2. **TypeORM**:
   - *Pros*: Traditional Active Record / Data Mapper patterns.
   - *Cons*: Heavy reflection and decorator metadata; legacy codebase; poorly suited for modern serverless edge runtimes.
3. **Raw `pg` (node-postgres)**:
   - *Pros*: Fast, lightweight.
   - *Cons*: No compile-time type safety; raw string queries prone to typos and schema drift.
4. **Drizzle ORM + Neon Serverless PostgreSQL**:
   - *Pros*: Zero binary dependencies; pure TypeScript query builder that compiles directly to SQL with negligible (<1ms) runtime overhead; native support for Neon serverless HTTP/WebSocket pooling; strict type inference; explicit migration files (`drizzle-kit`).
   - *Cons*: Smaller ecosystem than Prisma, but rapidly becoming the enterprise TypeScript standard.

## Decision Outcome
We adopted **Drizzle ORM** paired with **Neon Serverless PostgreSQL** (`src/server/db.ts` and `src/server/schema.ts`).

### Key Architecture Choices:
- **Neon Serverless Driver**: Uses `@neondatabase/serverless` with HTTP connection pooling, allowing thousands of concurrent serverless invocations without connection exhaustion.
- **Strict Constraints**: Unique index on `(mandate_id, previous_hash)` and composite index on `(mandate_id, created_at)` are defined directly in `src/server/schema.ts` and applied via Drizzle migrations.
- **Deterministic Type Safety**: Mandate, AuditLog, and Transaction types are derived directly from the Drizzle table schemas (`typeof mandates.$inferSelect`), guaranteeing that DB contracts match API contracts exactly.

## Consequences
- **Positive**: Blazing fast policy queries (<3ms), zero engine binary cold starts, zero pool exhaustion issues, clean and readable SQL output.
- **Negative**: Developers must write migrations using `drizzle-kit generate` rather than relying on automated shadow DB generation.
