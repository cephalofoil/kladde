"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
  "#000000", // black
  "#ffffff", // white
  "#f3f4f6", // light gray
];

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full h-8 p-1 bg-transparent">
          <div className="flex items-center gap-2 w-full">
            <div
              className="w-4 h-4 rounded border"
              style={{ backgroundColor: color }}
            />
            <span className="text-xs font-mono">{color}</span>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Preset Colors</Label>
            <div className="grid grid-cols-6 gap-2 mt-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  className="w-8 h-8 rounded border-2 hover:scale-110 transition-transform"
                  style={{
                    backgroundColor: presetColor,
                    borderColor: color === presetColor ? "#3b82f6" : "#e5e7eb",
                  }}
                  onClick={() => {
                    onChange(presetColor);
                    setIsOpen(false);
                  }}
                />
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="hex-input" className="text-xs">
              Hex Color
            </Label>
            <Input
              id="hex-input"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#000000"
              className="h-8 font-mono"
            />
          </div>

          <div>
            <Label htmlFor="color-input" className="text-xs">
              Color Picker
            </Label>
            <input
              id="color-input"
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-8 rounded border cursor-pointer"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
