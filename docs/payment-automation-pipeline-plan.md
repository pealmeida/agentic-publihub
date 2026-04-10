# PubliHub — Payment Automation Pipeline Plan

Safe, resilient, and auditable pipeline for creator withdrawal requests, fee processing, and payment queue management with admin approval.

**Scope**: Open beta (Free + Starter tiers). Extends the existing [Payment & payout spec](./payment-and-payout-spec.md), [Database schema](./supabase-database-schema.md), [API contract](./api-contract.md), and [Plan matrix](./plan-matrix-and-feature-limits.md).

---

## 1. Problem statement

Creators accumulate earnings in an append-only `wallet_ledger`. They need to **request withdrawals** (PIX to bank) with **correct fee deduction**, **plan-aware limits**, and a **payment queue** that an admin or automated rule can **approve, reject, or retry** — without risk of double-spend, race conditions, or balance corruption.

---

## 2. Design principles

| Principle | Implementation |
|-----------|---------------|
| **Append-only truth** | `wallet_ledger` never mutates; all state changes via new rows |
| **Optimistic locking** | `withdrawals` rows use `status` + `version` to prevent concurrent transitions |
| **Idempotency** | Every external call (InfinitePay, notifications) carries an idempotency key |
| **No money leaves without approval** | Withdrawal enters `queued` state; must transition through `approved` → `processing` → `paid` |
| **Fail safe** | Any error freezes the withdrawal at its current status; manual intervention required |
| **Audit trail** | Every status transition logged to `withdrawal_events`; no silent state changes |
| **Server-only balance mutations** | Ledger inserts and withdrawal state changes use Supabase **service role** exclusively |
| **Provider abstraction** | All gateway calls wrapped behind a `PaymentProvider` interface so swapping InfinitePay for another provider (Abacate Pay, Stripe) later requires no pipeline changes |

---

## 3. Provider: InfinitePay

### 3.1 Architecture: PubliHub as merchant of record

InfinitePay is **PubliHub's internal payment processor** — it is **not visible to creators or fans**. PubliHub operates a single InfinitePay account (`INFINITEPAY_HANDLE`) that receives all fan payments and originates all creator payouts via PIX.

```
┌──────────────────────────────────────────────────────────────┐
│ Fan sees: PubliHub branded checkout                          │
│ Creator sees: PubliHub Wallet + "Withdraw to my PIX key"    │
│ Behind the scenes: InfinitePay processes all transactions    │
└──────────────────────────────────────────────────────────────┘
```

**Implications**:
- **Single InfinitePay handle** — all checkouts use PubliHub's platform handle (env var)
- **No creator InfinitePay account** — creators never sign up on InfinitePay
- **PIX key payout** — creators provide a PIX key (CPF, CNPJ, email, phone, or random) in PubliHub Settings → Financial; payouts go directly to that key
- **KYC**: PubliHub collects creator identity data and stores it in `profiles.payout_profile`; verification is PubliHub's responsibility (not delegated to InfinitePay)
- **Revenue model**: InfinitePay charges its processing fee on the gross; PubliHub charges the platform inbound fee on top, keeping the spread

### 3.2 Why InfinitePay for MVP

| Factor | Detail |
|--------|--------|
| **Brazil-first** | PIX at 0%, card from 2.69% — aligned with our BRL-only MVP |
| **No monthly fees** | No fixed cost per creator; per-transaction only |
| **Checkout API** | `POST https://api.infinitepay.io/invoices/public/checkout/links` generates payment links |
| **Webhook notifications** | Payment confirmation via `webhook_url` on each checkout link |
| **PIX payouts** | PubliHub sends PIX directly from its InfinitePay digital account to creator's bank |
| **Instant settlement** | Receive na hora or 1 dia útil |

### 3.3 Provider abstraction

```typescript
interface PaymentProvider {
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  verifyPayment(params: VerifyParams): Promise<PaymentStatus>;
  initiatePayout(params: PayoutParams): Promise<PayoutResult>;
  checkPayoutStatus(referenceId: string): Promise<PayoutStatus>;
}

type CheckoutParams = {
  handle: string;           // PubliHub's platform InfiniteTag (from env var)
  items: CheckoutItem[];
  orderNsu: string;         // Our internal order ID
  redirectUrl: string;
  webhookUrl: string;
  customer?: CustomerInfo;
};

type CheckoutItem = {
  quantity: number;
  price: number;            // In cents
  description: string;
};

type CheckoutResult = {
  checkoutUrl: string;      // URL to redirect the fan
  slug: string;             // Invoice reference
};

type PaymentStatus = {
  paid: boolean;
  amount: number;
  paidAmount: number;
  installments: number;
  captureMethod: 'credit_card' | 'pix';
  transactionNsu: string;
};

type PayoutParams = {
  amount_cents: number;
  pix_key: string;          // Creator's registered PIX key
  pix_key_type: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  idempotency_key: string;
  description?: string;
};

type PayoutResult = {
  provider_ref: string;
  status: 'processing' | 'paid' | 'failed';
};

type PayoutStatus = {
  status: 'processing' | 'paid' | 'failed';
  paid_at?: string;
  failure_code?: string;
};
```

