"use client";

import React from "react";
import {
  Zap,
  MessageSquare,
  Mic,
  Video as Youtube,
  Play,
  Volume2,
  LayoutGrid,
  Store,
  Link2,
  ExternalLink,
  TicketPercent,
  Music,
} from "lucide-react";
import type { HubBlock } from "@/types/hub-block";

const FAN_MESSAGES = [
  {
    id: 1,
    user: "Sarah99",
    amt: 50,
    type: "audio" as const,
    content: "TTS: Keep up the great streams!",
    voice: "Nova (Female)",
  },
  {
    id: 2,
    user: "GamerBro",
    amt: 20,
    type: "video" as const,
    title: "Check this meme out",
    url: "https://youtube.com",
  },
  {
    id: 3,
    user: "ArtFan",
    amt: 10,
    type: "text" as const,
    content: "Love the new presets!",
  },
];

type HubCardHubData = {
  theme: {
    bg: string;
    card: string;
    primary: string;
    song: string;
  };
  profile: {
    name: string;
    bio: string;
    avatar: string;
  };
};

export function HubBlockCardInner({
  block,
  hubData,
  activeDonationTab,
  setActiveDonationTab,
}: {
  block: HubBlock;
  hubData: HubCardHubData;
  activeDonationTab: "text" | "audio" | "video";
  setActiveDonationTab: React.Dispatch<
    React.SetStateAction<"text" | "audio" | "video">
  >;
}) {
  return (
    <>
      {block.type === "interactive_donation" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-amber-500" />
            <span
              className={`text-sm font-black ${hubData.theme.card.includes("bg-slate-800") ? "text-white" : "text-slate-900"}`}
            >
              {block.title}
            </span>
          </div>

          <div className="flex rounded-xl bg-slate-100/50 p-1">
            <button
              type="button"
              onClick={() => setActiveDonationTab("text")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-colors ${activeDonationTab === "text" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              <MessageSquare size={12} /> Text
            </button>
            <button
              type="button"
              onClick={() => setActiveDonationTab("audio")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-colors ${activeDonationTab === "audio" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Mic size={12} /> AI Voice
            </button>
            <button
              type="button"
              onClick={() => setActiveDonationTab("video")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[10px] font-bold transition-colors ${activeDonationTab === "video" ? "bg-white text-red-500 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Youtube size={12} /> Video
            </button>
          </div>

          <div className="space-y-3">
            {activeDonationTab === "text" && (
              <textarea
                placeholder="Write a public message..."
                className="h-16 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-indigo-300"
              />
            )}
            {activeDonationTab === "audio" && (
              <div className="space-y-2">
                <select className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-800 outline-none">
                  <option>Voice: Nova (Female)</option>
                  <option>Voice: Echo (Male)</option>
                  <option>Voice: Spongebob (Meme)</option>
                </select>
                <textarea
                  placeholder="Type what the AI should say on stream..."
                  className="h-16 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-indigo-300"
                />
              </div>
            )}
            {activeDonationTab === "video" && (
              <input
                type="text"
                placeholder="Paste YouTube Link here..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 outline-none focus:border-red-300"
              />
            )}

            <div className="flex items-center gap-2">
              <div className="flex w-24 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[10px] font-bold text-slate-400">R$</span>
                <input
                  type="number"
                  defaultValue={
                    activeDonationTab === "text"
                      ? 10
                      : activeDonationTab === "audio"
                        ? 25
                        : 50
                  }
                  className="w-full border-none bg-transparent text-sm font-black text-slate-800 outline-none"
                />
              </div>
              <button
                type="button"
                className={`flex-1 rounded-xl py-2.5 text-xs font-bold shadow-sm ${hubData.theme.primary}`}
              >
                Pay & Send Media
              </button>
            </div>
          </div>
        </div>
      )}

      {block.type === "fan_board" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <Volume2
              size={16}
              className={
                hubData.theme.card.includes("bg-slate-800")
                  ? "text-indigo-400"
                  : "text-indigo-600"
              }
            />
            <span
              className={`text-sm font-black ${hubData.theme.card.includes("bg-slate-800") ? "text-white" : "text-slate-900"}`}
            >
              {block.title}
            </span>
          </div>
          <div className="space-y-3">
            {FAN_MESSAGES.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-xl border p-3 ${hubData.theme.card.includes("bg-slate-800") ? "border-slate-600 bg-slate-700/50" : "border-slate-100 bg-slate-50"}`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-500">
                    {msg.user}
                  </span>
                  <span className="rounded bg-emerald-50 px-1.5 text-[10px] font-black text-emerald-500">
                    R$ {msg.amt}
                  </span>
                </div>
                {msg.type === "text" && (
                  <p className="text-xs font-medium text-slate-700">{msg.content}</p>
                )}
                {msg.type === "audio" && (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-medium text-slate-700">{msg.content}</p>
                    <div className="flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50/50 p-1.5">
                      <button
                        type="button"
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-white"
                      >
                        <Play size={10} className="ml-0.5" />
                      </button>
                      <span className="text-[9px] font-bold text-indigo-500">
                        Play {msg.voice}
                      </span>
                    </div>
                  </div>
                )}
                {msg.type === "video" && (
                  <div className="mt-1 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50/50 p-1.5">
                    <div className="flex h-6 w-8 items-center justify-center rounded bg-red-500 text-white">
                      <Youtube size={12} />
                    </div>
                    <span className="flex-1 truncate text-[10px] font-bold text-red-700">
                      {msg.title}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {block.type === "product" && (
        <div className="space-y-3">
          <img
            src={block.image}
            className="h-32 w-full rounded-xl object-cover"
            alt="Product"
          />
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-bold">{block.title}</h3>
              <p className="mt-1 text-[10px] opacity-70">{block.desc}</p>
            </div>
            <span
              className={`rounded-lg px-2 py-1 text-xs font-black shadow-sm ${hubData.theme.primary}`}
            >
              {block.price <= 0 ? "Free" : `R$ ${block.price}`}
            </span>
          </div>
          <button
            type="button"
            className={`w-full rounded-xl py-2.5 text-xs font-bold opacity-90 hover:opacity-100 ${hubData.theme.primary}`}
          >
            {block.price <= 0 ? "Open link" : "Buy Now"}
          </button>
        </div>
      )}

      {block.type === "marketplace_grid" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <LayoutGrid size={16} className="text-violet-600" aria-hidden />
              <span
                className={`text-sm font-black ${hubData.theme.card.includes("bg-slate-800") ? "text-white" : "text-slate-900"}`}
              >
                {block.title}
              </span>
            </div>
            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-violet-800">
              Marketplace
            </span>
          </div>
          <p
            className={`text-[11px] font-medium ${hubData.theme.card.includes("bg-slate-800") ? "text-slate-300" : "text-slate-500"}`}
          >
            Affiliate SKUs from your connected programs appear here. Fans shop
            without leaving your hub.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {block.channels.map((ch) => (
              <span
                key={ch}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold ${hubData.theme.card.includes("bg-slate-800") ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-700"}`}
              >
                {ch}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`rounded-xl border p-2 ${hubData.theme.card.includes("bg-slate-800") ? "border-slate-600 bg-slate-700/40" : "border-slate-100 bg-slate-50"}`}
              >
                <div className="mb-2 aspect-square w-full rounded-lg bg-gradient-to-br from-slate-200 to-slate-300" />
                <div className="h-2 w-3/4 rounded bg-slate-200/80" />
                <div className="mt-1 h-2 w-1/2 rounded bg-slate-200/60" />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="w-full rounded-xl border border-violet-200 bg-violet-50 py-2 text-[10px] font-black text-violet-800"
          >
            Manage product links
          </button>
        </div>
      )}

      {block.type === "ecommerce_embed" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Store size={16} className="text-emerald-600" aria-hidden />
              <span
                className={`text-sm font-black ${hubData.theme.card.includes("bg-slate-800") ? "text-white" : "text-slate-900"}`}
              >
                {block.title}
              </span>
            </div>
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-emerald-800">
              {block.platform}
            </span>
          </div>
          <p
            className={`text-[11px] font-medium ${hubData.theme.card.includes("bg-slate-800") ? "text-slate-300" : "text-slate-500"}`}
          >
            Live sync: {block.syncedCount} products mapped from your store.
            Orders route through your checkout.
          </p>
          <div
            className={`rounded-xl border p-3 ${hubData.theme.card.includes("bg-slate-800") ? "border-slate-600 bg-slate-700/30" : "border-emerald-100 bg-emerald-50/50"}`}
          >
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br from-emerald-200 to-teal-200" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-2.5 w-4/5 rounded bg-slate-200/90" />
                <div className="h-2 w-3/5 rounded bg-slate-200/70" />
                <div className="h-7 w-20 rounded-md bg-emerald-600/90" />
              </div>
            </div>
          </div>
          <button
            type="button"
            className="w-full rounded-xl border border-emerald-200 bg-white py-2 text-[10px] font-black text-emerald-800 shadow-sm"
          >
            Open store dashboard
          </button>
        </div>
      )}

      {block.type === "link_block" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Link2 size={18} className="text-sky-600" aria-hidden />
            <span
              className={`text-sm font-black ${hubData.theme.card.includes("bg-slate-800") ? "text-white" : "text-slate-900"}`}
            >
              {block.title}
            </span>
          </div>
          <p
            className={`text-[11px] font-medium ${hubData.theme.card.includes("bg-slate-800") ? "text-slate-400" : "text-slate-500"}`}
          >
            {block.subtitle}
          </p>
          <div
            className={`truncate rounded-xl border px-3 py-2 font-mono text-[10px] ${hubData.theme.card.includes("bg-slate-800") ? "border-slate-600 bg-slate-800/50 text-slate-300" : "border-slate-100 bg-slate-50 text-slate-600"}`}
          >
            {block.url}
          </div>
          <button
            type="button"
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold ${hubData.theme.primary}`}
          >
            <ExternalLink size={14} aria-hidden />
            Open link
          </button>
        </div>
      )}

      {block.type === "coupon_block" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TicketPercent size={18} className="text-rose-600" aria-hidden />
              <span
                className={`text-sm font-black ${hubData.theme.card.includes("bg-slate-800") ? "text-white" : "text-slate-900"}`}
              >
                {block.title}
              </span>
            </div>
            <span className="rounded-lg bg-rose-100 px-2 py-1 text-[10px] font-black text-rose-700">
              {block.discountLabel}
            </span>
          </div>
          <div
            className={`flex items-center justify-between rounded-xl border-2 border-dashed px-3 py-3 ${hubData.theme.card.includes("bg-slate-800") ? "border-rose-400/40 bg-rose-950/20" : "border-rose-200 bg-rose-50/60"}`}
          >
            <span className="font-mono text-base font-black tracking-widest text-rose-700">
              {block.code}
            </span>
            <button
              type="button"
              className="rounded-lg bg-rose-600 px-3 py-1.5 text-[10px] font-black uppercase text-white"
            >
              Copy
            </button>
          </div>
          <p
            className={`text-center text-[10px] font-medium ${hubData.theme.card.includes("bg-slate-800") ? "text-slate-400" : "text-slate-500"}`}
          >
            Single-use or partner rules apply at checkout.
          </p>
        </div>
      )}

      {block.type === "song_block" && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-md">
              <Music size={24} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p
                className={`truncate text-sm font-black ${hubData.theme.card.includes("bg-slate-800") ? "text-white" : "text-slate-900"}`}
              >
                {block.title}
              </p>
              <p
                className={`truncate text-[11px] font-bold ${hubData.theme.card.includes("bg-slate-800") ? "text-slate-400" : "text-slate-500"}`}
              >
                {block.artist}
              </p>
              <span className="mt-1 inline-block rounded-md bg-fuchsia-100 px-2 py-0.5 text-[9px] font-black uppercase text-fuchsia-800">
                {block.platform}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[10px] font-black ${hubData.theme.primary}`}
            >
              <Play size={12} className="ml-0.5" aria-hidden />
              Listen
            </button>
            <button
              type="button"
              className={`rounded-xl border px-3 py-2.5 text-[10px] font-bold ${hubData.theme.card.includes("bg-slate-800") ? "border-slate-600 text-slate-200" : "border-slate-200 text-slate-700"}`}
            >
              Share
            </button>
          </div>
        </div>
      )}
    </>
  );
}
