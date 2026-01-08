"use client";

import { useState, useRef, useEffect } from "react";
import { GripVertical, X, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HeadingSection } from "@/lib/board-types";

interface HeadingSectionRendererProps {
  section: HeadingSection;
  onUpdate: (updates: Partial<HeadingSection>) => void;
  onRemove: () => void;
}

const headingStyles = {
  1: { fontSize: "26.7px", fontWeight: 700 },
  2: { fontSize: "21.3px", fontWeight: 600 },
  3: { fontSize: "17.3px", fontWeight: 600 },
};

export function HeadingSectionRenderer({
  section,
  onUpdate,
  onRemove,
}: HeadingSectionRendererProps) {
  const [showLevelMenu, setShowLevelMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const style = headingStyles[section.level];

  return (
    <div className="group relative flex items-start gap-1 py-1 hover:bg-gray-50/50 rounded transition-colors">
      {/* Drag Handle */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing pt-0.5">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center gap-1">
        {/* Level Selector */}
        <div className="relative">
          <button
            onClick={() => setShowLevelMenu(!showLevelMenu)}
            className="flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            H{section.level}
            <ChevronDown className="w-2 h-2" />
          </button>
          {showLevelMenu && (
            <div className="absolute top-full left-0 mt-0.5 bg-white border border-gray-200 rounded shadow-lg z-10">
              {([1, 2, 3] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    onUpdate({ level });
                    setShowLevelMenu(false);
                  }}
                  className={cn(
                    "block w-full px-2 py-1 text-left text-[10px] hover:bg-gray-50 transition-colors",
                    section.level === level && "bg-gray-100"
                  )}
                >
                  Heading {level}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Input */}
        <input
          ref={inputRef}
          type="text"
          value={section.text}
          onChange={(e) => onUpdate({ text: e.target.value })}
          placeholder={`Heading ${section.level}`}
          className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder:text-gray-300"
          style={style}
        />
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
