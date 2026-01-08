"use client";

import { useState, useCallback } from "react";
import { GripVertical, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpacerSection } from "@/lib/board-types";

interface SpacerSectionRendererProps {
  section: SpacerSection;
  onUpdate: (updates: Partial<SpacerSection>) => void;
  onRemove: () => void;
}

const PRESET_SIZES = [
  { label: "S", value: 15 },
  { label: "M", value: 25 },
  { label: "L", value: 35 },
] as const;

export function SpacerSectionRenderer({
  section,
  onUpdate,
  onRemove,
}: SpacerSectionRendererProps) {
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customValue, setCustomValue] = useState(String(section.height));

  // Convert mm to px at 96 DPI
  const heightPx = section.height * 3.78;

  const handlePresetClick = useCallback(
    (value: number) => {
      onUpdate({ height: value });
      setShowCustomInput(false);
    },
    [onUpdate]
  );

  const handleCustomSubmit = useCallback(() => {
    const value = parseInt(customValue);
    if (!isNaN(value) && value >= 5 && value <= 100) {
      onUpdate({ height: value });
    }
    setShowCustomInput(false);
  }, [customValue, onUpdate]);

  const handleCustomKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleCustomSubmit();
      } else if (e.key === "Escape") {
        setShowCustomInput(false);
        setCustomValue(String(section.height));
      }
    },
    [handleCustomSubmit, section.height]
  );

  const isPresetActive = (value: number) => section.height === value;
  const isCustomActive = !PRESET_SIZES.some((p) => p.value === section.height);

  return (
    <div className="group relative flex items-center gap-1 hover:bg-gray-50/50 rounded transition-colors">
      {/* Drag Handle */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>

      {/* Spacer Visual */}
      <div
        className="flex-1 flex items-center justify-center border border-dashed border-gray-200 rounded bg-gray-50/50"
        style={{ height: Math.max(heightPx, 16) }}
      >
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Preset size buttons */}
          {PRESET_SIZES.map((preset) => (
            <button
              key={preset.label}
              onClick={() => handlePresetClick(preset.value)}
              className={cn(
                "px-3 py-1.5 text-[13px] font-bold rounded transition-colors min-w-[28px]",
                isPresetActive(preset.value)
                  ? "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {preset.label}
            </button>
          ))}

          {/* Custom input toggle/display */}
          {showCustomInput ? (
            <input
              type="number"
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              onBlur={handleCustomSubmit}
              onKeyDown={handleCustomKeyDown}
              min={5}
              max={100}
              autoFocus
              className="w-16 px-2.5 py-1.5 text-[13px] font-bold text-center bg-white border border-gray-300 rounded focus:outline-none focus:border-gray-500"
            />
          ) : (
            <button
              onClick={() => {
                setCustomValue(String(section.height));
                setShowCustomInput(true);
              }}
              className={cn(
                "px-3 py-1.5 text-[13px] font-bold rounded transition-colors min-w-[28px]",
                isCustomActive
                  ? "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              )}
            >
              {isCustomActive ? `${section.height}` : "..."}
            </button>
          )}
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
