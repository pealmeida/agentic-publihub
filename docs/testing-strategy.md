# PubliHub — Testing Strategy

Unit, integration, and end-to-end testing approach for the PubliHub platform.

---

## 1. Testing Pyramid

```
          ┌──────────┐
          │  E2E (5%)│  Playwright — critical user flows
          ├──────────┤
          │ Integration│  Vitest — server actions, API routes, DB
          │    (25%)  │
          ├──────────┤
          │  Unit (70%)│  Vitest — pure functions, utilities, schemas
          └──────────┘
```

---

## 2. Tools

| Tool | Purpose | Config |
|------|---------|--------|
| **Vitest** | Unit + integration tests | `vitest.config.ts` |
| **Playwright** | E2E browser tests | `playwright.config.ts` |
| **React Testing Library** | Component tests | Via Vitest |
| **MSW** | Mock HTTP (InfinitePay, Supabase) | Via Vitest setup |
| **Supabase Local** | Real DB for integration tests | Docker |

---

## 3. Unit Tests

### Scope

- Zod validation schemas
- Feature gate logic (plan tier checks)
- Fee calculations (inbound, withdrawal)
- Ledger balance computations
- Token hashing utilities
- Data normalization (HudEvent mapping)

### Example

```typescript
import { describe, it, expect } from 'vitest';
import { calculateInboundFee } from '@/lib/fees';

describe('calculateInboundFee', () => {
  it('applies Starter fee correctly', () => {
    const fee = calculateInboundFee('starter', 10000); // R$ 100.00
    expect(fee).toBe(540); // 4.9% of 10000 + 50 = 490 + 50 = 540 cents
  });

  it('applies Free fee with minimum', () => {
    const fee = calculateInboundFee('free', 500); // R$ 5.00
    expect(fee).toBe(80); // 5.9% of 500 + 50 = 29.5 + 50 = ~80 cents
  });
});
```

### Running

```bash
npx vitest                    # Watch mode
npx vitest run                # Single run (CI)
npx vitest run --coverage     # With coverage
```

---

## 4. Integration Tests

### Scope

- Server Actions (with real Supabase local DB)
- API route handlers (webhook processing)
- Wallet ledger operations
- HUD token creation + verification
- InfinitePay checkout link creation (mocked InfinitePay API)

### Setup

```typescript
// vitest.config.ts integration setup
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.integration.test.{ts,tsx}'],
    setupFiles: ['./tests/setup-integration.ts'],
  },
});
```

### Example

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { createHudToken, verifyHudToken } from '@/lib/hud-tokens';
import { createClient } from '@supabase/supabase-js';

describe('HUD Token lifecycle', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('creates and verifies a valid token', async () => {
    const { plaintext, hash } = await createHudToken(creatorId);
    const result = await verifyHudToken(plaintext);
    expect(result.creatorId).toBe(creatorId);
    expect(result.valid).toBe(true);
  });

  it('rejects revoked tokens', async () => {
    const { plaintext } = await createHudToken(creatorId);
    await revokeToken(creatorId);
    const result = await verifyHudToken(plaintext);
    expect(result.valid).toBe(false);
  });
});
```

---

## 5. E2E Tests

### Scope (Critical Paths Only)

| Flow | Test |
|------|------|
| **Sign up** | Creator signs up → lands on dashboard |
| **Create hub** | Add page → add block → publish → view public hub |
| **Buy product** | Fan visits hub → checkout → wallet credited |
| **Withdraw** | Creator requests withdrawal → validation passes |
| **HUD URL** | Copy URL → page renders → Realtime connects |
| **Copilot chat** | Open chat → send message → receive response |

### Playwright Config

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  baseURL: 'http://localhost:3000',
  use: {
    locale: 'pt-BR',
  },
});
```

### Example

```typescript
import { test, expect } from '@playwright/test';

test('creator can create a digital product', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('text=Add Product');
  await page.fill('[name=title]', 'My Preset Pack');
  await page.fill('[name=price]', '49.90');
  await page.click('text=Save');
  await expect(page.locator('text=My Preset Pack')).toBeVisible();
});
```

### Running

```bash
npx playwright test              # All E2E
npx playwright test --ui         # Interactive UI
npx playwright test tests/e2e/checkout.spec.ts  # Single file
```

---

## 6. Test Data Strategy

| Environment | Data Source |
|-------------|-------------|
| Unit tests | Hardcoded fixtures |
| Integration | Supabase local + seed migrations |
| E2E | Playwright test fixtures + API seeding |

### Seed Data

```sql
-- supabase/seed.sql (for local dev + integration tests)
INSERT INTO profiles (id, email, plan_tier) VALUES
  ('test-creator-1', 'test@example.com', 'starter');

INSERT INTO wallet_ledger (creator_id, type, category, amount_cents, currency) VALUES
  ('test-creator-1', 'credit', 'sale', 5000, 'BRL');
```

---

## 7. CI Integration

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm ci
      - run: npx vitest run
      - run: npm run lint
      - run: npx tsc --noEmit
```

---

## 8. Coverage Targets

| Layer | Target |
|-------|--------|
| Fee calculations | 100% |
| Feature gates | 100% |
| Server actions | 80%+ |
| API route handlers | 80%+ |
| UI components | 50%+ (critical paths only) |

---

## Related Docs

- [API contract](./api-contract.md) — Endpoints to test
- [Payment & payout spec](./payment-and-payout-spec.md) — Financial flows to test
- [HUD token security spec](./hud-token-security-spec.md) — Token tests
- [Deployment & infrastructure](./deployment-and-infrastructure.md) — CI pipeline
