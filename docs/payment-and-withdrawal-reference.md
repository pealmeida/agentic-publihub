# PubliHub — Payment & Withdrawal Reference

**Canonical, single-source document** for the entire payment and withdrawal system: provider architecture, checkout flow, receivables settlement, wallet ledger, fee rules, withdrawal pipeline, approval queue, database schema, API contracts, security requirements, and implementation roadmap.

**Scope**: Open beta — Free and Starter tiers only. Growth tier schema is defined but not active.

**Approval model**: All withdrawals require **manual admin approval**. Auto-approval rules exist in the codebase but are disabled by default.

**Settlement model**: Creator wallet is credited **only after InfinitePay settles the receivable**. PIX settles near-instantly; credit card settles on InfinitePay's schedule (T+1 to T+30 per installment). No wallet credit before settlement.

---

## 1. Architecture overview

### 1.1 PubliHub is the merchant of record

InfinitePay is **PubliHub's internal payment processor**. It is never visible to creators or fans. PubliHub operates a single InfinitePay account that receives all fan payments and originates all creator payouts via PIX.

```
┌─────────────────────────────────────────────────────────────┐
│  Fan sees:    PubliHub branded checkout                     │
│  Creator sees: PubliHub Wallet + "Sacar para minha chave    │
│                PIX"                                         │
│  Behind it:   InfinitePay processes all transactions        │
└─────────────────────────────────────────────────────────────┘
```

**Implications**:
- Single InfinitePay handle (`INFINITEPAY_HANDLE` env var) — all checkouts use this
- No creator InfinitePay account — creators never interact with InfinitePay
- Creators provide a PIX key in Settings → Financial; payouts go directly to that key
- PubliHub collects creator identity (full name + CPF); KYC is PubliHub's responsibility
- InfinitePay charges its processing fee on gross; PubliHub charges the platform inbound fee on top, keeping the spread
- **Settlement lock-in**: Creator wallet is credited only after the receivable settles — not when the fan pays

### 1.2 Provider selection

| Provider | Role | Status |
|----------|------|--------|
| **InfinitePay** | Internal payment processing + payout | **Primary (MVP)** |
| Abacate Pay | Backup | Phase 2+ |
| Stripe | Backup (international) | Phase 2+ |

### 1.3 Why InfinitePay

| Factor | Detail |
|--------|--------|
| Brazil-first | PIX at 0%, credit card from 2.69% |
| No monthly fees | Pure per-transaction model |
| Checkout API | `POST https://api.infinitepay.io/invoices/public/checkout/links` |
| Webhooks | Payment confirmation via `webhook_url` + `payment_check` for dual verification |
| PIX payouts | Send PIX directly from PubliHub's InfinitePay account to creator's bank |
| Settlement | Na hora or 1 dia util |
| Anti-fraud | CNF-certified |

### 1.4 System topology

```
┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
│ Fan (Hub)   │───>│ Next.js      │───>│ InfinitePay API  │
└─────────────┘    │ Server       │    │ (checkout, PIX)  │
                   │ Actions +    │    └──────────────────┘
┌─────────────┐    │ Route        │           │
│ Creator     │───>│ Handlers     │    ┌──────┴───────────┐
│ (Dashboard) │    │              │    │ Webhooks          │
└─────────────┘    │              │<───│ /api/webhooks/    │
                   └──────┬───────┘    │   infinitepay     │
                          │            └──────────────────┘
                   ┌──────┴───────┐
                   │ Supabase     │
                   │ PostgreSQL   │
                   │ Realtime     │
                   └──────────────┘
```

### 1.5 Money flow (end-to-end)

```
Fan pays R$ 100 (PIX) or R$ 100 (credit card)
        │
        ▼
InfinitePay receives payment, deducts its processing fee
        │
        ▼
Webhook → PubliHub creates 1 receivable
  - PIX: settles in minutes
  - Card: settles T+1 (1x only, no installments in MVP)
        │
        ▼  Receivable settles (InfinitePay confirms)
PubliHub credits creator wallet
  - ledger: credit_sale (+net_cents)
  - Net = gross - platform fee (PIX or card rate)
        │
        ▼  Creator requests withdrawal
Withdrawal pipeline: queued → admin approve → PIX payout
```

---

## 2. Checkout flow (fan → receivable → wallet → HUD)

### 2.1 End-to-end sequence

```
Fan clicks "Buy" / "Donate" on Hub
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│ Server: createCheckout()                                  │
│ POST api.infinitepay.io/invoices/public/checkout/links    │
│ handle: INFINITEPAY_HANDLE (PubliHub's)                   │
│ items: [{ quantity, price (cents), description }]         │
│ order_nsu: PubliHub internal order ID                     │
│ redirect_url: {ORIGIN}/api/checkout/success               │
│ webhook_url: {ORIGIN}/api/webhooks/infinitepay            │
└───────────────────────────────────────────────────────────┘
        │
        ▼  Returns { checkoutUrl, slug }
┌───────────────────────────────────────────────────────────┐
│ Redirect fan to payment page                              │
│ (branded PubliHub checkout — fan never sees "InfinitePay")│
└───────────────────────────────────────────────────────────┘
        │
        ▼  Fan completes payment (PIX or card)
┌───────────────────────────────────────────────────────────┐
│ InfinitePay webhook POST → /api/webhooks/infinitepay      │
│ { invoice_slug, amount, paid_amount, capture_method,      │
│   transaction_nsu, order_nsu, receipt_url, items }        │
└───────────────────────────────────────────────────────────┘
        │
        ▼  Dual verify + create receivable(s)
┌───────────────────────────────────────────────────────────┐
│ 1. payment_check API confirms payment is genuine          │
│ 2. Create order → completed, reveal delivery link         │
│ 3. Create receivable in `receivables` table            │
│    - PIX: settlement_expected_at = now+5min        │
│    - Card: settlement_expected_at = T+1            │
│    (always 1 receivable per payment — no installments in MVP)
│ 4. Supabase Realtime broadcast to HUD                     │
│                                                             │
│ NOTE: Wallet is NOT credited yet.                          │
│       Wallet credits only when receivables settle.         │
└───────────────────────────────────────────────────────────┘
        │
        ▼  Settlement cron confirms receivable settled
┌───────────────────────────────────────────────────────────┐
│ 1. Receivable transitions to `settled`                     │
│ 2. Insert wallet_ledger: credit (net) + debit (platform   │
│    fee)                                                    │
│ 3. Supabase Realtime: balance updated notification        │
└───────────────────────────────────────────────────────────┘
```