### 3.4 Checkout flow (fan payment)

```
Fan clicks "Buy" on Hub
        │
        ▼
┌──────────────────────────────────────────┐
│ Next.js Server Action:                    │
│ POST api.infinitepay.io/.../checkout/links│
│ handle: INFINITEPAY_HANDLE (PubliHub's)   │
│ items: [{ price, description }]           │
│ order_nsu: PubliHub internal order ID     │
│ redirect_url: /api/checkout/success       │
│ webhook_url: /api/webhooks/infinitepay    │
└──────────────────────────────────────────┘
        │
        ▼  Returns checkout URL
┌──────────────────────────────────────────┐
│ Redirect fan to payment page              │
│ (branded PubliHub checkout via InfinitePay│
│  — fan never sees "InfinitePay")          │
└──────────────────────────────────────────┘
        │
        ▼  Fan completes payment (PIX or card)
┌──────────────────────────────────────────┐
│ InfinitePay webhook POST → our endpoint   │
│ /api/webhooks/infinitepay                 │
│ Body: { invoice_slug, amount, paid_amount,│
│         capture_method, transaction_nsu,  │
│         order_nsu, receipt_url, items }   │
└──────────────────────────────────────────┘
        │
        ▼  Dual verify + insert ledger
┌──────────────────────────────────────────┐
│ wallet_ledger + digital_product delivery  │
│ + Supabase Realtime broadcast to HUD      │
└──────────────────────────────────────────┘
```

### 3.5 Webhook verification strategy

InfinitePay does not provide HMAC signature verification on webhooks. We use **dual verification**:

1. **Webhook receipt** — InfinitePay POSTs to our `webhook_url` with the payment payload. We respond `200 OK` quickly.
2. **Server-side confirmation** — Immediately after receiving the webhook, we call `POST https://api.infinitepay.io/invoices/public/checkout/payment_check` with `{ handle: INFINITEPAY_HANDLE, order_nsu, transaction_nsu, slug }` to **confirm the payment is genuinely paid** before crediting the ledger.
3. **Idempotency** — We store the `transaction_nsu` with a unique constraint and skip duplicates.

This ensures we never credit the ledger based on a spoofed webhook alone.

### 3.6 Creator payout setup

Creators never interact with InfinitePay. To receive payouts:

1. Creator goes to **Settings → Financial** in PubliHub
2. Enters their **PIX key** (type + value) and verifies it with a small test transfer or CPF/CNPJ validation
3. PubliHub stores `{ pix_key, pix_key_type, pix_key_verified, full_name, document_cpf }` in `profiles.payout_profile` (encrypted via Supabase Vault for secrets)
4. **KYC**: PubliHub collects minimum identity info (full name + CPF) required for PIX transfers above regulatory thresholds. PubliHub is responsible for this verification, not InfinitePay.

Before a withdrawal is allowed, the server checks: `pix_key_verified = true AND full_name IS NOT NULL AND document_cpf IS NOT NULL`.

---

## 4. State machine

```
                         ┌──────────┐
            Creator      │          │   Admin /
            requests     │  queued  │   auto-rule
            withdraw     │          │──────────┐
                         └────┬─────┘          │
                              │                ▼
                         Admin│          ┌──────────┐
                         skip │          │          │
                              ▼          │ approved │
                         ┌──────────┐    │          │
                         │          │    └─────┬────┘
                         │ rejected │          │
                         │          │          │ InfinitePay
                         └──────────┘          │ PIX transfer
                                               ▼
                                         ┌──────────┐
                                         │          │
                                         │processing│
                                         │          │
                                         └────┬─────┘
                                    ┌─────────┴─────────┐
                                    │                   │
                                    ▼                   ▼
                              ┌──────────┐        ┌──────────┐
                              │          │        │          │
                              │   paid   │        │  failed  │
                              │          │        │          │
                              └──────────┘        └────┬─────┘
                                                       │
                                                       │ Admin
                                                       │ retry
                                                       ▼
                                                 ┌──────────┐
                                                 │  queued  │
                                                 └──────────┘
```

### Status definitions

