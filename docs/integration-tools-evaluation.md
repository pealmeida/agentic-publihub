# Evaluation: Integration Orchestration & Catalog Management Tools

Analysis of third-party solutions vs. building in-house for PubliHub's integration needs.

---

## 1. Integration Orchestration Tools

### API2Cart

| Aspect | Details |
|--------|---------|
| **What it is** | Unified API for 60+ e-commerce platforms (Shopify, Magento, WooCommerce, Amazon, eBay, etc.) |
| **Pricing** | $300-$1000/mo based on API calls + connected stores |
| **Pros** | One integration → 60+ platforms; product/order/customer sync; webhooks |
| **Cons** | SaaS (vendor lock-in); per-request pricing; overkill for just 8 platforms |
| **Fit for PubliHub** | ❌ Overkill. We only need 8 e-commerce platforms, not 60+. |

### ActivePieces

| Aspect | Details |
|--------|---------|
| **What it is** | Open-source workflow automation (Zapier alternative) |
| **Pricing** | Free (self-hosted) · $5/flow/mo (cloud) · Enterprise custom |
| **Pros** | 200+ pieces (integrations); MIT-licensed; visual flow builder; AI agents |
| **Cons** | Still need custom pieces for niche e-commerce APIs; added complexity layer |
| **Fit for PubliHub** | ❌ Unnecessary abstraction. Our integrations are straightforward API clients. |

### n8n

| Aspect | Details |
|--------|---------|
| **What it is** | Open-source workflow automation with code-first approach |
| **Pricing** | Free (self-hosted) · $20/mo (cloud) |
| **Pros** | 400+ integrations; code-first; self-hostable; very active community |
| **Cons** | Additional infrastructure to manage; not core to our product |
| **Fit for PubliHub** | ❌ Adds operational complexity. Direct SDK integration is simpler. |

### Recommendation: Build Direct

For PubliHub's scope (8 e-commerce + 8 streaming/messaging platforms), **direct SDK integration** is the right approach:

- ✅ No vendor lock-in
- ✅ Full control over normalization logic  
- ✅ No per-request costs
- ✅ Simpler architecture

---

## 2. MCP-Based Orchestration Layer

**Model Context Protocol (MCP)** offers a standardized way to expose integrations as tools that AI agents can discover and invoke. This is particularly valuable for PubliHub's Copilot AI feature.

### Available Frameworks

| Framework | Stars | Key Features | Fit |
|-----------|-------|--------------|-----|
| **FastMCP** | 3k+ | Simple API, multiple transports, auth, CLI for testing | ✅ Best balance |
| **MCP-Use** | 173 | Client + Server + Inspector + CLI, full DX | ✅ Best for AI agents |
| **MCPKit** | New | Decorator-based, type-safe, middleware, plugins | Good for production |
| **mcp-lite** | 101 | Minimal, fetch-first, zero deps | Good for edge |
| **mcp-ts-core** | 123 | Edge-ready (CF Workers), OpenTelemetry, declarative | Good for serverless |

### Option A: FastMCP (Recommended)

```typescript
import { FastMCP } from 'fastmcp';
import { z } from 'zod';

const server = new FastMCP({
  name: 'publihub-integrations',
  version: '1.0.0',
});

// Shopify integration as MCP tool
server.addTool({
  name: 'shopify_get_products',
  description: 'Get products from connected Shopify store',
  parameters: z.object({
    limit: z.number().optional().default(50),
  }),
  async execute({ limit }) {
    const client = new ShopifyClient(...);
    const products = await client.getProducts({ limit });
    return { products };
  },
});

server.start({ transportType: 'stdio' });
```

**Pros**: Simple, well-maintained, good docs
**Cons**: Abstracts some low-level details

### Option B: Official MCP SDK (More Control)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Tool, Resource } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({
  name: 'publihub-integrations',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
    resources: {},
  },
});

server.setRequestHandler('tools/list', async () => ({
  tools: [{
    name: 'shopify_get_products',
    description: 'Get products from Shopify',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number' } },
    },
  }],
}));
```

**Pros**: Full control, no abstraction overhead, production-ready
**Cons**: More boilerplate

### Integration Architecture with MCP

```
┌─────────────────────────────────────────────────────────────────┐
│                      PubliHub MCP Server                       │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ twitch-tools │  │ shopify-tools│  │ whatsapp-    │        │
│  │              │  │              │  │ tools        │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│         │                  │                  │               │
│         └──────────────────┼──────────────────┘               │
│                            ▼                                   │
│                   ┌──────────────┐                            │
│                   │  Tool Router │  (normalize → HudEvent)    │
│                   └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │   Copilot AI Agent       │  (uses MCP tools)
              └───────────────────────────┘
