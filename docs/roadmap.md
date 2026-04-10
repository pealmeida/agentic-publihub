# PubliHub — Product Roadmap: MVP to Scale

Phased delivery plan from open beta through scaled platform.

---

## Overview

| Phase | Name | Timeline | Focus |
|-------|------|----------|-------|
| **1** | MVP (Open Beta) | Weeks 1-8 | Core product, digital monetization, HUD |
| **2** | Growth Foundations | Weeks 9-16 | Integrations, Copilot AI, marketplace prep |
| **3** | E-commerce & Scale | Weeks 17-28 | Growth tier, e-com sync, MCP orchestration |
| **4** | Platform & Ecosystem | Weeks 29-52 | API marketplace, third-party developers, advanced analytics |

---

## Phase 1 — MVP (Open Beta)

**Goal**: Launch Free + Starter with working digital monetization and streaming HUD.

### Scope

| Area | Deliverables |
|------|--------------|
| **Auth** | Supabase Auth (email + OAuth: Google, Twitch) |
| **Hub** | Creator hub builder (pages, blocks, drag-and-drop layout) |
| **Products** | Digital products (title, price, file/link delivery) |
| **Wallet** | Balance, ledger, PIX payout (InfinitePay, internal) |
| **Widgets** | HUD browser source URL + Supabase Realtime |
| **Settings** | Integrations list (OAuth status), app preferences, plan selector |
| **Copilot** | Basic chat + generative canvas (block/widget drafts) |

### Plans Offered

| Plan | Price | Inbound Fee | Withdrawal Min |
|------|-------|-------------|----------------|
| Free | R$ 0 | 5.9% + R$ 0.50 | R$ 100 |
| Starter | R$ 99 | 4.9% + R$ 0.50 | R$ 50 |

### Not In Scope

- Growth plan, e-commerce sync, marketplace integrations
- WhatsApp/Telegram bots
- Custom domains
- Advanced analytics

### Exit Criteria

- [ ] Creator can sign up, build a hub, list a digital product
- [ ] Fan can purchase product → creator wallet credited
- [ ] Creator can withdraw via PIX (minimum enforced by tier)
- [ ] HUD URL works in OBS (donation events appear in real time)
- [ ] Copilot answers questions and generates block/widget drafts

---

## Phase 2 — Growth Foundations

**Goal**: Expand integrations, deepen Copilot, prepare marketplace infrastructure.

### Scope

| Area | Deliverables |
|------|--------------|
| **Integrations** | Twitch EventSub, Discord webhooks, Streamlabs socket |
| **Messaging** | WhatsApp Business API, Telegram Bot (Coming Soon badges) |
| **Copilot** | LangGraph workflows, MCP tool wrapping, multi-step tasks |
| **Auth** | OAuth for Discord, Instagram, X |
| **Quests** | Basic digital Quests (no affiliate verification) |
| **Database** | `orders`, `checkout_sessions`, `hud_tokens` tables |
| **Security** | HUD token lifecycle (rotation, revocation), rate limiting |

### Integration Priority

| Priority | Platform | Type | Library |
|----------|----------|------|---------|
| P0 | Twitch EventSub | Webhook | `@twurple/eventsub` |
| P0 | Discord | Webhook + Bot | `discord.js` |
| P1 | Streamlabs | Socket | `socket.io-client` |
| P1 | WhatsApp | API | Meta Cloud API |
| P2 | Telegram | Bot API | `node-telegram-bot-api` |
| P2 | Instagram | OAuth | Meta Graph API |
| P3 | YouTube Live | API | `googleapis` |
| P3 | X (Twitter) | OAuth | `twitter-api-v2` |

### Copilot Evolution

```
Phase 1 Copilot:  Chat → LLM → Text response
Phase 2 Copilot:  Chat → LLM → MCP Tools → Execute → Structured response
                           ↓
                    ┌──────────────┐
                    │  MCP Server  │
                    │  - hub tools │
                    │  - wallet    │
                    │  - integrations│
                    └──────────────┘
```

### Exit Criteria

- [ ] Twitch events (subs, bits, raids) appear in HUD
- [ ] Discord notifications for sales/donations
- [ ] Copilot can execute multi-step tasks via MCP tools
- [ ] HUD tokens rotate every 24h, revocable by creator
- [ ] WhatsApp/Telegram shown as "Coming Soon" in integrations

---