### 2.2 Webhook dual verification

InfinitePay does **not** provide HMAC signature verification. PubliHub uses a two-step process:

1. **Webhook receipt** — InfinitePay POSTs to our `webhook_url`. We respond `200 OK` immediately.
2. **Server-side confirmation** — We call `POST https://api.infinitepay.io/invoices/public/checkout/payment_check` with `{ handle, order_nsu, transaction_nsu, slug }` to verify the payment is genuinely paid.
3. **Idempotency** — `transaction_nsu` stored with unique constraint; duplicates skipped.

**If `payment_check` returns `paid: false` after a webhook claims paid**: do not credit. Log a security alert with the full payload.

### 2.3 Webhook response handling

InfinitePay expects:
- **200 OK** → delivered successfully
- **400 Bad Request** → InfinitePay retries

Our handler responds `200` immediately, then processes asynchronously.

---

## 3. Receivables (settlement lock-in)

### 3.1 Why receivables

PubliHub does **not** credit the creator wallet when the fan pays. Instead, it creates **receivables** — one per settlement event. The wallet is credited **only when InfinitePay confirms the receivable has settled** into PubliHub's account.

This protects PubliHub from:
- **Chargebacks** on credit card transactions (up to 120 days)
- **Settlement failures** where InfinitePay doesn't receive funds
- **Cash flow gaps** where creators withdraw funds that haven't settled

### 3.2 Receivable lifecycle

```
Payment confirmed (webhook + payment_check)
        │
        ▼
┌──────────────────────────────────────────────────┐
│ Create receivable(s):                             │
│                                                   │
│ PIX (1x):                                         │
│   1 receivable                                    │
│   settlement_expected_at = now + 5 min            │
│                                                   │
│ Credit card (1x only — no installments in MVP):   │
│   1 receivable                                    │
│   settlement_expected_at = created_at + 1 day     │
└──────────────────────────────────────────────────┘
        │
        ▼  Settlement cron checks / InfinitePay confirms
┌──────────────────────────────────────────────────┐
│ Receivable status transitions:                    │
│                                                   │
│ pending → settled → (wallet credited)             │
│ pending → failed → (alert admin, no credit)       │
│ settled → charged_back → (debit wallet, alert)    │
└──────────────────────────────────────────────────┘
```

### 3.3 Settlement timeline by payment method

| Method | InfinitePay settlement | Receivable `settlement_expected_at` | Wallet credit |
|--------|----------------------|--------------------------------------|---------------|
| **PIX** | Near-instant (seconds) | `created_at + 5 min` | Within minutes |
| **Credit card (1x only)** | T+1 (next business day) | `created_at + 1 day` | 1 business day |

**MVP constraint**: Credit card payments are limited to **1x (no installments)**. Installments (2x–12x) will be enabled in a future phase when settlement and chargeback handling matures.

### 3.4 Settlement cron

A dedicated cron (`GET /api/cron/settle-receivables`) runs every 10 minutes:

```
1. SELECT receivables WHERE status = 'pending'
   AND settlement_expected_at <= now()
   ORDER BY settlement_expected_at ASC
   LIMIT 200
2. For each:
   a. Check settlement status via InfinitePay API
   b. If settled: transition → 'settled', credit wallet
   c. If still pending: skip (will retry next cycle)
   d. If failed: transition → 'failed', alert admin
3. Check for overdue receivables:
   SELECT receivables WHERE status = 'pending'
   AND settlement_expected_at < now() - interval '3 days'
   → Alert admin (settlement delay)
```

### 3.5 Chargeback handling

If a settled receivable is charged back:

```
1. Transition receivable → 'charged_back'
2. Debit creator wallet:
   - ledger: debit_refund (-net_cents)  (reference: receivable.id)
3. If creator balance goes negative from chargeback:
   - Flag account for admin review
   - Negative balance allowed (debt to PubliHub)
   - Creator must repay before next withdrawal
4. Revoke digital product access (if applicable)
5. Alert admin
```

### 3.6 Creator-facing transparency

Creators see in their wallet:

```
┌─────────────────────────────────────────────────┐
│ Saldo disponivel:          R$ 94.60             │
│ A liquidar (pending):      R$ 200.00            │
│ Total recebido (all-time): R$ 1,200.00          │
│                                                  │
│ Proximas liquidacoes:                            │
│   R$ 100.00 — PIX — estimativa: hoje            │
│   R$ 100.00 — Cartao — estimativa: amanha       │
└─────────────────────────────────────────────────┘
```

---

## 4. Wallet ledger

### 4.1 Design

The `wallet_ledger` is **append-only** — no updates, no deletes. Every money movement is a new row.

```typescript
type LedgerEntry = {
  id: string;
  creator_id: string;
  entry_type: 'credit_sale' | 'credit_donation' | 'credit_affiliate'
            | 'debit_withdrawal' | 'debit_fee' | 'debit_refund'
            | 'adjustment';
  amount_cents: number;
  currency: 'BRL';
  idempotency_key: string;
  reference_type: 'order' | 'withdrawal' | 'receivable' | null;
  reference_id: string | null;
  description: string;
  balance_after: number;
  metadata: Record<string, unknown>;
  created_at: string;
};
```

