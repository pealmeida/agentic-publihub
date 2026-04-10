"use client";

/**
 * Mock UI preview (no backend).
 * - Copilot: chat + **Generative canvas** harness (hub block & HUD widget drafts, apply / dismiss / refine).
 * - Widgets: hub page link + QR, Browser Source URL, create-widget sheet/modal (templates + Copilot AI),
 *   catalog + bottom sheet (mobile) / modal (desktop) editor, mock HUD preview.
 * - Settings: Integrations, App, Financial (payout), Plan (aligned with docs).
 * - Lucide: `Video as Youtube` for YouTube icon.
 */
import React, {
  memo,
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  useCallback,
} from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { HubBlock, HubPageLayoutId } from "@/types/hub-block";
export type { HubBlock, HubPageLayoutId } from "@/types/hub-block";
import { HubBlockCardInner } from "@/components/hub-block-card-inner";
import {
  GenerativeCanvasPanel,
  type GenerativeCanvasDraft,
} from "@/components/generative-canvas";
import {
  Home,
  Wallet as WalletIcon,
  Target,
  Settings,
  Sparkles,
  Send,
  Plus,
  ExternalLink,
  Edit3,
  X,
  ArrowRightLeft,
  CheckCircle2,
  Eye,
  Zap,
  Check,
  Trash2,
  KeyRound,
  ArrowDownToLine,
  Video as Youtube,
  Volume2,
  MessageSquare,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Pencil,
  Lock,
  Crown,
  ShoppingBag,
  Store,
  Link2,
  TicketPercent,
  Music,
  GripVertical,
  Monitor,
  Bell,
  Plug,
  Globe,
  ChevronDown,
  QrCode,
} from "lucide-react";

// --- MOCK DATA & INITIAL STATE ---
const INITIAL_HUB = {
  theme: {
    bg: "bg-white",
    card: "bg-white border-slate-200",
    primary: "bg-indigo-600 text-white",
    song: "None",
  },
  profile: {
    name: "Alex Creator",
    bio: "Digital Artist & Streamer 🚀",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alex",
  },
};

const INITIAL_WALLET = {
  balance: 1240.5,
  events: [
    {
      label: "TTS Donation (Sarah99)",
      amt: 50.0,
      time: "10 mins ago",
      type: "in" as const,
    },
    {
      label: "Media Share (GamerBro)",
      amt: 20.0,
      time: "25 mins ago",
      type: "in" as const,
    },
    { label: "Withdrawal", amt: -500.0, time: "Yesterday", type: "out" as const },
  ],
};

const INITIAL_QUESTS = [
  {
    id: "q1",
    brand: "Shopee",
    product: "Wireless Headphones",
    goal: 50,
    current: 32,
    earned: 520,
    status: "active",
  },
];

const INITIAL_SETTINGS = {
  email: "alex@creator.com",
  whatsapp: "+55 11 99999-9999",
  plan: "Starter",
  domain: "alex.publihub.com",
  gateway: "Stripe",
  locale: "pt-BR",
  notifyEmail: true,
  payoutPix: "***.***.***-01",
  aiCreditsUsed: 45,
  aiCreditsLimit: 100,
};

type MockHudWidget = {
  id: string;
  type: string;
  title: string;
  description: string;
  enabled: boolean;
  durationSec: number;
  animation: string;
  minAmount: number;
  soundOn: boolean;
  badge?: string;
};

/** Fan-facing creator hub URL (mock — mirrors Settings domain). */
function creatorHubPageUrl(domain: string) {
  const d = domain.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return `https://${d}`;
}

/** Widget types offered in the “Create widget” sheet (superset of starter catalog). */
type WidgetCreateOption = {
  type: string;
  title: string;
  description: string;
  badge?: string;
};

const WIDGET_CREATE_OPTIONS: WidgetCreateOption[] = [
  {
    type: "donation_alert",
    title: "Donation alert",
    description:
      "Full-screen or corner toast when fans donate through your Hub.",
  },
  {
    type: "sale_alert",
    title: "Digital sale alert",
    description: "Highlight new digital product purchases on the overlay.",
  },
  {
    type: "goal_bar",
    title: "Goal bar",
    description: "Progress toward a tip or sales goal on the HUD.",
    badge: "Soon",
  },
  {
    type: "media_queue",
    title: "Media queue",
    description: "Approve fan clips before they air on stream.",
    badge: "Soon",
  },
  {
    type: "recent_events",
    title: "Recent events ticker",
    description: "Subtle scrolling feed of last tips, sales, and Quest pings.",
    badge: "Soon",
  },
  {
    type: "chat_overlay",
    title: "Chat highlight",
    description: "Pin highlighted chat lines or Copilot summaries on the HUD.",
    badge: "Soon",
  },
];

function newWidgetFromCreateOption(opt: WidgetCreateOption): MockHudWidget {
  const soon = Boolean(opt.badge);
  return {
    id: `w-${opt.type}-${Date.now()}`,
    type: opt.type,
    title: opt.title,
    description: opt.description,
    enabled: !soon,
    durationSec:
      opt.type === "goal_bar" ||
      opt.type === "media_queue" ||
      opt.type === "recent_events" ||
      opt.type === "chat_overlay"
        ? 0
        : opt.type === "sale_alert"
          ? 10
          : 8,
    animation:
      opt.type === "sale_alert"
        ? "slide"
        : opt.type === "donation_alert"
          ? "bounce"
          : "fade",
    minAmount: opt.type === "goal_bar" ? 5 : 0,
    soundOn:
      !soon &&
      opt.type !== "goal_bar" &&
      opt.type !== "recent_events" &&
      opt.type !== "chat_overlay",
    ...(opt.badge ? { badge: opt.badge } : {}),
  };
}

const INITIAL_MOCK_WIDGETS: MockHudWidget[] = [
  {
    id: "w-donation",
    type: "donation_alert",
    title: "Donation alert",
    description:
      "Shows when fans donate through your Hub — appears on stream via Browser Source.",
    enabled: true,
    durationSec: 8,
    animation: "bounce",
    minAmount: 0,
    soundOn: true,
  },
  {
    id: "w-sale",
    type: "sale_alert",
    title: "Digital sale alert",
    description: "Highlights new digital product purchases on your overlay.",
    enabled: true,
    durationSec: 10,
    animation: "slide",
    minAmount: 0,
    soundOn: true,
  },
  {
    id: "w-goal",
    type: "goal_bar",
    title: "Goal bar",
    description: "Progress bar toward a tip or sales goal on HUD.",
    enabled: false,
    durationSec: 0,
    animation: "fade",
    minAmount: 5,
    soundOn: false,
    badge: "Soon",
  },
  {
    id: "w-media",
    type: "media_queue",
    title: "Media queue",
    description: "Approve fan-submitted clips for the overlay queue.",
    enabled: false,
    durationSec: 0,
    animation: "fade",
    minAmount: 0,
    soundOn: false,
    badge: "Soon",
  },
];

export type MockIntegrationStatus = "connected" | "failed";

/** OAuth vs API-key style setup shown in the manage dialog accordion. */
export type MockIntegrationCredentialsKind = "oauth" | "api_key";

export type MockIntegration = {
  id: string;
  name: string;
  status: MockIntegrationStatus;
  /** Account tail, error message, or next step — shown in the list */
  detail?: string;
  credentialsKind: MockIntegrationCredentialsKind;
};

const INITIAL_MOCK_INTEGRATIONS: MockIntegration[] = [
  {
    id: "twitch",
    name: "Twitch",
    status: "connected",
    detail: "Signed in as @alex_streams",
    credentialsKind: "oauth",
  },
  {
    id: "google",
    name: "Google",
    status: "connected",
    detail: "alex.creator@gmail.com",
    credentialsKind: "oauth",
  },
  {
    id: "discord",
    name: "Discord",
    status: "failed",
    detail: "Token expired — reconnect in Manage integrations (mock).",
    credentialsKind: "oauth",
  },
  {
    id: "youtube",
    name: "YouTube",
    status: "failed",
    detail: "Channel not linked — connect with Google (mock).",
    credentialsKind: "oauth",
  },
  {
    id: "instagram",
    name: "Instagram",
    status: "failed",
    detail: "Meta Business login required (mock).",
    credentialsKind: "oauth",
  },
  {
    id: "tiktok",
    name: "TikTok",
    status: "failed",
    detail: "Creator account OAuth pending (mock).",
    credentialsKind: "oauth",
  },
  {
    id: "x",
    name: "X (Twitter)",
    status: "failed",
    detail: "Not connected (mock).",
    credentialsKind: "oauth",
  },
  {
    id: "streamlabs",
    name: "Streamlabs",
    status: "failed",
    detail: "Socket token missing (mock).",
    credentialsKind: "oauth",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    status: "failed",
    detail: "API credentials not set (mock).",
    credentialsKind: "api_key",
  },
  {
    id: "telegram",
    name: "Telegram",
    status: "failed",
    detail: "Bot token not set (mock).",
    credentialsKind: "api_key",
  },
  {
    id: "shopee",
    name: "Shopee affiliate API",
    status: "failed",
    detail: "Partner key not set (mock).",
    credentialsKind: "api_key",
  },
  {
    id: "amazon",
    name: "Amazon Associates",
    status: "failed",
    detail: "Tracking ID not set (mock).",
    credentialsKind: "api_key",
  },
  {
    id: "shopify",
    name: "Shopify",
    status: "failed",
    detail: "API access token not set (mock).",
    credentialsKind: "api_key",
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    status: "failed",
    detail: "Consumer key/secret not set (mock).",
    credentialsKind: "api_key",
  },
  {
    id: "mercadolivre",
    name: "Mercado Livre",
    status: "failed",
    detail: "Access token not set (mock).",
    credentialsKind: "oauth",
  },
  {
    id: "adobecommerce",
    name: "Adobe Commerce (Magento)",
    status: "failed",
    detail: "Integration key not set (mock).",
    credentialsKind: "api_key",
  },
  {
    id: "wixstore",
    name: "Wix Store",
    status: "failed",
    detail: "API token not set (mock).",
    credentialsKind: "oauth",
  },
];

type TabId = "hub" | "wallet" | "quests" | "widgets" | "settings";

/** One fan-facing hub tab; id is stable, label is creator-editable. */
type HubPageDef = { id: string; label: string };

const DEFAULT_HUB_PAGES: HubPageDef[] = [
  { id: "home", label: "Home" },
  { id: "shop", label: "Shop" },
  { id: "links", label: "Links" },
];

/** Creators pick one hub surface: one page, or multiple tabbed pages (each with its own layout). */
type HubPageStructureMode = "single" | "multi";

const INITIAL_HUB_BLOCKS_BY_PAGE: Record<string, HubBlock[]> = {
  home: [
    {
      id: "b2",
      type: "product",
      title: "Editing Presets",
      price: 49.0,
      image:
        "https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=400&q=80",
      desc: "1-click transformation.",
    },
    {
      id: "b3",
      type: "interactive_donation",
      title: "Send a Live Message",
    },
    { id: "b4", type: "fan_board", title: "Live Supporter Board" },
  ],
  shop: [
    {
      id: "s1",
      type: "product",
      title: "Preset Pack Vol. 2",
      price: 29.0,
      image:
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80",
      desc: "New looks for your edits.",
    },
  ],
  links: [
    {
      id: "l1",
      type: "product",
      title: "Watch on YouTube",
      price: 0,
      image:
        "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400&q=80",
      desc: "Latest streams & tutorials.",
    },
  ],
};