## Phase 3 — E-commerce & Scale

**Goal**: Launch Growth tier with e-commerce platform sync and marketplace integrations.

### Scope

| Area | Deliverables |
|------|--------------|
| **Growth Plan** | R$ 299 tier, 3.9% + R$ 0.50 inbound, R$ 0 withdrawal fee |
| **Marketplace Sync** | Shopee affiliate, Amazon Associates, Mercado Livre |
| **E-commerce Sync** | Shopify, WooCommerce, Adobe Commerce, Wix Store |
| **Product Sync** | Pull products from external stores → display on Hub |
| **Webhook Tracking** | Auto affiliate attribution, Quest progress from verified webhooks |
| **Advanced Quests** | Brand-synced Quests with partner verification |
| **Custom Domains** | Vercel domains API or Cloudflare for SSL |
| **Analytics** | GMV dashboard, credit velocity, time-to-first-dollar |

### E-commerce Architecture

```
┌───────────────────┐     ┌───────────────────┐
│  Creator's Hub    │     │  External Store    │
│  ┌─────────────┐  │     │  (Shopify, etc.)   │
│  │ Synced      │◄─┼─────┤  Products          │
│  │ Products    │  │ API │  Inventory         │
│  └─────────────┘  │     │  Orders            │
│  ┌─────────────┐  │     └───────────────────┘
│  │ PubliHub    │  │            │
│  │ Checkout    │──┼──── Webhooks
│  └─────────────┘  │     (order tracking)
└───────────────────┘     └───────────────────┘
```

### Exit Criteria

- [ ] Growth plan selectable in UI
- [ ] Creator can connect Shopify store → products appear on Hub
- [ ] Marketplace affiliate links track conversions
- [ ] Quest progress updates from verified partner webhooks
- [ ] Analytics dashboard shows GMV, conversion rates, top products

---

## Phase 4 — Platform & Ecosystem

**Goal**: Open PubliHub as a platform for third-party developers and advanced brand tools.

### Scope

| Area | Deliverables |
|------|--------------|
| **API Marketplace** | Public REST/GraphQL API for developers |
| **MCP Server (public)** | Expose PubliHub tools for external AI agents |
| **Custom Widgets** | Developer SDK for building custom HUD widgets |
| **Brand Dashboard** | Campaign management, multi-creator Quests |
| **Advanced AI** | Credit purchase with wallet, custom Copilot personas |
| **Mobile App** | React Native companion (push notifications, quick stats) |
| **Multi-tenant** | Agency/manager accounts managing multiple creators |

### MCP Integration (Full)

```
┌─────────────────────────────────────────┐
│  PubliHub MCP Server (Public)          │
│                                         │
│  Tools:                                 │
│  - hub.create, hub.update, hub.publish  │
│  - products.list, products.create       │
│  - wallet.balance, wallet.withdraw      │
│  - integrations.connect, integrations.sync│
│  - quests.create, quests.track          │
│  - analytics.dashboard                  │
│                                         │
│  Resources:                             │
│  - hub://<creator>/<page>               │
│  - wallet://<creator>/transactions      │
└─────────────────────────────────────────┘
```

### Exit Criteria

- [ ] Public API with rate limiting and API key auth
- [ ] Third-party developer can build custom HUD widget
- [ ] Brand dashboard live with campaign tracking
- [ ] AI credit purchase with wallet balance works
- [ ] Mobile app in app stores (MVP companion)

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Payment provider delays | High | Blocks Sprint 3 | Pre-integrate InfinitePay; have Abacate Pay as backup |
| Supabase Realtime limits | Medium | HUD drops events | Benchmark early; fallback to SSE/polling |
| Twitch API changes | Low | EventSub breaks | Pin SDK version; monitor Twitch dev blog |
| Growth tier too expensive | Medium | Low conversion | A/B test pricing; offer annual discount |
| MCP ecosystem immaturity | Medium | Copilot limitations | Build direct first; MCP is additive |

---

## Related Docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md)
- [Integrations guide](./integrations-guide.md)
- [Integration tools evaluation](./integration-tools-evaluation.md)
- [Streaming & OBS integration plan](./streaming-and-obs-integration-plan.md)
- [PRD — MVP (Day One Launch)](./prd-mvp-day-one-launch.md)
- [System architecture](./system-architecture-and-data-flow.md)
- [Database schema](./supabase-database-schema.md)