### 4.2 Balance calculation

```
available_balance  = SUM(amount_cents) WHERE creator_id = X
pending_settlement = SUM(net_cents) FROM receivables WHERE creator_id = X
                     AND status = 'pending'
pending_withdrawal = SUM(amount_cents) FROM withdrawals WHERE creator_id = X
                     AND status IN ('queued', 'approved', 'processing')
withdrawn_all_time = SUM(amount_cents) FROM withdrawals WHERE creator_id = X
                     AND status = 'paid'
```

### 4.3 Settlement credit (one receivable settles) — two ledger entries

```
Receivable settles: R$ 100.00 PIX sale on Starter plan
Platform fee (PIX rate): 3.9% + R$ 0.30 = R$ 4.20 (420 cents)
Net to creator: 10000 - 420 = 9580 cents

Ledger entries (single transaction):
  1. credit_sale      → +9580 cents  (reference: receivable.id)
  2. debit_fee        →  -420 cents  (reference: receivable.id)

Creator receives: R$ 95.80 in available balance
```

### 4.4 Chargeback debit

```
Chargeback on settled receivable: R$ 95.80

Ledger entries:
  1. debit_refund     → -9580 cents  (reference: receivable.id)

Creator balance decreases by R$ 95.80 (may go negative)
```

---

## 5. Fee rules

### 5.1 Platform inbound fees — split by payment method

Fees are split because **PIX has near-zero cost and instant settlement**, while **credit cards carry processing cost, chargeback risk, and delayed settlement**.

#### PIX fees (InfinitePay cost: 0%, settlement: instant)

| Plan | PubliHub fee | Example: R$ 100 PIX sale |
|------|-------------|--------------------------|
| **Free** | 4.9% + R$ 0.30 | R$ 5.20 → creator gets R$ 94.80 |
| **Starter** | 3.9% + R$ 0.30 | R$ 4.20 → creator gets R$ 95.80 |
| **Growth** | 2.9% + R$ 0.30 | R$ 3.20 → creator gets R$ 96.80 |

**Margin for PubliHub**: Since InfinitePay charges 0% on PIX, the entire platform fee is margin.

#### Credit card fees (InfinitePay cost: ~3–5%, settlement: T+1 to T+30)

| Plan | PubliHub fee | Example: R$ 100 card sale |
|------|-------------|---------------------------|
| **Free** | 7.9% + R$ 0.50 | R$ 8.40 → creator gets R$ 91.60 |
| **Starter** | 6.9% + R$ 0.50 | R$ 7.40 → creator gets R$ 92.60 |
| **Growth** | 5.9% + R$ 0.50 | R$ 6.40 → creator gets R$ 93.60 |

**Margin for PubliHub**: After InfinitePay takes ~3–5% on credit cards, PubliHub keeps the spread.

### 5.2 Withdrawal fees (per payout)

| Plan | Withdrawal fee | Deducted when |
|------|---------------|---------------|
| **Free** | R$ 1.50 | Withdrawal is created (queued) |
| **Starter** | R$ 0.50 | Withdrawal is created (queued) |
| **Growth** | R$ 0.00 | — |

### 5.3 Fee calculation functions

```typescript
type PlanTier = 'free' | 'starter' | 'growth';
type CaptureMethod = 'pix' | 'credit_card';

type FeeSchedule = {
  pixPercent: number;
  pixFixedCents: number;
  cardPercent: number;
  cardFixedCents: number;
  withdrawalFeeCents: number;
  minWithdrawalCents: number;
  weeklyLimitCents: number | null;
};

const FEE_SCHEDULE: Record<PlanTier, FeeSchedule> = {
  free: {
    pixPercent: 4.9, pixFixedCents: 30,
    cardPercent: 7.9, cardFixedCents: 50,
    withdrawalFeeCents: 150, minWithdrawalCents: 10000, weeklyLimitCents: 50000,
  },
  starter: {
    pixPercent: 3.9, pixFixedCents: 30,
    cardPercent: 6.9, cardFixedCents: 50,
    withdrawalFeeCents: 50, minWithdrawalCents: 5000, weeklyLimitCents: 500000,
  },
  growth: {
    pixPercent: 2.9, pixFixedCents: 30,
    cardPercent: 5.9, cardFixedCents: 50,
    withdrawalFeeCents: 0, minWithdrawalCents: 2500, weeklyLimitCents: null,
  },
};

function calculatePlatformFee(
  tier: PlanTier,
  method: CaptureMethod,
  grossCents: number,
): number {
  const s = FEE_SCHEDULE[tier];
  if (method === 'pix') {
    return Math.round(grossCents * s.pixPercent / 100) + s.pixFixedCents;
  }
  return Math.round(grossCents * s.cardPercent / 100) + s.cardFixedCents;
}

function calculateNetAmount(
  tier: PlanTier,
  method: CaptureMethod,
  grossCents: number,
): number {
  return grossCents - calculatePlatformFee(tier, method, grossCents);
}

function calculateWithdrawalFee(tier: PlanTier): number {
  return FEE_SCHEDULE[tier].withdrawalFeeCents;
}
```

### 5.4 Fee examples with settlement

#### PIX sale — R$ 100, Starter plan

```
Fan pays R$ 100 via PIX
  InfinitePay processing fee: 0% (free)
  PubliHub platform fee: 3.9% + R$ 0.30 = R$ 4.20

Receivable created:
  gross_cents = 10000
  fee_cents   =   420
  net_cents   =  9580
  capture_method = 'pix'
  settlement_expected_at = now + 5 min

~5 min later: receivable settles
  Ledger: credit_sale +9580, debit_fee -420
  Creator available balance: +R$ 95.80
```

