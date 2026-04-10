# PubliHub — API Route & Server Action Contract

Defines endpoint signatures, request/response schemas, authentication, and error conventions.

---

## 1. Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Client      │────▶│  Server      │────▶│  Supabase    │
│  Components  │     │  Actions     │     │  DB/Auth     │
│              │     │  + Route     │     │  + InfinitePay│
│              │     │    Handlers  │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
```

**Server Actions**: Mutations from React components (form submissions, state changes).
**Route Handlers**: Webhooks, public APIs, file downloads.

---

## 2. Authentication & Authorization

| Context | Auth Method | Notes |
|---------|-------------|-------|
| Server Actions | Supabase session cookie | Auto via `createServerClient()` |
| Webhook routes | InfinitePay dual verification | Webhook + `payment_check` API call |
| Public hub pages | None (read-only) | `GET /@creator` is public |
| HUD page | Bearer token (`hud_token`) | Short-lived, scoped to creator |

### Plan Enforcement

```typescript
// lib/feature-gate.ts
type PlanTier = 'free' | 'starter' | 'growth';

function requirePlan(tier: PlanTier, required: PlanTier): void {
  const tiers: PlanTier[] = ['free', 'starter', 'growth'];
  if (tiers.indexOf(tier) < tiers.indexOf(required)) {
    throw new PlanError('PLAN_UPGRADE_REQUIRED', required);
  }
}
```

---

## 3. Error Convention

### Error Response Format

```typescript
type ApiError = {
  code: string;       // Machine-readable: INSUFFICIENT_BALANCE
  message: string;    // Human-readable (pt-BR)
  details?: Record<string, unknown>;
};
```

### HTTP Status Codes

| Status | Usage |
|--------|-------|
| 200 | Success |
| 400 | Validation error, bad request |
| 401 | Not authenticated |
| 403 | Plan limit, feature not available |
| 404 | Resource not found |
| 409 | Conflict (duplicate, stale state) |
| 422 | Business rule violation (insufficient balance, etc.) |
| 429 | Rate limited |
| 500 | Server error |

### Standard Error Codes

| Code | HTTP | Meaning |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Request body failed Zod validation |
| `UNAUTHORIZED` | 401 | No valid session |
| `PLAN_UPGRADE_REQUIRED` | 403 | Feature requires higher plan |
| `PLAN_LIMIT_EXCEEDED` | 403 | Tier limit reached (products, pages, etc.) |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Duplicate or stale version |
| `INSUFFICIENT_BALANCE` | 422 | Wallet balance too low |
| `BELOW_MINIMUM` | 422 | Below withdrawal minimum |
| `WEEKLY_LIMIT_EXCEEDED` | 422 | Payout weekly cap reached |
| `KYC_PENDING` | 422 | Identity verification incomplete |
| `RATE_LIMITED` | 429 | Too many requests |

---

## 4. Server Actions

### Hub

| Action | Input | Output | Plan |
|--------|-------|--------|------|
| `updateHubProfile` | `{ name, bio, avatar }` | `Hub` | All |
| `updateHubTheme` | `{ theme }` | `Hub` | All |
| `addHubPage` | `{ label }` | `HubPage` | Free: max 5, Starter: max 10, Growth: unlimited |
| `removeHubPage` | `{ pageId }` | `void` | All |
| `reorderHubPages` | `{ pageIds: string[] }` | `void` | All |
| `updateHubPageLayout` | `{ pageId, layout }` | `void` | All |

### Hub Blocks

| Action | Input | Output | Plan |
|--------|-------|--------|------|
| `addHubBlock` | `{ pageId, type, ...blockData }` | `HubBlock` | All |
| `updateHubBlock` | `{ blockId, ...updates }` | `HubBlock` | All |
| `removeHubBlock` | `{ blockId }` | `void` | All |
| `reorderHubBlocks` | `{ pageId, blockIds: string[] }` | `void` | All |

### Wallet

| Action | Input | Output | Plan |
|--------|-------|--------|------|
| `requestWithdrawal` | `{ amount_cents }` | `Withdrawal` | Starter+ |
| `savePayoutProfile` | `{ pix_key, pix_key_type, full_name, document_cpf }` | `Profile` | Starter+ |

### Integrations

| Action | Input | Output | Plan |
|--------|-------|--------|------|
| `connectIntegration` | `{ provider, code }` | `Integration` | All (varies by provider) |
| `disconnectIntegration` | `{ provider }` | `void` | All |
| `updateIntegrationConfig` | `{ provider, config }` | `void` | All |

### Settings

| Action | Input | Output | Plan |
|--------|-------|--------|------|
| `updateSettings` | `{ locale?, notifyEmail?, ... }` | `Settings` | All |
| `switchPlan` | `{ plan: PlanTier }` | `Settings` | All |

---

## 5. Route Handlers

### Webhooks

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/webhooks/infinitepay` | POST | InfinitePay verification | Payment events |
| `/api/webhooks/twitch` | POST | Twitch HMAC | EventSub notifications |
| `/api/webhooks/shopify` | POST | HMAC verify | Product/order sync (Growth) |

### Public

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/hud/[token]/events` | GET | Bearer `hud_token` | SSE / Realtime token exchange |
| `/api/hub/[slug]` | GET | None | Public hub data (SSR/ISR) |
| `/api/checkout/create` | POST | Session | Create InfinitePay checkout link |
| `/api/checkout/success` | GET | Session | Post-payment redirect |

---

## 6. Validation

All inputs validated with **Zod schemas** on the server:

```typescript
import { z } from 'zod';

const requestWithdrawalSchema = z.object({
  amount_cents: z.number().int().positive(),
});

export async function requestWithdrawal(raw: unknown) {
  const { amount_cents } = requestWithdrawalSchema.parse(raw);
  // ...
}
```

---

## Related Docs

- [Payment & payout spec](./payment-and-payout-spec.md) — Financial flow details
- [HUD token security spec](./hud-token-security-spec.md) — Token auth for HUD
- [Supabase database schema](./supabase-database-schema.md) — Table definitions
- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md) — Tier limits
