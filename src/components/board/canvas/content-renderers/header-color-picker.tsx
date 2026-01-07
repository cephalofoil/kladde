"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Preset colors for quick selection
const PRESET_COLORS = [
  "#ffffff", // White
  "#f3f4f6", // Gray 100
  "#e5e7eb", // Gray 200
  "#d1d5db", // Gray 300
  "#000000", // Black
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#84cc16", // Lime
  "#22c55e", // Green
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#a855f7", // Purple
  "#ec4899", // Pink
];

interface HeaderColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
}

/**
 * Calculate if white or black text is more visible on the given background color
 */
function getContrastTextColor(hexColor: string): string {
  // Remove # if present
  const hex = hexColor.replace("#", "");

  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate relative luminance using the formula:
  // L = 0.2126 * R + 0.7152 * G + 0.0722 * B
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  // Return white for dark backgrounds, black for light backgrounds
  return luminance > 128 ? "#000000" : "#ffffff";
}

export function HeaderColorPicker({
  value,
  onChange,
  onClose,
}: HeaderColorPickerProps) {
  const [hexInput, setHexInput] = useState(value);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHexInput(e.target.value);
  };

  const handleHexBlur = () => {
    // Validate hex color
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    if (hexPattern.test(hexInput)) {
      onChange(hexInput);
    } else {
      // Reset to current value if invalid
      setHexInput(value);
    }
  };

  const handleHexKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleHexBlur();
    }
  };

  const handlePresetClick = (color: string) => {
    setHexInput(color);
    onChange(color);
  };

  return (
    <div
      ref={pickerRef}
      className="w-64 bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Header Color</h3>
        <Button
          onClick={onClose}
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Hex Input */}
      <div className="mb-4">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">
          Hex Code
        </label>
        <Input
          value={hexInput}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          onKeyDown={handleHexKeyDown}
          className="font-mono text-sm"
          placeholder="#FFFFFF"
        />
      </div>

      {/* Preset Colors */}
      <div>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 block">
          Preset Colors
        </label>
        <div className="grid grid-cols-6 gap-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handlePresetClick(color)}
              className="w-8 h-8 rounded-md border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
              style={{
                backgroundColor: color,
                borderColor: value === color ? "#3b82f6" : undefined,
                borderWidth: value === color ? "2px" : "1px",
              }}
              title={color}
            />
          ))}
        </div>
      </div>

      {/* Reset Button */}
      <Button
        onClick={() => {
          setHexInput("#f9fafb");
          onChange("#f9fafb");
        }}
        variant="outline"
        size="sm"
        className="w-full mt-4"
      >
        Reset to Default
      </Button>
    </div>
  );
}

export { getContrastTextColor };