#### Credit card 1x — R$ 100, Starter plan

```
Fan pays R$ 100 via credit card (1x)
  InfinitePay processing fee: ~3.5% (absorbed by PubliHub)
  PubliHub platform fee: 6.9% + R$ 0.50 = R$ 7.40

1 receivable created:
  gross=10000, fee=740, net=9260, settles T+1

Next business day: receivable settles
  Ledger: credit_sale +9260, debit_fee -740
  Creator available balance: +R$ 92.60
```

### 5.5 Withdrawal fee example

```
Creator available balance:  R$ 200.00 (20000 cents)
Creator requests withdraw:  R$ 150.00 (15000 cents)
Plan: Starter (withdrawal fee R$ 0.50)

Ledger entries (single transaction):
  1. debit_withdrawal  → -15000 cents  (reference: withdrawal.id)
  2. debit_fee         →    -50 cents  (reference: withdrawal.id)

withdrawals row:
  amount_cents = 15000
  fee_cents    =    50
  net_cents    = 14950   ← sent to creator via PIX

Available balance after: R$ 49.50 (4950 cents)
```

---

## 6. Withdrawal rules and limits

### 6.1 Per-tier limits

| Rule | Free | Starter | Growth |
|------|------|---------|--------|
| **Minimum per request** | R$ 100 (10000 cents) | R$ 50 (5000 cents) | R$ 25 (2500 cents) |
| **Weekly limit** | R$ 500 (50000 cents) | R$ 5,000 (500000 cents) | Unlimited |
| **Withdrawal fee** | R$ 1.50 (150 cents) | R$ 0.50 (50 cents) | R$ 0.00 |
| **Rate limit** | 5 requests / 24h | 5 requests / 24h | 5 requests / 24h |

### 6.2 Pre-flight validation (all must pass, in order)

| # | Check | Error Code | HTTP |
|---|-------|------------|------|
| 1 | `amount_cents` is a positive integer | `VALIDATION_ERROR` | 400 |
| 2 | Creator has verified payout profile: `pix_key_verified = true`, `full_name IS NOT NULL`, `document_cpf IS NOT NULL` | `KYC_PENDING` | 422 |
| 3 | `amount_cents >= minWithdrawalCents` for plan | `BELOW_MINIMUM` | 422 |
| 4 | `available_balance >= amount_cents + withdrawalFee` | `INSUFFICIENT_BALANCE` | 422 |
| 5 | Weekly total (paid + queued + approved + processing) + `amount_cents <= weeklyLimit` | `WEEKLY_LIMIT_EXCEEDED` | 422 |
| 6 | Count of withdrawals in last 24h < 5 | `RATE_LIMITED` | 429 |

### 6.3 Creator payout profile

Creators set up their payout destination in **Settings → Financial**:

```typescript
type PayoutProfile = {
  pix_key: string;
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  pix_key_verified: boolean;
  full_name: string;
  document_cpf: string;
};
```

Stored in `profiles.payout_profile` (JSONB). Sensitive fields encrypted via Supabase Vault.

**Verification**: PIX key is validated by either a small test transfer or CPF/CNPJ format validation before `pix_key_verified` is set to `true`.

---

## 7. Withdrawal pipeline

### 7.1 State machine

```
                     ┌──────────┐
Creator requests     │          │   Admin
withdraw             │  queued  │   manual
                     │          │   approval
                     └────┬─────┘          │
                          │                ▼
                     Admin│          ┌──────────┐
                     skip │          │ approved │
                          ▼          │          │
                     ┌──────────┐    └─────┬────┘
                     │ rejected │          │ Cron sends
                     │          │          │ PIX transfer
                     └──────────┘          ▼
                                       ┌──────────┐
                                       │processing│
                                       └────┬─────┘
                                  ┌─────────┴─────────┐
                                  ▼                   ▼
                            ┌──────────┐        ┌──────────┐
                            │   paid   │        │  failed  │
                            └──────────┘        └────┬─────┘
                                                     │ Admin retry
                                                     ▼
                                               ┌──────────┐
                                               │  queued  │
                                               └──────────┘
```

### 7.2 Status definitions

| Status | Who sets it | Meaning |
|--------|-------------|---------|
| `queued` | System (on creator request) | Awaiting admin approval. Balance reserved. |
| `approved` | Admin only | Cleared for payout. Funds reserved. |
| `rejected` | Admin only | Denied. Balance **released** (amount + fee credited back). |
| `processing` | System cron | PIX transfer sent to InfinitePay. Awaiting confirmation. |
| `paid` | System (webhook/poll) | PIX settled in creator's bank. Terminal. |
| `failed` | System (webhook/poll) | PIX failed. Balance stays reserved. Admin may retry. |

### 7.3 Transition rules

| From | To | Actor | Condition |
|------|----|-------|-----------|
| — | `queued` | Creator | All pre-flight validations pass |
| `queued` | `approved` | Admin | Manual review passes |
| `queued` | `rejected` | Admin | Any reason; balance released |
| `approved` | `processing` | Cron | InfinitePay PIX call succeeds |
| `processing` | `paid` | System | Provider confirms settlement |
| `processing` | `failed` | System | Provider reports failure |
| `failed` | `queued` | Admin | Retry requested; re-queues |

### 7.4 Concurrency guard (optimistic locking)

Every status transition uses Compare-And-Swap on `version`:

```sql
UPDATE withdrawals
SET status = 'approved', version = version + 1
WHERE id = $1 AND status = 'queued' AND version = $2
RETURNING *;
-- 0 rows = concurrent conflict → reject the operation
```

### 7.5 Withdrawal creation flow

On `POST /api/wallet/withdraw` (single Supabase transaction):

