# PubliHub — Business Model Canvas

Strategic view of **who we serve**, **what we offer**, and **how we capture value**. Pair with the [PRD](./prd-mvp-day-one-launch.md) (what we build), [The Creator’s Journey](./publihub-creators-journey.md) (experience arc), and [Phase 1 MVP plan](./phase-1-mvp-execution-plan.md) (delivery).

**Note on numbers**  
Take-rate and fee **examples** in §7 align with the canonical **[Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)**; adjust both docs together when pricing changes.

---

## 1. Problem

### Fragmented creator stack

Creators stitch together **link-in-bio** tools (e.g. Linktree), **donation / alert** products (e.g. LivePix), and **digital storefronts** (e.g. Stan Store). Fans face **inconsistent UX** and creators face **extra ops** across vendors.

### Passive affiliate sales

Sponsorships and **Shopee / Amazon**-style links depend on **passive clicks**, not **active, gamified** community participation — so conversion and narrative stay weak.

### Delayed liquidity

E-commerce gateways and affiliate networks often settle in **14–30+ days**, which **hurts cash flow** for mid-tier creators who run tight budgets.

---

## 2. Customer segments

| Segment | Type | Profile |
|---------|------|---------|
| **“Middle-class” creator** | B2C / B2B | Streamers, podcasters, influencers (~**10k–500k** followers) wanting **diverse, dependable** income. |
| **Highly engaged fans** | B2C | Spend for **recognition**, **VIP** signals, and **community** participation on stream and on the Hub. |
| **Brand partners & agencies** | B2B | Want **performance (CPA)** campaigns with **clear ROI** and less opaque reporting than spray-and-pray links. |

---

## 3. Unique value proposition (UVP)

**“Turn your audience into a multiplayer economy.”**

One **chat-first Hub** where **digital products**, **instant donations**, and **gamified** brand / affiliate plays feed a **single** community experience — not three disconnected tabs.

---

## 4. Solution

### Chat-first storefront

**AI-driven** setup on **web** and **WhatsApp**: creators describe what they sell; a **Digital Twin**-style agent configures the Hub (aligned with [Copilot / Generative UI](./system-architecture-and-data-flow.md#generative-ui--secure-approach) in architecture).

### Closed-loop “Nexus Credits”

Fans **buy credits** quickly; credits **fund** donations, digital goods, and **micro-interactions** so **in-the-moment** spend is less coupled to slow **bank settlement** cycles. (Underlying payouts and regulatory treatment remain gateway-specific.)

### Gamified middleware

Marketplace links become **Quests** (e.g. *“50 sales unlocks a 12h subathon”*) with progress **verified in real time** via **webhooks** and server-side state (see [PRD Epic 3](./prd-mvp-day-one-launch.md#epic-3--affiliate-gamification-and-quests)).

### Widgets engine

**TTS**, **video sharing**, **fan boards**, and similar tools are **tied to spending** and sync to **OBS** via **Hub-to-HUD** (**open beta:** core **donation / interaction** alerts; richer widgets phased).

---

## 5. Channels

### Viral loop (product-led growth)

**“Powered by PubliHub”** on storefronts, checkout, and **livestream HUD** alerts so **Hub** actions create **on-stream** social proof ([plan matrix](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch)).

### B2B outreach

**Agency partnerships** for **exclusive**, gamified **Publi Quest** pilots.

### Creator referral engine

**Bounties** (e.g. paid in **Nexus Credits**) for creators who **onboard peers**.

---

## 6. Unfair advantage

### Agile payment infrastructure

**Evaluate and route** across high-performance gateways (**Stripe**, **Abacate Pay**, **InfinitePay**) to optimize **conversion** and **withdrawal friction** per market (Brazil-first assumptions in current docs).

### Agentic orchestration

**LangGraph** (and related stack) automates **hard state tracking** — e.g. matching a **Shopee** purchase to a **Twitch-scale** alert — **without** creators wiring webhooks or scripts themselves (see [architecture](./system-architecture-and-data-flow.md) responsibilities table).

---

## 7. Revenue streams

| Stream | Role | Mechanics |
|--------|------|-----------|
| **Transaction take-rate (primary)** | Core | **Tiered** inbound fee on fan conversions (donations, digital sales, micro-interactions): **5.9% / 4.9% / 3.9%** + R$ 0.50 by tier — [Plan matrix](./plan-matrix-and-feature-limits.md#2-plan-specifics-fintech--ai). |
| **SaaS subscription (secondary)** | Expansion | **Starter** (R$ 99) in **open beta**; **Growth** (R$ 299) when e-com and related entitlements launch — see [Plan matrix](./plan-matrix-and-feature-limits.md) (including [Open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch)). |
| **Brand campaign fees (tertiary)** | B2B | **10–15%** platform fee on **escrowed** bounties for **Publi Quests** matched through the network. |

---

## 8. Cost structure

| Bucket | Examples |
|--------|-----------|
| **Infrastructure & AI** | LLM APIs (OpenAI, Anthropic, etc.), **LangGraph** / agent runtime, observability. |
| **Financial operations** | Gateway **API** costs (**Stripe** / **Abacate Pay** / **InfinitePay**), **KYC / compliance**, **anti-fraud** monitoring. |
| **Engineering & R&D** | Real-time **webhooks**, partner and internal **APIs** (including **GraphQL** where used for product or partner surfaces), **mobile-first** Hub and dashboard. |

---

## 9. Key metrics

| Metric | Definition / intent |
|--------|----------------------|
| **GMV (Gross Merchandise Value)** | Total **BRL** (and later multi-currency) **flowing through** the Hub / checkout, before refunds/chargebacks. |
| **Credit velocity** | How quickly purchased **Nexus Credits** are **spent** on store items vs. stream / HUD experiences — signals engagement vs. hoarding. |
| **Time-to-first-dollar (TtFD)** | **Minutes** from **AI-assisted onboarding** to **first credited** fan payment (donation or sale). |

---

## Related docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)  
- [PRD — MVP (Day One Launch)](./prd-mvp-day-one-launch.md)  
- [PubliHub — The Creator’s Journey](./publihub-creators-journey.md)  
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md)  
- [System architecture and data flow](./system-architecture-and-data-flow.md)  
- [Supabase database schema (draft)](./supabase-database-schema.md)
