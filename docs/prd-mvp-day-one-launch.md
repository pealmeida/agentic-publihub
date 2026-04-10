# PubliHub — Product Requirements Document (PRD)

| Field | Value |
|--------|--------|
| **Product** | PubliHub |
| **Phase** | MVP (Day One Launch) |
| **Platforms** | Mobile-web first, desktop **creator dashboard** + **browser HUD** (OBS / Streamlabs Browser Source). **Open beta:** **WhatsApp / Telegram** **coming soon** — [Open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch). |

**Related documentation**  
[Plan matrix & feature limits](./plan-matrix-and-feature-limits.md) (tiers & fees), [Business Model Canvas](./business-model-canvas-publihub.md) (strategy), [The Creator’s Journey](./publihub-creators-journey.md) (narrative), [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md) (delivery), [System architecture](./system-architecture-and-data-flow.md) (technical), [Component tree](./component-tree-and-state-strategy.md) (UI structure).

---

## 1. Executive summary

PubliHub is an **agentic middleware** platform for the Creator Economy. It replaces static **link-in-bio** pages with an **interactive Hub** backed by a unified **Creator Wallet**. Creators monetize through **donations**, **digital product sales**, and **Quests** — affiliate and partner links turned into **real-time, community-driven** goals with visible progress and stream feedback.

---

## 2. Core mechanics

### 2.1 Nexus credits / direct payments

Fans support creators through **frictionless checkouts** (PIX and card paths subject to chosen gateways). The product may expose packaged **credits** for micro-interactions (TTS, sounds, pins) where it improves conversion; all money movement remains **ledger-backed** and **auditable**.

### 2.2 The Creator Wallet

A **central ledger** records revenue from **donations**, **sales**, and **Quest-attributed** events. The Wallet surface exposes balance, history, and **withdrawal** with clear fees and limits per plan (see [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)).

### 2.3 Agentic middleware

