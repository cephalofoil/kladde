"use client";

import React from "react";
import type { DocumentSection } from "@/types/canvas";
import { Minus, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface SpacerSectionProps {
  section: DocumentSection;
  onUpdate: (updates: Partial<DocumentSection>) => void;
  onRemove: () => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function SpacerSection({
  section,
  onUpdate,
  onRemove,
  isDragging = false,
  dragHandleProps,
}: SpacerSectionProps) {
  const height = section.height || 10;

  return (
    <div
      className={`border-2 border-dashed border-gray-200 bg-gray-50 rounded-lg p-3 mb-2 transition-all ${
        isDragging ? "opacity-50 scale-95" : "opacity-100"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing hover:bg-gray-200 rounded p-1"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          <Minus className="w-4 h-4 text-gray-400" />
          <div className="text-xs text-gray-500">Spacer ({height}mm)</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Slider
          value={[height]}
          onValueChange={(value) => onUpdate({ height: value[0] })}
          min={5}
          max={50}
          step={5}
          className="flex-1"
        />
        <div className="text-xs text-gray-600 w-12 text-right">{height}mm</div>
      </div>

      {/* Visual representation of spacer */}
      <div
        className="mt-3 bg-gray-200 rounded-sm mx-auto"
        style={{
          height: `${Math.min(height, 50)}px`,
          width: "100%",
          maxHeight: "50px",
        }}
      />
    </div>
  );
}
