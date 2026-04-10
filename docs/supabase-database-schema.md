# PubliHub — Supabase Database Schema

Foundation documentation. Core tables for users, storefront JSON, immutable wallet ledger, quests, and subscriptions. Final SQL migrations will refine types and constraints.

**Canonical decisions** (resolves prior open questions):
- `amount_cents` is **positive for credits, negative for debits** (single signed integer).
- `hud_tokens` is a **separate table** (not embedded in `creator_hud_settings`).
- `orders` and `checkout_sessions` tables track purchases before they become ledger entries.
- Secrets encrypted via **Supabase Vault** (not plaintext jsonb).

## Conventions

- `id` UUID primary keys, `created_at` timestamptz, `updated_at` where mutable.
- Row Level Security (RLS) on all user-facing tables.
- Money stored as **integer minor units** (cents) plus `currency` text.

## Core tables

### `profiles` (1:1 with `auth.users`)

- `user_id` (PK, FK → `auth.users`)
- `display_name`, `handle` (unique), `avatar_url`
- `role` enum: `creator`, `fan`, `admin` (as needed)
- `plan_tier` enum: `free`, `starter`, `growth` (denormalized cache from billing, refreshed by webhooks/job). **Open beta:** only **`free`** and **`starter`** are assigned in product flows; **`growth`** exists for schema continuity until launch — see [Open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch).
- `ai_credits_balance` / or separate credits table if you prefer accrual logs
- Optional: `payout_profile` jsonb — **default PIX / bank** for **Settings → Financial** (no raw card data; provider tokens server-side); **Wallet** withdraw flow uses this or per-request override.

### `subscriptions`

- `id`, `user_id` (creator)
- `plan_tier`, `status` (`active`, `past_due`, `canceled`)
- `provider` (`internal`, `stripe`, …), `provider_customer_id`, `provider_subscription_id`
- `current_period_start`, `current_period_end`
- `metadata` jsonb

### `hubs`

- `id`, `owner_user_id` (creator)
- `slug` (unique), `custom_domain` (nullable, unique where set)
- `published` boolean, `fan_view_defaults` jsonb (optional)

### `hub_blocks`

- `id`, `hub_id` (FK)
- `sort_order` int
- `block_type` enum: `product`, `donation`, `link`, `quest_teaser`, `media`, …
- `payload` jsonb — block-specific config (URLs, copy, product refs)
- `visibility` jsonb or enum — plan-gated visibility rules if needed

### `creator_hud_settings` *(optional; Widgets page + `/hud/[token]`)*

- `user_id` (PK, FK → `profiles`) or `hub_id` if one HUD per hub
- `widgets` jsonb — per `widget_type`: `{ enabled, ...options }` (validated server-side against allowlist; see [component tree — Widgets](./component-tree-and-state-strategy.md))
- `hud_token_hash` / rotation metadata if not using standalone `hud_tokens` table
- `updated_at`

### `digital_products` (optional normalization; else embed in `hub_blocks.payload`)

- `id`, `hub_id`, `title`, `description`, `price_cents`, `currency`, `file_ref` or external provider id, `active`

### `wallet_ledger` (append-only)

- `id`, `user_id` (creator receiving funds)
- `entry_type` enum: `credit_sale`, `credit_donation`, `credit_affiliate`, `debit_withdrawal`, `debit_fee`, `debit_refund`, `adjustment`
- `amount_cents` **signed integer**: positive for credits, negative for debits
- `currency`
- `idempotency_key` (unique) — e.g. `stripe_evt_…` or internal UUID
- `reference_type`, `reference_id` — link to order/payout row
- `metadata` jsonb
- **No updates/deletes** in app code (only inserts)

### `withdrawals`

- `id`, `user_id`, `status` (`queued`, `approved`, `processing`, `paid`, `failed`, `rejected`)
- `amount_cents`, `currency`, `method` (`pix`)
- `provider_ref`, `version`, `fee_cents`, `net_cents`, `idempotency_key`
- `created_at`, `completed_at`, `processed_at`, `rejected_reason`
- See [Payment automation pipeline plan §5](./payment-automation-pipeline-plan.md#5-database-changes) for extended schema

### `quests`

- `id`, `hub_id` or `user_id`
- `title`, `rules` jsonb (thresholds, affiliate IDs)
- `progress_current`, `progress_target` (or derived from events)
- `automation_enabled` boolean (Growth-only; enforce in API)
- `status`

### `quest_events` (optional, for audit)

- `id`, `quest_id`, `event_type`, `amount_cents`, `metadata` jsonb, `created_at`

### `integrations` (WhatsApp/Telegram, marketplace sync)

- `id`, `user_id`, `provider`, `config` jsonb (encrypted secrets via Supabase Vault — never store plaintext API keys or OAuth tokens in this column; use `vault` extension for secret fields)
- `enabled` boolean
- `status` enum: `connected`, `failed`, `pending`

### `orders`

- `id`, `creator_id`, `fan_id` (nullable — fans may not be logged in)
- `product_id` (FK → `digital_products`, nullable for donations)
- `type` enum: `digital_product`, `donation`, `quest_reward`
- `amount_cents`, `currency`
- `stripe_checkout_session_id` (unique)
- `status` enum: `pending`, `completed`, `refunded`, `disputed`
- `metadata` jsonb (fan message, product delivery link)
- `created_at`, `completed_at`

### `checkout_sessions`

- `id`, `order_id` (FK → `orders`)
- `stripe_session_id` (unique)
- `expires_at`
- `status` enum: `open`, `complete`, `expired`

### `hud_tokens`

- `id` UUID PK
- `creator_id` (FK → `profiles`)
- `token_hash` TEXT (unique, SHA-256 of plaintext)
- `label` TEXT (default 'default')
- `created_at`, `expires_at`, `revoked_at`, `last_used_at`
- See [HUD token security spec](./hud-token-security-spec.md) for full lifecycle

### `ai_credit_ledger` (recommended for audit vs simple balance)

- `id`, `user_id`, `delta`, `reason`, `period_month` (for monthly caps), `created_at`

## Indexes and constraints

- Unique: `handle`, `hubs.slug`, `wallet_ledger.idempotency_key`, `orders.stripe_checkout_session_id`, `hud_tokens.token_hash`
- Index: `wallet_ledger(user_id, created_at desc)`, `hub_blocks(hub_id, sort_order)`, `hud_tokens(creator_id) WHERE revoked_at IS NULL`, `orders(creator_id, created_at desc)`

## RLS sketch (to implement in Sprint 2+)

- Creators: full CRUD on own `hubs`, `hub_blocks`, read own `wallet_ledger`, `withdrawals`, `quests`.
- Public: read published `hubs` + `hub_blocks` for public slug/domain only.
- **Ledger writes**: deny all from `anon`/`authenticated` client roles; only service role from Next.js.

## Related docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)
- [Business Model Canvas](./business-model-canvas-publihub.md)
- [System architecture and data flow](./system-architecture-and-data-flow.md)
- [Component tree and state strategy](./component-tree-and-state-strategy.md)
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md)
- [Payment & payout spec](./payment-and-payout-spec.md)
- [HUD token security spec](./hud-token-security-spec.md)
- [Widget type registry](./widget-type-registry.md)
- [Deployment & infrastructure](./deployment-and-infrastructure.md)
