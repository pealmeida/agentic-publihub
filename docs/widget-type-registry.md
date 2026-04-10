# PubliHub — Widget Type Registry

Canonical enum of HUD widget types, their properties, and per-plan availability.

---

## 1. Widget Types

| Type | ID | Description | Visual |
|------|----|-------------|--------|
| **Donation Alert** | `donation_alert` | Animated overlay for donations | Fullscreen flash + name/amount |
| **TTS Message** | `tts_message` | Text-to-speech for donation messages | Audio + chat overlay |
| **Media Share** | `media_share` | Fan-submitted video/image on stream | Picture-in-picture |
| **Supporter Board** | `supporter_board` | Top donors / leaderboard | Sidebar list |
| **Fan Board** | `fan_board` | Live fan messages / chat wall | Scrolling text |
| **Goal Bar** | `goal_bar` | Progress toward a target amount | Horizontal fill bar |
| **Timer** | `timer` | Countdown or count-up timer | Digital clock |

---

## 2. Widget Configuration Schema

```typescript
type WidgetType = 
  | 'donation_alert'
  | 'tts_message'
  | 'media_share'
  | 'supporter_board'
  | 'fan_board'
  | 'goal_bar'
  | 'timer';

type HudWidget = {
  id: string;
  type: WidgetType;
  title: string;
  description: string;
  enabled: boolean;

  // Timing
  durationSec: number;       // Display duration (5-30s)
  animation: 'fade' | 'slide' | 'bounce' | 'none';
  
  // Thresholds
  minAmount: number;          // Minimum donation to trigger (R$)
  
  // Audio
  soundOn: boolean;
  soundUrl?: string;          // Custom sound file
  
  // Badge / label
  badge?: string;             // Optional badge text

  // Layout
  position: 'top-left' | 'top-center' | 'top-right' 
           | 'center' 
           | 'bottom-left' | 'bottom-center' | 'bottom-right';
};
```

---

## 3. Per-Plan Availability

| Widget Type | Free | Starter | Growth |
|-------------|------|---------|--------|
| `donation_alert` | ✅ | ✅ | ✅ |
| `fan_board` | ✅ | ✅ | ✅ |
| `supporter_board` | ❌ | ✅ | ✅ |
| `goal_bar` | ❌ | ✅ | ✅ |
| `tts_message` | ❌ | ✅ | ✅ |
| `media_share` | ❌ | ❌ | ✅ |
| `timer` | ❌ | ✅ | ✅ |

### Plan Limits

| Metric | Free | Starter | Growth |
|--------|------|---------|--------|
| Max active widgets | 2 | 5 | 20 |
| Custom sounds | ❌ | ✅ | ✅ |
| Custom CSS | ❌ | ❌ | ✅ |

---

## 4. Widget Defaults

```typescript
const WIDGET_DEFAULTS: Record<WidgetType, Partial<HudWidget>> = {
  donation_alert: {
    durationSec: 8,
    animation: 'bounce',
    minAmount: 5,
    soundOn: true,
    position: 'center',
  },
  tts_message: {
    durationSec: 15,
    animation: 'slide',
    minAmount: 10,
    soundOn: true,
    position: 'bottom-center',
  },
  media_share: {
    durationSec: 10,
    animation: 'fade',
    minAmount: 20,
    soundOn: false,
    position: 'center',
  },
  supporter_board: {
    durationSec: 30,
    animation: 'none',
    minAmount: 0,
    soundOn: false,
    position: 'top-right',
  },
  fan_board: {
    durationSec: 5,
    animation: 'slide',
    minAmount: 0,
    soundOn: false,
    position: 'bottom-left',
  },
  goal_bar: {
    durationSec: 0, // persistent
    animation: 'none',
    minAmount: 0,
    soundOn: true,
    position: 'top-center',
  },
  timer: {
    durationSec: 0, // persistent
    animation: 'none',
    minAmount: 0,
    soundOn: false,
    position: 'bottom-right',
  },
};
```

---

## 5. Database Storage

Stored in `creator_hud_settings.widgets` as JSONB:

```json
{
  "widgets": [
    {
      "id": "w1",
      "type": "donation_alert",
      "title": "Donation Alert",
      "description": "Shows animated donation overlay",
      "enabled": true,
      "durationSec": 8,
      "animation": "bounce",
      "minAmount": 5,
      "soundOn": true,
      "position": "center"
    }
  ]
}
```

### Validation

Server validates on save:
1. Widget type is in the `WidgetType` enum
2. Active widget count doesn't exceed plan limit
3. Widget type is available on the creator's plan
4. `durationSec` is within valid range (0-60, or 0 for persistent)
5. `minAmount` is non-negative

---

## Related Docs

- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md) — Tier availability
- [Streaming & OBS integration plan](./streaming-and-obs-integration-plan.md) — HUD architecture
- [Supabase database schema](./supabase-database-schema.md) — `creator_hud_settings` table
- [Component tree & state strategy](./component-tree-and-state-strategy.md) — Widget editor components
