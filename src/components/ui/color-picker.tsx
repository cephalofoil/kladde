"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { X, Pipette } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { cn } from "@/lib/utils";
import {
  RGB,
  HSV,
  rgbToHsv,
  hsvToRgb,
  rgbToHex,
  rgbToRgbString,
  rgbToHslString,
  parseColor,
  isValidHex,
  clamp,
} from "@/lib/utils/color-conversions";

const RECENT_COLORS_KEY = "kladde-recent-colors";
const MAX_RECENT_COLORS = 10;

export interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  position?: { left: number; top: number } | "auto";
  showAlpha?: boolean;
  showEyedropper?: boolean;
  showSwatches?: boolean;
  showFormatTabs?: boolean;
}

type ColorFormat = "hex" | "rgb" | "hsl";

// Helper functions for recent colors
function getRecentColors(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_COLORS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentColor(color: string): void {
  if (typeof window === "undefined") return;
  try {
    const recent = getRecentColors();
    const filtered = recent.filter((c) => c !== color);
    const updated = [color, ...filtered].slice(0, MAX_RECENT_COLORS);
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * SaturationValueSelector Component
 * 2D draggable area for selecting saturation and value
 */
interface SaturationValueSelectorProps {
  hue: number;
  saturation: number;
  value: number;
  onChange: (s: number, v: number) => void;
}

function SaturationValueSelector({
  hue,
  saturation,
  value,
  onChange,
}: SaturationValueSelectorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateColor = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const y = clamp(clientY - rect.top, 0, rect.height);

      const s = (x / rect.width) * 100;
      const v = 100 - (y / rect.height) * 100;

      onChange(s, v);
    },
    [onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      updateColor(e.clientX, e.clientY);
    },
    [updateColor],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        updateColor(e.clientX, e.clientY);
      }
    },
    [isDragging, updateColor],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Calculate indicator position
  const indicatorX = (saturation / 100) * 100;
  const indicatorY = (1 - value / 100) * 100;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-48 rounded-md cursor-crosshair touch-none select-none"
      style={{
        background: `
          linear-gradient(to top, #000, transparent),
          linear-gradient(to right, #fff, transparent),
          hsl(${hue}, 100%, 50%)
        `,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Indicator */}
      <div
        className="absolute w-4 h-4 -ml-2 -mt-2 border-2 border-white rounded-full shadow-lg pointer-events-none"
        style={{
          left: `${indicatorX}%`,
          top: `${indicatorY}%`,
          boxShadow:
            "0 0 0 1px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
        }}
      />
    </div>
  );
}

/**
 * HueSlider Component
 * Horizontal slider for hue selection (0-360)
 */
interface HueSliderProps {
  hue: number;
  onChange: (hue: number) => void;
}