function newHubPageId(): string {
  return `hub-page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Pro & Business: marketplace + e-commerce catalog blocks; Free/Starter see gated CTAs. */
function planHasPaidHubBlocks(plan: string): boolean {
  const p = plan.trim().toLowerCase();
  return p !== "free" && p !== "starter";
}

type AddBlockTemplateId =
  | "digital_product"
  | "interactive_donation"
  | "fan_board"
  | "link"
  | "coupon"
  | "song"
  | "marketplace_grid"
  | "ecommerce_sync";

function hubBlockFromTemplate(template: AddBlockTemplateId): HubBlock {
  const id = `block-${Date.now()}`;
  switch (template) {
    case "digital_product":
      return {
        id,
        type: "product",
        title: "New digital product",
        price: 19,
        image:
          "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80",
        desc: "Describe what fans get when they purchase.",
      };
    case "interactive_donation":
      return {
        id,
        type: "interactive_donation",
        title: "Send a Live Message",
      };
    case "fan_board":
      return {
        id,
        type: "fan_board",
        title: "Live Supporter Board",
      };
    case "link":
      return {
        id,
        type: "link_block",
        title: "New link",
        url: "https://",
        subtitle: "Tap to edit label and URL",
      };
    case "coupon":
      return {
        id,
        type: "coupon_block",
        title: "Partner offer",
        code: "PUBLIHUB20",
        discountLabel: "20% off",
      };
    case "song":
      return {
        id,
        type: "song_block",
        title: "Track title",
        artist: "Artist name",
        platform: "Spotify",
      };
    case "marketplace_grid":
      return {
        id,
        type: "marketplace_grid",
        title: "Marketplace showcase",
        channels: ["Shopee", "Amazon", "Mercado Livre"],
      };
    case "ecommerce_sync":
      return {
        id,
        type: "ecommerce_embed",
        title: "Synced store catalog",
        platform: "Shopify",
        syncedCount: 12,
      };
    default: {
      const _exhaustive: never = template;
      return _exhaustive;
    }
  }
}

const HUB_LAYOUT_OPTIONS: {
  id: HubPageLayoutId;
  title: string;
  description: string;
}[] = [
  {
    id: "classic",
    title: "Classic stack",
    description: "Single column, balanced for any creator.",
  },
  {
    id: "magazine",
    title: "Magazine grid",
    description: "Two-column grid for products and media.",
  },
  {
    id: "minimal",
    title: "Minimal",
    description: "Tight spacing, typography-first.",
  },
  {
    id: "hero",
    title: "Hero focus",
    description: "Banner strip plus profile — great for launches.",
  },
  {
    id: "storefront",
    title: "Storefront",
    description: "Product-forward grid with bold CTAs.",
  },
  {
    id: "stream",
    title: "Stream first",
    description: "Donations & board up top for live moments.",
  },
];

const HubLayoutPreviewArt = memo(function HubLayoutPreviewArt({
  layoutId,
}: {
  layoutId: HubPageLayoutId;
}) {
  const shell =
    "flex h-full w-full flex-col bg-gradient-to-b from-slate-800 to-[#0a0a0a] p-[8%]";
  const card = "rounded-md bg-white/15";

  const avatar = (
    <>
      <div className="mx-auto mb-2 h-[10%] w-[22%] rounded-full bg-white/25" />
      <div className="mx-auto mb-3 h-[3%] w-[55%] rounded-full bg-white/15" />
    </>
  );

  switch (layoutId) {
    case "hero":
      return (
        <div className={shell}>
          <div className="mb-2 h-[12%] w-full rounded-sm bg-indigo-500/35" />
          {avatar}
          <div className="mt-1 flex flex-1 flex-col gap-2">
            <div className={`h-[22%] w-full ${card}`} />
            <div className={`flex-1 ${card}`} />
          </div>
        </div>
      );
    case "minimal":
      return (
        <div className={shell}>
          {avatar}
          <div className="flex flex-1 flex-col gap-1.5">
            <div className={`h-[15%] w-full ${card}`} />
            <div className={`h-[15%] w-full ${card}`} />
            <div className={`h-[15%] w-full ${card}`} />
          </div>
        </div>
      );
    case "magazine":
    case "storefront":
      return (
        <div className={shell}>
          {avatar}
          <div className="grid flex-1 grid-cols-2 gap-2">
            <div className={`min-h-[26%] ${card}`} />
            <div className={`min-h-[26%] ${card}`} />
            <div className={`col-span-2 min-h-[22%] ${card}`} />
            <div className={`min-h-[24%] ${card}`} />
            <div className={`min-h-[24%] ${card}`} />
          </div>
        </div>
      );
    case "stream":
      return (
        <div className={shell}>
          {avatar}
          <div className="flex flex-1 flex-col gap-2">
            <div className={`h-[18%] w-full ${card} bg-amber-500/25`} />
            <div className={`h-[22%] w-full ${card} bg-indigo-500/25`} />
            <div className={`flex-1 ${card}`} />
          </div>
        </div>
      );
    default:
      return (
        <div className={shell}>
          {avatar}
          <div className="flex flex-1 flex-col gap-2">
            <div className={`h-[24%] w-full ${card}`} />
            <div className={`h-[20%] w-full ${card}`} />
            <div className={`flex-1 ${card}`} />
          </div>
        </div>
      );
  }
});

function hubBlocksContainerClass(layoutId: HubPageLayoutId): string {
  switch (layoutId) {
    case "magazine":
    case "storefront":
      return "grid grid-cols-2 gap-3";
    case "minimal":
      return "flex flex-col gap-2";
    case "stream":
      return "flex flex-col gap-3";
    default:
      return "flex flex-col gap-4";
  }
}

function hubBlockSpanClass(
  layoutId: HubPageLayoutId,
  blockType: HubBlock["type"]
): string {
  if (layoutId === "magazine" || layoutId === "storefront") {
    if (
      blockType === "interactive_donation" ||
      blockType === "fan_board" ||
      blockType === "marketplace_grid" ||
      blockType === "ecommerce_embed"
    ) {
      return "col-span-2";
    }
  }
  return "";
}

function hubBlockPaddingClass(layoutId: HubPageLayoutId): string {
  return layoutId === "minimal" ? "p-3" : "p-4";
}

function HubLayoutCarousel({
  activeIndex,
  onSelect,
  className,
  hideHeading,
}: {
  activeIndex: number;
  onSelect: (index: number) => void;
  className?: string;
  hideHeading?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [vw, setVw] = useState(0);

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const applyWidth = (raw: number) => {
      const w = Math.round(raw * 100) / 100;
      setVw((prev) => {
        if (w <= 0) return prev;
        if (prev > 0 && Math.abs(prev - w) < 0.75) return prev;
        return w;
      });
    };

    applyWidth(el.getBoundingClientRect().width);

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect.width;
      if (cr != null) applyWidth(cr);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = HUB_LAYOUT_OPTIONS.length;
  const translateX = vw > 0 ? (vw * (1 - activeIndex)) / 3 : 0;

  const step = (dir: -1 | 1) => {
    onSelect(Math.min(n - 1, Math.max(0, activeIndex + dir)));
  };

  const pick = useCallback(
    (i: number) => {
      onSelect(i);
    },
    [onSelect]
  );

  return (
    <div className={`relative mx-auto w-full max-w-7xl px-2 ${className ?? ""}`}>
      {!hideHeading && (
        <p className="mb-3 text-center text-xs font-black uppercase tracking-widest text-slate-400">
          Page layout
        </p>
      )}
      <div className="relative">
        <div
          ref={viewportRef}
          className="overflow-hidden py-2 [contain:layout]"
        >
          <div
            className="flex transition-[transform] duration-500 ease-out"
            style={{
              width: vw > 0 ? `${(vw / 3) * n}px` : undefined,
              transform:
                vw > 0 ? `translate3d(${translateX}px, 0, 0)` : undefined,
              willChange: "transform",
            }}
          >
            {HUB_LAYOUT_OPTIONS.map((layout, i) => {
              const isActive = i === activeIndex;
              return (
                <div
                  key={layout.id}
                  className="relative flex shrink-0 justify-center px-4"
                  style={{
                    width: vw > 0 ? `${vw / 3}px` : `${100 / 3}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => pick(i)}
                    className="mx-auto block w-full max-w-[280px] text-left"
                    aria-label={`Select ${layout.title}`}
                  >
                    <div
                      className="duration-500 ease-out [backface-visibility:hidden] [transform:translateZ(0)] transition-[transform,opacity]"
                      style={{
                        transform: isActive
                          ? "scale(1) translateZ(0)"
                          : "scale(0.85) translateZ(0)",
                        opacity: isActive ? 1 : 0.45,
                      }}
                    >
                      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0F0F0F] shadow-lg">
                        <div className="relative aspect-[384/840] w-full overflow-hidden">
                          <HubLayoutPreviewArt layoutId={layout.id} />
                        </div>
                      </div>
                      <p className="mt-3 text-center text-sm font-bold text-slate-800">
                        {layout.title}
                      </p>
                      <p className="mt-0.5 px-1 text-center text-[10px] font-medium leading-snug text-slate-500">
                        {layout.description}
                      </p>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          aria-label="Previous layout"
          onClick={() => step(-1)}
          disabled={activeIndex <= 0}
          className="absolute left-0 top-[42%] z-10 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white/95 p-3 shadow-md backdrop-blur-sm transition-all hover:border-pink-400/50 hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-6 w-6 text-slate-800" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Next layout"
          onClick={() => step(1)}
          disabled={activeIndex >= n - 1}
          className="absolute right-0 top-[42%] z-10 -translate-y-1/2 rounded-full border border-slate-200/80 bg-white/95 p-3 shadow-md backdrop-blur-sm transition-all hover:border-pink-400/50 hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-6 w-6 text-slate-800" aria-hidden />
        </button>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2 sm:gap-3">
        {HUB_LAYOUT_OPTIONS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to layout ${i + 1}`}
            onClick={() => onSelect(i)}
            className={`rounded-full transition-[width,background-color] duration-300 ${
              i === activeIndex
                ? "h-2.5 w-8 bg-gradient-to-r from-pink-500 to-pink-600"
                : "h-2.5 w-2.5 bg-slate-300 hover:bg-slate-400"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function HubStructureModeToggle({
  mode,
  onChange,
  idPrefix,
}: {
  mode: HubPageStructureMode;
  onChange: (mode: HubPageStructureMode) => void;
  idPrefix: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Hub page structure"
      className="flex w-full gap-1 px-4 pb-3"
    >
      {(
        [
          { id: "single" as const, label: "Single page" },
          { id: "multi" as const, label: "Multi-tab" },
        ] as const
      ).map((opt) => {
        const on = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={on}
            id={`${idPrefix}-structure-${opt.id}`}
            onClick={() => onChange(opt.id)}
            className={`flex-1 rounded-xl border py-2.5 text-center text-[11px] font-black transition-colors ${
              on
                ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function HubLayoutPageTabsEditor({
  pages,
  activePageId,
  onSelectPage,
  onUpdatePageLabel,
  onAddPage,
  onDeletePage,
  idPrefix,
}: {
  pages: HubPageDef[];
  activePageId: string;
  onSelectPage: (id: string) => void;
  onUpdatePageLabel: (id: string, label: string) => void;
  onAddPage: () => void;
  onDeletePage: (id: string) => void;
  idPrefix: string;
}) {
  const [editTabPanelOpen, setEditTabPanelOpen] = useState(false);
  const selected = pages.find((p) => p.id === activePageId);
  const canDelete = pages.length > 1;
  const editPanelId = `${idPrefix}-tab-edit-panel`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 px-4">
        <div
          role="tablist"
          aria-label="Hub pages"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {pages.map((p) => {
            const isSelected = p.id === activePageId;
            const editOpenForTab = editTabPanelOpen && isSelected;
            return (
              <div key={p.id} className="relative shrink-0 max-w-[148px]">
                <button
                  type="button"
                  role="tab"
                  id={`${idPrefix}-tab-${p.id}`}
                  aria-selected={isSelected}
                  aria-controls={`${idPrefix}-panel-layout`}
                  tabIndex={isSelected ? 0 : -1}
                  onClick={() => onSelectPage(p.id)}
                  className={`w-full truncate rounded-full py-1.5 pl-3 pr-7 text-left text-[11px] font-black transition-colors ${
                    isSelected
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p.label.trim() || "Untitled"}
                </button>
                <button
                  type="button"
                  aria-label={`Edit tab: ${p.label.trim() || "Untitled"}`}
                  aria-expanded={editOpenForTab}
                  aria-controls={editPanelId}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isSelected && editTabPanelOpen) {
                      setEditTabPanelOpen(false);
                    } else {
                      onSelectPage(p.id);
                      setEditTabPanelOpen(true);
                    }
                  }}
                  className={`absolute right-0.5 top-0.5 z-[1] flex h-5 w-5 items-center justify-center rounded-full transition-colors ${
                    isSelected
                      ? "text-white/75 hover:bg-white/15 hover:text-white"
                      : "text-slate-400 hover:bg-slate-200/90 hover:text-slate-800"
                  }`}
                >
                  <Pencil size={11} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onAddPage}
          aria-label="Add new tab"
          className="flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-700 shadow-sm transition-colors hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      {editTabPanelOpen ? (
        <div
          id={editPanelId}
          role="region"
          aria-label="Rename or delete the selected tab"
          className="flex flex-col gap-2 border-t border-slate-100 px-4 pb-3 pt-2"
        >
          <label
            className="text-[10px] font-bold uppercase tracking-wide text-slate-400"
            htmlFor={`${idPrefix}-tab-title-input`}
          >
            Tab title
          </label>
          <input
            id={`${idPrefix}-tab-title-input`}
            type="text"
            value={selected?.label ?? ""}
            onChange={(e) =>
              selected && onUpdatePageLabel(selected.id, e.target.value)
            }
            disabled={!selected}
            maxLength={40}
            placeholder="Tab name"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none ring-pink-400/30 placeholder:font-medium placeholder:text-slate-400 focus:border-pink-300 focus:ring-2 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => selected && onDeletePage(selected.id)}
            disabled={!canDelete || !selected}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2 text-[11px] font-black text-red-600 transition-colors hover:border-red-200 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 size={14} aria-hidden />
            Delete tab
          </button>
        </div>
      ) : null}
    </div>
  );
}

