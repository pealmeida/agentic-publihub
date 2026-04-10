"use client";

import React from "react";
import {
  LayoutGrid,
  Monitor,
  Sparkles,
  Trash2,
  MessageSquareText,
} from "lucide-react";

export type GenerativeCanvasDraftKind = "hub_block" | "hud_widget";

/** One agent-produced draft sitting on the canvas until applied or dismissed. */
export type GenerativeCanvasDraft = {
  id: string;
  kind: GenerativeCanvasDraftKind;
  /** Chat message id that produced this draft (for traceability). */
  sourceMessageId?: number;
  createdAt: number;
};

function HubBlockDraftPreview() {
  return (
    <div className="rounded-lg border border-white bg-white/95 p-3 shadow-sm">
      <div className="mb-2 h-12 w-full rounded-md bg-gradient-to-r from-indigo-100 to-violet-100" />
      <div className="h-2 w-2/3 rounded bg-slate-200" />
      <div className="mt-2 h-2 w-full rounded bg-slate-100" />
      <div className="mt-2 flex gap-2">
        <div className="h-10 flex-1 rounded-md bg-slate-100" />
        <div className="h-10 flex-1 rounded-md bg-slate-100" />
      </div>
    </div>
  );
}

function HudWidgetDraftPreview() {
  return (
    <div className="rounded-lg border border-white bg-white/95 p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase text-slate-400">
          HUD overlay
        </span>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-800">
          Live
        </span>
      </div>
      <div className="rounded-lg border border-violet-100 bg-gradient-to-br from-violet-600/90 to-indigo-700/90 px-2 py-3 text-center text-white shadow-inner">
        <p className="text-[9px] font-bold uppercase tracking-wider text-violet-200">
          Donation
        </p>
        <p className="mt-0.5 text-sm font-black">R$ 25 · fan_alex</p>
      </div>
    </div>
  );
}

export type GenerativeCanvasPanelProps = {
  drafts: GenerativeCanvasDraft[];
  onApplyHubBlock: (draftId: string) => void;
  onApplyHudWidget: (draftId: string) => void;
  onDismiss: (draftId: string) => void;
  onRefineInChat: (draftId: string, kind: GenerativeCanvasDraftKind) => void;
};

/**
 * Artboard-style harness for Copilot generative outputs: hub blocks and HUD widgets
 * are previewed here, then applied into the real Hub or widget catalog.
 */
export function GenerativeCanvasPanel({
  drafts,
  onApplyHubBlock,
  onApplyHudWidget,
  onDismiss,
  onRefineInChat,
}: GenerativeCanvasPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100/90">
      <div className="shrink-0 border-b border-slate-200/80 bg-white/90 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <LayoutGrid className="text-indigo-600" size={16} aria-hidden />
          <div>
            <p className="text-[11px] font-black uppercase tracking-wide text-slate-800">
              Generative canvas
            </p>
            <p className="text-[10px] leading-snug text-slate-500">
              Agent drafts land here — apply into Hub or HUD, or refine in chat.
            </p>
          </div>
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto p-3"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgb(148 163 184 / 0.35) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      >
        {drafts.length === 0 ? (
          <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/80 bg-white/60 p-4 text-center">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <Sparkles size={22} aria-hidden />
            </div>
            <p className="text-xs font-bold text-slate-700">Harness ready</p>
            <p className="mt-1 max-w-[220px] text-[11px] leading-relaxed text-slate-500">
              Ask Copilot to generate a{" "}
              <span className="font-semibold text-slate-600">hub block</span> or{" "}
              <span className="font-semibold text-slate-600">HUD widget</span>.
              Previews and apply actions appear on this canvas.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Generative drafts">
            {drafts.map((d) => (
              <li
                key={d.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {d.kind === "hub_block" ? (
                      <LayoutGrid
                        className="text-indigo-500"
                        size={14}
                        aria-hidden
                      />
                    ) : (
                      <Monitor
                        className="text-violet-600"
                        size={14}
                        aria-hidden
                      />
                    )}
                    <span className="text-[10px] font-black uppercase tracking-wide text-slate-700">
                      {d.kind === "hub_block"
                        ? "Hub block draft"
                        : "HUD widget draft"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDismiss(d.id)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                    aria-label="Remove draft from canvas"
                  >
                    <Trash2 size={14} aria-hidden />
                  </button>
                </div>
                <div className="p-3">
                  {d.kind === "hub_block" ? (
                    <HubBlockDraftPreview />
                  ) : (
                    <HudWidgetDraftPreview />
                  )}
                  <div className="mt-3 flex flex-col gap-2">
                    {d.kind === "hub_block" ? (
                      <button
                        type="button"
                        onClick={() => onApplyHubBlock(d.id)}
                        className="w-full rounded-xl bg-indigo-600 py-2.5 text-xs font-black text-white transition-colors hover:bg-indigo-700"
                      >
                        Apply to active hub page
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onApplyHudWidget(d.id)}
                        className="w-full rounded-xl bg-violet-600 py-2.5 text-xs font-black text-white transition-colors hover:bg-violet-700"
                      >
                        Add to widget catalog
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onRefineInChat(d.id, d.kind)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
                    >
                      <MessageSquareText size={14} aria-hidden />
                      Refine in chat
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
