"use client";

import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpacerSection } from "@/lib/board-types";

interface SpacerSectionRendererProps {
  section: SpacerSection;
  onUpdate: (updates: Partial<SpacerSection>) => void;
  onRemove: () => void;
}

export function SpacerSectionRenderer({
  section,
  onUpdate,
  onRemove,
}: SpacerSectionRendererProps) {
  // Convert mm to px (at 50% scale, so divide by 2)
  const heightPx = (section.height * 3.78) / 2;

  return (
    <div className="group relative flex items-center gap-1 hover:bg-gray-50/50 rounded transition-colors">
      {/* Drag Handle */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>

      {/* Spacer Visual */}
      <div
        className="flex-1 flex items-center justify-center border border-dashed border-gray-200 rounded bg-gray-50/50"
        style={{ height: Math.max(heightPx, 12) }}
      >
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[8px] text-gray-400">{section.height}mm</span>
          <input
            type="range"
            min={5}
            max={50}
            value={section.height}
            onChange={(e) => onUpdate({ height: parseInt(e.target.value) })}
            className="w-16 h-1 appearance-none bg-gray-200 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2 [&::-webkit-slider-thumb]:h-2 [&::-webkit-slider-thumb]:bg-gray-500 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded"
      >
        <X className="w-3 h-3 text-red-500" />
      </button>
    </div>
  );
}