| Status | Owner | Description |
|--------|-------|-------------|
| `queued` | System | Initial state after creator request. Awaiting admin or auto-approval. |
| `approved` | Admin / Auto-rule | Validated and cleared for payout. Funds reserved. |
| `rejected` | Admin | Denied. Balance **released** back to available. Reason logged. |
| `processing` | System | InfinitePay PIX transfer initiated. Awaiting provider confirmation. |
| `paid` | System (webhook / poll) | InfinitePay confirmed payout. Terminal state. |
| `failed` | System (webhook / poll) | InfinitePay reported failure. Admin may retry → `queued`. Balance stays reserved. |

### Transition rules

| From | To | Actor | Condition |
|------|----|-------|-----------|
| `queued` | `approved` | Admin or auto-rule | KYC verified, balance still sufficient, not flagged |
| `queued` | `rejected` | Admin | Any reason; balance released |
| `approved` | `processing` | System cron / admin action | InfinitePay PIX transfer call succeeds |
| `processing` | `paid` | Webhook or poll confirmation | Payment confirmed by provider |
| `processing` | `failed` | Webhook or poll confirmation | Provider reported failure |
| `failed` | `queued` | Admin retry | Balance still reserved, re-queues for re-processing |

### Concurrency guard

```sql
UPDATE withdrawals
SET status = 'approved', version = version + 1
WHERE id = $1 AND status = 'queued' AND version = $2
RETURNING *;
-- If 0 rows returned → concurrent conflict, reject the operation
```

---

## 5. Database changes

### 5.1 New table: `withdrawal_events`

Append-only audit log for every status transition.

```sql
CREATE TABLE withdrawal_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL REFERENCES withdrawals(id),
  from_status   TEXT NOT NULL,           -- 'queued' | 'approved' | etc.
  to_status     TEXT NOT NULL,           -- new status
  actor         TEXT NOT NULL,           -- 'creator' | 'admin' | 'system' | 'provider_webhook' | 'provider_poll'
  actor_id      UUID NULL,               -- FK → profiles or system identifier
  reason        TEXT,                    -- human-readable note
  metadata      JSONB DEFAULT '{}',     -- provider_ref, error codes, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_withdrawal_events_withdrawal ON withdrawal_events(withdrawal_id, created_at);
```

### 5.2 Modify `withdrawals` table

Add concurrency guard and fee tracking:

```sql
ALTER TABLE withdrawals ADD COLUMN version          INT NOT NULL DEFAULT 1;
ALTER TABLE withdrawals ADD COLUMN fee_cents         INT NOT NULL DEFAULT 0;
ALTER TABLE withdrawals ADD COLUMN net_cents         INT NOT NULL DEFAULT 0;  -- amount_cents - fee_cents
ALTER TABLE withdrawals ADD COLUMN provider_ref      TEXT;        -- InfinitePay payout reference
ALTER TABLE withdrawals ADD COLUMN idempotency_key   TEXT UNIQUE;
ALTER TABLE withdrawals ADD COLUMN processed_at      TIMESTAMPTZ;
ALTER TABLE withdrawals ADD COLUMN rejected_reason   TEXT;

-- Add 'queued', 'approved', 'rejected' to status enum
-- Existing: pending, processing, paid, failed
-- New canonical list: queued, approved, processing, paid, failed, rejected
```

### 5.3 New table: `withdrawal_rules`

Configurable auto-approval rules (admin-managed).

```sql
CREATE TABLE withdrawal_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  condition_type  TEXT NOT NULL,        -- 'max_amount' | 'creator_trust_level' | 'plan_tier'
  condition_value JSONB NOT NULL,       -- e.g. {"max_cents": 50000} or {"tiers": ["starter"]}
  action          TEXT NOT NULL DEFAULT 'auto_approve',  -- 'auto_approve' | 'flag_for_review'
  priority        INT NOT NULL DEFAULT 0,  -- lower = evaluated first
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 5.4 New table: `payment_queue`

Materialized view of withdrawals pending action (admin dashboard reads this).

```sql
CREATE TABLE payment_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id   UUID NOT NULL REFERENCES withdrawals(id) UNIQUE,
  priority_score  INT NOT NULL DEFAULT 0,    -- higher = processed first
  assigned_to     UUID REFERENCES profiles(user_id),  -- admin user
  batch_id        UUID,                      -- group withdrawals for batch processing
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at    TIMESTAMPTZ
);

CREATE INDEX idx_payment_queue_pending ON payment_queue(processed_at)
  WHERE processed_at IS NULL;
```

### 5.5 RLS policies

```sql
-- Creators: read own withdrawals and withdrawal_events
CREATE POLICY "Creators read own withdrawals"
  ON withdrawals FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Creators read own withdrawal events"
  ON withdrawal_events FOR SELECT USING (
    withdrawal_id IN (SELECT id FROM withdrawals WHERE user_id = auth.uid())
  );

-- Admin: full access to withdrawals, withdrawal_events, payment_queue, withdrawal_rules
-- (enforced via service role or admin role check)