function HubLayoutPickerOverlay({
  open,
  onClose,
  committedByPage,
  committedPages,
  committedStructureMode,
  onCommit,
  initialPageId,
}: {
  open: boolean;
  onClose: () => void;
  committedByPage: Record<string, number>;
  committedPages: HubPageDef[];
  committedStructureMode: HubPageStructureMode;
  onCommit: (next: {
    pages: HubPageDef[];
    layouts: Record<string, number>;
    structureMode: HubPageStructureMode;
  }) => void;
  initialPageId: string;
}) {
  const [draftByPage, setDraftByPage] =
    useState<Record<string, number>>(committedByPage);
  const [draftPages, setDraftPages] = useState<HubPageDef[]>(committedPages);
  const [draftStructureMode, setDraftStructureMode] =
    useState<HubPageStructureMode>(committedStructureMode);
  const [sheetPage, setSheetPage] = useState<string>(initialPageId);

  const draftByPageRef = useRef(draftByPage);
  draftByPageRef.current = draftByPage;
  const draftPagesRef = useRef(draftPages);
  draftPagesRef.current = draftPages;
  const draftStructureRef = useRef(draftStructureMode);
  draftStructureRef.current = draftStructureMode;

  const primaryDraftPageId = draftPages[0]?.id ?? "";

  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setDraftByPage({ ...committedByPage });
      setDraftPages(committedPages.map((p) => ({ ...p })));
      setDraftStructureMode(committedStructureMode);
      const firstId = committedPages[0]?.id ?? initialPageId;
      const pick =
        committedStructureMode === "single"
          ? firstId
          : committedPages.some((p) => p.id === initialPageId)
            ? initialPageId
            : firstId;
      setSheetPage(pick);
    }
    prevOpen.current = open;
  }, [
    open,
    committedByPage,
    committedPages,
    committedStructureMode,
    initialPageId,
  ]);

  const layoutTargetPage =
    draftStructureMode === "single" ? primaryDraftPageId : sheetPage;

  const draftIndex = draftByPage[layoutTargetPage] ?? 0;
  const setDraftIndex = useCallback(
    (i: number) => {
      setDraftByPage((prev) => ({ ...prev, [layoutTargetPage]: i }));
    },
    [layoutTargetPage]
  );

  const updateDraftPageLabel = useCallback((id: string, label: string) => {
    setDraftPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, label } : p))
    );
  }, []);

  const addDraftPage = useCallback(() => {
    const id = newHubPageId();
    setDraftPages((prev) => [...prev, { id, label: "New tab" }]);
    setDraftByPage((prev) => ({ ...prev, [id]: 0 }));
    setSheetPage(id);
  }, []);

  const deleteDraftPage = useCallback((id: string) => {
    setDraftPages((prevPages) => {
      if (prevPages.length <= 1) return prevPages;
      const nextPages = prevPages.filter((p) => p.id !== id);
      setSheetPage((cur) => (cur === id ? nextPages[0]!.id : cur));
      return nextPages;
    });
    setDraftByPage((prev) => {
      if (!(id in prev) || Object.keys(prev).length <= 1) return prev;
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const flushCommit = useCallback(() => {
    onCommit({
      pages: draftPagesRef.current,
      layouts: draftByPageRef.current,
      structureMode: draftStructureRef.current,
    });
  }, [onCommit]);

  const handleClose = useCallback(() => {
    flushCommit();
    onClose();
  }, [flushCommit, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        flushCommit();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, flushCommit]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Mobile bottom sheet */}
      <div
        className="fixed inset-0 z-[70] md:hidden"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          aria-label="Close layout picker"
          onClick={handleClose}
        />
        <div
          className="absolute bottom-0 left-0 right-0 flex max-h-[min(92vh,900px)] flex-col rounded-t-[2rem] bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.15)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="hub-layout-sheet-title"
        >
          <div className="flex shrink-0 flex-col border-b border-slate-100 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between px-4 pb-2">
              <h2
                id="hub-layout-sheet-title"
                className="text-sm font-black text-slate-900"
              >
                Page layout
              </h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <HubStructureModeToggle
              idPrefix="hub-layout-sheet"
              mode={draftStructureMode}
              onChange={setDraftStructureMode}
            />
            <p className="px-4 pb-2 text-[10px] font-medium leading-snug text-slate-500">
              {draftStructureMode === "single"
                ? "One page for your hub. Layout applies to that page."
                : "Fans see tabs; pick a tab below to set its layout."}
            </p>
            {draftStructureMode === "multi" ? (
              <HubLayoutPageTabsEditor
                idPrefix="hub-layout-sheet"
                pages={draftPages}
                activePageId={sheetPage}
                onSelectPage={setSheetPage}
                onUpdatePageLabel={updateDraftPageLabel}
                onAddPage={addDraftPage}
                onDeletePage={deleteDraftPage}
              />
            ) : null}
          </div>
          <div
            id="hub-layout-sheet-panel-layout"
            role="tabpanel"
            aria-labelledby={
              draftStructureMode === "multi"
                ? `hub-layout-sheet-tab-${sheetPage}`
                : "hub-layout-sheet-title"
            }
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-4"
          >
            <HubLayoutCarousel
              activeIndex={draftIndex}
              onSelect={setDraftIndex}
              className="!max-w-full"
              hideHeading
            />
          </div>
        </div>
      </div>

      {/* Desktop modal: explicit z-stacking + full-viewport scrim (button resets avoid layout/UA quirks) */}
      <div
        className="fixed inset-0 z-[70] hidden md:block"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 z-0 m-0 box-border block h-full w-full cursor-pointer appearance-none border-0 bg-slate-950/55 p-0 backdrop-blur-md outline-none transition-[background-color] duration-200 hover:bg-slate-950/65 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-0"
          aria-label="Close layout picker"
          onClick={handleClose}
        />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div
            className="pointer-events-auto flex max-h-[min(90vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="hub-layout-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 flex-col border-b border-slate-100">
              <div className="flex items-center justify-between px-5 py-4">
                <h2
                  id="hub-layout-modal-title"
                  className="text-base font-black text-slate-900"
                >
                  Page layout
                </h2>
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              </div>
              <HubStructureModeToggle
                idPrefix="hub-layout-modal"
                mode={draftStructureMode}
                onChange={setDraftStructureMode}
              />
              <p className="px-5 pb-2 text-[10px] font-medium leading-snug text-slate-500">
                {draftStructureMode === "single"
                  ? "One page for your hub. Layout applies to that page."
                  : "Fans see tabs; pick a tab below to set its layout."}
              </p>
              {draftStructureMode === "multi" ? (
                <HubLayoutPageTabsEditor
                  idPrefix="hub-layout-modal"
                  pages={draftPages}
                  activePageId={sheetPage}
                  onSelectPage={setSheetPage}
                  onUpdatePageLabel={updateDraftPageLabel}
                  onAddPage={addDraftPage}
                  onDeletePage={deleteDraftPage}
                />
              ) : null}
            </div>
            <div
              id="hub-layout-modal-panel-layout"
              role="tabpanel"
              aria-labelledby={
                draftStructureMode === "multi"
                  ? `hub-layout-modal-tab-${sheetPage}`
                  : "hub-layout-modal-title"
              }
              className="min-h-0 flex-1 overflow-y-auto p-4"
            >
              <HubLayoutCarousel
                activeIndex={draftIndex}
                onSelect={setDraftIndex}
                hideHeading
              />
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function AddBlockPickerOverlay({
  open,
  onClose,
  hasPaidPlan,
  onPickTemplate,
  onBuildWithCopilot,
  onUpgradeRequest,
}: {
  open: boolean;
  onClose: () => void;
  hasPaidPlan: boolean;
  onPickTemplate: (id: AddBlockTemplateId) => void;
  onBuildWithCopilot: () => void;
  onUpgradeRequest: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const freeTemplates: {
    id: AddBlockTemplateId;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "digital_product",
      title: "Digital product",
      description: "Sell presets, files, or tickets from your hub.",
      icon: <ShoppingBag size={18} className="text-indigo-600" aria-hidden />,
    },
    {
      id: "interactive_donation",
      title: "Interactive donation",
      description: "Text, AI voice, or video super-chat style tips.",
      icon: <Zap size={18} className="text-amber-500" aria-hidden />,
    },
    {
      id: "fan_board",
      title: "Live fan board",
      description: "Surface paid supporter messages on the page.",
      icon: <Volume2 size={18} className="text-indigo-600" aria-hidden />,
    },
    {
      id: "link",
      title: "Link",
      description: "Outbound link with title — socials, site, or affiliate.",
      icon: <Link2 size={18} className="text-sky-600" aria-hidden />,
    },
    {
      id: "coupon",
      title: "Coupon",
      description: "Promo or partner code fans can copy at checkout.",
      icon: <TicketPercent size={18} className="text-rose-600" aria-hidden />,
    },
    {
      id: "song",
      title: "Song",
      description: "Highlight a track — streaming deep link or Now playing.",
      icon: <Music size={18} className="text-fuchsia-600" aria-hidden />,
    },
  ];

  const paidTemplates: {
    id: AddBlockTemplateId;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: "marketplace_grid",
      title: "Marketplace grid",
      description:
        "Pull affiliate SKUs from Shopee, Amazon, Mercado Livre, and more.",
      icon: <LayoutGrid size={18} className="text-violet-600" aria-hidden />,
    },
    {
      id: "ecommerce_sync",
      title: "Store catalog sync",
      description:
        "Connect Shopify, WooCommerce, or Nuvemshop — live inventory on your hub.",
      icon: <Store size={18} className="text-emerald-600" aria-hidden />,
    },
  ];

  const templateCard = (
    t: (typeof freeTemplates)[0],
    opts: { locked: boolean }
  ) => {
    const blocked = opts.locked && !hasPaidPlan;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => {
          if (blocked) onUpgradeRequest();
          else onPickTemplate(t.id);
        }}
        className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition-colors ${
          blocked
            ? "border-slate-200 bg-slate-50/80 hover:border-amber-200 hover:bg-amber-50/50"
            : "border-slate-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40"
        }`}
      >
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            blocked ? "bg-slate-200/80" : "bg-slate-100"
          }`}
        >
          {t.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-900">{t.title}</span>
            {opts.locked ? (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-800">
                <Crown size={10} aria-hidden />
                Pro
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-500">
            {t.description}
          </p>
        </div>
        {blocked ? (
          <Lock
            size={16}
            className="mt-1 shrink-0 text-amber-600/90"
            aria-hidden
          />
        ) : null}
      </button>
    );
  };

  const panelInner = (
    <>
      <p className="mb-3 text-[11px] font-medium leading-snug text-slate-500">
        Start from a template, or describe a custom block — Copilot can generate
        layout and copy (AG-UI).
      </p>

      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
        Included
      </p>
      <div className="flex flex-col gap-2">{freeTemplates.map((t) => templateCard(t, { locked: false }))}</div>

      <p className="mb-2 mt-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
        Pro &amp; Business
      </p>
      <div className="flex flex-col gap-2">
        {paidTemplates.map((t) => templateCard(t, { locked: true }))}
      </div>

      <button
        type="button"
        onClick={onBuildWithCopilot}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 py-3.5 text-sm font-black text-indigo-700 transition-colors hover:bg-indigo-100/80"
      >
        <Sparkles size={18} className="text-indigo-500" aria-hidden />
        Build with Copilot
      </button>
    </>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[70] md:hidden" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          aria-label="Close add block picker"
          onClick={onClose}
        />
        <div
          className="absolute bottom-0 left-0 right-0 flex max-h-[min(88vh,820px)] flex-col rounded-t-[2rem] bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.15)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-block-sheet-title"
        >
          <div className="flex shrink-0 flex-col border-b border-slate-100 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between px-4 pb-3">
              <h2
                id="add-block-sheet-title"
                className="text-sm font-black text-slate-900"
              >
                Add block
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
            {panelInner}
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-[70] hidden md:block" role="presentation">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default bg-slate-900/50 backdrop-blur-[2px]"
          aria-label="Close add block picker"
          onClick={onClose}
        />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div
            className="pointer-events-auto flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-block-modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2
                id="add-block-modal-title"
                className="text-base font-black text-slate-900"
              >
                Add block
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {panelInner}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function blockToDraft(block: HubBlock): Record<string, string> {
  switch (block.type) {
    case "product":
      return {
        title: block.title,
        desc: block.desc,
        price: String(block.price),
        image: block.image,
      };
    case "interactive_donation":
    case "fan_board":
      return { title: block.title };
    case "marketplace_grid":
      return { title: block.title, channels: block.channels.join(", ") };
    case "ecommerce_embed":
      return {
        title: block.title,
        platform: block.platform,
        syncedCount: String(block.syncedCount),
      };
    case "link_block":
      return {
        title: block.title,
        subtitle: block.subtitle,
        url: block.url,
      };
    case "coupon_block":
      return {
        title: block.title,
        code: block.code,
        discountLabel: block.discountLabel,
      };
    case "song_block":
      return {
        title: block.title,
        artist: block.artist,
        platform: block.platform,
      };
  }
}

function applyDraftToBlock(
  original: HubBlock,
  d: Record<string, string>
): HubBlock {
  switch (original.type) {
    case "product":
      return {
        ...original,
        title: d.title ?? original.title,
        desc: d.desc ?? original.desc,
        price: Number.parseFloat(d.price ?? "") || 0,
        image: d.image ?? original.image,
      };
    case "interactive_donation":
    case "fan_board":
      return { ...original, title: d.title ?? original.title };
    case "marketplace_grid":
      return {
        ...original,
        title: d.title ?? original.title,
        channels: (d.channels ?? "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    case "ecommerce_embed":
      return {
        ...original,
        title: d.title ?? original.title,
        platform: d.platform ?? original.platform,
        syncedCount:
          Number.parseInt(d.syncedCount ?? "", 10) || original.syncedCount,
      };
    case "link_block":
      return {
        ...original,
        title: d.title ?? original.title,
        subtitle: d.subtitle ?? original.subtitle,
        url: d.url ?? original.url,
      };
    case "coupon_block":
      return {
        ...original,
        title: d.title ?? original.title,
        code: d.code ?? original.code,
        discountLabel: d.discountLabel ?? original.discountLabel,
      };
    case "song_block":
      return {
        ...original,
        title: d.title ?? original.title,
        artist: d.artist ?? original.artist,
        platform: d.platform ?? original.platform,
      };
  }
}

function HubBlockEditFields({
  block,
  draft,
  setDraft,
}: {
  block: HubBlock;
  draft: Record<string, string>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-indigo-300";
  const labelClass =
    "mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-400";

  const setKey = (key: string, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  switch (block.type) {
    case "product":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Title</label>
            <input
              className={fieldClass}
              value={draft.title ?? ""}
              onChange={(e) => setKey("title", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              rows={3}
              className={`${fieldClass} resize-none font-medium`}
              value={draft.desc ?? ""}
              onChange={(e) => setKey("desc", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Price (R$)</label>
            <input
              type="number"
              step="0.01"
              className={fieldClass}
              value={draft.price ?? ""}
              onChange={(e) => setKey("price", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Image URL</label>
            <input
              className={`${fieldClass} font-mono text-xs font-medium`}
              value={draft.image ?? ""}
              onChange={(e) => setKey("image", e.target.value)}
            />
          </div>
        </div>
      );
    case "interactive_donation":
    case "fan_board":
      return (
        <div>
          <label className={labelClass}>Title</label>
          <input
            className={fieldClass}
            value={draft.title ?? ""}
            onChange={(e) => setKey("title", e.target.value)}
          />
        </div>
      );
    case "marketplace_grid":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Title</label>
            <input
              className={fieldClass}
              value={draft.title ?? ""}
              onChange={(e) => setKey("title", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Channels (comma-separated)</label>
            <input
              className={fieldClass}
              value={draft.channels ?? ""}
              onChange={(e) => setKey("channels", e.target.value)}
              placeholder="Shopee, Amazon"
            />
          </div>
        </div>
      );
    case "ecommerce_embed":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Title</label>
            <input
              className={fieldClass}
              value={draft.title ?? ""}
              onChange={(e) => setKey("title", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Platform</label>
            <input
              className={fieldClass}
              value={draft.platform ?? ""}
              onChange={(e) => setKey("platform", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Synced product count</label>
            <input
              type="number"
              className={fieldClass}
              value={draft.syncedCount ?? ""}
              onChange={(e) => setKey("syncedCount", e.target.value)}
            />
          </div>
        </div>
      );
    case "link_block":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Title</label>
            <input
              className={fieldClass}
              value={draft.title ?? ""}
              onChange={(e) => setKey("title", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Subtitle</label>
            <input
              className={fieldClass}
              value={draft.subtitle ?? ""}
              onChange={(e) => setKey("subtitle", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>URL</label>
            <input
              className={`${fieldClass} font-mono text-xs font-medium`}
              value={draft.url ?? ""}
              onChange={(e) => setKey("url", e.target.value)}
            />
          </div>
        </div>
      );
    case "coupon_block":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Title</label>
            <input
              className={fieldClass}
              value={draft.title ?? ""}
              onChange={(e) => setKey("title", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Code</label>
            <input
              className={`${fieldClass} font-mono tracking-widest`}
              value={draft.code ?? ""}
              onChange={(e) => setKey("code", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Discount label</label>
            <input
              className={fieldClass}
              value={draft.discountLabel ?? ""}
              onChange={(e) => setKey("discountLabel", e.target.value)}
            />
          </div>
        </div>
      );
    case "song_block":
      return (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Track title</label>
            <input
              className={fieldClass}
              value={draft.title ?? ""}
              onChange={(e) => setKey("title", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Artist</label>
            <input
              className={fieldClass}
              value={draft.artist ?? ""}
              onChange={(e) => setKey("artist", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Platform</label>
            <input
              className={fieldClass}
              value={draft.platform ?? ""}
              onChange={(e) => setKey("platform", e.target.value)}
            />
          </div>
        </div>
      );
  }
}

function HubBlockSheetOverlay({
  block,
  onClose,
  onSaveEdit,
  onConfirmDelete,
}: {
  block: HubBlock | null;
  onClose: () => void;
  onSaveEdit: (block: HubBlock) => void;
  onConfirmDelete: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  useEffect(() => {
    if (block) {
      setDraft(blockToDraft(block));
    } else {
      setDraft({});
    }
  }, [block]);

  useEffect(() => {
    if (!block) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [block, onClose]);

  if (!block) return null;

  const title = "Edit block";
  const sheetTitleId = "hub-block-sheet-title";
  const modalTitleId = "hub-block-modal-title";

  const editFooter = (
    <div className="mt-5 flex gap-2">
      <button
        type="button"
        onClick={() => onConfirmDelete(block.id)}
        className="flex-1 rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-bold text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-100"
      >
        Delete block
      </button>
      <button
        type="button"
        onClick={() => onSaveEdit(applyDraftToBlock(block, draft))}
        className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white transition-colors hover:bg-indigo-700"
      >
        Save
      </button>
    </div>
  );

  const panelBody = (
    <>
      <p className="mb-3 text-[11px] font-medium text-slate-500">
        Type:{" "}
        <span className="font-black text-slate-700">{block.type}</span>
      </p>
      <HubBlockEditFields block={block} draft={draft} setDraft={setDraft} />
      {editFooter}
    </>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[75] md:hidden" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          aria-label="Close block sheet"
          onClick={onClose}
        />
        <div
          className="absolute bottom-0 left-0 right-0 flex max-h-[min(88vh,820px)] flex-col rounded-t-[2rem] bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.15)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={sheetTitleId}
        >
          <div className="flex shrink-0 flex-col border-b border-slate-100 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between px-4 pb-3">
              <h2
                id={sheetTitleId}
                className="text-sm font-black text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
            {panelBody}
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-[75] hidden md:block" role="presentation">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default bg-slate-900/50 backdrop-blur-[2px]"
          aria-label="Close block dialog"
          onClick={onClose}
        />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div
            className="pointer-events-auto flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2
                id={modalTitleId}
                className="text-base font-black text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {panelBody}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

const MOCK_HUD_BROWSER_URL =
  "https://publihub.app/hud/mock-token-7a3f…?v=1";

function ToggleSwitch({
  checked,
  onCheckedChange,
  disabled,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked);
      }}
      className={`inline-flex h-7 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      } ${checked ? "bg-indigo-600" : "bg-slate-200"}`}
    >
      <span
        aria-hidden
        className={`h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function IntegrationsEditorSheetOverlay({
  open,
  integrations,
  onClose,
  onSave,
}: {
  open: boolean;
  integrations: MockIntegration[];
  onClose: () => void;
  onSave: (next: MockIntegration[]) => void;
}) {
  const [draft, setDraft] = useState<MockIntegration[]>(integrations);
  const [editorExpanded, setEditorExpanded] = useState<Record<string, boolean>>(
    {}
  );
  const [keyDrafts, setKeyDrafts] = useState<
    Record<string, { clientId: string; secret: string }>
  >({});
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("all");

  const integrationCategories: Record<string, string[]> = {
    streaming: ["twitch", "youtube", "tiktok"],
    social: ["discord", "instagram", "x"],
    messaging: ["whatsapp", "telegram"],
    marketplaces: ["shopee", "amazon", "mercadolivre"],
    ecommerce: ["shopify", "woocommerce", "adobecommerce", "wixstore"],
    tools: ["google", "streamlabs"],
  };

  const getFilteredIntegrations = () => {
    if (activeCategoryTab === "all") return draft;
    const categoryIds = integrationCategories[activeCategoryTab] ?? [];
    return draft.filter((i) => categoryIds.includes(i.id));
  };

  const filteredDraft = getFilteredIntegrations();

  useEffect(() => {
    if (open) {
      setDraft(integrations.map((i) => ({ ...i })));
      setEditorExpanded({});
      setKeyDrafts({});
    }
  }, [open, integrations]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const title = "Manage integrations";
  const sheetTitleId = "integrations-sheet-title";
  const modalTitleId = "integrations-modal-title";

  const panelBody = (
    <>
      <p className="mb-4 text-xs text-slate-500">
        Tap an integration to open OAuth or API key details. Toggle simulates
        connected vs failed (mock).
      </p>
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-2">
        {[
          { id: "all", label: "All" },
          { id: "streaming", label: "Streaming" },
          { id: "social", label: "Social" },
          { id: "messaging", label: "Messaging" },
          { id: "marketplaces", label: "Marketplaces" },
          { id: "ecommerce", label: "E-commerce" },
          { id: "tools", label: "Tools" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveCategoryTab(tab.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              activeCategoryTab === tab.id
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mb-6 space-y-3">
        {filteredDraft.map((row) => {
          const expanded = Boolean(editorExpanded[row.id]);
          const keys = keyDrafts[row.id] ?? { clientId: "", secret: "" };
          return (
            <div
              key={row.id}
              className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50"
            >
              <div className="flex items-center justify-between gap-3 px-3 py-3">
                <button
                  type="button"
                  onClick={() =>
                    setEditorExpanded((prev) => ({
                      ...prev,
                      [row.id]: !prev[row.id],
                    }))
                  }
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left outline-none ring-indigo-500/30 focus-visible:ring-2"
                  aria-expanded={expanded}
                  aria-controls={`integration-editor-${row.id}`}
                  id={`integration-editor-trigger-${row.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{row.name}</p>
                    {row.detail ? (
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {row.detail}
                      </p>
                    ) : null}
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </button>
                <div className="shrink-0">
                  <ToggleSwitch
                    checked={row.status === "connected"}
                    ariaLabel={`${row.name}: mark as connected`}
                    onCheckedChange={(next) =>
                      setDraft((d) =>
                        d.map((x) =>
                          x.id === row.id
                            ? { ...x, status: next ? "connected" : "failed" }
                            : x
                        )
                      )
                    }
                  />
                </div>
              </div>
              {expanded ? (
                <div
                  id={`integration-editor-${row.id}`}
                  role="region"
                  aria-labelledby={`integration-editor-trigger-${row.id}`}
                  className="border-t border-slate-100 bg-white px-3 py-3"
                >
                  {row.credentialsKind === "oauth" ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-500">
                        Sign in with the provider; tokens are stored encrypted
                        server-side (mock).
                      </p>
                      <button
                        type="button"
                        className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-black text-white hover:bg-indigo-700"
                        onClick={() => {
                          /* mock */
                        }}
                      >
                        Continue with {row.name} (OAuth)
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] text-slate-500">
                        Paste partner credentials; never shown to fans (mock).
                      </p>
                      <div>
                        <label
                          htmlFor={`int-${row.id}-client`}
                          className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          Client / public key
                        </label>
                        <input
                          id={`int-${row.id}-client`}
                          type="text"
                          autoComplete="off"
                          value={keys.clientId}
                          onChange={(e) =>
                            setKeyDrafts((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...keys,
                                clientId: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                          placeholder="pk_live_••••"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor={`int-${row.id}-secret`}
                          className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400"
                        >
                          Secret key
                        </label>
                        <input
                          id={`int-${row.id}-secret`}
                          type="password"
                          autoComplete="off"
                          value={keys.secret}
                          onChange={(e) =>
                            setKeyDrafts((prev) => ({
                              ...prev,
                              [row.id]: {
                                ...keys,
                                secret: e.target.value,
                              },
                            }))
                          }
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700"
        >
          Save
        </button>
      </div>
    </>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[75] md:hidden" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          aria-label="Close integrations sheet"
          onClick={onClose}
        />
        <div
          className="absolute bottom-0 left-0 right-0 flex max-h-[min(90vh,880px)] flex-col rounded-t-[2rem] bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.15)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={sheetTitleId}
        >
          <div className="flex shrink-0 flex-col border-b border-slate-100 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between px-4 pb-3">
              <h2
                id={sheetTitleId}
                className="text-sm font-black text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
            {panelBody}
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-[75] hidden md:block" role="presentation">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default bg-slate-900/50 backdrop-blur-[2px]"
          aria-label="Close integrations dialog"
          onClick={onClose}
        />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div
            className="pointer-events-auto flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2
                id={modalTitleId}
                className="text-base font-black text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {panelBody}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function PlanDialogSheetOverlay({
  open,
  currentPlan,
  onClose,
  onSelectPlan,
}: {
  open: boolean;
  currentPlan: string;
  onClose: () => void;
  onSelectPlan: (plan: string) => void;
}) {
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);

  useEffect(() => {
    if (open) {
      setSelectedPlan(currentPlan);
    }
  }, [open, currentPlan]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const plans = [
    {
      id: "Free",
      name: "Free",
      price: "R$ 0",
      period: "/mês",
      credits: "25",
      features: [
        "1 Hub com até 5 páginas",
        "Produtos digitais (até 5)",
        "Widget de doação (OBS)",
        "Sem taxa de transação",
        "Mín. saque: R$ 100",
      ],
      unavailable: [],
    },
    {
      id: "Starter",
      name: "Starter",
      price: "R$ 99",
      period: "/mês",
      credits: "100",
      popular: true,
      features: [
        "3 Hubs com até 10 páginas cada",
        "Produtos digitais (até 30)",
        "Widgets customizáveis",
        "Sem taxa de transação",
        "Mín. saque: R$ 50",
        "Suporte priority",
      ],
      unavailable: [],
    },
    {
      id: "Growth",
      name: "Growth",
      price: "R$ 299",
      period: "/mês",
      credits: "500",
      features: [
        "Hubs ilimitados",
        "Produtos digitais ilimitados",
        "Sincronização e-commerce",
        "Marketplace affiliations",
        "Análise avançada",
        "API access",
      ],
      unavailable: ["Open beta"],
    },
  ];

  const dialogContent = (
    <>
      <div className="mb-6 text-center">
        <h2 className="text-xl font-black text-slate-900">Escolha seu plano</h2>
        <p className="mt-2 text-sm text-slate-500">
          Todos os planos incluem acesso ao Copilot AI
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const isCurrent = currentPlan === plan.id;
          const isUnavailable = plan.unavailable.length > 0;
          return (
            <button
              key={plan.id}
              type="button"
              disabled={isUnavailable}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative flex flex-col rounded-2xl border-2 p-4 text-left transition-all ${
                isSelected
                  ? "border-indigo-600 bg-indigo-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              } ${isUnavailable ? "opacity-50" : ""}`}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black uppercase text-white">
                  Mais popular
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-3 right-3 rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-black uppercase text-white">
                  Atual
                </span>
              )}
              <div className="mb-3">
                <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900">
                    {plan.price}
                  </span>
                  <span className="text-xs text-slate-500">{plan.period}</span>
                </div>
              </div>
              <p className="mb-4 text-xs text-slate-500">
                <span className="font-bold text-slate-800">{plan.credits}</span>{" "}
                créditos AI/mês
              </p>
              <ul className="mt-auto space-y-2">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-emerald-600"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              {isUnavailable && (
                <p className="mt-3 rounded-lg bg-rose-100 px-3 py-2 text-xs font-bold text-rose-800">
                  Em breve
                </p>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={selectedPlan === currentPlan}
          onClick={() => {
            onSelectPlan(selectedPlan);
            onClose();
          }}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${
            selectedPlan === currentPlan
              ? "cursor-not-allowed bg-slate-100 text-slate-400"
              : "bg-indigo-600 text-white hover:bg-indigo-700"
          }`}
        >
          {selectedPlan === currentPlan ? "Plano atual" : `Mudar para ${selectedPlan}`}
        </button>
      </div>
    </>
  );

  const titleId = "plan-dialog-title";

  return createPortal(
    <>
      <div className="fixed inset-0 z-[75] md:hidden" role="presentation">
        <div
          className={`absolute inset-0 bg-slate-900/50 transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
          aria-hidden
        />
        <div
          className={`absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-5 transition-transform ${
            open ? "translate-y-0" : "translate-y-full"
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 id={titleId} className="text-lg font-black text-slate-900">
              Planos
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
          {dialogContent}
        </div>
      </div>

      <div className="fixed inset-0 z-[75] hidden md:block" role="presentation">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default bg-slate-900/50 backdrop-blur-[2px]"
          aria-label="Fechar diálogo"
          onClick={onClose}
        />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div
            className="pointer-events-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <h2 id={titleId} className="text-lg font-black text-slate-900">
                Planos
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Fechar"
              >
                <X size={22} />
              </button>
            </div>
            <div className="p-6">{dialogContent}</div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function WidgetEditorSheetOverlay({
  widget,
  onClose,
  onSave,
}: {
  widget: MockHudWidget | null;
  onClose: () => void;
  onSave: (next: MockHudWidget) => void;
}) {
  const [draft, setDraft] = useState<MockHudWidget | null>(null);

  useEffect(() => {
    setDraft(widget ? { ...widget } : null);
  }, [widget]);

  useEffect(() => {
    if (!widget) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [widget, onClose]);

  if (!widget || !draft) return null;

  const isSoon = Boolean(widget.badge);
  const title = `Edit: ${widget.title}`;
  const sheetTitleId = "widget-sheet-title";
  const modalTitleId = "widget-modal-title";

  const panelBody = (
    <>
      {isSoon ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900">
          Mock preview — this widget type ships after open beta.
        </p>
      ) : null}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-xs font-bold text-slate-700">Show on live HUD</span>
          <ToggleSwitch
            checked={draft.enabled}
            disabled={isSoon}
            ariaLabel="Show on live HUD"
            onCheckedChange={(next) =>
              setDraft((d) => (d ? { ...d, enabled: next } : d))
            }
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            On-screen duration (sec)
          </label>
          <input
            type="number"
            min={1}
            max={60}
            disabled={isSoon}
            value={draft.durationSec || ""}
            onChange={(e) =>
              setDraft((d) =>
                d
                  ? { ...d, durationSec: Number(e.target.value) || 0 }
                  : d
              )
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Animation
          </label>
          <select
            disabled={isSoon}
            value={draft.animation}
            onChange={(e) =>
              setDraft((d) => (d ? { ...d, animation: e.target.value } : d))
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          >
            <option value="bounce">Bounce</option>
            <option value="slide">Slide</option>
            <option value="fade">Fade</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Min amount (R$) to show
          </label>
          <input
            type="number"
            min={0}
            disabled={isSoon}
            value={draft.minAmount}
            onChange={(e) =>
              setDraft((d) =>
                d ? { ...d, minAmount: Number(e.target.value) || 0 } : d
              )
            }
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <span className="text-xs font-bold text-slate-700">Sound on alert</span>
          <ToggleSwitch
            checked={draft.soundOn}
            disabled={isSoon}
            ariaLabel="Sound on alert"
            onCheckedChange={(next) =>
              setDraft((d) => (d ? { ...d, soundOn: next } : d))
            }
          />
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(draft)}
          className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700"
        >
          Save
        </button>
      </div>
    </>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[75] md:hidden" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          aria-label="Close widget sheet"
          onClick={onClose}
        />
        <div
          className="absolute bottom-0 left-0 right-0 flex max-h-[min(88vh,820px)] flex-col rounded-t-[2rem] bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.15)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={sheetTitleId}
        >
          <div className="flex shrink-0 flex-col border-b border-slate-100 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between px-4 pb-3">
              <h2
                id={sheetTitleId}
                className="text-sm font-black text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
            {panelBody}
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-[75] hidden md:block" role="presentation">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default bg-slate-900/50 backdrop-blur-[2px]"
          aria-label="Close widget dialog"
          onClick={onClose}
        />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div
            className="pointer-events-auto flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2
                id={modalTitleId}
                className="text-base font-black text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {panelBody}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

function WidgetCreateSheetOverlay({
  open,
  onClose,
  onPickTemplate,
  onCreateWithAI,
}: {
  open: boolean;
  onClose: () => void;
  onPickTemplate: (opt: WidgetCreateOption) => void;
  onCreateWithAI: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const title = "Add HUD widget";
  const sheetTitleId = "widget-create-sheet-title";
  const modalTitleId = "widget-create-modal-title";

  const panelBody = (
    <>
      <p className="mb-4 text-xs text-slate-500">
        Pick a template to add to your live overlay catalog, or let Copilot
        propose a layout with generative UI.
      </p>
      <button
        type="button"
        onClick={onCreateWithAI}
        className="mb-5 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-violet-300 bg-gradient-to-r from-violet-600 to-indigo-600 py-3.5 text-sm font-black text-white shadow-md transition-opacity hover:opacity-95"
      >
        <Sparkles size={18} aria-hidden />
        Create with Copilot (AI)
      </button>
      <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
        All widget types
      </p>
      <div className="mb-4 space-y-2">
        {WIDGET_CREATE_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            type="button"
            onClick={() => onPickTemplate(opt)}
            className="flex w-full items-start justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{opt.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
                {opt.description}
              </p>
            </div>
            {opt.badge ? (
              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                {opt.badge}
              </span>
            ) : (
              <Plus
                size={18}
                className="shrink-0 text-indigo-500"
                aria-hidden
              />
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
      >
        Cancel
      </button>
    </>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[75] md:hidden" role="presentation">
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          aria-label="Close add widget sheet"
          onClick={onClose}
        />
        <div
          className="absolute bottom-0 left-0 right-0 flex max-h-[min(92vh,900px)] flex-col rounded-t-[2rem] bg-white shadow-[0_-20px_60px_rgba(0,0,0,0.15)]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={sheetTitleId}
        >
          <div className="flex shrink-0 flex-col border-b border-slate-100 pt-2">
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-slate-200" />
            <div className="flex items-center justify-between px-4 pb-3">
              <h2
                id={sheetTitleId}
                className="text-sm font-black text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
            {panelBody}
          </div>
        </div>
      </div>

      <div className="fixed inset-0 z-[75] hidden md:block" role="presentation">
        <button
          type="button"
          className="absolute inset-0 z-0 cursor-default bg-slate-900/50 backdrop-blur-[2px]"
          aria-label="Close add widget dialog"
          onClick={onClose}
        />
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
          <div
            className="pointer-events-auto flex max-h-[min(90vh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_25px_80px_-12px_rgba(15,23,42,0.45)]"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <h2
                id={modalTitleId}
                className="text-base font-black text-slate-900"
              >
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close"
              >
                <X size={22} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {panelBody}
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// Contextual Quick Actions for the AI Chat
const CONTEXTUAL_ACTIONS: Record<TabId, string[]> = {
  hub: ["Add Media Donation", "Add Fan Board", "Change Theme"],
  wallet: ["Withdraw Funds", "Export History", "Analyze Revenue"],
  quests: ["New Shopee Quest", "Create Amazon Goal"],
  widgets: [
    "Copy Browser Source URL",
    "Generate HUD widget with Copilot",
    "Edit donation alert",
  ],
  settings: ["Connect Twitch", "Update PIX payout", "Compare plans"],
};

type ChatMessage = {
  id: number;
  role: "user" | "ai";
  content: string;
  generativeUI?: { type: string; data?: { max?: number } };
};

type AiReply = Omit<ChatMessage, "id">;

function SortableHubBlockItem({
  id,
  className,
  children,
  onEditClick,
}: {
  id: string;
  className: string;
  children: React.ReactNode;
  onEditClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { zIndex: 30, position: "relative" } : {}),
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${className}${isDragging ? " shadow-lg" : ""}`}
    >
      <div className="absolute left-2 top-3 z-30 flex flex-col gap-1.5">
        <button
          type="button"
          aria-label="Drag to reorder block"
          className="flex h-8 w-8 cursor-grab touch-none items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-600 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100 active:cursor-grabbing"
          {...listeners}
          {...attributes}
        >
          <GripVertical size={14} strokeWidth={2.5} aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Edit block"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEditClick();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-100"
        >
          <Pencil size={13} strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      <div className="pl-12">{children}</div>
    </div>
  );
}

export default function PubliHubApp() {
  const [activeTab, setActiveTab] = useState<TabId>("hub");
  const [hubData, setHubData] = useState(INITIAL_HUB);
  const [walletData, setWalletData] = useState(INITIAL_WALLET);
  const [questsData, setQuestsData] = useState(INITIAL_QUESTS);
  const [settingsData, setSettingsData] = useState(INITIAL_SETTINGS);
  const [mockWidgets, setMockWidgets] = useState<MockHudWidget[]>(
    () => INITIAL_MOCK_WIDGETS.map((w) => ({ ...w }))
  );
  const [widgetEditorId, setWidgetEditorId] = useState<string | null>(null);
  const [widgetCreateOpen, setWidgetCreateOpen] = useState(false);
  const [hudUrlCopied, setHudUrlCopied] = useState(false);
  const [hubPageUrlCopied, setHubPageUrlCopied] = useState(false);
  const [emailNotify, setEmailNotify] = useState(INITIAL_SETTINGS.notifyEmail);
  const [mockIntegrations, setMockIntegrations] = useState<MockIntegration[]>(
    () => INITIAL_MOCK_INTEGRATIONS.map((i) => ({ ...i }))
  );
  const [integrationsEditorOpen, setIntegrationsEditorOpen] = useState(false);
  const [integrationsAccordionOpen, setIntegrationsAccordionOpen] =
    useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);

  useEffect(() => {
    if (activeTab !== "widgets") {
      setWidgetEditorId(null);
      setWidgetCreateOpen(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "settings") setIntegrationsEditorOpen(false);
  }, [activeTab]);

  const [isAgentOpen, setIsAgentOpen] = useState(false);
  const [input, setInput] = useState("");
  const [aiCredits, setAiCredits] = useState(25);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      role: "ai",
      content:
        "Hey! I'm your Copilot. Navigate through your Hub, Wallet, Quests, or Widgets and let me know how I can help!",
    },
  ]);
  /** Monotonic ids — Date.now() collides under Strict Mode / same-ms bursts. */
  const copilotMessageIdRef = useRef(1);
  const nextCopilotMessageId = useCallback(() => {
    copilotMessageIdRef.current += 1;
    return copilotMessageIdRef.current;
  }, []);
  const [generativeCanvasDrafts, setGenerativeCanvasDrafts] = useState<
    GenerativeCanvasDraft[]
  >([]);
  /** Mobile: toggle Copilot body between chat and generative canvas. */
  const [copilotMobileTab, setCopilotMobileTab] = useState<"chat" | "canvas">(
    "chat"
  );
  const [editMode, setEditMode] = useState(false);
  const [hubPageStructureMode, setHubPageStructureMode] =
    useState<HubPageStructureMode>("multi");
  const [hubPages, setHubPages] = useState<HubPageDef[]>(() =>
    DEFAULT_HUB_PAGES.map((p) => ({ ...p }))
  );
  const [activeHubPublicPage, setActiveHubPublicPage] = useState("home");
  const [hubPageLayoutIndexByPage, setHubPageLayoutIndexByPage] = useState<
    Record<string, number>
  >({
    home: 0,
    shop: 1,
    links: 2,
  });
  const [hubBlocksByPage, setHubBlocksByPage] = useState<
    Record<string, HubBlock[]>
  >(() => ({ ...INITIAL_HUB_BLOCKS_BY_PAGE }));
  const [hubLayoutPickerOpen, setHubLayoutPickerOpen] = useState(false);
  const [addBlockPickerOpen, setAddBlockPickerOpen] = useState(false);
  const [hubBlockSheet, setHubBlockSheet] = useState<HubBlock | null>(null);
  const [activeDonationTab, setActiveDonationTab] = useState<
    "text" | "audio" | "video"
  >("text");

  const primaryHubPageId = hubPages[0]?.id ?? "";

  const hubContentPageId =
    hubPageStructureMode === "single" ? primaryHubPageId : activeHubPublicPage;

  useEffect(() => {
    if (hubPageStructureMode === "single" && primaryHubPageId) {
      setActiveHubPublicPage(primaryHubPageId);
    }
  }, [hubPageStructureMode, primaryHubPageId]);

  useEffect(() => {
    const ids = new Set(hubPages.map((p) => p.id));
    if (!ids.has(activeHubPublicPage) && hubPages[0]) {
      setActiveHubPublicPage(hubPages[0].id);
    }
  }, [hubPages, activeHubPublicPage]);

  const hubLayoutIndex = hubPageLayoutIndexByPage[hubContentPageId] ?? 0;
  const hubPageLayout = HUB_LAYOUT_OPTIONS[hubLayoutIndex]?.id ?? "classic";
  const hubBlocksForActivePage = hubBlocksByPage[hubContentPageId] ?? [];

  const commitHubLayoutPicker = useCallback(
    (next: {
      pages: HubPageDef[];
      layouts: Record<string, number>;
      structureMode: HubPageStructureMode;
    }) => {
      setHubPages(next.pages.map((p) => ({ ...p })));
      setHubPageLayoutIndexByPage(next.layouts);
      setHubPageStructureMode(next.structureMode);
      setHubBlocksByPage((prev) => {
        const allowed = new Set(next.pages.map((p) => p.id));
        const out: Record<string, HubBlock[]> = {};
        for (const id of allowed) {
          out[id] = prev[id] ?? [];
        }
        return out;
      });
    },
    []
  );

  useEffect(() => {
    if (!editMode) setHubLayoutPickerOpen(false);
  }, [editMode]);

  useEffect(() => {
    if (!editMode) setAddBlockPickerOpen(false);
  }, [editMode]);

  useEffect(() => {
    if (!editMode) setHubBlockSheet(null);
  }, [editMode]);

  const applyAddBlockTemplate = useCallback(
    (template: AddBlockTemplateId) => {
      const block = hubBlockFromTemplate(template);
      setHubBlocksByPage((prev) => ({
        ...prev,
        [hubContentPageId]: [...(prev[hubContentPageId] ?? []), block],
      }));
      setAddBlockPickerOpen(false);
    },
    [hubContentPageId]
  );

  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAgentOpen]);

  useEffect(() => {
    if (!isAgentOpen) return;
    let contextMsg = "";
    if (activeTab === "hub")
      contextMsg =
        "Want to add a live Supporter Board or let fans send YouTube videos?";
    if (activeTab === "wallet")
      contextMsg =
        "Need help withdrawing funds to your registered gateway?";
    if (activeTab === "quests")
      contextMsg =
        "Ready to gamify a brand deal? Paste an affiliate link here.";
    if (activeTab === "widgets")
      contextMsg =
        "Share your hub link or QR with fans, copy the Browser Source URL, create widgets from templates or Copilot, then edit timing and sound.";
    if (activeTab === "settings")
      contextMsg =
        "Manage integrations, payout account, app language, and your Starter plan.";
    setMessages((prev) => [
      ...prev,
      { id: nextCopilotMessageId(), role: "ai", content: contextMsg },
    ]);
  }, [activeTab, isAgentOpen, nextCopilotMessageId]);

  const processCopilotCommand = (text: string): AiReply => {
    const lower = text.toLowerCase();
    const response: AiReply = {
      role: "ai",
      content: "I've processed your request.",
    };

    if (lower.includes("go to") || lower.includes("navigate") || lower.includes("show me")) {
      if (lower.includes("wallet") || lower.includes("money")) {
        setActiveTab("wallet");
        response.content = "Navigating to your Wallet.";
      } else if (lower.includes("quest")) {
        setActiveTab("quests");
        response.content = "Opening your Quests.";
      } else if (lower.includes("widget") || lower.includes("obs")) {
        setActiveTab("widgets");
        response.content = "Opening your Widgets dashboard.";
      } else {
        setActiveTab("hub");
        response.content = "Taking you back to your Hub.";
      }
    } else if (lower.includes("dark mode")) {
      setHubData((prev) => ({
        ...prev,
        theme: {
          ...prev.theme,
          bg: "bg-slate-900",
          card: "bg-slate-800 border-slate-700 text-white",
          primary: "bg-indigo-500 text-white",
        },
      }));
      response.content =
        "I've updated your Hub to a sleek dark mode. Check it out!";
      setActiveTab("hub");
    } else if (lower.includes("fan board") || lower.includes("supporter")) {
      const newBoard: HubBlock = {
        id: Date.now().toString(),
        type: "fan_board",
        title: "Live Supporter Board",
      };
      setHubBlocksByPage((prev) => ({
        ...prev,
        [hubContentPageId]: [...(prev[hubContentPageId] ?? []), newBoard],
      }));
      response.content =
        "Added the Live Supporter Board to your Hub. Fans' paid messages will appear here!";
      setActiveTab("hub");
    } else if (
      (lower.includes("marketplace") ||
        lower.includes("affiliate grid") ||
        (lower.includes("shopee") && lower.includes("product")) ||
        (lower.includes("amazon") && lower.includes("link"))) &&
      planHasPaidHubBlocks(settingsData.plan)
    ) {
      const newBlock = hubBlockFromTemplate("marketplace_grid");
      setHubBlocksByPage((prev) => ({
        ...prev,
        [hubContentPageId]: [...(prev[hubContentPageId] ?? []), newBlock],
      }));
      response.content =
        "Added a Marketplace grid block — wire SKUs from Shopee, Amazon, and other programs in the editor.";
      setActiveTab("hub");
    } else if (
      (lower.includes("shopify") ||
        lower.includes("woocommerce") ||
        lower.includes("nuvemshop") ||
        (lower.includes("store") && lower.includes("catalog"))) &&
      planHasPaidHubBlocks(settingsData.plan)
    ) {
      const newBlock = hubBlockFromTemplate("ecommerce_sync");
      setHubBlocksByPage((prev) => ({
        ...prev,
        [hubContentPageId]: [...(prev[hubContentPageId] ?? []), newBlock],
      }));
      response.content =
        "Added a synced store catalog block. Inventory updates flow from your e-commerce platform.";
      setActiveTab("hub");
    } else if (
      lower.includes("marketplace") ||
      lower.includes("shopify") ||
      lower.includes("woocommerce") ||
      (lower.includes("store") && lower.includes("catalog"))
    ) {
      response.content =
        "Marketplace and synced store catalogs are on Pro and Business. Head to Settings to upgrade your plan.";
      setActiveTab("settings");
    } else if (
      (lower.includes("custom") &&
        (lower.includes("block") || lower.includes("section"))) ||
      (lower.includes("generate") && lower.includes("block")) ||
      (text.length > 48 && lower.includes("block"))
    ) {
      response.content =
        "Here is a generative preview. Add it to your active hub page, then iterate with another prompt.";
      response.generativeUI = { type: "hub_block_draft" };
      setActiveTab("hub");
    } else if (
      lower.includes("donation") ||
      lower.includes("media donation") ||
      lower.includes("interactive")
    ) {
      const newDonation: HubBlock = {
        id: Date.now().toString(),
        type: "interactive_donation",
        title: "Send a Live Message",
      };
      setHubBlocksByPage((prev) => ({
        ...prev,
        [hubContentPageId]: [newDonation, ...(prev[hubContentPageId] ?? [])],
      }));
      response.content =
        "I've added the Interactive Super Chat widget. Fans can now pay to send Text, AI Voices, or YouTube links!";
      setActiveTab("hub");
    } else if (
      activeTab === "widgets" &&
      (lower.includes("generate hud widget") ||
        (lower.includes("hud") &&
          lower.includes("widget") &&
          (lower.includes("copilot") || lower.includes("generative"))))
    ) {
      response.content =
        "Here's a suggested HUD widget from Copilot. Apply it to add to your catalog, then open the editor to fine-tune.";
      response.generativeUI = { type: "hud_widget_draft" };
    } else if (lower.includes("withdraw") || lower.includes("funds")) {
      response.content =
        "I can help with that. Please confirm your withdrawal details below.";
      response.generativeUI = {
        type: "withdrawal_widget",
        data: { max: walletData.balance },
      };
      setActiveTab("wallet");
    } else {
      response.content =
        "I'm your PubliHub Copilot. Try asking me to 'Add a Media Donation widget' or 'Go to my Wallet'.";
    }

    return response;
  };

  const handleSendMessage = (
    textOrEvent: React.FormEvent | string
  ) => {
    if (typeof textOrEvent !== "string" && textOrEvent?.preventDefault) {
      textOrEvent.preventDefault();
    }
    const textToProcess =
      typeof textOrEvent === "string" ? textOrEvent : input;
    if (!textToProcess.trim()) return;

    const userMsgId = nextCopilotMessageId();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: textToProcess },
    ]);
    setInput("");
    setAiCredits((prev) => Math.max(0, prev - 1));

    setTimeout(() => {
      const aiResponse = processCopilotCommand(textToProcess);
      const aiMsgId = nextCopilotMessageId();
      setMessages((prev) => [
        ...prev,
        { id: aiMsgId, ...aiResponse },
      ]);
      const gui = aiResponse.generativeUI?.type;
      if (gui === "hub_block_draft") {
        setGenerativeCanvasDrafts((d) => [
          ...d,
          {
            id: `draft-${aiMsgId}`,
            kind: "hub_block",
            sourceMessageId: aiMsgId,
            createdAt: Date.now(),
          },
        ]);
        setCopilotMobileTab("canvas");
      }
      if (gui === "hud_widget_draft") {
        setGenerativeCanvasDrafts((d) => [
          ...d,
          {
            id: `draft-${aiMsgId}`,
            kind: "hud_widget",
            sourceMessageId: aiMsgId,
            createdAt: Date.now(),
          },
        ]);
        setCopilotMobileTab("canvas");
      }
    }, 800);
  };

  const removeBlock = (id: string) =>
    setHubBlocksByPage((prev) => ({
      ...prev,
      [hubContentPageId]: (prev[hubContentPageId] ?? []).filter(
        (b) => b.id !== id
      ),
    }));

  const applyCanvasHubBlock = useCallback(
    (draftId: string) => {
      const block = hubBlockFromTemplate("digital_product");
      setHubBlocksByPage((prev) => ({
        ...prev,
        [hubContentPageId]: [...(prev[hubContentPageId] ?? []), block],
      }));
      setGenerativeCanvasDrafts((d) => d.filter((x) => x.id !== draftId));
      setActiveTab("hub");
    },
    [hubContentPageId]
  );

  const applyCanvasHudWidget = useCallback((draftId: string) => {
    const w: MockHudWidget = {
      id: `w-copilot-${Date.now()}`,
      type: "donation_alert",
      title: "Copilot donation banner",
      description:
        "Generative overlay — tune animation, duration, and min amount in the editor (mock).",
      enabled: true,
      durationSec: 8,
      animation: "bounce",
      minAmount: 0,
      soundOn: true,
    };
    setMockWidgets((prev) => [...prev, w]);
    setWidgetEditorId(w.id);
    setGenerativeCanvasDrafts((d) => d.filter((x) => x.id !== draftId));
    setActiveTab("widgets");
  }, []);

  const dismissCanvasDraft = useCallback((draftId: string) => {
    setGenerativeCanvasDrafts((d) => d.filter((x) => x.id !== draftId));
  }, []);

  const refineCanvasDraftInChat = useCallback(
    (_draftId: string, kind: GenerativeCanvasDraft["kind"]) => {
      setCopilotMobileTab("chat");
      setInput(
        kind === "hub_block"
          ? "Refine the hub block on the canvas: "
          : "Refine the HUD widget on the canvas: "
      );
    },
    []
  );

  // --- AG-UI COMPONENTS ---
  const GenerativeWithdrawalWidget = () => {
    const [status, setStatus] = useState<
      "pending" | "processing" | "success"
    >("pending");
    if (status === "success")
      return (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check size={16} />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-900">
              Withdrawal Complete
            </p>
            <p className="text-[10px] text-emerald-600">
              Funds sent to {settingsData.gateway}
            </p>
          </div>
        </div>
      );
    return (
      <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700">
            Withdraw to {settingsData.gateway}
          </span>
          <span className="rounded bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-600">
            No Fee
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
          <span className="pl-1 text-sm font-bold text-slate-400">R$</span>
          <input
            type="number"
            defaultValue={100}
            className="w-full border-none bg-transparent font-bold text-slate-800 outline-none"
          />
        </div>
        <button
          type="button"
          disabled={status === "processing"}
          onClick={() => {
            setStatus("processing");
            setTimeout(() => {
              setWalletData((prev) => ({
                ...prev,
                balance: prev.balance - 100,
                events: [
                  {
                    label: "Withdrawal",
                    amt: -100,
                    time: "Just now",
                    type: "out",
                  },
                  ...prev.events,
                ],
              }));
              setStatus("success");
            }, 1500);
          }}
          className="w-full rounded-lg bg-slate-900 py-2 text-xs font-bold text-white disabled:opacity-70"
        >
          {status === "pending" ? "Confirm Transfer" : "Processing..."}
        </button>
      </div>
    );
  };

  // --- APPLICATION VIEWS ---
  const HubView = () => {
    const blockSortSensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: { distance: 8 },
      }),
      useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
      })
    );

    const onHubBlocksDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        setHubBlocksByPage((prev) => {
          const list = [...(prev[hubContentPageId] ?? [])];
          const oldIndex = list.findIndex((b) => b.id === active.id);
          const newIndex = list.findIndex((b) => b.id === over.id);
          if (oldIndex < 0 || newIndex < 0) return prev;
          return {
            ...prev,
            [hubContentPageId]: arrayMove(list, oldIndex, newIndex),
          };
        });
      },
      [hubContentPageId]
    );

    const hubBlockSortStrategy =
      hubPageLayout === "magazine" || hubPageLayout === "storefront"
        ? rectSortingStrategy
        : verticalListSortingStrategy;

    const hubBlockShellClass = (block: HubBlock) =>
      `group relative transition-all duration-300 ${hubData.theme.card} ${hubBlockPaddingClass(hubPageLayout)} ${hubBlockSpanClass(hubPageLayout, block.type)} ${editMode ? "hover:ring-2 hover:ring-indigo-400" : ""}`;

    return (
    <>
      <div
        className="fixed right-4 top-[4.25rem] z-[45] flex items-center rounded-xl border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur-md md:right-6 md:top-6"
        role="toolbar"
        aria-label="Hub preview mode"
      >
        <button
          type="button"
          onClick={() => setEditMode(true)}
          className={`flex items-center gap-1 rounded-lg p-2 text-xs font-bold ${editMode ? "bg-slate-900 text-white" : "text-slate-500"}`}
        >
          <Edit3 size={14} aria-hidden /> Edit
        </button>
        <button
          type="button"
          onClick={() => setEditMode(false)}
          className={`flex items-center gap-1 rounded-lg p-2 text-xs font-bold ${!editMode ? "bg-slate-900 text-white" : "text-slate-500"}`}
        >
          <Eye size={14} aria-hidden /> View
        </button>
      </div>

      {editMode && (
        <>
          <button
            type="button"
            className="fixed left-4 top-[4.25rem] z-[45] flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-md transition-colors hover:border-indigo-200 hover:bg-indigo-50/80 md:left-[calc(16rem+1rem)] md:top-6"
            aria-label="Page layout settings"
            onClick={() => setHubLayoutPickerOpen(true)}
          >
            <Settings2 size={20} strokeWidth={2} aria-hidden />
          </button>
          <HubLayoutPickerOverlay
            open={hubLayoutPickerOpen}
            onClose={() => setHubLayoutPickerOpen(false)}
            committedByPage={hubPageLayoutIndexByPage}
            committedPages={hubPages}
            committedStructureMode={hubPageStructureMode}
            onCommit={commitHubLayoutPicker}
            initialPageId={activeHubPublicPage}
          />
          <AddBlockPickerOverlay
            open={addBlockPickerOpen}
            onClose={() => setAddBlockPickerOpen(false)}
            hasPaidPlan={planHasPaidHubBlocks(settingsData.plan)}
            onPickTemplate={applyAddBlockTemplate}
            onBuildWithCopilot={() => {
              setAddBlockPickerOpen(false);
              setIsAgentOpen(true);
              setInput(
                "Describe the hub block to generate (layout, copy, products, marketplace rows)…"
              );
            }}
            onUpgradeRequest={() => {
              setAddBlockPickerOpen(false);
              setActiveTab("settings");
            }}
          />
        </>
      )}

      <div className="flex flex-1 flex-col items-center overflow-y-auto pb-32 pt-4 md:pb-8 md:p-8">
      <div
        className={`relative min-h-[80vh] w-full max-w-md overflow-hidden rounded-[2.5rem] shadow-2xl transition-colors duration-500 md:border-8 md:border-slate-800 ${hubData.theme.bg}`}
      >
        <div className="relative flex flex-col items-center space-y-6 p-6 pt-8">
          <div className="group relative flex w-full flex-col items-center text-center">
            {editMode && (
              <div className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-black/5 opacity-0 transition-opacity group-hover:opacity-100">
                <Edit3 className="text-slate-700" />
              </div>
            )}
            <img
              src={hubData.profile.avatar}
              className="mb-4 h-24 w-24 rounded-full border-4 border-white shadow-md"
              alt="Avatar"
            />
            <h1
              className={`text-xl font-black ${hubData.theme.card.includes("bg-slate-800") ? "text-white" : "text-slate-900"}`}
            >
              {hubData.profile.name}
            </h1>
            <p
              className={`mt-2 max-w-[260px] text-sm ${hubData.theme.card.includes("bg-slate-800") ? "text-slate-300" : "text-slate-500"}`}
            >
              {hubData.profile.bio}
            </p>
          </div>

          {hubPageStructureMode === "multi" ? (
            <div
              className="flex w-full max-w-[280px] justify-center gap-1"
              role="tablist"
              aria-label="Hub pages"
            >
              {hubPages.map((p) => {
                const on = p.id === activeHubPublicPage;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setActiveHubPublicPage(p.id)}
                    className={`min-w-0 flex-1 truncate rounded-full px-1 py-1.5 text-center text-[9px] font-black uppercase tracking-wide transition-colors ${
                      on
                        ? hubData.theme.card.includes("bg-slate-800")
                          ? "bg-white/15 text-white"
                          : "bg-slate-900 text-white"
                        : hubData.theme.card.includes("bg-slate-800")
                          ? "text-slate-400 hover:bg-white/10 hover:text-slate-200"
                          : "bg-slate-100/80 text-slate-500 hover:bg-slate-200/80"
                    }`}
                  >
                    {p.label.trim() || "Untitled"}
                  </button>
                );
              })}
            </div>
          ) : null}

          {hubPageLayout === "hero" && (
            <div className="w-full max-w-[280px] rounded-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 p-[2px] shadow-md">
              <div className="h-16 w-full rounded-[0.9rem] bg-gradient-to-br from-indigo-400/90 to-fuchsia-600/90" />
            </div>
          )}

          <div className={`w-full ${hubBlocksContainerClass(hubPageLayout)}`}>
            {editMode ? (
              <DndContext
                sensors={blockSortSensors}
                collisionDetection={closestCenter}
                onDragEnd={onHubBlocksDragEnd}
              >
                <SortableContext
                  items={hubBlocksForActivePage.map((b) => b.id)}
                  strategy={hubBlockSortStrategy}
                >
                  {hubBlocksForActivePage.map((block) => (
                    <SortableHubBlockItem
                      key={block.id}
                      id={block.id}
                      className={hubBlockShellClass(block)}
                      onEditClick={() => setHubBlockSheet(block)}
                    >
                      <HubBlockCardInner
                        block={block}
                        hubData={hubData}
                        activeDonationTab={activeDonationTab}
                        setActiveDonationTab={setActiveDonationTab}
                      />
                    </SortableHubBlockItem>
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              hubBlocksForActivePage.map((block) => (
                <div key={block.id} className={hubBlockShellClass(block)}>
                  <HubBlockCardInner
                    block={block}
                    hubData={hubData}
                    activeDonationTab={activeDonationTab}
                    setActiveDonationTab={setActiveDonationTab}
                  />
                </div>
              ))
            )}
          </div>


          {editMode && (
            <button
              type="button"
              onClick={() => setAddBlockPickerOpen(true)}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-300 py-4 text-indigo-500 transition-colors hover:bg-indigo-50"
            >
              <div className="rounded-full bg-indigo-100 p-2">
                <Plus size={20} aria-hidden />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest">
                Add block
              </span>
              <span className="text-[10px] font-medium normal-case tracking-normal text-indigo-400/90">
                Template, Pro catalogs, or Copilot
              </span>
            </button>
          )}
        </div>
      </div>
      </div>
    </>
  );
  };

  const WalletView = () => (
    <div className="animate-in fade-in mx-auto w-full max-w-4xl p-6 pb-32 md:p-12">
      <h1 className="mb-6 text-2xl font-black text-slate-900">Creator Wallet</h1>
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 p-6 text-white shadow-xl md:p-8">
          <div className="absolute right-0 top-0 p-8 opacity-10">
            <WalletIcon size={120} />
          </div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-indigo-200">
            Available Balance
          </p>
          <h2 className="mb-8 text-4xl font-black tracking-tighter">
            R$ {walletData.balance.toFixed(2)}
          </h2>
          <div className="relative z-10 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setIsAgentOpen(true);
                handleSendMessage("Withdraw Funds");
              }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500 py-3.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-indigo-400"
            >
              <ArrowDownToLine size={16} /> Withdraw
            </button>
          </div>
        </div>
      </div>
      <h3 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
        Ledger History
      </h3>
      <div className="space-y-3">
        {walletData.events.map((ev, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${ev.type === "in" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}
              >
                <ArrowRightLeft size={20} />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{ev.label}</p>
                <p className="text-[10px] font-medium text-slate-400">
                  {ev.time}
                </p>
              </div>
            </div>
            <p
              className={`text-sm font-black ${ev.type === "in" ? "text-emerald-600" : "text-slate-900"}`}
            >
              {ev.type === "in" ? "+" : ""} R$ {ev.amt.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );

  const QuestsView = () => (
    <div className="animate-in fade-in mx-auto w-full max-w-4xl p-6 pb-32 md:p-12">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900">Publi Quests</h1>
        <button
          type="button"
          onClick={() => {
            setIsAgentOpen(true);
            handleSendMessage("Create Quest");
          }}
          className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white"
        >
          <Plus size={16} /> New Quest
        </button>
      </div>
      {questsData.map((quest) => (
        <div
          key={quest.id}
          className="flex flex-col items-center gap-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:flex-row"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
            <Target size={32} />
          </div>
          <div className="w-full flex-1 text-center md:text-left">
            <h2 className="text-lg font-black text-slate-900">
              {quest.brand}: {quest.product}
            </h2>
            <div className="mb-2 mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-orange-500 transition-all duration-1000"
                style={{ width: `${(quest.current / quest.goal) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] font-bold uppercase text-slate-400">
              <span>
                {quest.current} / {quest.goal} Sold
              </span>
              <span className="text-emerald-500">Earned: R$ {quest.earned}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const WidgetsView = () => {
    const editingWidget =
      mockWidgets.find((w) => w.id === widgetEditorId) ?? null;
    const hubPageUrl = creatorHubPageUrl(settingsData.domain);
    const hubQrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=168x168&data=${encodeURIComponent(hubPageUrl)}`;

    return (
      <div className="animate-in fade-in mx-auto w-full max-w-4xl p-6 pb-32 md:p-12">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-slate-900">Widgets</h1>
          <p className="mt-1 text-sm text-slate-500">
            Share your{" "}
            <span className="font-bold text-slate-700">PubliHub page</span>{" "}
            (link + QR), wire{" "}
            <span className="font-bold text-slate-700">Browser Source</span> for
            OBS, then curate live HUD widgets — create from templates or
            Copilot, edit in a sheet (mobile) or dialog (desktop).
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-[2rem] border border-indigo-200 bg-indigo-50/80 p-5 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <Monitor className="text-indigo-600" size={22} />
                <h2 className="text-sm font-black text-slate-900">
                  Browser Source URL
                </h2>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(MOCK_HUD_BROWSER_URL);
                    setHudUrlCopied(true);
                    window.setTimeout(() => setHudUrlCopied(false), 2000);
                  } catch {
                    setHudUrlCopied(true);
                    window.setTimeout(() => setHudUrlCopied(false), 2000);
                  }
                }}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white"
              >
                <ExternalLink size={14} />
                {hudUrlCopied ? "Copied!" : "Copy URL"}
              </button>
            </div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-indigo-800/70">
              Paste into OBS → Sources → Browser
            </p>
            <div className="break-all rounded-xl border border-indigo-100 bg-white px-3 py-2 font-mono text-[11px] text-slate-600">
              {MOCK_HUD_BROWSER_URL}
            </div>
            <button
              type="button"
              className="mt-3 text-xs font-bold text-indigo-700 underline"
            >
              Regenerate HUD token (mock)
            </button>
          </div>

          <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50/80 p-5 shadow-sm">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="text-emerald-700" size={22} />
                <h2 className="text-sm font-black text-slate-900">
                  Your PubliHub page
                </h2>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(hubPageUrl);
                    setHubPageUrlCopied(true);
                    window.setTimeout(() => setHubPageUrlCopied(false), 2000);
                  } catch {
                    setHubPageUrlCopied(true);
                    window.setTimeout(() => setHubPageUrlCopied(false), 2000);
                  }
                }}
                className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-800 px-4 py-2.5 text-xs font-bold text-white"
              >
                <Link2 size={14} />
                {hubPageUrlCopied ? "Copied!" : "Copy link"}
              </button>
            </div>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-emerald-900/70">
              Fans open this link or scan the QR — same hub as in Settings
            </p>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
              <div className="shrink-0 rounded-2xl border border-white bg-white p-2 shadow-sm">
                <img
                  src={hubQrSrc}
                  width={168}
                  height={168}
                  alt={`QR code for ${hubPageUrl}`}
                  className="h-[168px] w-[168px] rounded-xl bg-white"
                />
              </div>
              <div className="min-w-0 flex-1 text-center sm:text-left">
                <p className="break-all rounded-xl border border-emerald-100 bg-white px-3 py-2 font-mono text-[11px] text-slate-700">
                  {hubPageUrl}
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-emerald-900/80">
                  Mock QR encodes your public hub URL. Replace with an on-brand
                  asset or dynamic frame in production.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="flex min-h-[140px] flex-col justify-between rounded-[1.5rem] border border-slate-200 bg-slate-900 p-4 text-white shadow-inner">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
              <Eye size={14} /> HUD preview (mock)
            </div>
            <div className="flex flex-1 flex-col items-center justify-center py-4">
              <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 text-center">
                <p className="text-[10px] font-medium text-indigo-100">
                  Last event
                </p>
                <p className="text-sm font-black">R$ 50 — Sarah99</p>
                <p className="text-[9px] text-indigo-200">Donation alert</p>
              </div>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
            <p className="font-bold text-slate-700">Tip</p>
            <p className="mt-2 leading-relaxed">
              Set the Browser source size to <span className="font-mono">1920×1080</span>{" "}
              and use a transparent background in OBS for a clean overlay.
            </p>
          </div>
        </div>

        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Live widgets
          </h3>
          <button
            type="button"
            onClick={() => setWidgetCreateOpen(true)}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            <Plus size={16} strokeWidth={2.5} aria-hidden />
            Create widget
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {mockWidgets.map((w) => (
            <div
              key={w.id}
              className="flex flex-col rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900">
                      {w.title}
                    </h2>
                    {w.badge ? (
                      <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                        {w.badge}
                      </span>
                    ) : null}
                  </div>
                </div>
                <ToggleSwitch
                  checked={w.enabled}
                  ariaLabel={`Enable ${w.title} on live HUD`}
                  onCheckedChange={(next) => {
                    setMockWidgets((prev) =>
                      prev.map((x) =>
                        x.id === w.id ? { ...x, enabled: next } : x
                      )
                    );
                  }}
                />
              </div>
              <p className="mb-4 flex-1 text-xs leading-relaxed text-slate-500">
                {w.description}
              </p>
              <button
                type="button"
                onClick={() => setWidgetEditorId(w.id)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-indigo-600 hover:bg-slate-50"
              >
                <Pencil size={14} /> Edit widget
              </button>
            </div>
          ))}
        </div>

        <WidgetCreateSheetOverlay
          open={widgetCreateOpen}
          onClose={() => setWidgetCreateOpen(false)}
          onPickTemplate={(opt) => {
            const w = newWidgetFromCreateOption(opt);
            setMockWidgets((prev) => [...prev, w]);
            setWidgetCreateOpen(false);
            setWidgetEditorId(w.id);
          }}
          onCreateWithAI={() => {
            setWidgetCreateOpen(false);
            setIsAgentOpen(true);
            window.setTimeout(() => {
              handleSendMessage("Generate HUD widget with Copilot");
            }, 0);
          }}
        />
        <WidgetEditorSheetOverlay
          widget={editingWidget}
          onClose={() => setWidgetEditorId(null)}
          onSave={(next) => {
            setMockWidgets((prev) =>
              prev.map((x) => (x.id === next.id ? next : x))
            );
            setWidgetEditorId(null);
          }}
        />
      </div>
    );
  };

  const SettingsView = () => (
    <div className="animate-in fade-in mx-auto w-full max-w-4xl p-6 pb-32 md:p-12">
      <h1 className="mb-2 text-2xl font-black text-slate-900">Settings</h1>
      <p className="mb-8 text-sm text-slate-500">
        Integrations, app preferences, payout account, and your plan.
      </p>

      <div className="space-y-8">
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-4">
            <Plug className="text-indigo-600" size={20} />
            <h2 className="text-sm font-black text-slate-900">Integrations</h2>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Linked OAuth and partner accounts. Open the list for per-service
            status; use Manage at the bottom to edit (mock).
          </p>
          <div
            className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50/50"
            role="region"
            aria-label="Integration list"
          >
            <div className="flex w-full items-stretch bg-white">
              <button
                type="button"
                onClick={() => setIntegrationsAccordionOpen((o) => !o)}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-2 px-3 py-3.5 text-left transition-colors hover:bg-slate-50"
                aria-expanded={integrationsAccordionOpen}
                aria-controls="integration-list-panel"
                id="integration-list-trigger"
              >
                {(() => {
                  const connected = mockIntegrations.filter(
                    (i) => i.status === "connected"
                  ).length;
                  const failed = mockIntegrations.filter(
                    (i) => i.status === "failed"
                  ).length;
                  return (
                    <div
                      className="flex flex-wrap items-center gap-2"
                      aria-label="Integration summary"
                    >
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-800">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                          aria-hidden
                        />
                        {connected} connected
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-rose-800">
                        <span
                          className="h-1.5 w-1.5 rounded-full bg-rose-500"
                          aria-hidden
                        />
                        {failed} failed
                      </span>
                    </div>
                  );
                })()}
              </button>
              <button
                type="button"
                onClick={() => setIntegrationsAccordionOpen((o) => !o)}
                className="flex shrink-0 items-center justify-center border-l border-slate-100 px-3 text-slate-500 outline-none ring-indigo-500/40 transition-colors hover:bg-slate-50 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-inset"
                aria-expanded={integrationsAccordionOpen}
                aria-controls="integration-list-panel"
                aria-label={
                  integrationsAccordionOpen
                    ? "Collapse integration list"
                    : "Expand integration list"
                }
              >
                <ChevronDown
                  size={20}
                  className={`transition-transform duration-200 ${integrationsAccordionOpen ? "rotate-180" : ""}`}
                  aria-hidden
                />
              </button>
            </div>
            {integrationsAccordionOpen ? (
              <ul
                id="integration-list-panel"
                className="divide-y divide-slate-100 border-t border-slate-100 bg-white"
                role="list"
                aria-labelledby="integration-list-trigger"
              >
                {mockIntegrations.map((row) => {
                  const ok = row.status === "connected";
                  return (
                    <li
                      key={row.id}
                      className="px-3 py-3"
                      role="listitem"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-bold text-slate-900">
                          {row.name}
                        </p>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                            ok
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {ok ? "Connected" : "Failed"}
                        </span>
                      </div>
                      {row.detail ? (
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                          {row.detail}
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setIntegrationsEditorOpen(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50 py-3 text-sm font-black text-indigo-800 transition-colors hover:bg-indigo-100"
          >
            <Pencil size={16} strokeWidth={2.5} aria-hidden />
            Manage integrations
          </button>
          <IntegrationsEditorSheetOverlay
            open={integrationsEditorOpen}
            integrations={mockIntegrations}
            onClose={() => setIntegrationsEditorOpen(false)}
            onSave={(next) => {
              setMockIntegrations(next);
              setIntegrationsEditorOpen(false);
            }}
          />
          <PlanDialogSheetOverlay
            open={planDialogOpen}
            currentPlan={settingsData.plan}
            onClose={() => setPlanDialogOpen(false)}
            onSelectPlan={(plan) =>
              setSettingsData((prev) => ({ ...prev, plan }))
            }
          />
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Globe className="text-indigo-600" size={20} />
            <h2 className="text-sm font-black text-slate-900">App</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Language
              </label>
              <select
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium"
                defaultValue={settingsData.locale}
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-sm font-bold text-slate-800">
                Email notifications
              </span>
              <ToggleSwitch
                checked={emailNotify}
                ariaLabel="Email notifications"
                onCheckedChange={setEmailNotify}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <KeyRound className="text-emerald-600" size={20} />
            <h2 className="text-sm font-black text-slate-900">
              Financial · payout account
            </h2>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Default destination for withdrawals. Run payouts from{" "}
            <span className="font-bold text-slate-700">Wallet</span>.
          </p>
          <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div>
              <p className="text-xs font-bold text-slate-800">Active gateway</p>
              <p className="text-[10px] text-slate-500">
                {settingsData.gateway}
              </p>
            </div>
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-slate-400">
              PIX key (masked)
            </label>
            <input
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              value={settingsData.payoutPix}
            />
          </div>
          <button
            type="button"
            className="mt-3 text-xs font-bold text-indigo-600 underline"
          >
            Update payout method (mock)
          </button>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Crown className="text-amber-500" size={20} />
            <h2 className="text-sm font-black text-slate-900">Plan</h2>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Current
              </p>
              <p className="text-lg font-black text-slate-900">
                {settingsData.plan}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                AI credits:{" "}
                <span className="font-bold text-slate-800">
                  {settingsData.aiCreditsUsed} / {settingsData.aiCreditsLimit}
                </span>{" "}
                this month
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPlanDialogOpen(true)}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white"
            >
              Compare plans (mock)
            </button>
          </div>
          <p className="mt-4 text-[10px] text-slate-400">
            Open beta: Free + Starter only. Growth unlocks e-com &amp; marketplace
            sync — see docs.
          </p>
        </section>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-white font-sans text-slate-900">
      {/* DESKTOP SIDEBAR */}
      <aside className="z-10 hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 font-black text-white">
            P
          </div>
          <span className="text-lg font-black tracking-tight">PubliHub</span>
        </div>
        <nav className="flex-1 space-y-2 p-4">
          {(
            [
              { id: "hub" as const, icon: Home, label: "My Hub" },
              { id: "wallet" as const, icon: WalletIcon, label: "Wallet" },
              { id: "quests" as const, icon: Target, label: "Quests" },
              { id: "widgets" as const, icon: LayoutGrid, label: "Widgets" },
              { id: "settings" as const, icon: Settings, label: "Settings" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all ${activeTab === tab.id ? "bg-slate-900 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"}`}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* MOBILE HEADER */}
      <header className="absolute left-0 right-0 top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-xs font-black text-white">
            P
          </div>
          <span className="text-sm font-black tracking-tight">PubliHub</span>
        </div>
        <div className="h-7 w-7 overflow-hidden rounded-full border border-slate-200">
          <img src={hubData.profile.avatar} alt="" />
        </div>
      </header>

      {/* MAIN SCROLLABLE CONTENT */}
      <main className="relative flex-1 overflow-y-auto scroll-smooth pt-14 md:pt-0">
        {activeTab === "hub" && <HubView />}
        {activeTab === "wallet" && <WalletView />}
        {activeTab === "quests" && <QuestsView />}
        {activeTab === "widgets" && <WidgetsView />}
        {activeTab === "settings" && <SettingsView />}
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-20 items-center justify-around border-t border-slate-200 bg-white px-2 pb-4 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] md:hidden">
        {(
          [
            { id: "hub" as const, icon: Home, label: "Hub" },
            { id: "wallet" as const, icon: WalletIcon, label: "Wallet" },
            { id: "quests" as const, icon: Target, label: "Quests" },
            { id: "widgets" as const, icon: LayoutGrid, label: "Widgets" },
            { id: "settings" as const, icon: Settings, label: "Settings" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center gap-1.5 p-2 ${activeTab === tab.id ? "text-indigo-600" : "text-slate-400"}`}
          >
            <tab.icon
              size={22}
              className={activeTab === tab.id ? "fill-indigo-50/50" : ""}
            />
            <span className="text-[9px] font-black uppercase tracking-widest">
              {tab.label}
            </span>
          </button>
        ))}
      </nav>

      {/* COPILOT AGENT BUBBLE */}
      <div className="fixed bottom-24 right-4 z-[60] flex flex-col items-end md:bottom-8 md:right-8">
        {isAgentOpen && (
          <div className="mb-4 flex h-[min(78vh,640px)] w-[calc(100vw-32px)] origin-bottom-right flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl animate-in slide-in-from-bottom-4 md:h-[min(75vh,620px)] md:max-w-[820px] md:w-[min(92vw,820px)]">
            <div className="flex h-16 shrink-0 items-center justify-between bg-slate-900 px-4 md:px-6">
              <div className="flex items-center gap-3 text-white">
                <div className="rounded-lg bg-indigo-500 p-1.5">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">PubliHub Copilot</h3>
                  <p className="text-[10px] font-medium text-indigo-200">
                    Chat + generative canvas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAgentOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div
              className="flex shrink-0 border-b border-slate-200 bg-slate-50 md:hidden"
              role="tablist"
              aria-label="Copilot workspace"
            >
              <button
                type="button"
                role="tab"
                aria-selected={copilotMobileTab === "chat"}
                onClick={() => setCopilotMobileTab("chat")}
                className={`flex-1 py-2.5 text-center text-[11px] font-black uppercase tracking-wide ${copilotMobileTab === "chat" ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-500"}`}
              >
                Chat
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={copilotMobileTab === "canvas"}
                onClick={() => setCopilotMobileTab("canvas")}
                className={`relative flex-1 py-2.5 text-center text-[11px] font-black uppercase tracking-wide ${copilotMobileTab === "canvas" ? "border-b-2 border-indigo-600 text-indigo-700" : "text-slate-500"}`}
              >
                Canvas
                {generativeCanvasDrafts.length > 0 ? (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-violet-600 px-1.5 py-0.5 text-[9px] font-black text-white">
                    {generativeCanvasDrafts.length}
                  </span>
                ) : null}
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col md:flex-row">
              <div
                className={`min-h-0 min-w-0 flex-1 flex-col ${copilotMobileTab === "chat" ? "flex" : "hidden"} md:flex`}
              >
                <div className="flex-1 space-y-4 overflow-y-auto scroll-smooth bg-slate-50 p-4">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed ${m.role === "user" ? "rounded-br-sm bg-indigo-600 text-white shadow-sm" : "rounded-bl-sm border border-slate-200 bg-white text-slate-800 shadow-sm"}`}
                      >
                        {m.content}
                      </div>
                      {(m.generativeUI?.type === "hub_block_draft" ||
                        m.generativeUI?.type === "hud_widget_draft") &&
                      m.role === "ai" ? (
                        <p className="mt-2 max-w-[85%] text-[11px] font-medium text-slate-500">
                          Preview and apply on the{" "}
                          <span className="font-bold text-indigo-700">
                            Generative canvas
                          </span>
                          {copilotMobileTab === "chat" ? (
                            <>
                              {" "}
                              <button
                                type="button"
                                className="font-bold text-indigo-600 underline"
                                onClick={() => setCopilotMobileTab("canvas")}
                              >
                                Open canvas
                              </button>
                            </>
                          ) : null}
                          .
                        </p>
                      ) : null}
                      {m.generativeUI?.type === "withdrawal_widget" && (
                        <GenerativeWithdrawalWidget />
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              </div>

              <div
                className={`min-h-0 shrink-0 border-slate-200 md:w-[min(38%,300px)] md:border-l ${copilotMobileTab === "canvas" ? "flex min-h-[260px] flex-1 flex-col" : "hidden"} md:flex md:min-h-0 md:flex-1 md:flex-col`}
              >
                <GenerativeCanvasPanel
                  drafts={generativeCanvasDrafts}
                  onApplyHubBlock={applyCanvasHubBlock}
                  onApplyHudWidget={applyCanvasHudWidget}
                  onDismiss={dismissCanvasDraft}
                  onRefineInChat={refineCanvasDraftInChat}
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto whitespace-nowrap border-t border-slate-100 bg-white px-4 py-2 scrollbar-hide">
              {CONTEXTUAL_ACTIONS[activeTab].map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(action)}
                  className="inline-block rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[10px] font-bold text-indigo-600 transition-colors hover:bg-indigo-600 hover:text-white"
                >
                  {action}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-white p-4 pt-2">
              <div className="w-6 text-center text-[10px] font-black text-indigo-400">
                {aiCredits}
              </div>
              <form
                onSubmit={handleSendMessage}
                className="relative flex flex-1 items-center"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Ask me to edit your ${activeTab}...`}
                  className="w-full rounded-2xl border border-transparent bg-slate-100 py-3 pl-4 pr-12 text-sm transition-all focus:border-indigo-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="absolute right-1.5 rounded-xl bg-indigo-600 p-2 text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsAgentOpen(!isAgentOpen)}
          className={`flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 ${isAgentOpen ? "rotate-12 bg-slate-900 text-white" : "bg-indigo-600 text-white shadow-indigo-500/50"}`}
        >
          {isAgentOpen ? <X size={24} /> : <Sparkles size={24} />}
        </button>
      </div>

      <HubBlockSheetOverlay
        block={hubBlockSheet}
        onClose={() => setHubBlockSheet(null)}
        onSaveEdit={(updated) => {
          setHubBlocksByPage((prev) => ({
            ...prev,
            [hubContentPageId]: (prev[hubContentPageId] ?? []).map((b) =>
              b.id === updated.id ? updated : b
            ),
          }));
          setHubBlockSheet(null);
        }}
        onConfirmDelete={(id) => {
          removeBlock(id);
          setHubBlockSheet(null);
        }}
      />
    </div>
  );
}
