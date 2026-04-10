# PubliHub — Phase 1 MVP Execution Plan

Foundation documentation (Phase 0). Four sprints from empty repo through **open beta**: shell, Supabase hub persistence, wallet + gating, **Copilot + browser HUD** (Realtime → OBS / Browser Source) — [plan matrix — Open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch).

## Sprint 1 — UI shell and navigation

- Next.js App Router project scaffold, Tailwind, shadcn/ui baseline
- Responsive shell: bottom tabs (mobile) + sidebar (desktop), placeholder pages for the five pillars (**Widgets** includes **copy HUD URL** by open beta exit — [open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch))
- Framer Motion on Copilot shell (open/close only, no AI yet)
- Public hub route stub with static mock blocks

## Sprint 2 — Supabase Auth and Hub persistence

- Supabase project wiring (env, typed client, middleware for protected routes)
- `profiles`, `hubs`, `hub_blocks` tables + RLS (public read published hub; owner CRUD)
- Server Actions or Route Handlers: load/save hub JSON, reorder blocks
- `ViewModeToggle` driving real data in Fan vs Edit

## Sprint 3 — Wallet read path and plan gating

- `wallet_ledger`, `subscriptions` (or `plan_tier` on profile) + RLS read for owner
- Server-only insert path (mock or test admin) to validate ledger append and listing
- `FeatureGate` from plan matrix: **open beta** exposes **Free** and **Starter** only; **Growth** hidden/disabled (schema may still define `growth` for later). Enforce **minimum withdrawal**, **weekly cap**, and **fees** from [§2](./plan-matrix-and-feature-limits.md#2-plan-specifics-fintech--ai).
- Withdrawal **UI** + validation rules; payout provider integration can be stubbed with “coming soon” if keys not ready

### Plan enforcement reminder (product)

**Canonical table:** [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md) — includes **open beta scope**, capabilities, inbound/withdrawal fees, **minimum withdrawal**, weekly limits, AI credits, integrations.

Frontend gates UX; **server** must enforce the same rules on **mutations**, **checkout math**, **withdrawals**, and **webhooks**.

## Sprint 4 — Copilot MVP + HUD *(open beta scope)*

- Vercel AI SDK Route Handler: streaming chat + **tool definitions** for `navigate`, `render_ui_block` (validated), optional `get_wallet_summary` reading DB server-side
- `GenerativeUIHost` + 2–3 registered widgets (e.g. confirm-style card, simple CTA)
- **`/hud/[token]`** minimal page: subscribes to **creator-scoped** Realtime channel with **short-lived or signed** token (minted by Next.js API — no service role in browser)
- On **`wallet_ledger`** insert (service path from payment webhook or test tool), **broadcast** alert payload; HUD shows toast-style alert (e.g. Framer Motion)
- **Widgets** page: **widget catalog** + **sheet/modal editors** per widget type, copy **Browser Source URL**, optional test ping ([component tree](./component-tree-and-state-strategy.md))
- **Settings** page: **integrations**, **app**, **financial / payout profile**, **plan** sections ([PRD](./prd-mvp-day-one-launch.md) Epic 5)
- Security pass: HUD token scope, RLS, allowlist, rate limits on AI route — [Realtime channels for HUD](./system-architecture-and-data-flow.md#realtime-channels-for-hud)

## Open beta exit criteria

Creator can **edit a hub**, **fan preview**, **view ledger**, **copy HUD URL** into **OBS** (or equivalent), receive a **Realtime HUD alert** on a **test or real Hub-originated credit** (donation/sale), and use **Copilot** for navigation + **one** safe generative widget; **Free vs Starter** gates premium sections — see [Open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch).

## Post–open beta *(streaming platform ingest)*

**Twitch EventSub**, **Streamlabs Socket**, **YouTube** live chat, etc. → normalize → same HUD pipeline — [Streaming & OBS integration plan](./streaming-and-obs-integration-plan.md) phases **B+**.

## Pre-development alignment (open questions)

Before implementation, confirm:

1. **Payments**: For managed (non-transparent) flows, will v1 use **Stripe Connect**, **Pagar.me**, **Mercado Pago**, or another Brazil-first stack? Is **PIX** the only fiat payout for MVP?
2. **Webhooks**: Single Next.js Route Handler per provider with signature verification, or **Supabase Edge Functions** for some events? Do you require an **outbox** pattern (table + worker) for Realtime emit vs doing it inline in the webhook?
3. **AI prompt engineering**: Should the copilot **default persona** be Portuguese (pt-BR) first? Any **brand voice** constraints and **forbidden actions** (e.g. never initiate withdrawal without explicit user confirmation tool)?
4. **Multi-tenant custom domains**: Vercel domains API vs Cloudflare for SSL — any existing preference?
5. **Enterprise “bring your own Stripe”**: Is that **OAuth Connect** to the creator’s Stripe account, or **API key** storage (higher compliance burden)?

## Related docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)
- [Business Model Canvas](./business-model-canvas-publihub.md)
- [PRD — MVP (Day One Launch)](./prd-mvp-day-one-launch.md)
- [The Creator’s Journey (product narrative)](./publihub-creators-journey.md)
- [Streaming & OBS integration plan](./streaming-and-obs-integration-plan.md)
- [System architecture and data flow](./system-architecture-and-data-flow.md)
- [Supabase database schema (draft)](./supabase-database-schema.md)
- [Component tree and state strategy](./component-tree-and-state-strategy.md)
