# PubliHub — Plan Matrix & Feature Limits

**Canonical reference** for **Free**, **Starter**, and **Growth**: product capabilities, fintech rules, AI allowances, and integrations. Engineering should mirror these rules in **`FeatureGate`**, **server mutations**, **webhooks**, and **billing** (see [Phase 1 — Sprint 3](./phase-1-mvp-execution-plan.md#sprint-3--wallet-read-path-and-plan-gating)).

**Pricing**  
Monthly subscription list prices: **Free** R$ 0 · **Starter** R$ 99 · **Growth** R$ 299. Inbound and withdrawal fees below apply **on top of** subscription tier (except Free).

---

## Open beta (MVP launch)

What is **live** during **open beta** vs the full matrix below:

| Topic | Open beta |
|--------|-----------|
| **Plans offered** | **Free** and **Starter** only. **Growth** is **not** sold or selectable; keep enum/schema ready but hide in UI and billing. |
| **Commerce** | **Digital** Hub monetization only (donations, digital products, core wallet). **No** marketplace sync, **no** Shopee/Amazon-style **auto webhook** sales tracking, **no** Growth **e-com** blocks. |
| **Quests / affiliates** | **Basic** digital Quests only if shipped; **no** partner-verified affiliate pipeline in beta. |
| **Stream / overlay** | **Mandatory in open beta:** **`/hud/[token]`** browser page + **Supabase Realtime** (or equivalent) so **donations and fan interactions** from the **Hub** show on the creator’s **livestream** via **OBS / Streamlabs / any Browser Source** ([streaming plan](./streaming-and-obs-integration-plan.md)). **Scope:** **PubliHub-originated** ledger events first; Twitch/Streamlabs/YouTube **mirror** ingest remains **post-beta** unless scoped. |
| **Social / messaging integrations** | **Coming soon:** WhatsApp, Telegram, E-com API sync. **Twitch** / **Google** / **Discord** as **OAuth login** only if shipped; no Twitch EventSub / Streamlabs socket in beta unless explicitly scoped later. |
| **Enforcement** | Server and `FeatureGate` must match this scope; **HUD tokens** must be **scoped and revocable** (no public subscribe to arbitrary creators). |

After open beta, enable **Growth** and **coming soon** rows per release notes.

---

## 1. Product capabilities by tier

| Feature | Free (R$ 0) | Starter (R$ 99) | Growth (R$ 299) |
|--------|-------------|-----------------|-----------------|
| **Product types** | Digital only | Digital only | **Digital + e-com** |
| **Digital workflow** | Title, price, link | Title, price, link | **Full customization** |
| **Marketplace sync** | None | None | **Shopee, Amazon,** etc. |
| **Sales tracking** | Manual | Manual | **Auto — webhook tracking** |
| **Coupons & Quests** | Basic | Basic | **Advanced + brand sync** |

### Interpretation notes

- **Digital only** (Free / Starter): no marketplace-native sync or automated affiliate attribution; Quests may exist in **basic** form where product allows (manual or limited automation).  
- **Growth** unlocks **e-com** blocks, **partner webhooks** for progress and wallet attribution, and **deeper** Quest / brand tooling (see [§3](#3-the-digital-vs-e-com-split-logic)). **Not in open beta.**

---

## 2. Plan specifics (fintech & AI)

| Metric | Free | Starter | Growth |
|--------|------|---------|--------|
| **Inbound fee** | 5.9% + R$ 0.50 | 4.9% + R$ 0.50 | 3.9% + R$ 0.50 |
| **Withdrawal fee** | R$ 1.50 | R$ 0.50 | **R$ 0.00** |
| **Minimum withdrawal** | **R$ 100** | **R$ 50** | **R$ 25** *(Growth; confirm at launch)* |
| **Weekly withdrawal limit** | R$ 500 | R$ 5,000 | **Unlimited** |
| **AI monthly credits** | 10 | 100 | 500 |
| **Social / integration sync** *(full product)* | OBS + Twitch (stream HUD path) | **+ WhatsApp, Telegram** *(coming soon)* | **+ E-com APIs** *(post–Growth launch)* |

**Open beta:** creators get a **Browser Source URL** from the **Widgets** tab; fan **donations and interactions** on the **Hub** must **emit** to the **HUD** in real time ([streaming plan](./streaming-and-obs-integration-plan.md)).

### Withdrawal minimums (semantics)

- **Minimum** = smallest **amount the creator may request** to withdraw from **available wallet balance** in one request.  
- **Withdrawal fee** (column above) is charged **per successful payout** (deducted from balance or netted per gateway rules); **validate** `available_balance >= minimum` **before** submitting to the provider.  
- Payment providers may impose their **own** floor; server should surface provider errors clearly if above PubliHub minimum.

### Enforcement reminders

- **Frontend** gates UX (disabled actions, upsell). **Server** must enforce the same on **checkout**, **ledger credit math**, **withdrawal requests** (minimum, weekly cap, fee), and **AI tool** invocation.  
- **Credits** reset on a **monthly** billing boundary aligned to subscription (exact cron vs anniversary TBD in billing provider).  
- **Donations** and **micro-interactions** inherit **inbound fee** tier unless product defines exceptions.

---

## 3. The digital vs e-com split logic

### Digital products (Free & Starter)

Built for **high-margin, low-complexity** offers: PDFs, preset download links, private community invites, etc.

The **success / delivery link** stays **behind PubliHub checkout** and is revealed **only after** payment confirmation — reducing leakage and keeping fulfillment inside the Hub.

### E-commerce & marketplaces (Growth)

Built for **physical goods** and **affiliate scale**.

The **AI agent** pulls **product metadata** from external URLs, issues **tracked PubliHub links**, and **updates Quests** from **verified partner webhooks**. Community progress (bars, milestones, stream alerts) **automates** without the creator operating spreadsheet workflows.

**Open beta:** this tier and flows are **out of scope**; ship after Growth launch.

---

## Related docs

- [Streaming & OBS integration plan](./streaming-and-obs-integration-plan.md)  
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md)  
- [PRD — MVP (Day One Launch)](./prd-mvp-day-one-launch.md)  
- [Business Model Canvas](./business-model-canvas-publihub.md)  
- [Supabase database schema (draft)](./supabase-database-schema.md) (`plan_tier`, `subscriptions`)
