# PubliHub — Payment & Payout Specification

Provider selection, integration architecture, and financial flow for creator monetization.

---

## 1. Provider Selection

### Decision: InfinitePay (primary) + PIX for payouts

| Provider | Role | Rationale |
|----------|------|-----------|
| **InfinitePay** | Payment processing + payout | Brazil-first, PIX 0%, low card fees, checkout API, webhook notifications |
| Abacate Pay | Backup (Phase 2+) | Brazilian-focused, alternative PIX infrastructure |
| Stripe | Backup (Phase 2+) | Global coverage, multi-currency, if international expansion needed |

### Why InfinitePay for MVP

- PIX at 0%, credit card from 2.69% — best BRL-first pricing
- `POST https://api.infinitepay.io/invoices/public/checkout/links` for payment link generation
- Webhook notifications on payment confirmation + `payment_check` for dual verification
- No monthly fees — pure per-transaction model aligns with creator economics
- Instant or 1-day settlement
- Built-in anti-fraud (CNF-certified)

---

## 2. Payment Flow

### Fan Checkout

```
Fan clicks "Buy" on Hub
        │
        ▼
┌──────────────────────────────────────────┐
│ Next.js Server                            │
│ Action: createCheckout()                  │
│ POST api.infinitepay.io/.../checkout/links│
└──────────────────────────────────────────┘
        │
        ▼  Returns checkout URL
┌──────────────────────────────────────────┐
│ InfinitePay Checkout Page                 │
│ Fan pays with PIX or card                 │
└──────────────────────────────────────────┘
        │
        ▼  Fan completes payment
┌──────────────────────────────────────────┐
│ InfinitePay Webhook                       │
│ → our API route                           │
│ /api/webhooks/infinitepay                 │
└──────────────────────────────────────────┘
        │
        ▼  Dual verify (webhook + payment_check), insert ledger
┌──────────────────────────────────────────┐
│ wallet_ledger                             │
│ + digital_product delivery link           │
│ + Realtime broadcast to HUD               │
└──────────────────────────────────────────┘
```

### Webhook Events to Handle

| Event | Action |
|-------|--------|
| Payment webhook (`paid: true`) | Credit creator wallet, reveal download link |
| `payment_check` confirmation | Verify webhook is genuine before crediting |
| Payment failed (webhook not received, timeout) | Mark order failed, notify creator |
| Refund / chargeback (manual via InfinitePay dashboard) | Debit creator wallet, revoke access |