1. Lock creator's latest balance (serializable read)
2. Insert `withdrawals` row: `status: 'queued'`, `fee_cents`, `net_cents`, `idempotency_key`
3. Insert `wallet_ledger` rows: `debit_withdrawal` (-amount) + `debit_fee` (-fee)
4. Insert `withdrawal_events` row: `queued`, actor: `creator`
5. Insert `payment_queue` row (priority by plan tier + amount)
6. Evaluate auto-approval rules (disabled by default — see §7.8)
7. Return `Withdrawal` object

### 7.6 Rejection and refund flow

On `POST /api/admin/queue/:id/reject` (single transaction):

1. CAS update: `withdrawals SET status = 'rejected', version++`
2. Insert `wallet_ledger`:
   - `adjustment` credit: `+amount_cents`
   - `adjustment` credit: `+fee_cents`
3. Insert `withdrawal_events`: `queued → rejected`, actor: `admin`, reason
4. Mark `payment_queue.processed_at`

Balance is **fully restored** (amount + fee).

### 7.7 Payout execution (cron)

A Vercel Cron route runs every 5 minutes: `GET /api/cron/process-payouts`

```
1. SELECT withdrawals WHERE status = 'approved'
   ORDER BY created_at ASC LIMIT 50
2. For each:
   a. CAS transition → 'processing'
   b. InfinitePay PIX payout (via provider abstraction)
      - amount: net_cents
      - pix_key: creator's registered key
      - idempotency_key: withdrawal.idempotency_key
   c. On success: record provider_ref, log event
   d. On failure: transition → 'failed', log event, alert admin
3. Poll fallback: re-check withdrawals stuck in 'processing' > 15 min
```

Cron is protected by `CRON_SECRET` bearer token verification.

### 7.8 Auto-approval engine

Auto-approval rules exist in the `withdrawal_rules` table but are **disabled by default**. Admin can enable them later if desired.

```typescript
async function evaluateAutoApproval(withdrawal, creator): Promise<boolean> {
  const rules = await getEnabledRules(); // ordered by priority ASC
  for (const rule of rules) {
    if (evaluateCondition(rule, withdrawal, creator)) {
      if (rule.action === 'auto_approve') {
        await transitionWithdrawal(withdrawal.id, 'queued', 'approved', 'system');
        return true;
      }
      if (rule.action === 'flag_for_review') {
        await flagForReview(withdrawal.id, rule.name);
        return false;
      }
    }
  }
  return false;
}
```

Seeded rules (disabled):

| Name | Condition | Action |
|------|-----------|--------|
| `starter_auto_under_200` | `plan_tier = 'starter' AND net_cents <= 20000` | `auto_approve` |
| `flag_large_withdrawals` | `net_cents > 100000` | `flag_for_review` |

---

## 8. Database schema

### 8.1 `receivables`