-- Payment queue: service-role only for writes; admin role for reads
-- Creators never read payment_queue directly
```

---

## 6. Fee calculation pipeline

### 6.1 Inbound fee (on credit)

Applied when a fan payment is confirmed via webhook + payment_check. Already specified in [Payment & payout spec](./payment-and-payout-spec.md).

**Note**: InfinitePay charges its own processing fee on the gross transaction (PIX: 0%, credit card: from 4.20%). PubliHub's **platform inbound fee** is deducted **on top of** the InfinitePay processing fee. The `calculateInboundFee` function computes only PubliHub's take.

```typescript
type PlanTier = 'free' | 'starter' | 'growth';

type FeeSchedule = {
  inboundPercent: number;   // e.g. 4.9 → 0.049
  inboundFixedCents: number; // e.g. 50
  withdrawalFeeCents: number;
  minWithdrawalCents: number;
  weeklyLimitCents: number | null;  // null = unlimited
};

const FEE_SCHEDULE: Record<PlanTier, FeeSchedule> = {
  free:     { inboundPercent: 5.9, inboundFixedCents: 50, withdrawalFeeCents: 150, minWithdrawalCents: 10000, weeklyLimitCents: 50000 },
  starter:  { inboundPercent: 4.9, inboundFixedCents: 50, withdrawalFeeCents: 50,  minWithdrawalCents: 5000,  weeklyLimitCents: 500000 },
  growth:   { inboundPercent: 3.9, inboundFixedCents: 50, withdrawalFeeCents: 0,   minWithdrawalCents: 2500,  weeklyLimitCents: null },
};

function calculateInboundFee(tier: PlanTier, grossCents: number): number {
  const schedule = FEE_SCHEDULE[tier];
  return Math.round(grossCents * schedule.inboundPercent / 100) + schedule.inboundFixedCents;
}

function calculateWithdrawalFee(tier: PlanTier): number {
  return FEE_SCHEDULE[tier].withdrawalFeeCents;
}
```

### 6.2 Withdrawal fee (on debit)

Deducted when the withdrawal is **created** (queued), not when paid. The fee is captured in `withdrawals.fee_cents` and a corresponding `debit_fee` ledger entry is inserted atomically.

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
  net_cents    = 14950   ← what InfinitePay actually transfers to creator via PIX

Available balance after: R$ 49.50 (4950 cents)
```

---

## 7. API design

### 7.1 Creator-facing endpoints

#### `POST /api/wallet/withdraw`

Creator requests a withdrawal.

**Request**:
```typescript
{
  amount_cents: number;  // what the creator wants to receive (before fee)
}
```

**Server validation** (all must pass, in order):

| # | Check | Error Code |
|---|-------|------------|
| 1 | `amount_cents` > 0 | `VALIDATION_ERROR` |
| 2 | Creator has verified payout profile (`pix_key_verified` + `full_name` + `document_cpf`) | `KYC_PENDING` |
| 3 | `amount_cents` >= plan minimum | `BELOW_MINIMUM` |
| 4 | `available_balance >= amount_cents + withdrawal_fee` | `INSUFFICIENT_BALANCE` |
| 5 | Weekly total (paid + queued + approved + processing) + `amount_cents` <= weekly limit | `WEEKLY_LIMIT_EXCEEDED` |
| 6 | Rate: max 5 withdrawal requests / creator / 24h | `RATE_LIMITED` |
| 7 | No duplicate pending withdrawal for same creator (optional: allow multiple) | — |

**Success flow** (single Supabase RPC / transaction):

1. Lock creator's latest balance (serializable read)
2. Insert `withdrawals` row (`status: 'queued'`, `fee_cents`, `net_cents`, `idempotency_key`)
3. Insert `wallet_ledger` rows: `debit_withdrawal` + `debit_fee`
4. Insert `withdrawal_events` row (`queued` ← null, actor: `creator`)
5. Insert `payment_queue` row (priority based on plan tier + amount)
6. Evaluate auto-approval rules (see §7.3)
7. Return `Withdrawal` object

**Response** (201):
```typescript
{
  id: string;
  status: 'queued' | 'approved';  // may auto-approve
  amount_cents: number;
  fee_cents: number;
  net_cents: number;
  created_at: string;
}
```

#### `GET /api/wallet/withdrawals`

Paginated list of creator's withdrawals.

```typescript
{
  data: Withdrawal[];
  page: number;
  per_page: number;
  total: number;
}
```

#### `GET /api/wallet/balance`

```typescript
{
  available_cents: number;       // sum of all ledger entries
  pending_cents: number;         // sum of queued+approved+processing withdrawals
  withdrawn_cents: number;       // sum of paid withdrawals (all-time)
  currency: 'BRL';
}
```

### 7.2 Admin-facing endpoints

