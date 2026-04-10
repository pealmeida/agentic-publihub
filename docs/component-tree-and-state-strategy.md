# PubliHub — Component Tree & State Strategy

Foundation documentation (Phase 0). Foundational React components and where state lives (Zustand vs Context vs local), aligned to Next.js App Router and the five product pillars.

## App structure (foundational routes)

- **Interactive mock** (no backend): root **`/`** renders `Publi-hub-mock-preview` — demonstrates **Widgets** (catalog + sheet/modal editors + Browser Source URL + HUD preview) and **Settings** (integrations, app, financial, plan). Use as UX reference until real routes ship.
- **Marketing** (optional Phase 1): `/` *(may replace mock later)*
- **Creator app** (authenticated): `(dashboard)/layout` with responsive shell
- **Public hub**: `/u/[handle]` or `/[slug]` + custom domain middleware
- **HUD** *(open beta)*: `/hud/[token]` or `/api/hud/...` + minimal layout (Browser Source; [plan matrix](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch))

## Foundational components (build order)

### Shell & navigation

- `AppProviders` — Query/client, theme, auth context wrappers
- `ResponsiveAppShell` — mobile bottom tabs vs desktop sidebar
- `MainNav`, `SidebarNav`, `MobileTabBar`
- `PlanBadge` / `FeatureGate` — wraps gated sections

### Hub (My Hub)

- `HubCanvas` — grid/stack editor surface
- `HubBlockRenderer` — maps `block_type` → block components
- `HubEditorToolbar` — add block, reorder, save
- `ViewModeToggle` — Creator Edit vs Fan View (simulated)
- Block primitives: `ProductBlock`, `DonationBlock`, `LinkBlock`, `QuestTeaserBlock`, …

### Wallet

- `WalletSummary`, `LedgerTable`, `WithdrawalDialog`
- `PixWithdrawForm` / `CryptoWithdrawForm` (stub until provider chosen)

### Quests

- `QuestList`, `QuestProgressBar`, `QuestEditor`

### Widgets (OBS / HUD) — `/widgets` (or tab `widgets`)

**Purpose:** One place to see **every overlay widget** available for **live** (HUD), **enable/disable** visibility, and **edit** per-widget options — without editing the Hub canvas.

**Layout**

- **`WidgetsPage`** — scrollable **catalog** of widget types (cards or list rows). Each item shows: **name**, **short description**, **on/off** for HUD, **thumbnail** or icon, **“Live preview”** hint.
- **`WidgetCatalogItem`** / **`WidgetCard`** — tap or **Edit** opens the editor (see below).
- **`WidgetLinksPanel`** — global **Browser Source URL**, **regenerate HUD token**, short OBS setup copy (open beta).
- **`HudPreview`** — optional embedded preview of the HUD URL or last event (iframe).

**Edit interaction (responsive)**

- **Mobile:** **`WidgetEditorSheet`** — **bottom sheet** (shadcn `Sheet` side=bottom or equivalent): title, form fields for that widget, save / discard, link to **reset defaults**.
- **Desktop / large tablet:** **`WidgetEditorDialog`** — **modal dialog** (centered) with the same form body; same validation and save path as the sheet.
- Share inner content: **`WidgetEditorForm`** (React Hook Form or controlled) per `widget_type` to avoid duplicating logic.

**Example widget types** *(extend via registry)*

| `widget_type` | On live HUD (open beta) | Editor fields (examples) |
|---------------|-------------------------|---------------------------|
| **`donation_alert`** | Yes | Duration, animation style, min amount to show, sound on/off |
| **`sale_alert`** | Yes | Same as donation or merged **“tip jar”** alert |
| **`goal_bar`** | Phase 2+ | Goal title, target amount, bar color |
| **`media_queue`** | Post-beta | Queue length, max duration |
| **`tts_queue`** | Post-beta | Voice, rate, min paid amount |

