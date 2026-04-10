# PubliHub — Integrations Guide

How PubliHub connects to external platforms: streaming, social, messaging, marketplaces, and e-commerce.

---

## 1. Integration Architecture

### Philosophy: Lightweight & Composable

PubliHub uses a **direct API + webhook** approach rather than building a monolithic integration layer. This keeps complexity manageable while supporting all platform types.

```
┌─────────────────────────────────────────────────────────────┐
│                    PubliHub Backend                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Webhooks   │  │  API Client │  │   Queue     │         │
│  │  (ingest)   │  │  (outbound) │  │  (workers)  │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└─────────────────────────────────────────────────────────────┘
         ▲                ▲                   ▲
         │                │                   │
    ┌────┴────┐      ┌────┴────┐        ┌────┴────┐
    │OAuth/  │      │Platform │        │Internal │
    │Webhooks│      │ SDKs    │        │Events   │
    └─────────┘      └─────────┘        └─────────┘
```

### Simple Pattern: 3 Integration Types

| Type | Use Case | Example |
|------|----------|---------|
| **OAuth Login** | Authenticate creators | Twitch, Google, Discord |
| **Webhook Ingest** | Receive events | InfinitePay (payments), Shopee, Amazon |
| **API Client** | Pull/push data | Shopify, WhatsApp API |

---

## 2. Platform SDKs & Libraries

### Streaming

| Platform | Library | Type | Notes |
|----------|---------|------|-------|
| **Twitch** | [`@twurple/auth`](https://twurple.js.org) + [`@twurple/eventsub`](https://twurple.js.org/docs/eventsub) | OAuth + Webhook | EventSub for subs, bits, raids |
| **Streamlabs** | [`socket.io-client`](https://socket.io) | Socket API | Real-time donations/alerts |
| **YouTube** | [`googleapis`](https://github.com/googleapis/google-api-nodejs-client) | API Client | LiveChatMessages + broadcasts |
| **Kick** | REST API + webhooks | Webhook | New platform, limited SDK |

### Social

| Platform | Library | Type | Notes |
|----------|---------|------|-------|
| **Discord** | [`discord.js`](https://discord.js.org) | API Client | Bot for notifications |
| **Instagram** | Meta Graph API | OAuth | Business account required |
| **X (Twitter)** | [`twitter-api-v2`](https://github.com/PLhery/node-twitter-api-v2) | OAuth | API v2 |

### Messaging

| Platform | Library | Type | Notes |
|----------|---------|------|-------|
| **WhatsApp** | [`@whatsapp-business-sdk`](https://github.com/WhatsAppBusinessSDK) | API Client | Cloud API (Meta) |
| **Telegram** | [`node-telegram-bot-api`](https://github.com/yagop/node-telegram-bot-api) | API Client | Bot API |
| **Discord** | (see above) | API Client | Already covered |

### E-commerce & Marketplaces

| Platform | Library | Type | Notes |
|----------|---------|------|-------|
| **Shopify** | [`@shopify/shopify-api`](https://github.com/Shopify/shopify-node-api) | OAuth + API | Admin + Storefront APIs |
| **WooCommerce** | [`@woocommerce/woocommerce-rest-api`](https://woocommerce.github.io/woocommerce-rest-api-docs/) | API Key | REST API with consumer key/secret |
| **Mercado Livre** | [`mercadopago`](https://github.com/mercadopago/sdk-nodejs) | OAuth + API | Payments + inventory |
| **Shopee** | REST API (partner) | API Key | Affiliate API |
| **Amazon Associates** | [`amazon-paapi`](https://github.com/amzn/selling-partner-api-samples) | API Key | Product Advertising API |
| **Adobe Commerce** | REST API | API Key | Magento 2.x headless |
| **Wix** | Wix REST API | OAuth | Store + e-commerce |

---

## 3. Lightweight Connector Approach

### Option A: Direct SDK (Recommended for MVP)

Use official SDKs directly. Most platforms provide stable, well-maintained Node.js libraries.

```typescript
// Example: Twitch EventSub
import { EventSubHttpListener } from '@twurple/eventsub';

const listener = new EventSubHttpListener({
  apiClient,
  secret: process.env.TWITCH_EVENTSUB_SECRET,
  hostName: 'your-domain.com',
  pathPrefix: '/webhooks',
});

listener.onSubscription('user.id', (event) => {
  // Normalize → PubliHub event → broadcast to HUD
  broadcastHudEvent(normalizeSubscription(event));
});
```

### Option B: Unified API Wrapper (For Scale)

If integrating many similar platforms, create thin wrappers:

```typescript
// lib/integrations/base.ts
interface PlatformClient {
  authenticate(): Promise<void>;
  getProducts(): Promise<Product[]>;
  getOrders(): Promise<Order[]>;
}

// lib/integrations/shopify.ts
export class ShopifyClient implements PlatformClient {
  constructor(private shop: string, private accessToken: string) {}
  
  async getProducts() {
    const response = await fetch(
      `https://${this.shop}.myshopify.com/admin/api/2024-01/products.json`,
      { headers: { 'X-Shopify-Access-Token': this.accessToken } }
    );
    return response.json();
  }
}
```

### Option C: n8n-style Nodes (Future Consideration)

For non-technical users or complex workflows, consider building custom n8n nodes later. Not recommended for MVP.

---

## 4. Integration Matrix by Plan

| Integration | Free | Starter | Growth |
|-------------|------|---------|--------|
| **OAuth login** (Twitch, Google, Discord) | ✅ | ✅ | ✅ |
| **WhatsApp / Telegram** | - | Coming soon | ✅ |
| **Shopify** | - | - | ✅ |
| **WooCommerce** | - | - | ✅ |
| **Shopee / Amazon affiliates** | - | - | ✅ |
| **Mercado Livre** | - | - | ✅ |
| **Adobe Commerce / Wix** | - | - | ✅ |

---

## 5. Simple Integration Checklist

For each new platform, follow this 5-step process:

1. **Auth** — Choose auth type (OAuth, API key, webhook)
2. **Client** — Install SDK or create thin wrapper
3. **Normalize** — Map external event → PubliHub `HudEvent`
4. **Test** — Webhook delivery + API polling
5. **Monitor** — Rate limits, tokens, errors

---

## 6. External References

### Official APIs
- [Twitch Developer](https://dev.twitch.tv/docs)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [Shopify API](https://shopify.dev/docs/api)
- [Meta for Developers](https://developers.facebook.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

### Node.js SDKs
- [Twurple](https://twurple.js.org) — Twitch UI + EventSub
- [@shopify/shopify-api](https://github.com/Shopify/shopify-node-api)
- [googleapis](https://github.com/googleapis/google-api-nodejs-client)

### Related Docs
- [Plan matrix & feature limits](./plan-matrix-and-feature-limits.md)
- [Streaming & OBS integration plan](./streaming-and-obs-integration-plan.md)
- [System architecture](./system-architecture-and-data-flow.md)