```sql
CREATE TABLE receivables (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES orders(id),
  creator_id              UUID NOT NULL REFERENCES profiles(user_id),
  gross_cents             INT NOT NULL,
  platform_fee_cents      INT NOT NULL,
  net_cents               INT NOT NULL,
  capture_method          TEXT NOT NULL,  -- 'pix' | 'credit_card'
  status                  TEXT NOT NULL DEFAULT 'pending',
    -- pending | settled | failed | charged_back
  settlement_expected_at  TIMESTAMPTZ NOT NULL,
  settled_at              TIMESTAMPTZ,
  provider_ref            TEXT,
  metadata                JSONB DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.2 `wallet_ledger` (append-only)

```sql
CREATE TABLE wallet_ledger (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(user_id),
  entry_type      TEXT NOT NULL,  -- credit_sale, credit_donation, credit_affiliate,
                                  -- debit_withdrawal, debit_fee, debit_refund, adjustment
  amount_cents    INT NOT NULL,   -- positive = credit, negative = debit
  currency        TEXT NOT NULL DEFAULT 'BRL',
  idempotency_key TEXT NOT NULL UNIQUE,
  reference_type  TEXT,           -- 'order' | 'withdrawal' | 'receivable' | NULL
  reference_id    UUID,
  description     TEXT,
  balance_after   INT NOT NULL,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wallet_ledger_user ON wallet_ledger(user_id, created_at DESC);
```

### 8.3 `withdrawals`

```sql
CREATE TABLE withdrawals (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES profiles(user_id),
  status           TEXT NOT NULL DEFAULT 'queued',
    -- queued | approved | processing | paid | failed | rejected
  amount_cents     INT NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'BRL',
  method           TEXT NOT NULL DEFAULT 'pix',
  fee_cents        INT NOT NULL DEFAULT 0,
  net_cents        INT NOT NULL DEFAULT 0,
  version          INT NOT NULL DEFAULT 1,
  provider_ref     TEXT,
  idempotency_key  TEXT UNIQUE,
  rejected_reason  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at     TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ
);
```

### 8.4 `withdrawal_events` (append-only audit)

```sql
CREATE TABLE withdrawal_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id  UUID NOT NULL REFERENCES withdrawals(id),
  from_status    TEXT NOT NULL,
  to_status      TEXT NOT NULL,
  actor          TEXT NOT NULL,
  actor_id       UUID,
  reason         TEXT,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_withdrawal_events_withdrawal ON withdrawal_events(withdrawal_id, created_at);
```

### 8.5 `withdrawal_rules`

```sql
CREATE TABLE withdrawal_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT false,
  condition_type  TEXT NOT NULL,
  condition_value JSONB NOT NULL,
  action          TEXT NOT NULL DEFAULT 'auto_approve',
  priority        INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.6 `payment_queue`

```sql
CREATE TABLE payment_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id   UUID NOT NULL REFERENCES withdrawals(id) UNIQUE,
  priority_score  INT NOT NULL DEFAULT 0,
  assigned_to     UUID REFERENCES profiles(user_id),
  batch_id        UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_payment_queue_pending ON payment_queue(processed_at)
  WHERE processed_at IS NULL;
```

### 8.7 `orders`

```sql
CREATE TABLE orders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id     UUID NOT NULL REFERENCES profiles(user_id),
  fan_id         UUID REFERENCES profiles(user_id),
  product_id     UUID REFERENCES digital_products(id),
  type           TEXT NOT NULL,  -- 'digital_product' | 'donation' | 'quest_reward'
  amount_cents   INT NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'BRL',
  capture_method TEXT,  -- 'pix' | 'credit_card'
  provider_session_id TEXT UNIQUE,
  status         TEXT NOT NULL DEFAULT 'pending',
    -- pending | completed | refunded | disputed
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);

CREATE INDEX idx_orders_creator ON orders(creator_id, created_at DESC);
```

### 8.8 RLS policies

```sql
-- Creators: read own data
CREATE POLICY "Creators read own withdrawals"
  ON withdrawals FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Creators read own wallet ledger"
  ON wallet_ledger FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Creators read own receivables"
  ON receivables FOR SELECT USING (creator_id = auth.uid());

CREATE POLICY "Creators read own withdrawal events"
  ON withdrawal_events FOR SELECT USING (
    withdrawal_id IN (SELECT id FROM withdrawals WHERE user_id = auth.uid())
  );

-- Ledger + receivable + withdrawal writes: service-role ONLY
-- payment_queue: service-role writes; admin-role reads
-- Creators NEVER read payment_queue
```

---

## 9. API reference

### 9.1 Creator-facing

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/checkout/create` | POST | Session | Create InfinitePay checkout link |
| `/api/checkout/success` | GET | Session | Post-payment redirect (verify + delivery) |
| `/api/wallet/balance` | GET | Session | Available + pending settlement + withdrawn |
| `/api/wallet/ledger` | GET | Session | Paginated ledger history |
| `/api/wallet/receivables` | GET | Session | Pending and settled receivables |
| `/api/wallet/withdraw` | POST | Session | Request withdrawal |
| `/api/wallet/withdrawals` | GET | Session | Paginated withdrawal history |

#### `POST /api/wallet/withdraw`

**Request**:
```typescript
{ amount_cents: number }
```

**Response** (201):
```typescript
{
  id: string;
  status: 'queued';
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  created_at: string;
}
```

#### `GET /api/wallet/balance`

```typescript
{
  available_cents: number;
  pending_settlement_cents: number;
  pending_withdrawal_cents: number;
  withdrawn_cents: number;
  currency: 'BRL';
  upcoming_settlements: Array<{
    amount_cents: number;
    capture_method: 'pix' | 'credit_card';
    expected_at: string;
  }>;
}
```

#### `GET /api/wallet/receivables`

```typescript
{
  data: Array<{
    id: string;
    order_id: string;
    gross_cents: number;
    platform_fee_cents: number;
    net_cents: number;
    capture_method: 'pix' | 'credit_card';
    status: 'pending' | 'settled' | 'failed' | 'charged_back';
    settlement_expected_at: string;
    settled_at: string | null;
  }>;
  page: number;
  per_page: number;
  total: number;
}
```

### 9.2 Admin-facing

All require `role = 'admin'` verified server-side.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/queue` | GET | Payment queue with stats |
| `/api/admin/queue/:id/approve` | POST | Approve (CAS on version) |
| `/api/admin/queue/:id/reject` | POST | Reject + refund balance |
| `/api/admin/queue/batch-approve` | POST | Approve multiple |
| `/api/admin/queue/:id/retry` | POST | Retry failed withdrawal |
| `/api/admin/rules` | GET | List auto-approval rules |
| `/api/admin/rules/:id` | PUT | Update rule (enable/disable) |
| `/api/admin/receivables` | GET | Receivables overview (settlement status) |

### 9.3 Webhooks

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/webhooks/infinitepay` | POST | Dual verification | Payment confirmations |

### 9.4 Internal (cron)

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/cron/process-payouts` | GET | `CRON_SECRET` bearer | Payout processor (every 5 min) |
| `/api/cron/settle-receivables` | GET | `CRON_SECRET` bearer | Receivable settlement (every 10 min) |
| `/api/infinitepay/onboard` | POST | Admin | Configure PubliHub's InfinitePay handle |

### 9.5 Server Actions

| Action | Input | Plan |
|--------|-------|------|
| `requestWithdrawal` | `{ amount_cents }` | All |
| `savePayoutProfile` | `{ pix_key, pix_key_type, full_name, document_cpf }` | All |

### 9.6 Error codes

| Code | HTTP | User message (pt-BR) |
|------|------|----------------------|
| `VALIDATION_ERROR` | 400 | (Field-specific) |
| `UNAUTHORIZED` | 401 | — |
| `BELOW_MINIMUM` | 422 | "Valor minimo de saque: R$ X." |
| `INSUFFICIENT_BALANCE` | 422 | "Saldo insuficiente para saque." |
| `WEEKLY_LIMIT_EXCEEDED` | 422 | "Limite semanal atingido." |
| `KYC_PENDING` | 422 | "Complete seu cadastro financeiro (chave PIX + dados pessoais)." |
| `RATE_LIMITED` | 429 | "Muitas solicitacoes. Tente novamente em 24h." |
| `PAYOUT_FAILED` | 422 | "Saque falhou. Tente novamente." |
| `DUPLICATE_EVENT` | 200 | (Silent skip, idempotent) |
| `PAYMENT_NOT_CONFIRMED` | 200 | (Log only, no user message) |
| `CONFLICT` | 409 | "Estado alterado concorrentemente. Recarregue." |

---

## 10. Provider abstraction

All InfinitePay calls are wrapped behind a `PaymentProvider` interface so swapping providers requires no pipeline changes.

```typescript
interface PaymentProvider {
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  verifyPayment(params: VerifyParams): Promise<PaymentStatus>;
  checkSettlement(providerRef: string): Promise<SettlementStatus>;
  initiatePayout(params: PayoutParams): Promise<PayoutResult>;
  checkPayoutStatus(referenceId: string): Promise<PayoutStatus>;
}

type SettlementStatus = {
  status: 'pending' | 'settled' | 'failed';
  settled_at?: string;
  amount_cents?: number;
};
```

**Implementations**: `InfinitePayProvider` (production), `MockProvider` (tests).

---

## 11. Security requirements

| Requirement | Implementation | Priority |
|-------------|---------------|----------|
| Dual webhook verification | Webhook payload + `payment_check` API call before any mutation | Mandatory |
| Settlement lock-in | Wallet credits only after receivable settles; never before | Mandatory |
| Idempotency | `transaction_nsu` unique constraint on ledger; `idempotency_key` on withdrawals and receivables | Mandatory |
| No card/bank data in DB | InfinitePay handles all PCI scope | Mandatory |
| Service-role-only writes | Ledger + receivable + withdrawal writes via Supabase service role, never from client | Mandatory |
| Optimistic locking | CAS on `version` column for every status transition | Mandatory |
| Creator KYC | `pix_key_verified + full_name + document_cpf` required before first withdrawal | Mandatory |
| Rate limiting | 5 withdrawal requests / creator / 24h | Mandatory |
| Admin auth | All admin endpoints verify `role = 'admin'` from JWT | Mandatory |
| PIX key validation | Format check + `verified = true` required | Mandatory |
| Cron protection | `CRON_SECRET` bearer token on cron endpoints | Mandatory |
| RLS | Creators read own data only; payment_queue invisible to creators | Mandatory |
| Audit trail | Every status transition logged to `withdrawal_events` | Mandatory |
| Integer money | All amounts as integer cents; no float arithmetic | Mandatory |
| Structured errors | Machine-readable codes; no stack traces in API responses | Mandatory |
| Chargeback handling | Debit wallet on chargeback; allow negative balance with flag | Mandatory |

---

## 12. Monitoring and alerting

| Metric | Threshold | Action |
|--------|-----------|--------|
| Withdrawal stuck in `processing` | > 24h | Page admin; check InfinitePay status |
| Receivable stuck in `pending` | > 3 days past `settlement_expected_at` | Page admin; settlement delay |
| Webhook failure rate | > 1% over 1h | Page admin; check InfinitePay connectivity |
| Payment queue backlog | > 100 items | Page admin; increase cron frequency |
| Balance inconsistency | Any `balance_after` mismatch | Freeze creator; manual audit |
| Concurrent conflict rate | > 5% | Review UX for double-submit |
| Daily withdrawal volume | > 3x rolling 7-day avg | Flag for review |
| Webhook spoof attempt | `payment_check` = false after webhook = paid | Security alert; log full payload |
| Chargeback rate | > 2% of settled receivables | Flag creator for review |
| Negative creator balance | Any wallet < 0 | Alert admin; block withdrawals |

**Health endpoint** (`GET /api/health`):
```typescript
{
  infinitepay: { connected: boolean },
  receivables: {
    pending_count: number,
    overdue_count: number,
    total_pending_cents: number,
  },
  queue: {
    pending_count: number,
    oldest_pending_age_minutes: number,
    last_processed_at: string | null
  }
}
```

---

## 13. Edge cases

| Scenario | Behavior |
|----------|----------|
| Creator double-clicks "Withdraw" | Idempotency key prevents duplicate; same withdrawal returned |
| Balance changes between render and submit | Server re-validates; returns `INSUFFICIENT_BALANCE` |
| PIX payout succeeds but confirmation delayed | Withdrawal stays `processing`; cron polls after 15 min |
| Webhook arrives twice | `transaction_nsu` unique constraint; skip silently |
| Admin approves but cron is down | Withdrawal stays `approved`; cron picks up on restart |
| Creator's PIX key becomes invalid | PIX fails; transitions to `failed`; admin retries or rejects |
| Spoofed webhook (claims paid, not confirmed) | `payment_check` returns false; no receivable created; security alert |
| Server crash mid-transaction | Supabase transaction rolls back; no partial state |
| Negative balance attempt | `balance_after >= 0` constraint; insert rejected |
| Creator on Free requests R$ 10 | Below R$ 100 minimum; returns `BELOW_MINIMUM` |
| Creator at weekly limit requests more | Returns `WEEKLY_LIMIT_EXCEEDED` |
| Receivable never settles | Alert after 3 days overdue; admin investigates with InfinitePay |
| Chargeback on settled receivable | Wallet debited; may go negative; admin notified |
| Creator withdraws all balance, then chargeback | Balance goes negative; account flagged; withdrawals blocked until resolved |

---

## 14. Testing requirements

| Layer | Scope | Coverage target |
|-------|-------|-----------------|
| **Unit** | Fee calculations (PIX + card), validation rules, state transitions, auto-approval logic, provider abstraction, receivable creation logic | 100% |
| **Integration** | Withdrawal creation, receivable creation + settlement, balance computation, rejection refund, payout cron, settlement cron, webhook dual verification, chargeback debit | 80%+ |
| **E2E** | PIX sale → settle → wallet credit → withdraw → paid. Card sale → settle installments → wallet credits. Admin reject + refund. Chargeback handling. | Critical paths |

**Key scenarios**:

1. PIX happy path: fan pays → receivable created → settles in minutes → wallet credited → creator withdraws → paid
2. Credit card happy path: fan pays (1x) → receivable created → settles T+1 → wallet credited
3. Fee accuracy: PIX fee lower than card fee for same amount and tier
4. Insufficient balance → 422
5. Below plan minimum → 422
6. Weekly limit exceeded → 422
7. Two concurrent withdrawals for same creator → no double-spend
8. Admin rejects → balance restored to pre-withdrawal level
9. Provider failure → `failed`; balance stays reserved
10. Chargeback: settled receivable charged back → wallet debited → alert
11. Spoofed webhook → `payment_check` catches it → no receivable created
12. Settlement delay: receivable overdue 3 days → alert

---

## 15. Implementation roadmap

| Phase | Days | Deliverables |
|-------|------|-------------|
| **A — DB & types** | 1–2 | Migrations (receivables, withdrawal_events, withdrawals columns, withdrawal_rules, payment_queue, RLS). TypeScript types + Zod schemas. |
| **B — Provider & fees** | 2–4 | `PaymentProvider` interface + `InfinitePayProvider` + `MockProvider`. Split fee engine (`lib/fees.ts` — PIX vs card). Validation chain. Unit tests (100%). |
| **C — Receivables** | 4–6 | Receivable creation from webhooks. Settlement cron (`/api/cron/settle-receivables`). Wallet credit on settlement. Chargeback handler. Integration tests. |
| **D — Withdrawal creation** | 6–8 | Ledger helpers, balance computation (available + pending settlement + pending withdrawal). `POST /api/wallet/withdraw`. Balance and receivables endpoints. Integration tests. |
| **E — Admin queue** | 8–10 | Auto-approval engine (disabled). Admin queue listing, approve, reject, batch-approve, retry. Rule CRUD. Integration tests. |
| **F — Payout & webhooks** | 10–12 | InfinitePay PIX payout in provider. Payout cron processor. `vercel.json` cron config. Webhook handler with dual verification. Poll fallback. Integration tests. |
| **G — Frontend** | 12–15 | Wallet page (balance, pending settlements, receivables list, withdrawal form, history). Withdrawal form (amount, fee preview, confirm). Admin queue + receivables dashboard. E2E tests. |
| **H — Hardening** | 15–17 | Rate limiting. Alerts (stuck receivables, settlement delays, stuck processing, webhook failures, chargebacks). Structured logging. Load test. |

---

## 16. Environment variables

```env
# InfinitePay (internal — never exposed to creators or fans)
INFINITEPAY_HANDLE=                  # PubliHub's platform InfiniteTag (single account)
INFINITEPAY_API_URL=https://api.infinitepay.io
INFINITEPAY_WEBHOOK_SECRET=          # Reserved: if InfinitePay adds HMAC later

# Cron
CRON_SECRET=                         # Bearer token for all cron endpoints

# Supabase
SUPABASE_SERVICE_ROLE_KEY=           # Server-only: ledger + receivable + withdrawal writes
```

Creator payout data (PIX key, CPF) stored in `profiles.payout_profile`, encrypted via Supabase Vault.

---

## 17. File structure

```
app/
├── api/
│   ├── webhooks/infinitepay/route.ts    # Payment webhook (dual verification → create receivables)
│   ├── wallet/
│   │   ├── balance/route.ts             # GET balance (available + pending settlement + pending withdrawal)
│   │   ├── withdraw/route.ts            # POST create withdrawal
│   │   ├── withdrawals/route.ts         # GET paginated history
│   │   └── receivables/route.ts         # GET pending and settled receivables
│   ├── checkout/
│   │   ├── create/route.ts              # POST create InfinitePay checkout link
│   │   └── success/route.ts             # GET post-payment redirect
│   ├── admin/
│   │   ├── queue/
│   │   │   ├── route.ts                 # GET list queue
│   │   │   ├── batch-approve/route.ts   # POST approve multiple
│   │   │   └── [id]/
│   │   │       ├── approve/route.ts     # POST approve single
│   │   │       ├── reject/route.ts      # POST reject single
│   │   │       └── retry/route.ts       # POST retry failed
│   │   ├── rules/
│   │   │   ├── route.ts                 # GET list rules
│   │   │   └── [id]/route.ts            # PUT update rule
│   │   └── receivables/
│   │       └── route.ts                 # GET receivables overview
│   └── cron/
│       ├── process-payouts/route.ts     # GET payout processor (every 5 min)
│       └── settle-receivables/route.ts  # GET receivable settlement (every 10 min)
lib/
├── fees.ts                              # Split fee engine (PIX vs card per tier)
├── feature-gate.ts                      # Plan tier enforcement
├── providers/
│   ├── types.ts                         # PaymentProvider interface
│   ├── infinitepay.ts                   # InfinitePay implementation
│   └── mock.ts                          # Mock provider for tests
├── receivables/
│   ├── create.ts                        # Create receivable from payment confirmation (1 per payment)
│   ├── settlement.ts                    # Settlement cron logic
│   └── chargeback.ts                    # Chargeback handler
├── withdrawal/
│   ├── validation.ts                    # Pre-flight checks
│   ├── transitions.ts                   # State machine (CAS)
│   ├── auto-approval.ts                # Rule engine (disabled by default)
│   └── queue.ts                         # Payment queue helpers
├── wallet/
│   ├── balance.ts                       # Balance calculations (available + pending)
│   └── ledger.ts                        # Append-only ledger helpers
└── admin/
    └── auth.ts                          # Admin role verification
```

---

## Related docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md) — Tier rules source of truth
- [Supabase database schema](./supabase-database-schema.md) — Full DB schema
- [API contract](./api-contract.md) — General API conventions
- [Testing strategy](./testing-strategy.md) — Vitest / Playwright pyramid
- [Deployment & infrastructure](./deployment-and-infrastructure.md) — Vercel Cron, env vars
- [System architecture](./system-architecture-and-data-flow.md) — Webhook → ledger → Realtime pipeline
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md) — Sprint timeline
- [InfinitePay Checkout Docs](https://www.infinitepay.io/checkout) — Internal integration reference