Persist widget config in **`hub_widgets` jsonb** or **`creator_hud_settings`** table (see schema notes when added); server validates allowed keys per plan ([plan matrix](./plan-matrix-and-feature-limits.md)).

**State**

- **Sheet open + active `widgetId`:** prefer **URL query** `?edit=donation_alert` or **local state** + focus trap; avoid stacking multiple sheets.
- **Optimistic UI** optional; **server** is source of truth for HUD payload shape.

### Settings — `/settings` (or tab `settings`)

**Purpose:** **Integrations**, **app preferences**, **financial / payout account**, and **subscription plan** — separate from day-to-day **Wallet** ledger (Wallet = balance & history; Settings = **how** money leaves and **who** you’re connected to).

**Suggested sections** *(single scroll page with anchors, or sub-routes)*

1. **`SettingsIntegrationsSection`**
   - Linked identities: **Twitch**, **Google**, **Discord** (OAuth status, connect / disconnect).
   - **Coming soon:** WhatsApp, Telegram, e-com APIs — greyed rows with copy from [open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch).

2. **`SettingsAppSection`**
   - Language / locale, notification toggles (email, optional push later), theme if productized.

3. **`SettingsFinancialSection`** *(payout account)*
   - **Default payout method** (PIX key, bank account per gateway): forms mirror **`PixWithdrawForm`** / bank fields; **KYC / verification** status when provider requires it.
   - Link **“View balance & withdraw”** → **`/wallet`** for the actual **Withdraw** CTA and ledger (avoid two competing withdraw flows — Settings configures **destination**, Wallet executes **payout**).

4. **`SettingsPlanSection`**
   - Current **Free / Starter** badge, **usage** (e.g. AI credits used / limit), **upgrade / manage billing** CTA.
   - **Compare plans** sheet or link to marketing comparison aligned with [plan matrix](./plan-matrix-and-feature-limits.md).

**Components**

- `SettingsPage`, `SettingsNav` (mobile: list of sections; desktop: sidebar)
- `ProfileForm`, `DomainSettings` *(Growth / post-beta if custom domains)*
- `PaymentGatewaySettings` — enterprise / BYO gateway CTA + internal flags
- Reuse **`PlanBadge`** / **`FeatureGate`** patterns for gated rows

### Copilot (AG-UI)

- `CopilotBubble` — floating entry, Framer Motion slide
- `CopilotPanel` — conversation + Generative UI host
- `GenerativeUIHost` — registry renderer + fallback
- `CopilotToolConfirmation` — human-in-the-loop for sensitive tools (withdrawal, domain change)

### Settings *(see full Settings block above)*

- Consolidated under **`/settings`**; individual forms listed in **Settings** section.

## Zustand vs Context vs local state

| Concern | Store |
|--------|--------|
| Copilot open/closed, panel width, unread badge | **Zustand** |
| Active dashboard tab / section (mirrors URL when possible) | **Zustand** + sync from `usePathname` |
| Hub editor mode: Edit vs Fan preview | **Zustand** |
| Ephemeral UI: modals, toasts, drag state, **widget editor sheet open** | **Local** or shallow Zustand slice |
| Auth session, user profile snapshot | **React Context** (from Supabase listener) or server-first + minimal client |
| Feature gates derived from `plan_tier` | **Context** or selector hook reading profile + static plan config |
| Hub blocks JSON while editing | **Local** + debounced persist; optional Zustand for large editor |
| Form fields (withdrawal, settings) | **Local** + React Hook Form if adopted |

### Principle

Zustand for **cross-route UI chrome**; Context for **auth/plan**; server state for **hub/ledger** (TanStack Query optional in Phase 1 or Phase 2 for cache/invalidation).

## Related docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)
- [Business Model Canvas](./business-model-canvas-publihub.md)
- [PRD — MVP (Day One Launch)](./prd-mvp-day-one-launch.md)
- [System architecture and data flow](./system-architecture-and-data-flow.md)
- [Supabase database schema (draft)](./supabase-database-schema.md)
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md)