```

### Benefits for PubliHub

| Benefit | Description |
|---------|-------------|
| **AI-Ready** | Copilot can discover and invoke integrations via MCP |
| **Standardized** | Single interface for all platform integrations |
| **Extensible** | New integrations = new MCP tools |
| **Testable** | Use `fastmcp dev` to test tools in isolation |
| **Future-Proof** | MCP is an open standard (Anthropic-led) |

### Implementation Strategy

1. **Phase 1**: Direct SDK integration (no MCP)
2. **Phase 2**: Wrap integrations as MCP tools internally
3. **Phase 3**: Expose MCP server for Copilot AI

---

## 3. E-commerce Catalog Management (Headless Backend)

### Medusa.js

| Aspect | Details |
|--------|---------|
| **What it is** | Open-source headless commerce engine (Node.js/TypeScript) |
| **Pricing** | Free (self-hosted) · $29/mo (cloud hobby) · $299/mo (cloud pro) |
| **Pros** | 0% GMV fees; modular plugins; REST + event-driven; self-hostable |
| **Cons** | Heavy for our use case; separate commerce engine, not just integration |
| **Use case** | If we wanted to build a full e-commerce store with checkout, inventory, orders |

### How PubliHub Uses E-commerce

```
PubliHub (our platform)
       │
       ▼
┌─────────────────┐      ┌─────────────────┐
│  Creator's      │      │  External       │
│  Hub Products   │ ───► │  E-commerce     │
│  (digital only) │      │  (sync only)     │
└─────────────────┘      └─────────────────┘
       │                        │
       ▼                        ▼
   Checkout ←──────────── Product sync (Growth)
   (PubliHub)                + webhooks
```

PubliHub **does not need** a full commerce engine because:

1. We handle **checkout/payments** ourselves (InfinitePay, internal)
2. Growth e-commerce sync is **read-only** (pull products, show on Hub)
3. We don't need to manage inventory, shipping, or fulfillment

### Recommendation: Don't Use Medusa

PubliHub should **not** use Medusa.js because:

- ❌ We're not building an e-commerce store
- ❌ We only need to *read* product data, not manage full catalogs
- ❌ Adds unnecessary complexity

Our approach: **lightweight API clients** that pull product data and normalize it.

---

## 4. Summary: Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       PubliHub Backend                          │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐      │
│  │  Integrations │   │   Catalog    │   │   Webhook    │      │
│  │   Service     │   │   Sync       │   │   Handler    │      │
│  └──────────────┘   └──────────────┘   └──────────────┘      │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐      │
│  │ Direct SDKs  │   │ Lightweight  │   │   Normalize  │      │
│  │ (per spec)   │   │   Clients    │   │   → HudEvent │      │
│  └──────────────┘   └──────────────┘   └──────────────┘      │
└─────────────────────────────────────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │Twitch,   │      │Shopify,  │      │Stripe,   │
   │Streamlabs│      │WooCommerce│      │Shopee    │
   └──────────┘      └──────────┘      │Webhooks  │
                                      └──────────┘
```

### Why This Works

| Need | Solution |
|------|----------|
| OAuth login | Direct OAuth flow (Twitch, Google, Discord) |
| Streaming events | Twurple (Twitch), socket.io-client (Streamlabs) |
| Messaging | Direct API clients (WhatsApp, Telegram) |
| E-commerce sync | Lightweight REST clients (Shopify, WooCommerce) |
| Marketplace webhooks | Simple webhook handlers |
| Event normalization | Internal service → unified `HudEvent` format |

---

## 5. When to Re-evaluate

Consider adding orchestration tools if:

1. **Growth phase**: 20+ platform integrations
2. **Non-technical users**: Creators need to configure integrations themselves
3. **Complex workflows**: Multi-step automations (e.g., "new order → CRM → email")

Consider Medusa if:

1. PubliHub expands to **full e-commerce** (not just digital products)
2. We need **marketplace** functionality (not just sync)
3. Checkout/payments handled externally becomes a bottleneck

Consider MCP if:

1. **Now**: Copilot AI needs to interact with integrations
2. **Future**: Third-party developers want to build on PubliHub

---

## 6. Updated Docs

This evaluation has been incorporated into:

- [`docs/integrations-guide.md`](./integrations-guide.md) — Updated to recommend direct SDK approach
- [`docs/plan-matrix-and-feature-limits.md`](./plan-matrix-and-feature-limits.md) — Lists specific platforms

**Bottom line**: For PubliHub's MVP and early Growth phase, build direct integrations. Third-party tools add unnecessary cost and complexity.