All admin endpoints require `role = 'admin'` verified server-side.

#### `GET /api/admin/queue`

Payment queue with filtering and sorting.

```typescript
{
  data: QueueItem[];   // withdrawal + queue metadata + creator info
  stats: {
    total_pending: number;
    total_amount_cents: number;
    oldest_pending_at: string;
  };
}
```

**Query params**: `?status=queued&sort=priority&batch_id=...`

#### `POST /api/admin/queue/:id/approve`

Transition `queued` → `approved`. Uses optimistic locking on `version`.

```typescript
{
  version: number;  // client sends current version for CAS
}
```

#### `POST /api/admin/queue/:id/reject`

Transition `queued` → `rejected`. Releases reserved balance.

```typescript
{
  version: number;
  reason: string;
}
```

On reject, within a transaction:

1. Update `withdrawals` status → `rejected` (CAS on version)
2. Insert reverse `credit_sale` / `credit_donation` ledger entries (refund the debit)
3. Insert `withdrawal_events` row
4. Mark `payment_queue.processed_at`

#### `POST /api/admin/queue/batch-approve`

Approve multiple withdrawals at once. Each processed independently; partial success allowed.

```typescript
{
  withdrawal_ids: string[];
}
```

Returns per-item results: `{ approved: string[], failed: { id, reason }[] }`.

#### `POST /api/admin/queue/:id/retry`

Transition `failed` → `queued`. Re-queues for re-processing.

#### `GET /api/admin/rules`
#### `PUT /api/admin/rules/:id`

CRUD for auto-approval rules (`withdrawal_rules` table).

### 7.3 Auto-approval engine

Evaluated **synchronously** after withdrawal creation. If any rule matches with `action: 'auto_approve'`, the withdrawal transitions directly to `approved`.

```typescript
async function evaluateAutoApproval(withdrawal: Withdrawal, creator: Profile): Promise<boolean> {
  const rules = await getEnabledRules();  // ordered by priority ASC

  for (const rule of rules) {
    const matches = evaluateCondition(rule, withdrawal, creator);
    if (matches) {
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

  return false;  // no rule matched → stays queued for manual review
}
```

**Default rules** (seeded):

| Name | Condition | Action |
|------|-----------|--------|
| `starter_auto_under_200` | `plan_tier = 'starter' AND net_cents <= 20000` | `auto_approve` |
| `flag_large_withdrawals` | `net_cents > 100000` | `flag_for_review` |
| `free_tier_manual` | `plan_tier = 'free'` | stays queued (no auto-rule) |

---

## 8. Payout execution (cron job)

### 8.1 Processor design

A **Vercel Cron** route (`GET /api/cron/process-payouts`) runs every 5 minutes (configurable).

```
1. Query withdrawals WHERE status = 'approved' ORDER BY created_at ASC LIMIT 50
2. For each withdrawal:
   a. Transition to 'processing' (CAS on version)
   b. Call InfinitePay PIX payout API (via provider abstraction)
      - amount: net_cents
      - pix_key: creator's registered PIX key
      - idempotency_key: withdrawal.idempotency_key
   c. If provider call succeeds:
      - Record provider_ref
      - Insert withdrawal_event (approved → processing)
   d. If provider call fails:
      - Transition back to 'failed'
      - Insert withdrawal_event with error metadata
      - Alert admin (log + optional notification)
3. Confirmation via:
   - Webhook callback (if InfinitePay supports payout webhooks)
   - Fallback: poll provider status on next cron cycle for withdrawals
     stuck in 'processing' > 15 minutes
```

### 8.2 Cron protection

```typescript
// Verify cron secret to prevent external invocation
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  // ... process payouts
}
```

### 8.3 Vercel Cron config

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/process-payouts",
    "schedule": "*/5 * * * *"
  }]
}
```

---

## 9. Webhook handler (InfinitePay)

### 9.1 Checkout payment webhook

`POST /api/webhooks/infinitepay` — receives payment confirmations from InfinitePay.

```typescript
type InfinitePayWebhookPayload = {
  invoice_slug: string;
  amount: number;            // Original amount in cents
  paid_amount: number;       // Amount actually paid (may differ with interest)
  installments: number;
  capture_method: 'credit_card' | 'pix';
  transaction_nsu: string;   // Unique transaction ID
  order_nsu: string;         // Our internal order reference
  receipt_url: string;
  items: Array<{
    quantity: number;
    price: number;
    description: string;
  }>;
};

