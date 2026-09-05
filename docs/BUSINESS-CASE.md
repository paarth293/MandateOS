# MandateOS — Business Case & Monetization Model

> **Note on methodology:** the figures below are an illustrative, bottom-up estimate built on publicly reported Razorpay scale metrics, with every assumption stated explicitly. They're meant to show the shape of the opportunity and the reasoning behind it — not to be read as audited market research.

## 1. The Anchor Numbers

Razorpay processes roughly **$180B in annualized total payment volume (TPV)** today and has publicly targeted **~$400B in TPV by 2030**, alongside a reported valuation near **$9.2B**. That's the ecosystem MandateOS sits inside — every merchant, subscription, and payout flow already running through Razorpay's rails is a candidate for agent-initiated commerce the moment an enterprise decides to let an AI agent transact on its behalf.

## 2. Why Agent-Initiated Volume Is Coming

Every major card network shipped its own answer to agentic payments in 2026 — Google's AP2 (Agent Payments Protocol), Visa's Trusted Agent Protocol, and Mastercard's Agent Pay. That's three independent, well-capitalized bets that agent-initiated transactions are about to become a real volume category, not a novelty. None of them, however, ship the enforcement layer that answers "once this agent is authorized, exactly what is it allowed to do, and how do we prove it never did more" — which is the gap MandateOS is built to fill, and the reason it's deliberately protocol-agnostic rather than a competitor to any of the three.

## 3. Illustrative Bottom-Up TAM

| Step | Assumption | Result |
| :--- | :--- | :--- |
| Razorpay annualized TPV (reported) | — | **$180B** |
| Share flowing through enterprise / API-integrated merchants (vs. long-tail small business) | ~35% (illustrative) | **$63B** |
| Share of that plausibly delegated to autonomous agents by 2028 (procurement bots, infra auto-scalers, subscription/renewal agents) | 3–8% (illustrative range) | **$1.9B – $5.0B** |
| MandateOS take rate on agent-mandated volume | 3–5 bps (see §4) | **$0.6M – $2.5M ARR at the low end of the range, scaling with adoption** |

The wide range is intentional — this is a category that doesn't exist yet at scale, and the honest answer is "the ceiling is a meaningful fraction of enterprise payment volume, and the floor depends entirely on how fast agent-initiated commerce is actually adopted." The point of the model isn't the exact number; it's that even a conservative slice of an already-large, already-growing payment network is a venture-scale opportunity.

## 4. Monetization Model

- **Primary: basis-point fee on mandate-authorized volume (3–5 bps).** Charged on top of Razorpay's existing processing fee, priced as "the cost of provable safety" rather than competing on payment processing margin. This mirrors how fraud-scoring and risk products are typically priced in payments — as a spread on volume, not a per-seat SaaS fee, because the value scales with the money at risk, not with headcount.
- **Secondary: per-mandate platform fee** for enterprises that want unlimited transaction volume under a fixed monthly cost per active agent mandate — useful for large, predictable internal automation (e.g., a cloud cost-optimization agent making thousands of small daily purchases) where bps pricing would be disproportionate to risk.
- **Tertiary: compliance & audit export tier.** Signed, independently verifiable audit exports (`/api/export/chain`) are the artifact a compliance or audit team actually needs for SOC2 / internal audit purposes — a natural upsell for regulated enterprises (fintech, healthcare procurement, public sector) where audit tooling is budgeted separately from payments infrastructure.

## 5. Why Razorpay Specifically

MandateOS is deliberately **not** a standalone payment processor — it's a policy and cryptographic-enforcement layer that sits in front of Razorpay's existing Orders API and webhook infrastructure (see [ADR-003](./ADR/ADR-003-inngest-durability.md) and the architecture diagram in the [README](../README.md)). That means zero migration cost for a merchant already on Razorpay: MandateOS is additive infrastructure, not a replacement decision. For Razorpay itself, it's a differentiator against processors with no answer yet to "can I safely let an AI agent use this" — a question every enterprise payments buyer is starting to ask in 2026.

## 6. Go-to-Market Sequencing

1. **Design partners** — 3–5 companies already running AI agents with *some* spending authority today (cloud cost-optimization bots, procurement agents, subscription-renewal automation) who currently rely on hard-coded spend ceilings or manual approval queues.
2. **Razorpay ecosystem integration** — ship as a Razorpay-native add-on so it's a checkbox during onboarding, not a separate vendor evaluation.
3. **Compliance-led expansion** — once a design partner has audit-exportable proof of zero unauthorized spend over a quarter, that becomes the case study that sells the next five.

---
*Sources for the anchor figures: [Razorpay 10-year TPV targets](https://www.business-standard.com/companies/news/razorpay-marks-10-years-targets-about-400-billion-in-tpv-by-2030-125020900388_1.html), [Razorpay $180B TPV / business overview](https://digitalinasia.com/razorpay-explained/), [Razorpay valuation](https://valueforstartups.in/02-razorpay). Agent-payment protocol context: Google AP2, Visa Trusted Agent Protocol, Mastercard Agent Pay (all launched 2026).*
