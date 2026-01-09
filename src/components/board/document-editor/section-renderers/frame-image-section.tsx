"use client";

import { useMemo, useEffect, useState } from "react";
import { GripVertical, X, AlertTriangle, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardElement, FrameImageSection } from "@/lib/board-types";
import {
  renderFrameImageDataUrl,
  type FrameImageResult,
} from "@/lib/frame-image";

const HANDLE_GUTTER_PX = 28;
const HANDLE_TOP_OFFSET_PX = 6;
const CONTENT_WIDTH_PX = 794 - 2 * 94;

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
}

export function FrameImageSectionRenderer({
  section,
  allElements,
  onRemove,
  onUpdate,
}: FrameImageSectionRendererProps) {
  const liveFrame = useMemo(
    () => allElements.find((el) => el.type === "frame" && el.id === section.frameId),
    [allElements, section.frameId]
  );
  const [preview, setPreview] = useState<FrameImageResult | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  useEffect(() => {
    if (!liveFrame) {
      setPreview(null);
      return;
    }

    const frameWidth = liveFrame.width ?? 0;
    const scale =
      frameWidth > 0 ? Math.min(1, CONTENT_WIDTH_PX / frameWidth) : 1;

    let isActive = true;
    setIsRendering(true);

    const result = renderFrameImageDataUrl({
      frameId: section.frameId,
      elements: allElements,
      scale,
    });

    if (isActive) {
      setPreview(result);
      setIsRendering(false);
    }

    return () => {
      isActive = false;
    };
  }, [section.frameId, allElements, liveFrame]);

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

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2 py-1 rounded transition-colors",
        isDeleted ? "bg-red-50/50" : "hover:bg-gray-50/50"
      )}
    >
      <button
        type="button"
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        style={{ left: -HANDLE_GUTTER_PX, top: HANDLE_TOP_OFFSET_PX }}
        aria-label="Reorder section"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-1">
          <div className="flex items-center justify-center w-4 h-4 rounded bg-emerald-100 text-emerald-700">
            <Square className="w-3 h-3" />
          </div>
          <span className="text-[13.3px] font-medium text-gray-600 truncate">
            {label}
          </span>
          <span className="text-[11px] text-gray-400">{styleLabel}</span>
          {isDeleted && (
            <div className="flex items-center gap-0.5 text-amber-600 text-[12px]">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>Source deleted</span>
            </div>
          )}
        </div>

        <div className="pl-5">
          {isDeleted ? (
            <div className="border border-dashed border-red-200 bg-red-50 text-red-600 text-[12px] rounded p-2">
              Frame no longer exists.
            </div>
          ) : isRendering ? (
            <div className="border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-[12px] rounded p-2">
              Rendering preview...
            </div>
          ) : preview?.dataUrl ? (
            <img
              src={preview.dataUrl}
              alt={`${label} preview`}
              className="max-w-full h-auto rounded border border-gray-200"
            />
          ) : (
            <div className="border border-dashed border-gray-200 bg-gray-50 text-gray-500 text-[12px] rounded p-2">
              Preview unavailable.
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onRemove}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded"
      >
        <X className="w-3 h-3 text-red-500" />
      </button>
    </div>
  );
}