function HueSlider({ hue, onChange }: HueSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const updateHue = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const newHue = (x / rect.width) * 360;

      onChange(newHue);
    },
    [onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      updateHue(e.clientX);
    },
    [updateHue],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        updateHue(e.clientX);
      }
    },
    [isDragging, updateHue],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const indicatorPosition = (hue / 360) * 100;

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Hue
      </label>
      <div
        ref={sliderRef}
        className="relative h-3 rounded-md cursor-pointer touch-none select-none"
        style={{
          background:
            "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Indicator */}
        <div
          className="absolute top-1/2 w-4 h-4 -ml-2 -mt-2 bg-white border-2 border-white rounded-full shadow-lg pointer-events-none"
          style={{
            left: `${indicatorPosition}%`,
            boxShadow:
              "0 0 0 1px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        />
      </div>
    </div>
  );
}

/**
 * AlphaSlider Component
 * Horizontal slider for alpha/opacity selection (0-1)
 */
interface AlphaSliderProps {
  alpha: number;
  color: RGB;
  onChange: (alpha: number) => void;
}

function AlphaSlider({ alpha, color, onChange }: AlphaSliderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);

  const updateAlpha = useCallback(
    (clientX: number) => {
      if (!sliderRef.current) return;

      const rect = sliderRef.current.getBoundingClientRect();
      const x = clamp(clientX - rect.left, 0, rect.width);
      const newAlpha = x / rect.width;

      onChange(newAlpha);
    },
    [onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === "mouse") return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      updateAlpha(e.clientX);
    },
    [updateAlpha],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isDragging) {
        updateAlpha(e.clientX);
      }
    },
    [isDragging, updateAlpha],
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const indicatorPosition = alpha * 100;

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Opacity
      </label>
      <div className="relative">
        <div
          ref={sliderRef}
          className="relative h-3 rounded-md cursor-pointer touch-none select-none overflow-hidden"
          style={{
            background:
              "repeating-conic-gradient(#e5e5e5 0% 25%, transparent 0% 50%) 50% / 10px 10px",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Color gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(to right, rgba(${color.r}, ${color.g}, ${color.b}, 0), rgba(${color.r}, ${color.g}, ${color.b}, 1))`,
            }}
          />
        </div>
        {/* Indicator - outside slider to prevent clipping */}
        <div
          className="absolute top-1/2 w-4 h-4 -ml-2 -mt-2 bg-white border-2 border-white rounded-full shadow-lg pointer-events-none"
          style={{
            left: `${indicatorPosition}%`,
            boxShadow:
              "0 0 0 1px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)",
          }}
        />
      </div>
    </div>
  );
}

/**
 * ColorFormatInput Component
 * Input field with format switcher
 */
interface ColorFormatInputProps {
  rgb: RGB;
  format: ColorFormat;
  onFormatChange: (format: ColorFormat) => void;
  onChange: (rgb: RGB) => void;
}

function ColorFormatInput({
  rgb,
  format,
  onFormatChange,
  onChange,
}: ColorFormatInputProps) {
  const [inputValue, setInputValue] = useState("");

  // Update input value when rgb or format changes
  useEffect(() => {
    switch (format) {
      case "hex":
        setInputValue(rgbToHex(rgb));
        break;
      case "rgb":
        setInputValue(
          `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`,
        );
        break;
      case "hsl": {
        const hslString = rgbToHslString(rgb);
        const match = hslString.match(/(\d+),\s*(\d+)%,\s*(\d+)%/);
        if (match) {
          setInputValue(`${match[1]}, ${match[2]}%, ${match[3]}%`);
        }
        break;
      }
    }
  }, [rgb, format]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleInputBlur = () => {
    let parsed: RGB | null = null;

    switch (format) {
      case "hex":
        parsed = parseColor(inputValue);
        break;
      case "rgb": {
        const rgbMatch = inputValue.match(/(\d+),\s*(\d+),\s*(\d+)/);
        if (rgbMatch) {
          parsed = {
            r: parseInt(rgbMatch[1]),
            g: parseInt(rgbMatch[2]),
            b: parseInt(rgbMatch[3]),
            a: rgb.a,
          };
        }
        break;
      }
      case "hsl": {
        const hslMatch = inputValue.match(/(\d+),\s*(\d+)%,\s*(\d+)%/);
        if (hslMatch) {
          const hslString = `hsl(${hslMatch[1]}, ${hslMatch[2]}, ${hslMatch[3]})`;
          parsed = parseColor(hslString);
          if (parsed) parsed.a = rgb.a;
        }
        break;
      }
    }

    if (parsed) {
      onChange(parsed);
    } else {
      // Reset to current value if invalid
      switch (format) {
        case "hex":
          setInputValue(rgbToHex(rgb));
          break;
        case "rgb":
          setInputValue(
            `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`,
          );
          break;
        case "hsl": {
          const hslString = rgbToHslString(rgb);
          const match = hslString.match(/(\d+),\s*(\d+)%,\s*(\d+)%/);
          if (match) {
            setInputValue(`${match[1]}, ${match[2]}%, ${match[3]}%`);
          }
          break;
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleInputBlur();
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <Button
          type="button"
          variant={format === "hex" ? "default" : "outline"}
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => onFormatChange("hex")}
        >
          HEX
        </Button>
        <Button
          type="button"
          variant={format === "rgb" ? "default" : "outline"}
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => onFormatChange("rgb")}
        >
          RGB
        </Button>
        <Button
          type="button"
          variant={format === "hsl" ? "default" : "outline"}
          size="sm"
          className="flex-1 h-7 text-xs"
          onClick={() => onFormatChange("hsl")}
        >
          HSL
        </Button>
      </div>
      <Input
        value={inputValue}
        onChange={handleInputChange}
        onBlur={handleInputBlur}
        onKeyDown={handleKeyDown}
        className="font-mono text-sm"
        placeholder={
          format === "hex"
            ? "#FFFFFF"
            : format === "rgb"
              ? "255, 255, 255"
              : "0, 0%, 100%"
        }
      />
    </div>
  );
}

interface HexInputProps {
  rgb: RGB;
  onChange: (rgb: RGB) => void;
}

function HexInput({ rgb, onChange }: HexInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) return;
    const trimmed = inputValue.trim();
    if (!isValidHex(trimmed)) return;

    const timeoutId = setTimeout(() => {
      const parsed = parseColor(trimmed);
      if (!parsed) return;
      if (rgb.a !== undefined && parsed.a === undefined) {
        parsed.a = rgb.a;
      }
      onChange(parsed);
    }, 120);

    return () => clearTimeout(timeoutId);
  }, [inputValue, isFocused, onChange, rgb.a]);

  useEffect(() => {
    if (!isFocused) {
      setInputValue(rgbToHex(rgb));
    }
  }, [rgb, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleApply = () => {
    const trimmed = inputValue.trim();
    if (!isValidHex(trimmed)) {
      setInputValue(rgbToHex(rgb));
      return;
    }

    const parsed = parseColor(trimmed);
    if (parsed) {
      if (rgb.a !== undefined && parsed.a === undefined) {
        parsed.a = rgb.a;
      }
      onChange(parsed);
      setInputValue(rgbToHex(parsed));
      return;
    }

    setInputValue(rgbToHex(rgb));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleApply();
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Hex
      </label>
      <Input
        value={inputValue}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          setIsFocused(false);
          handleApply();
        }}
        onKeyDown={handleKeyDown}
        className="font-mono text-sm"
        placeholder="#FFFFFF"
      />
    </div>
  );
}

/**
 * ColorSwatches Component
 * Recent colors display
 */
interface ColorSwatchesProps {
  colors: string[];
  onSelect: (color: string) => void;
  currentColor: string;
}

function ColorSwatches({ colors, onSelect, currentColor }: ColorSwatchesProps) {
  if (colors.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Recent Colors
      </label>
      <div className="flex flex-wrap gap-1">
        {colors.map((color, index) => {
          const isTransparent = color === "transparent";
          const isCurrent = color === currentColor;

          return (
            <button
              key={`${color}-${index}`}
              onClick={() => onSelect(color)}
              className={cn(
                "relative w-7 h-7 rounded-md border border-input shadow-xs transition-all duration-200 hover:scale-110 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isCurrent && "scale-105",
              )}
              style={{
                backgroundColor: isTransparent ? "transparent" : color,
                backgroundImage: isTransparent
                  ? "repeating-conic-gradient(#e5e5e5 0% 25%, transparent 0% 50%)"
                  : undefined,
                backgroundSize: isTransparent ? "6px 6px" : undefined,
                backgroundPosition: isTransparent ? "50% 50%" : undefined,
                boxShadow: isCurrent
                  ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${isTransparent ? "hsl(var(--foreground) / 0.5)" : color}`
                  : undefined,
              }}
              title={color}
            >
              {isTransparent && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-0.5 bg-red-500 rotate-45" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Main ColorPicker Component
 */
export function ColorPicker({
  value,
  onChange,
  isOpen,
  onClose,
  title = "Custom Color",
  position = "auto",
  showAlpha = true,
  showEyedropper = true,
  showSwatches = true,
  showFormatTabs = true,
}: ColorPickerProps) {
  const [format, setFormat] = useState<ColorFormat>("hex");
  const [recentColors, setRecentColors] = useState<string[]>([]);

  // Parse initial color to HSV
  const initialRgb = useMemo(() => {
    const parsed = parseColor(value);
    return parsed || { r: 255, g: 255, b: 255, a: 1 };
  }, [value]);

  const [hsv, setHsv] = useState<HSV>(() => rgbToHsv(initialRgb));

  // Sync HSV when value prop changes
  useEffect(() => {
    const parsed = parseColor(value);
    if (parsed) {
      setHsv(rgbToHsv(parsed));
    }
  }, [value]);

  // Load recent colors on mount
  useEffect(() => {
    if (showSwatches) {
      setRecentColors(getRecentColors());
    }
  }, [showSwatches]);

  // Derive RGB, HEX, HSL from HSV
  const rgb = useMemo(() => hsvToRgb(hsv), [hsv]);
  const hex = useMemo(() => rgbToHex(rgb), [rgb]);

  // Eyedropper support detection
  const [supportsEyedropper, setSupportsEyedropper] = useState(false);
  useEffect(() => {
    setSupportsEyedropper("EyeDropper" in window);
  }, []);

  const handleEyedropper = useCallback(async () => {
    if (!supportsEyedropper) return;

    try {
      // @ts-ignore - EyeDropper API not in TypeScript types yet
      const eyeDropper = new window.EyeDropper();
      const result = await eyeDropper.open();
      const parsed = parseColor(result.sRGBHex);
      if (parsed) {
        setHsv({ ...rgbToHsv(parsed), a: hsv.a });
      }
    } catch {
      // User cancelled or error occurred
    }
  }, [supportsEyedropper, hsv.a]);

  const handleSaturationValueChange = useCallback((s: number, v: number) => {
    setHsv((prev) => ({ ...prev, s, v }));
  }, []);

  const handleHueChange = useCallback((h: number) => {
    setHsv((prev) => ({ ...prev, h }));
  }, []);

  const handleAlphaChange = useCallback((a: number) => {
    setHsv((prev) => ({ ...prev, a }));
  }, []);

  const handleRgbChange = useCallback((newRgb: RGB) => {
    setHsv(rgbToHsv(newRgb));
  }, []);

  const handleApply = useCallback(() => {
    const outputColor = hex;
    onChange(outputColor);
    addRecentColor(outputColor);
    setRecentColors(getRecentColors());
    onClose();
  }, [hex, onChange, onClose]);

  const handleClose = useCallback(() => {
    const outputColor = hex;
    onChange(outputColor);
    addRecentColor(outputColor);
    setRecentColors(getRecentColors());
    onClose();
  }, [hex, onChange, onClose]);

  const handleSwatchSelect = useCallback((color: string) => {
    const parsed = parseColor(color);
    if (parsed) {
      setHsv(rgbToHsv(parsed));
    }
  }, []);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          handleClose();
        }
      };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, isOpen]);

  if (!isOpen) return null;

  // Calculate position
  const modalStyle: React.CSSProperties =
    position === "auto"
      ? {
          right: "20rem",
          top: "50%",
          transform: "translateY(-50%)",
        }
      : {
          left: position.left,
          top: position.top,
        };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20"
        style={{ zIndex: 999998 }}
        onClick={handleClose}
      />

      {/* Modal */}
      <div
        className="fixed w-80 bg-card/95 backdrop-blur-md border border-border rounded-xl p-6 shadow-2xl"
        style={{ ...modalStyle, zIndex: 999999 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <Button
            onClick={handleClose}
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Saturation/Value Selector */}
          <SaturationValueSelector
            hue={hsv.h}
            saturation={hsv.s}
            value={hsv.v}
            onChange={handleSaturationValueChange}
          />

          {/* Hue Slider */}
          <HueSlider hue={hsv.h} onChange={handleHueChange} />

          {/* Alpha Slider */}
          {showAlpha && (
            <AlphaSlider
              alpha={hsv.a ?? 1}
              color={rgb}
              onChange={handleAlphaChange}
            />
          )}

          {/* Format Input */}
          {showFormatTabs ? (
            <ColorFormatInput
              rgb={rgb}
              format={format}
              onFormatChange={setFormat}
              onChange={handleRgbChange}
            />
          ) : (
            <HexInput rgb={rgb} onChange={handleRgbChange} />
          )}

          {/* Eyedropper */}
          {showEyedropper && supportsEyedropper && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleEyedropper}
            >
              <Pipette className="w-4 h-4 mr-2" />
              Pick Color from Screen
            </Button>
          )}

          {/* Recent Colors */}
          {showSwatches && (
            <ColorSwatches
              colors={recentColors}
              onSelect={handleSwatchSelect}
              currentColor={hex}
            />
          )}

          {/* Apply Button */}
          <Button onClick={handleApply} className="w-full">
            Apply Color
          </Button>
        </div>
      </div>
    </>
  );
}