**Verification strategy**: InfinitePay does not provide HMAC webhook signatures. PubliHub uses **dual verification** — webhook payload is cross-checked with `POST /api/infinitepay.io/invoices/public/checkout/payment_check` before any ledger mutation. See [Payment automation pipeline plan §9](./payment-automation-pipeline-plan.md#9-webhook-handler-infinitepay).

---

## 3. Wallet Ledger Design

### Ledger Entry

```typescript
type LedgerEntry = {
  id: string;              // UUID
  creator_id: string;      // FK → profiles
  type: 'credit' | 'debit';
  category: 'sale' | 'donation' | 'withdrawal' | 'refund' | 'fee' | 'adjustment';
  amount_cents: number;    // Positive for credit, negative for debit
  currency: 'BRL';
  reference_type: 'order' | 'donation' | 'withdrawal' | null;
  reference_id: string | null;
  description: string;
  balance_after: number;   // Snapshot after this entry
  created_at: string;      // ISO 8601
};
```

### Balance Calculation

```
available_balance = SUM(amount_cents) WHERE creator_id = X
```

**Convention**: `amount_cents` is **positive for credits** and **negative for debits**. This is the canonical decision (resolves the open question from the database schema doc).

---

## 4. Payout Flow

### Withdrawal Request

```
Creator requests withdrawal
        │
        ▼
┌──────────────────────────────┐
│ Server Validation            │
│ - available_balance >= min   │
│ - weekly_limit not exceeded  │
│ - InfinitePay handle active  │
│ - PIX key verified           │
│ - PIX key configured         │
│ - Deduct withdrawal_fee      │
└──────────────────────────────┘
        │
        ▼  Queued → Approved → InfinitePay PIX transfer to creator's bank
┌──────────────────────────────┐
│ InfinitePay PIX Payout       │
│ - To creator's registered    │
│   PIX key                    │
│ - Settlement: na hora or     │
│   1 dia útil                 │
└──────────────────────────────┘
        │
        ▼  Webhook or poll confirmation
┌──────────────────────────────┐
│ Update withdrawal record     │
│ status = 'paid'              │
└──────────────────────────────┘
```

### Withdrawal Limits (by plan)

| Rule | Free | Starter | Growth |
|------|------|---------|--------|
| Minimum per request | R$ 100 | R$ 50 | R$ 25 |
| Weekly limit | R$ 500 | R$ 5,000 | Unlimited |
| Withdrawal fee | R$ 1.50 | R$ 0.50 | R$ 0.00 |
| Inbound fee (PIX) | 4.9% + R$ 0.30 | 3.9% + R$ 0.30 | 2.9% + R$ 0.30 |
| Inbound fee (Credit card) | 7.9% + R$ 0.50 | 6.9% + R$ 0.50 | 5.9% + R$ 0.50 |

**Credit card constraint (MVP)**: Only **1x** (no installments). Installments will be enabled in a future phase.

**Settlement**: Wallet credited only after receivable settles — PIX: minutes, Card: T+1. See [Payment & withdrawal reference §3](./payment-and-withdrawal-reference.md#3-receivables-settlement-lock-in).

### Fee Deduction

On each inbound transaction:
1. Calculate tier fee (e.g., Starter: 4.9% + R$ 0.50)
2. Credit creator: `gross - fee`
3. Record two ledger entries: one credit (gross), one debit (fee)

---

## 5. Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| **Webhook verification** | Dual verification: webhook payload + `payment_check` API call to InfinitePay |
| **Idempotency** | Use `transaction_nsu` as idempotency key; DB unique constraint on `infinitepay_transaction_nsu` |
| **No card data in our DB** | InfinitePay handles all PCI scope |
| **Creator KYC** | PubliHub collects creator identity (full name + CPF); stored in `profiles.payout_profile`. PIX payouts go directly to creator's registered PIX key. InfinitePay is not creator-facing. |
| **Rate limiting** | Max 5 withdrawal requests per creator per day |
| **Audit trail** | Every ledger mutation logged with timestamp + actor |

---

## 6. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/checkout/create` | POST | Create InfinitePay checkout link |
| `/api/checkout/success` | GET | Redirect after payment (verify + delivery) |
| `/api/webhooks/infinitepay` | POST | Receive InfinitePay payment webhooks |
| `/api/wallet/balance` | GET | Get creator's available balance |
| `/api/wallet/ledger` | GET | Paginated ledger history |
| `/api/wallet/withdraw` | POST | Request withdrawal |
| `/api/wallet/withdrawals` | GET | List withdrawal history |
| `/api/infinitepay/onboard` | POST | Admin: configure PubliHub's InfinitePay handle |

---

## 7. Error Handling

| Scenario | Error Code | User Message |
|----------|------------|--------------|
| Insufficient balance | `INSUFFICIENT_BALANCE` | "Saldo insuficiente para saque." |
| Below minimum | `BELOW_MINIMUM` | "Valor mínimo de saque: R$ X." |
| Weekly limit exceeded | `WEEKLY_LIMIT_EXCEEDED` | "Limite semanal atingido." |
| KYC not verified | `KYC_PENDING` | "Complete seu cadastro financeiro (PIX key + dados pessoais)." |
| Webhook not confirmed | `PAYMENT_NOT_CONFIRMED` | (Log only, no user message) |
| Duplicate event | `DUPLICATE_EVENT` | (Skip silently, idempotent) |
| Payout failed | `PAYOUT_FAILED` | "Saque falhou. Tente novamente." |
---

## Related Docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md) — Fee tiers and minimums
- [Supabase database schema](./supabase-database-schema.md) — `wallet_ledger`, `withdrawals` tables
- [Roadmap](./roadmap.md) — Phase timeline
- [PRD — MVP](./prd-mvp-day-one-launch.md) — Epic 2 (Wallet)
