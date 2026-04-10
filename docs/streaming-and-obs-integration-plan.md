# PubliHub — Streaming integrations plan (OBS, Twitch, Streamlabs, YouTube, …)

How **fan interactions on the Hub** reach **live overlays**, aligned with [System architecture](./system-architecture-and-data-flow.md) (browser-source HUD + Supabase Realtime).

**Open beta (mandatory):** **`/hud/[token]`** + **Realtime** for **PubliHub-originated** events (donations, digital sales, Hub-driven interactions) so creators can paste **one URL** into **OBS**, **Streamlabs Desktop**, or any app with a **Browser Source**. See [Open beta](./plan-matrix-and-feature-limits.md#open-beta-mvp-launch).

---

## 1. Mental model: two layers

| Layer | Role | PubliHub approach |
|--------|------|-------------------|
| **Overlay renderer** | Shows widgets, alerts, TTS triggers | **One URL** (Browser Source) — `/hud/[token]`. Works in **OBS**, **Streamlabs Desktop**, **Melon**, **prism**, etc. |
| **Event sources** | “Something happened” | **Hub payments / ledger** → server **broadcast** → HUD *(open beta)*. **Twitch / Streamlabs / YouTube** → same pipeline *(post-beta phases B+)*. |

**Rule:** Avoid putting Twitch/YouTube SDKs inside the OBS browser page. Keep the HUD **dumb**: subscribe with a **signed token**, render **typed payloads** ([Realtime channels for HUD](./system-architecture-and-data-flow.md#realtime-channels-for-hud)).

---

## 2. PubliHub-native events (source of truth)

**Flow:** Fan Hub → payment provider webhook → `wallet_ledger` → **Supabase Realtime** → **HUD**.

- **Open beta:** this path is **required** for monetization UX parity with “live on stream.”
- **LangGraph / workers** (optional): normalize webhook → `HudEvent` before broadcast.

---

## 3. Platform integrations (optional “also listen”)

Mirror **native** stream events into the **same** HUD queue *(typically post–open beta)*.

### 3.1 OBS Studio

- **Integration:** **Browser Source** only (no OBS plugin required for alerts).
- **Optional:** [obs-websocket](https://github.com/obsproject/obs-websocket) + **`obs-websocket-js`** for scene control.

### 3.2 Twitch

- [EventSub](https://dev.twitch.tv/docs/eventsub/) — **[Twurple](https://twurple.js.org/)** (`@twurple/eventsub-ws` / `eventsub-http`).

### 3.3 Streamlabs

- [Socket API](https://dev.streamlabs.com/docs/socket-api) — **`socket.io-client`**.

### 3.4 YouTube Live

- [liveChatMessages](https://developers.google.com/youtube/v3/live/docs/liveChatMessages) — prefer **`streamList`**.

### 3.5 Others

- **Kick:** [Kick Dev](https://docs.kick.com/). **Discord:** webhooks / **discord.js**.

---

## 4. Lightweight client stack (HUD page)

| Need | Library |
|------|---------|
| Animation | **Framer Motion** |
| Realtime | **`@supabase/supabase-js`** + **HUD token** from your API |
| TTS | Web Speech API or server audio URLs *(when micro-interactions ship)* |
| Dedupe | In-memory by `event_id` |

---

## 5. Phased rollout

| Phase | Scope |
|-------|--------|
| **A — Open beta (core)** | Hub checkout → **`wallet_ledger`** → **Realtime** → **`/hud/[token]`** + **Widgets** tab “copy URL” + test ping. **PubliHub-sourced** alerts only. |
| **B** | **Twitch** EventSub → normalize → HUD. |
| **C** | **Streamlabs** Socket API. |
| **D** | **YouTube** live chat / Super Chat–class. |
| **E** | **Kick** / others. |

---

## 6. Internal event contract (sketch)

```json
{
  "v": 1,
  "id": "uuid",
  "source": "publihub | twitch | streamlabs | youtube",
  "type": "tip | cheer | sub | sale | quest_milestone | ...",
  "amount_cents": 0,
  "currency": "BRL",
  "display_name": "Fan***",
  "message": "optional",
  "ts": "ISO8601"
}
```

---

## 7. Product / compliance

- **Terms:** Platform brand rules; “Powered by PubliHub” where required.
- **Rate limits:** Twitch / YouTube / Streamlabs — workers + reconnect backoff.

---

## Related docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)  
- [System architecture and data flow](./system-architecture-and-data-flow.md)  
- [Component tree and state strategy](./component-tree-and-state-strategy.md)  
- [PRD — MVP (Day One Launch)](./prd-mvp-day-one-launch.md)  
- [Phase 1 MVP execution plan](./phase-1-mvp-execution-plan.md)
- [HUD token security spec](./hud-token-security-spec.md)
- [Widget type registry](./widget-type-registry.md)
- [Roadmap](./roadmap.md)

### External references (official)

- [Twitch EventSub](https://dev.twitch.tv/docs/eventsub/)  
- [Streamlabs Socket API](https://dev.streamlabs.com/docs/socket-api)  
- [YouTube LiveChatMessages](https://developers.google.com/youtube/v3/live/docs/liveChatMessages)  
- [OBS WebSocket (optional)](https://github.com/obsproject/obs-websocket)