**AI and automation** sit between **messy external signals** (partner webhooks, affiliate conversions, payment events) and **simple creator/fan-facing outputs**: Hub block updates, Quest progress, **Copilot** explanations, and **stream overlay alerts** for **Hub-originated** events *(open beta)*. Complex webhook payloads are **normalized server-side**; the client never trusts raw model-emitted code (see [Generative UI — secure approach](./system-architecture-and-data-flow.md#generative-ui--secure-approach)).

---

## 3. Epics and features

### Epic 1 — The chat-first command center (Creator IDE)

**Goal:** Near-zero learning curve: the creator configures the business by **talking to Copilot**, not by mastering a traditional CMS.

| ID | Feature | Requirement |
|----|---------|-------------|
| **1.1** | **Conversational onboarding** | Copilot chat UI. Example: *“I want to sell my R$ 50 fitness e-book.”* The agent proposes **validated** Hub blocks; **Generative UI** renders them on the **Hub canvas** (live preview / Fan View). |
| **1.2** | **Mobile-first navigation** | Five pillars: **My Hub**, **Wallet**, **Quests**, **Widgets**, **Settings** — responsive shell (tabs on mobile, sidebar on desktop) per [component tree](./component-tree-and-state-strategy.md). |

### Epic 2 — The “Day One” wallet and monetization engine

**Goal:** **Instant** monetization and **on-stream visibility** from the first real **Hub** transaction.

| ID | Feature | Requirement |
|----|---------|-------------|
| **2.1** | **Payment gateway abstraction** | Provider-agnostic **checkout and payout** layer. **InfinitePay** (decided — Brazil-first internal processor, PIX 0%). Single integration surface in app code; webhooks verified and **idempotent**. InfinitePay is not creator-facing; PubliHub is the merchant of record. |
| **2.2** | **Live stream alerts (OBS / Browser Source)** | **Open beta — mandatory.** Unique **`/hud/[token]`** URL per creator. Fan **donations and Hub interactions** → **`wallet_ledger`** → **Realtime** → overlay ([core business flow](./system-architecture-and-data-flow.md#core-business-flow-fan--wallet--hud)). |
| **2.3** | **Micro-interactions** | Fans can pay to trigger **TTS**, **sound effects**, or **pinned messages** on **Hub + HUD** as shipped; v1 may **Hub-only** with HUD **alerts** for paid events. |

### Epic 3 — Affiliate gamification and Quests

**Goal:** Turn passive **Shopee / Amazon** (and similar) links into **active community events**.

**Open beta:** **no** e-commerce marketplace sync or **partner webhook** Quest completion; ship **3.1–3.3** after **Growth** launch (see [Open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch)). Basic Quest UI may exist without verified affiliate plumbing.

| ID | Feature | Requirement |
|----|---------|-------------|
| **3.1** | **AI link translator** | Creator pastes a raw marketplace URL in chat. The agent **fetches metadata** (title, image, price where available), creates a **PubliHub Link** (tracked redirect + Quest attribution where applicable). |
| **3.2** | **Quest builder** | Creator defines goals (e.g. *“100 sales”*). Public Hub renders a **progress bar** and copy; progress driven by **verified** events only. |
| **3.3** | **Webhook verification** | Platform **ingests partner webhooks**, updates Quest state, appends **wallet / attribution** rows as designed, and triggers **stream overlay** + optional Copilot summary **when Growth / partner path is live**; **Hub-only** Quest milestones use same **HUD** pipeline in beta if applicable. **Signature verification** and **idempotency** mandatory. |

### Epic 4 — Interactive widgets

**Goal:** **Broadcast-ready** tools; **open beta** ships **core** HUD + URL copy.

**Open beta:** **`/hud/[token]`**, **copy Browser Source URL**, **test ping** — [Open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch). Advanced fan board / media queue / TTS can trail.

| ID | Feature | Requirement |
|----|---------|-------------|
| **4.1** | **Widget manager** | **Widgets** page: **catalog** of **live HUD widgets** (cards/list) with **enable/disable**; each widget opens **`WidgetEditorSheet`** (mobile bottom sheet) or **`WidgetEditorDialog`** (desktop modal) to edit **per-widget** options (durations, styles, thresholds). Include **Browser Source URL**, regenerate token, optional **HudPreview** — [Widgets (component tree)](./component-tree-and-state-strategy.md). |
| **4.2** | **Hub-to-HUD sync** | **Ledger / Hub events** map to **HUD** Realtime payloads ([Realtime channels for HUD](./system-architecture-and-data-flow.md#realtime-channels-for-hud)); per-widget config **filters** or **styles** what the HUD renders. |

### Epic 5 — Settings, integrations, and plan

**Goal:** One **Settings** hub for **connections**, **app behavior**, **payout account**, and **plan / billing** — [Settings (component tree)](./component-tree-and-state-strategy.md).

| ID | Feature | Requirement |
|----|---------|-------------|
| **5.1** | **Integrations** | **OAuth** link status (Twitch, Google, Discord); **coming soon** rows for WhatsApp, Telegram, e-com APIs per [open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch). |
| **5.2** | **App settings** | Locale, notifications, optional theme; non-destructive prefs. |
| **5.3** | **Financial account (payout)** | **Default payout destination** (e.g. PIX, bank) and verification status; **Withdraw** execution stays primary on **Wallet** with deep link — Settings owns **saved payout profile**. |
| **5.4** | **Plans** | Current tier (**Free / Starter** in beta), usage (e.g. AI credits), **upgrade / billing** CTA; copy aligned with [plan matrix](./plan-matrix-and-feature-limits.md). |

---

## 4. User flows

### Flow 1 — The gamified Publi (fan)

1. Fan opens the creator’s **PubliHub** link (e.g. from bio or stream panel).  
2. Fan sees a **Quest** (e.g. *“Help me upgrade my PC!”* — **45 / 50** Shopee purchases).  
3. Fan taps the **integrated PubliHub Link** and completes a purchase on the partner site.  
4. **Partner** sends a **webhook** to PubliHub (verified, idempotent).  
5. **Agent / backend** updates Quest progress → **46 / 50**.  
6. **Realtime** fires a **celebratory alert** on the **stream overlay** (HUD) **when** partner Quest + webhooks are live (**Growth**). **Open beta:** same **HUD** path applies to **Hub-native** purchases/donations; this Shopee-style flow may be **post–Growth** per [open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch).

### Flow 2 — Instant digital sale (creator)

1. Fan buys a **R$ 30** digital guide on the Hub.  
2. **R$ 30** (minus **platform fee**) is **credited** to the Creator Wallet via **append-only ledger** insert.  
3. Creator opens **Wallet** and, once **available balance** meets the **minimum withdrawal** for their plan, initiates **Withdraw**.  
4. Funds settle to the creator’s **bank account** through the **chosen gateway**, subject to KYC, **minimum and weekly limits**, **withdrawal fee**, and plan rules ([plan matrix §2](./plan-matrix-and-feature-limits.md#2-plan-specifics-fintech--ai)).

---

## 5. Technical architecture guidelines (MVP)

| Area | Guideline |
|------|------------|
| **Frontend** | **Next.js (App Router)** with **React**; **shadcn/ui** + Tailwind for UI primitives. **Mobile-web first** layouts. |
| **State and AI** | **Vercel AI SDK** for **streaming** chat and **tool-first Generative UI**. **LangGraph** (or equivalent) for **multi-step agentic workflows** (webhook interpretation → ledger → Quest update → realtime emit), orchestrated **server-side**; outputs remain **structured** and **validated** before client render. |
| **Database** | **PostgreSQL** (via Supabase in current foundation docs): **immutable wallet ledger**, hubs, blocks, quests, webhook idempotency keys, RLS for roles. |
| **Payments** | **Abstracted payment layer** over **InfinitePay** (internal, non-transparent) with backup providers for future: checkout creation, webhooks, payout initiation, fee accounting. |

**Security and compliance (non-negotiable for MVP)**  
No executable code from the model on the client; **allowlisted** UI components; **human-in-the-loop** for **withdrawal** and sensitive account changes; **signed / scoped** HUD subscriptions **(open beta)**.

---

## 6. MVP scope boundaries (implicit)

- **Day One / open beta** prioritizes: **Hub + Wallet + one gateway path + Copilot + browser HUD** (Realtime alerts for **Hub-originated** fan actions) + **one** safe generative widget (see [open beta exit criteria](./phase-1-mvp-execution-plan.md#open-beta-exit-criteria)).  
- **Open beta** sells **Free + Starter** only; **no** Growth, **no** e-commerce / marketplace automation; **WhatsApp / Telegram / E-com APIs** are **coming soon** — [Plan matrix — Open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch).  
- **Withdrawals** enforce **minimum balance** and **weekly limits** per tier ([§2](./plan-matrix-and-feature-limits.md#2-plan-specifics-fintech--ai)).  
- **Full** Quest affiliate verification, **all** micro-interactions, and **all** listed gateways may **trail** the first shippable slice; this PRD states **intent** so epics can be **trimmed per sprint** without losing the product story.

---

## Related docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)  
- [Business Model Canvas](./business-model-canvas-publihub.md)  
- [PubliHub — The Creator’s Journey](./publihub-creators-journey.md)  
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md)  
- [Streaming & OBS integration plan](./streaming-and-obs-integration-plan.md)  
- [System architecture and data flow](./system-architecture-and-data-flow.md)  
- [Component tree and state strategy](./component-tree-and-state-strategy.md)
- [Payment & payout spec](./payment-and-payout-spec.md)
- [Roadmap](./roadmap.md)  
- [Supabase database schema (draft)](./supabase-database-schema.md)
