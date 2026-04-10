# PubliHub — Deployment & Infrastructure

Hosting, CI/CD, environment management, and monitoring for the PubliHub platform.

---

## 1. Hosting

### Primary: Vercel (Next.js)

| Component | Platform | Notes |
|-----------|----------|-------|
| **Next.js App** | Vercel | App Router, SSR, ISR, Server Actions |
| **Database** | Supabase Cloud | PostgreSQL + Realtime + Auth + Storage |
| **Payments** | InfinitePay | Checkout API + PIX payouts + Webhooks |
| **Domain** | Vercel + Cloudflare | `*.publihub.com` + custom domains (Growth) |

### Vercel Project Setup

```
publihub/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Auth routes
│   ├── (dashboard)/       # Creator dashboard
│   ├── @creator/          # Public hub pages
│   ├── api/               # Route handlers (webhooks)
│   │   ├── webhooks/
│   │   │   └── infinitepay/  # InfinitePay payment webhook
│   └── hud/[token]/       # HUD browser source page
├── components/            # React components
├── lib/                   # Server utilities
└── supabase/              # Migrations
```

### Environment Tiers

| Tier | Supabase | Vercel | InfinitePay |
|------|----------|--------|--------|
| **Development** | Local (Docker) or Supabase dev project | `vercel dev` | Test checkout links |
| **Preview** | Supabase staging project | Vercel Preview (auto on PR) | Test checkout links |
| **Production** | Supabase production | Vercel Production | Live mode |

---

## 2. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# InfinitePay
INFINITEPAY_HANDLE=
INFINITEPAY_API_URL=https://api.infinitepay.io
INFINITEPAY_WEBHOOK_SECRET=

# Auth
NEXT_PUBLIC_SITE_URL=

# Optional (Phase 2+)
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### Secrets Management

- **Vercel**: Encrypted environment variables (project settings)
- **Local**: `.env.local` (gitignored)
- **Never commit**: `SUPABASE_SERVICE_ROLE_KEY`, `INFINITEPAY_HANDLE` (production), `INFINITEPAY_WEBHOOK_SECRET`

---

## 3. CI/CD

### Pipeline (GitHub Actions)

```
Push to PR:
  → Lint (eslint)
  → Type check (tsc --noEmit)
  → Build (next build)
  → Deploy Preview (Vercel auto)

Push to main:
  → All PR checks
  → Deploy Production (Vercel auto)

Database changes:
  → Supabase CLI: supabase db push
  → Reviewed via PR (migration files committed)
```

### Branch Strategy

| Branch | Purpose | Deploy |
|--------|---------|--------|
| `main` | Production | Auto-deploy to Vercel Production |
| `feat/*` | Feature branches | Preview deploy on PR |
| `fix/*` | Bug fixes | Preview deploy on PR |

---

## 4. Database Migrations

### Tool: Supabase CLI

```bash
# Create migration
supabase migration new add_hud_tokens_table

# Apply locally
supabase db reset

# Push to staging
supabase db push --linked

# Push to production (after review)
supabase db push --linked --project-id <prod-id>
```

### Migration Naming Convention

```
supabase/migrations/
├── 20260410_001_initial_schema.sql
├── 20260410_002_add_hud_tokens.sql
├── 20260410_003_add_orders_table.sql
└── 20260410_004_add_indexes.sql
```

### Seed Data

```
supabase/seed.sql  # Minimal test data for local dev
```

---

## 5. Monitoring & Observability

### Health Checks

| Check | Endpoint | Frequency |
|-------|----------|-----------|
| App health | Vercel built-in | Every 30s |
| Supabase | `/api/health` (query DB) | Every 60s |
| InfinitePay connectivity | `/api/health` (ping InfinitePay API) | Every 60s |

### Logging

| Layer | Tool | What to log |
|-------|------|-------------|
| Next.js server | Vercel Logs | Request errors, server action failures |
| Webhooks | Structured JSON | Event type, processing time, errors |
| Database | Supabase Dashboard | Slow queries, connection count |
| Auth | Supabase Auth logs | Sign-ups, login failures |

### Alerts (Phase 2+)

| Alert | Condition |
|-------|-----------|
| Webhook failure | InfinitePay webhook returns 500 or verification fails |
| Payout stuck | Withdrawal pending > 48h |
| Realtime disconnect | HUD connections drop > 50% |
| High error rate | 5xx > 5% over 5 minutes |

---

## 6. Performance Targets

| Metric | Target |
|--------|--------|
| Public hub TTFB | < 200ms (ISR) |
| Dashboard TTFB | < 500ms (SSR) |
| HUD event latency | < 500ms (Realtime) |
| Checkout creation | < 1s |
| Webhook processing | < 2s (p95) — respond 200 quickly, process async |

---

## 7. Security Checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` never exposed to client
- [ ] RLS enabled on all tables
- [ ] InfinitePay webhook payloads verified via `payment_check` before ledger mutation
- [ ] CORS restricted to PubliHub domains
- [ ] Rate limiting on API routes (Vercel built-in + custom)
- [ ] Content Security Policy headers set
- [ ] `HttpOnly` + `Secure` cookies for auth
- [ ] HUD tokens hashed (not stored plaintext)
- [ ] Regular `npm audit` in CI

---

## Related Docs

- [System architecture](./system-architecture-and-data-flow.md)
- [HUD token security spec](./hud-token-security-spec.md)
- [Payment & payout spec](./payment-and-payout-spec.md)
- [Database schema](./supabase-database-schema.md)
