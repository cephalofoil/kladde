"use client";

import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";

// Curated workspace color palette - vibrant but professional
const WORKSPACE_COLORS = [
  "#2563eb", // Blue
  "#0ea5e9", // Sky
  "#14b8a6", // Teal
  "#16a34a", // Green
  "#84cc16", // Lime
  "#eab308", // Yellow
  "#f97316", // Orange
  "#ef4444", // Red
  "#ec4899", // Pink
  "#db2777", // Fuchsia
  "#a855f7", // Purple
  "#7c3aed", // Violet
  "#6366f1", // Indigo
  "#64748b", // Slate
];

interface WorkspaceColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onClose?: () => void;
}

export function WorkspaceColorPicker({
  value,
  onChange,
  onClose,
}: WorkspaceColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    // Ensure it starts with #
    if (val && !val.startsWith("#")) {
      val = "#" + val;
    }
    setHexInput(val);
  };

  const handleHexSubmit = () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    if (hexPattern.test(hexInput)) {
      onChange(hexInput.toLowerCase());
      onClose?.();
    } else {
      setHexInput(value);
    }
  };

  const handlePresetClick = (color: string) => {
    setHexInput(color);
    onChange(color);
    onClose?.();
  };

  return (
    <div className="p-3 w-[220px]">
      {/* Color swatches grid */}
      <div className="grid grid-cols-7 gap-1.5 mb-3">
        {WORKSPACE_COLORS.map((color) => {
          const isSelected = value.toLowerCase() === color.toLowerCase();
          return (
            <button
              key={color}
              onClick={() => handlePresetClick(color)}
              className="group relative w-6 h-6 rounded-full transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              style={{ backgroundColor: color }}
              title={color}
            >
              {isSelected && (
                <Check
                  className="absolute inset-0 m-auto h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
                  strokeWidth={3}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full shrink-0 border border-border"
          style={{ backgroundColor: hexInput }}
        />
        <Input
          ref={inputRef}
          value={hexInput}
          onChange={handleHexChange}
          onBlur={handleHexSubmit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleHexSubmit();
            } else if (e.key === "Escape") {
              setHexInput(value);
              onClose?.();
            }
          }}
          className="h-7 text-xs font-mono uppercase"
          placeholder="#000000"
          maxLength={7}
        />
      </div>
    </div>
  );
}
