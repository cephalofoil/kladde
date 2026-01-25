"use client";

import { useMemo, useEffect } from "react";
import Image from "next/image";
import { GripVertical, X, AlertTriangle, Square, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardElement, FrameImageSection } from "@/lib/board-types";
import { renderFrameImageDataUrl } from "@/lib/frame-image";

const HANDLE_GUTTER_PX = 28;
const HANDLE_TOP_OFFSET_PX = 6;
const CONTENT_WIDTH_PX = 794 - 2 * 94;
const FRAME_ACCENT_COLOR = "#059669";

const getFrameStyleLabel = (style?: string) => {
  switch (style) {
    case "cutting-mat":
      return "Cutting Mat";
    case "notebook":
      return "Notebook";
    case "minimal":
    default:
      return "Minimal";
  }
};

interface FrameImageSectionRendererProps {
  section: FrameImageSection;
  allElements: BoardElement[];
  onRemove: () => void;
  onUpdate: (updates: Partial<FrameImageSection>) => void;
  onIncludeContent: () => void;
}

export function FrameImageSectionRenderer({
  section,
  allElements,
  onRemove,
  onUpdate,
  onIncludeContent,
}: FrameImageSectionRendererProps) {
  const liveFrame = useMemo(
    () => allElements.find((el) => el.type === "frame" && el.id === section.frameId),
    [allElements, section.frameId]
  );
  const preview = useMemo(() => {
    if (!liveFrame) {
      return null;
    }

    const frameWidth = liveFrame.width ?? 0;
    const scale =
      frameWidth > 0 ? Math.min(1, CONTENT_WIDTH_PX / frameWidth) : 1;

    return renderFrameImageDataUrl({
      frameId: section.frameId,
      elements: allElements,
      scale,
    });
  }, [section.frameId, allElements, liveFrame]);
  const isRendering = false;

  useEffect(() => {
    if (!liveFrame) return;
    const needsLabel = !section.cachedFrameLabel;
    const needsStyle = !section.cachedFrameStyle;
    if (needsLabel || needsStyle) {
      onUpdate({
        cachedFrameLabel: needsLabel
          ? liveFrame.label || "Frame"
          : section.cachedFrameLabel,
        cachedFrameStyle: needsStyle
          ? liveFrame.frameStyle || "minimal"
          : section.cachedFrameStyle,
      });
    }
  }, [liveFrame, onUpdate, section.cachedFrameLabel, section.cachedFrameStyle]);

  const label = liveFrame?.label || section.cachedFrameLabel || "Frame";
  const styleLabel = getFrameStyleLabel(
    liveFrame?.frameStyle || section.cachedFrameStyle
  );
  const isDeleted = !liveFrame;

  const frameTileIds = useMemo(() => {
    return allElements
      .filter(
        (el) =>
          el.type === "tile" &&
          el.frameId === section.frameId &&
          !el.hidden &&
          el.tileContent &&
          (el.tileContent.richText ||
            el.tileContent.noteText ||
            el.tileContent.code ||
            el.tileContent.chart ||
            el.tileContent.imageSrc)
      )
      .map((tile) => tile.id);
  }, [allElements, section.frameId]);

  const frameTileCount = frameTileIds.length;
  const hasTiles = frameTileCount > 0;

  return (
    <div
      className={cn(
        "group relative rounded-lg border px-3 py-2 pl-4 transition-colors",
        isDeleted
          ? "border-red-200 bg-red-50/60"
          : "border-slate-200 bg-slate-50/80 hover:border-slate-300/80"
      )}
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: FRAME_ACCENT_COLOR }}
      />
      <button
        type="button"
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        style={{ left: -HANDLE_GUTTER_PX, top: HANDLE_TOP_OFFSET_PX }}
        aria-label="Reorder section"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 mb-2">
          <div
            className="flex items-center justify-center w-6 h-6 rounded-md text-white"
            style={{ backgroundColor: FRAME_ACCENT_COLOR }}
          >
            <Square className="w-3.5 h-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold text-slate-900 truncate font-[var(--font-heading)]">
                {label}
              </span>
              <span className="text-[11px] text-slate-400">{styleLabel}</span>
              {isDeleted && (
                <span className="flex items-center gap-1 text-amber-600 text-[12px]">
                  <AlertTriangle className="w-3 h-3" />
                  <span>Source deleted</span>
                </span>
              )}
            </div>
            <span
              className="text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: FRAME_ACCENT_COLOR }}
            >
              Frame
            </span>
          </div>
          {!isDeleted && hasTiles && (
            <button
              type="button"
              onClick={onIncludeContent}
              className="flex items-center gap-1 ml-auto px-2 py-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>insert frame tiles below</span>
            </button>
          )}
        </div>

        <div className="ml-8">
          {isDeleted ? (
            <div className="border border-dashed border-red-200 bg-red-50 text-red-600 text-[12px] rounded p-2">
              Frame no longer exists.
            </div>
          ) : isRendering ? (
            <div className="border border-dashed border-slate-200 bg-white text-slate-500 text-[12px] rounded p-2">
              Rendering preview...
            </div>
          ) : preview?.dataUrl ? (
            <Image
              src={preview.dataUrl}
              alt={`${label} preview`}
              width={CONTENT_WIDTH_PX}
              height={Math.round(CONTENT_WIDTH_PX * 0.6)}
              className="max-w-full h-auto rounded border border-slate-200"
            />
          ) : (
            <div className="border border-dashed border-slate-200 bg-white text-slate-500 text-[12px] rounded p-2">
              Preview unavailable.
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onRemove}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded"
      >
        <X className="w-3 h-3 text-red-500" />
      </button>
    </div>
  );
}