async function handlePaymentWebhook(payload: InfinitePayWebhookPayload) {
  // 1. Find order by order_nsu
  const order = await findOrderByNsu(payload.order_nsu);
  if (!order) {
    log.warn('infinitepay webhook: no matching order', { order_nsu: payload.order_nsu });
    return;
  }

  // 2. Idempotency: skip if already processed
  if (order.status === 'completed') return;

  // 3. DUAL VERIFICATION: confirm with InfinitePay directly
  const verification = await fetch(
    'https://api.infinitepay.io/invoices/public/checkout/payment_check',
    {
      method: 'POST',
      body: JSON.stringify({
        handle: process.env.INFINITEPAY_HANDLE,
        order_nsu: payload.order_nsu,
        transaction_nsu: payload.transaction_nsu,
        slug: payload.invoice_slug,
      }),
    }
  );
  const confirmed = await verification.json();

  if (!confirmed.success || !confirmed.paid) {
    log.warn('infinitepay webhook: payment not confirmed by provider', {
      order_nsu: payload.order_nsu,
      webhook_said_paid: true,
      provider_confirmed: false,
    });
    return;  // Do not credit — possible spoof
  }

  // 4. Credit creator wallet (within transaction)
  await creditCreatorWallet(order, confirmed);
}
```

### 9.2 Webhook response handling

InfinitePay expects a quick response:
- **200 OK** → webhook delivered successfully
- **400 Bad Request** → InfinitePay retries the webhook

Our handler:
1. Responds `200` immediately
2. Processes asynchronously (queue via Supabase or in-process)

---

## 10. Rejection and refund flow

When an admin **rejects** a withdrawal:

```
1. CAS update: withdrawals SET status = 'rejected', version++
   WHERE id = $1 AND status = 'queued' AND version = $2
2. IF updated:
   a. Insert wallet_ledger:
      - credit: +amount_cents (type: credit, category: adjustment, ref: withdrawal)
      - credit: +fee_cents   (type: credit, category: adjustment, ref: withdrawal)
   b. Insert withdrawal_event (queued → rejected, actor: admin, reason)
   c. Mark payment_queue.processed_at
3. ELSE:
   return conflict error (status changed concurrently)
```

This ensures the creator's balance is **fully restored** (amount + fee).

---

## 11. File structure

```
app/
├── api/
│   ├── webhooks/
│   │   └── infinitepay/
│   │       └── route.ts              # InfinitePay payment webhook
│   ├── wallet/
│   │   ├── balance/
│   │   │   └── route.ts              # GET — available + pending + withdrawn
│   │   ├── withdraw/
│   │   │   └── route.ts              # POST — create withdrawal
│   │   └── withdrawals/
│   │       └── route.ts              # GET — paginated history
│   ├── checkout/
│   │   ├── create/
│   │   │   └── route.ts              # POST — create InfinitePay checkout link
│   │   └── success/
│   │       └── route.ts              # GET — post-payment redirect
│   ├── admin/
│   │   ├── queue/
│   │   │   ├── route.ts              # GET — list queue
│   │   │   ├── batch-approve/
│   │   │   │   └── route.ts          # POST — approve multiple
│   │   │   └── [id]/
│   │   │       ├── approve/
│   │   │       │   └── route.ts      # POST — approve single
│   │   │       ├── reject/
│   │   │       │   └── route.ts      # POST — reject single
│   │   │       └── retry/
│   │   │           └── route.ts      # POST — retry failed
│   │   └── rules/
│   │       ├── route.ts              # GET, PUT — list / update rules
│   │       └── [id]/
│   │           └── route.ts          # GET, PUT, DELETE — single rule
│   └── cron/
│       └── process-payouts/
│           └── route.ts              # GET — cron-triggered payout processor
lib/
├── fees.ts                           # Fee calculation functions
├── feature-gate.ts                   # Plan tier enforcement
├── providers/
│   ├── types.ts                      # PaymentProvider interface
│   ├── infinitepay.ts                # InfinitePay implementation
│   └── mock.ts                       # Mock provider for tests
├── withdrawal/
│   ├── validation.ts                 # Pre-flight checks (balance, limits, KYC, rate)
│   ├── transitions.ts                # State machine (transitionWithdrawal)
│   ├── auto-approval.ts             # Rule evaluation engine
│   └── queue.ts                      # Payment queue helpers
├── wallet/
│   ├── balance.ts                    # Available / pending / withdrawn calculations
│   └── ledger.ts                     # Append-only ledger insert helpers
└── admin/
    └── auth.ts                       # Admin role verification middleware
supabase/
└── migrations/
    ├── 20260410_010_withdrawal_events.sql
    ├── 20260411_011_withdrawals_add_columns.sql
    ├── 20260411_012_withdrawal_rules.sql
    └── 20260411_013_payment_queue.sql
