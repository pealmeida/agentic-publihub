# PubliHub — The Creator’s Journey

Product narrative from first touch to payout. Use this alongside the [Plan matrix](./plan-matrix-and-feature-limits.md) (tiers & fees), [Business Model Canvas](./business-model-canvas-publihub.md) (strategy), [MVP PRD](./prd-mvp-day-one-launch.md) (requirements), [system architecture](./system-architecture-and-data-flow.md) (technical flows), and the [Phase 1 MVP plan](./phase-1-mvp-execution-plan.md) (delivery slices).

| Phase | Focus | Primary emotion |
|-------|--------|-----------------|
| 1 | Discovery & frictionless onboarding | Curious, skeptical |
| 2 | Conversational setup (“aha”) | Excited, empowered |
| 3 | Activation & stream integration | Practical, focused |
| 4 | Viral loop (live interaction) | Validated, high energy |
| 5 | Wallet & reinvestment | Strategic, professional |
| 6 | Payout & sovereignty | In control; upsell moment |

---

## Phase 1 — Discovery & frictionless onboarding

**Touchpoint**  
Creator notices a **“Powered by PubliHub”** alert on a peer’s stream or follows a **link-in-bio** URL.

**Action**  
Taps **Start for Free** and signs in with **Twitch**, **Google**, or **Discord** (OAuth; aligned with Supabase Auth in the stack).

**Emotional state**  
Curious but skeptical — wants proof before investing time.

**AI / Copilot trigger**  
The Copilot bubble opens immediately with a concrete, low-friction choice, e.g.  
*“Welcome! I’ve already fetched your social bio. Should I build a **Gaming Storefront** or a **Link-in-Bio** first?”*

**Product note**  
Bio prefetch and persona detection are **server-side enrichments** after consent; the first message should feel like the product already “knows” them without asking for a long form.

---

## Phase 2 — The conversational setup (“Aha!” moment)

**Touchpoint**  
**My Hub** in **editor mode** (creator canvas + Copilot).

**Action**  
Creator chats in natural language, e.g.  
*“Add a R$ 20 product for my Lightroom presets and a PIX donation box.”*

**Result**  
- **Generative UI** (AG-UI / allowlisted widgets) renders **hub blocks** on the canvas quickly.  
- **Fan View** preview updates so they see what fans will see.  
- Outcome story: *“I have a live business in about a minute.”*

**Emotional state**  
Excited and empowered — the product feels like a teammate, not a CMS.

**Technical alignment**  
Structured tool calls + validated UI blocks (see [Generative UI — secure approach](./system-architecture-and-data-flow.md#generative-ui--secure-approach)); no free-form code from the model.

---

## Phase 3 — Activation & integration

**Touchpoint**  
**Widgets** tab (or equivalent “Get on stream” entry).

**Action**  
Creator asks Copilot: *“How do I put this on my stream?”*

**Result**  
- **Browser Source URL** (`/hud/[token]`, OBS- / Streamlabs-friendly) + short tutorial.  
- **Realtime** from **Hub / ledger** to **HUD** so **donations and fan interactions** show **live** ([Realtime channels for HUD](./system-architecture-and-data-flow.md#realtime-channels-for-hud)).

**Emotional state**  
Relief — the scary part (“OBS tech”) is guided; **social proof** on stream matches **Wallet** in the app.

---

## Phase 4 — The viral loop (live interaction)

**Touchpoint**  
**Fan Hub** (public URL).

**Action**  
A fan sends e.g. a **R$ 50 media donation** with a linked clip (e.g. YouTube).

**Results (parallel)**  
1. **Wallet** — Balance updates from an append-only **wallet_ledger** entry (managed gateway + webhooks; see [Core business flow](./system-architecture-and-data-flow.md#core-business-flow-fan--wallet--hud)).  
2. **HUD** — High-impact animation on the **stream overlay** for **Hub-originated** events (minimal PII in payload).  
3. **Community** — Creator reacts live; other viewers follow the **Powered by PubliHub** / Hub link → loop back to Phase 1 for new creators.

**Emotional state**  
Validated, high energy — social proof on stream and in chat.

---

## Phase 5 — Wallet management & reinvestment

**Touchpoint**  
**Wallet** tab.

**Action**  
Creator reviews balance and usage; hits **monthly AI limit** (see [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)).

**Result**  
They **buy more AI credits** with **wallet balance** (e.g. R$ 10 → 50 credits) — no new card step when the managed gateway already holds a viable balance path.

**Emotional state**  
Strategic and professional — earnings compound into tooling, not friction.

---

## Phase 6 — Payout & sovereignty (withdrawal)

**Touchpoint**  
**Wallet → Withdrawal**.

**Action**  
Creator meets the **minimum withdrawal** for their plan (**R$ 100** Free, **R$ 50** Starter — [plan matrix](./plan-matrix-and-feature-limits.md#2-plan-specifics-fintech--ai)) and asks Copilot: *“Withdraw my money.”*

**Result**  
- Copilot renders the **AG-UI withdrawal widget** (confirm step, human-in-the-loop; see [component tree](./component-tree-and-state-strategy.md)).  
- On confirm, payout runs through the **managed gateway** (e.g. Stripe / Abacate Pay / InfinitePay — final providers TBD in product alignment), subject to **weekly limits** and **per-payout withdrawal fee**.  

**Upsell trigger (Sovereign)**  
Copilot surfaces economics transparently, e.g.  
*“You’ve paid R$ 150 in transaction fees this week. On **Sovereign**, you’d save about R$ 60 and get 0% withdrawal fee. Want to upgrade?”*

**Emotional state**  
Trust if the math is clear; optional upgrade without blocking payout.

---

## Related docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)  
- [Business Model Canvas](./business-model-canvas-publihub.md)  
- [PRD — MVP (Day One Launch)](./prd-mvp-day-one-launch.md)  
- [System architecture and data flow](./system-architecture-and-data-flow.md)  
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md)  
- [Component tree and state strategy](./component-tree-and-state-strategy.md)  
- [Supabase database schema (draft)](./supabase-database-schema.md)
