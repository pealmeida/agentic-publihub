# PubliHub — HUD Token Security Specification

Lifecycle, issuance, rotation, and revocation of browser-source HUD tokens.

---

## 1. Overview

The HUD page (`/hud/[token]`) renders inside OBS / Streamlabs / any Browser Source. It must:

1. Authenticate the connection without requiring the creator to log in
2. Scope access to only one creator's events
3. Be revocable at any time
4. Rotate on a regular schedule

---

## 2. Token Design

### Format

```
phud_<random_32_bytes_hex>
```

Example: `phud_a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6`

### Storage

```sql
CREATE TABLE hud_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id  UUID NOT NULL REFERENCES profiles(id),
  token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 of plaintext token
  label       TEXT DEFAULT 'default',
  created_at  TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_hud_tokens_creator ON hud_tokens(creator_id);
CREATE INDEX idx_hud_tokens_hash ON hud_tokens(token_hash) WHERE revoked_at IS NULL;
```

**Important**: Store only the **hash**, never the plaintext. The plaintext token is shown to the creator exactly once when created.

---

## 3. Token Lifecycle

```
Create          Use (OBS)           Rotate              Revoke
  │                │                   │                   │
  ▼                ▼                   ▼                   ▼
Generate     Creator pastes     New token issued,    Token marked
random       URL into OBS       old expires after    revoked, all
32 bytes     Browser Source     grace period         connections
                                                     dropped
```

### States

| State | Condition |
|-------|-----------|
| **Active** | `revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())` |
| **Expired** | `expires_at <= now()` |
| **Revoked** | `revoked_at IS NOT NULL` |

---

## 4. Issuance Flow

```
Creator clicks "Copy HUD URL" in Widgets tab
        │
        ▼
┌──────────────────┐
│ Server Action:   │
│ createHudToken() │
│ - Generate token │
│ - Hash + store   │
│ - Return plaintext│
└──────────────────┘
        │
        ▼
Client constructs URL:
https://alex.publihub.com/hud/phud_a1b2c3...
        │
        ▼
Creator copies to OBS Browser Source
```

### Rules

- Free plan: **1 active token** per creator
- Starter plan: **3 active tokens** per creator
- Growth plan: **10 active tokens** per creator

---

## 5. Authentication Flow

```
OBS loads /hud/phud_a1b2c3...
        │
        ▼
┌──────────────────┐
│ Route Handler:   │
│ GET /hud/[token] │
│                  │
│ 1. Hash token    │
│ 2. Look up in DB │
│ 3. Check active  │
│ 4. Get creator_id│
│ 5. last_used_at  │
└──────────────────┘
        │
        ▼
If valid: Render HUD page, connect to Supabase Realtime
         channel: `hud:{creator_id}`
If invalid: Show "Token expired or revoked" message
```

### Realtime Channel Security

```sql
-- RLS policy on Realtime broadcasts
-- Only allow HUD connections for the token's creator
CREATE POLICY "hud_token_owner_only"
  ON hud_tokens FOR SELECT
  USING (creator_id = auth.uid() OR token_hash = :provided_hash);
```

The HUD page subscribes to a **creator-scoped** Realtime channel using a **short-lived signed JWT** (not the raw HUD token):

```
1. Browser loads /hud/[token]
2. Server verifies token hash → issues short-lived JWT (15min)
3. Browser uses JWT to subscribe to Supabase Realtime
4. JWT refreshed automatically via silent fetch
5. If token revoked → JWT issuance fails → disconnect
```

---

## 6. Rotation

### Automatic Rotation

- Tokens expire after **90 days** (`expires_at`)
- Creator sees "Renew" badge in Widgets tab 7 days before expiry
- On renewal, old token enters **grace period** (24 hours) before revocation

### Manual Rotation

Creator can rotate at any time:
1. Click "Regenerate HUD URL" in Widgets tab
2. New token issued immediately
3. Old token enters 24h grace period (OBS still works)
4. After grace period, old token revoked

---

## 7. Revocation

### Immediate Revocation

Triggered by:
- Creator clicks "Revoke all HUD URLs"
- Creator changes password (security measure)
- Admin action (abuse, fraud)
- Plan downgrade (tokens exceeding new limit revoked, oldest first)

### Process

```sql
UPDATE hud_tokens
SET revoked_at = now()
WHERE creator_id = :creator_id
  AND revoked_at IS NULL
  AND id = :token_id;
```

Revoked tokens immediately fail authentication. OBS shows "Disconnected — check HUD URL."

---

## 8. Rate Limiting

| Context | Limit |
|---------|-------|
| Token creation | 5 per hour per creator |
| Token authentication | 60 per minute per token |
| Realtime connections per token | 3 concurrent |

---

## Related Docs

- [Streaming & OBS integration plan](./streaming-and-obs-integration-plan.md) — HUD event contract
- [System architecture](./system-architecture-and-data-flow.md) — Realtime channels
- [Supabase database schema](./supabase-database-schema.md) — `hud_tokens` table
- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md) — Token limits per tier