```

---

## 12. Implementation phases

### Phase A — Database & core types (Day 1–2)

- [ ] Migration: `withdrawal_events` table
- [ ] Migration: `withdrawals` add columns (`version`, `fee_cents`, `net_cents`, `provider_ref`, `idempotency_key`, `rejected_reason`, `processed_at`)
- [ ] Migration: `withdrawal_rules` table + seed default rules
- [ ] Migration: `payment_queue` table
- [ ] Migration: RLS policies for new tables
- [ ] TypeScript types for all new entities
- [ ] Zod schemas for all API inputs

### Phase B — Provider abstraction & fee engine (Day 2–4)

- [ ] `lib/providers/types.ts` — `PaymentProvider` interface
- [ ] `lib/providers/infinitepay.ts` — InfinitePay implementation (checkout + payout + payment_check)
- [ ] `lib/providers/mock.ts` — Mock provider for tests
- [ ] `lib/fees.ts` — `calculateInboundFee`, `calculateWithdrawalFee`
- [ ] `lib/withdrawal/validation.ts` — pre-flight validation chain
- [ ] `lib/feature-gate.ts` — plan tier checks (extend existing)
- [ ] Unit tests: fee calculations (100% coverage target per [testing strategy](./testing-strategy.md))
- [ ] Unit tests: provider abstraction
- [ ] Unit tests: validation rules

### Phase C — Withdrawal creation (Day 4–6)

- [ ] `lib/wallet/ledger.ts` — atomic ledger insert helpers (service role)
- [ ] `lib/wallet/balance.ts` — balance computation (available, pending, withdrawn)
- [ ] `lib/withdrawal/transitions.ts` — state machine with CAS
- [ ] `POST /api/wallet/withdraw` — full validation → ledger → queue flow
- [ ] `GET /api/wallet/balance` — balance endpoint
- [ ] `GET /api/wallet/withdrawals` — paginated history
- [ ] Integration tests: withdrawal creation (Supabase local)

### Phase D — Auto-approval & admin queue (Day 6–8)

- [ ] `lib/withdrawal/auto-approval.ts` — rule evaluation engine
- [ ] `GET /api/admin/queue` — queue listing
- [ ] `POST /api/admin/queue/[id]/approve` — single approve with CAS
- [ ] `POST /api/admin/queue/[id]/reject` — reject with balance refund
- [ ] `POST /api/admin/queue/batch-approve` — batch approval
- [ ] `POST /api/admin/queue/[id]/retry` — retry failed
- [ ] `GET/PUT /api/admin/rules` — rule CRUD
- [ ] Integration tests: admin flows

### Phase E — Payout execution & webhooks (Day 8–10)

- [ ] InfinitePay PIX payout integration in provider
- [ ] `GET /api/cron/process-payouts` — cron processor
- [ ] `vercel.json` — cron schedule config
- [ ] `POST /api/webhooks/infinitepay` — payment webhook with dual verification
- [ ] Poll-based fallback for payout status confirmation
- [ ] Integration tests: payout processing with InfinitePay test environment

### Phase F — Frontend (Day 10–13)

- [ ] Wallet page: balance display, withdrawal form, history list
- [ ] Withdrawal form: amount input, fee preview, confirm modal
- [ ] Admin dashboard: payment queue table, approve/reject/retry actions
- [ ] Admin dashboard: rule editor
- [ ] Real-time: new withdrawal → admin queue refresh (Supabase Realtime subscription)
- [ ] E2E tests: full withdrawal lifecycle

### Phase G — Hardening & monitoring (Day 13–15)

- [ ] Rate limiting on withdrawal endpoint (Vercel + application-level)
- [ ] Alert: withdrawal stuck in `processing` > 24h
- [ ] Alert: webhook processing failure rate > 1%
- [ ] Alert: queue backlog > 100 items
- [ ] Structured logging for all withdrawal events
- [ ] Load test: concurrent withdrawal creation (verify no double-spend)

---

## 13. Security checklist

| Check | Status |
|-------|--------|
| Dual webhook verification (webhook + `payment_check` confirmation) | Mandatory |
| `wallet_ledger` writes only via service role (never from client) | Mandatory |
| `withdrawals` writes only via service role | Mandatory |
| CAS (optimistic locking) on every status transition | Mandatory |
| Idempotency keys on all provider calls | Mandatory |
| Admin endpoints verify `role = 'admin'` from JWT + service role | Mandatory |
| Rate limiting: max 5 withdrawal requests / creator / 24h | Mandatory |
| No card / bank data stored in our DB (InfinitePay holds PCI scope) | Mandatory |
| All money amounts as integer cents (no float arithmetic) | Mandatory |
| `CRON_SECRET` verified on cron endpoint | Mandatory |
| RLS: creators can only read own withdrawals | Mandatory |
| Rejection fully refunds balance (amount + fee) | Mandatory |
| Structured error codes (no stack traces in API responses) | Mandatory |
| InfinitePay handle validated before withdrawal (account must be active) | Mandatory |
| PIX key format validated before payout initiation; must be `verified = true` | Mandatory |
| Creator identity (full_name + CPF) collected and stored before first withdrawal | Mandatory |

---

## 14. Monitoring & alerting

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| Withdrawal stuck in `processing` | > 24h | Page admin; check InfinitePay status |
| Webhook processing failure rate | > 1% over 1h | Page admin; check InfinitePay connectivity |
| Payment queue backlog | > 100 items | Page admin; consider increasing cron frequency |
| Balance inconsistency | Any `balance_after` mismatch | Freeze affected creator; manual audit |
| Concurrent withdrawal conflict rate | > 5% | Review UX for accidental double-submit |
| Daily withdrawal volume | Spike > 3x rolling 7-day avg | Flag for review |
| Webhook spoof attempt | `payment_check` returns `paid: false` after webhook said paid | Alert security; log full payload |

### Health endpoint

`GET /api/health` extended with:

```typescript
{
  infinitepay: { connected: boolean },
  queue: {
    pending_count: number,
    oldest_pending_age_minutes: number,
    last_processed_at: string | null
  }
}
```

---

## 15. Edge cases and failure scenarios

| Scenario | Expected behavior |
|----------|-------------------|
| Creator double-clicks "Withdraw" | Idempotency key prevents duplicate; same withdrawal returned |
| Balance changes between form render and submit | Server re-validates; returns `INSUFFICIENT_BALANCE` if now too low |
| InfinitePay payout succeeds but webhook is delayed | Withdrawal stays `processing`; cron polls status after 15 min |
| InfinitePay webhook arrives twice | Idempotency: `transaction_nsu` unique constraint; skip silently |
| Admin approves but cron is down | Withdrawal stays `approved`; cron picks up on restart |
| Creator's PIX key is invalid or bank account closed | Next cron cycle detects PIX failure; transitions to `failed` |
| Webhook claims paid but `payment_check` says not paid | Do not credit; log security alert with full payload |
| Server crash mid-transaction | Supabase transaction rolls back; no partial state |
| Negative balance attempt | Ledger constraint: `balance_after` must be >= 0 on insert |

---

## 16. Testing requirements

Per [Testing strategy](./testing-strategy.md):

| Layer | Tests | Coverage Target |
|-------|-------|-----------------|
| **Unit** | Fee calculations, validation rules, state machine transitions, auto-approval logic, provider abstraction | 100% |
| **Integration** | Withdrawal creation (real DB), balance computation, rejection refund, cron payout processing, webhook handling with dual verification | 80%+ |
| **E2E** | Creator withdraw flow (request → queued → approved → paid), admin approve/reject, retry failed | Critical paths |

### Key test scenarios

1. Happy path: creator requests withdraw → auto-approved → cron processes → webhook confirms paid
2. Insufficient balance: creator requests more than available → 422
3. Below minimum: creator requests R$ 10 on Free plan → 422
4. Weekly limit: creator at limit requests more → 422
5. Concurrent requests: two withdrawals for same creator → no double-spend
6. Reject refund: admin rejects → balance restored to pre-withdrawal level
7. Provider failure: payout fails → withdrawal `failed`, balance stays reserved
8. Retry flow: admin retries failed → re-queued → re-processed successfully
9. Idempotency: same InfinitePay webhook processed twice → no duplicate ledger entries
10. Spoof detection: webhook claims paid but `payment_check` says no → no credit, security alert

---

## 17. Environment variables

```env
# InfinitePay (internal — never exposed to creators or fans)
INFINITEPAY_HANDLE=                  # PubliHub's platform InfiniteTag (single account)
INFINITEPAY_API_URL=https://api.infinitepay.io
INFINITEPAY_WEBHOOK_SECRET=          # If InfinitePay adds signature verification later

# Creator payout data (stored in profiles.payout_profile, encrypted via Supabase Vault)
# - pix_key, pix_key_type, pix_key_verified
# - full_name, document_cpf
```

---

## Related docs

- [Payment & payout spec](./payment-and-payout-spec.md) — Original financial flow
- [Supabase database schema](./supabase-database-schema.md) — `wallet_ledger`, `withdrawals` tables
- [API contract](./api-contract.md) — Endpoint conventions, error codes
- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md) — Fee tiers, minimums, weekly caps
- [System architecture and data flow](./system-architecture-and-data-flow.md) — Webhook → ledger → Realtime pipeline
- [Testing strategy](./testing-strategy.md) — Vitest / Playwright test pyramid
- [Deployment & infrastructure](./deployment-and-infrastructure.md) — Vercel Cron, environment variables
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md) — Sprint 3 (wallet + gating)
- [InfinitePay Checkout Docs](https://www.infinitepay.io/checkout) — Internal integration reference (not creator-facing)
