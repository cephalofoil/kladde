"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";

interface TrashDropZoneProps {
  isVisible: boolean;
  isHovered: boolean;
  onDrop: () => void;
  zoom: number;
  pan: { x: number; y: number };
}

export function TrashDropZone({
  isVisible,
  isHovered,
  onDrop,
  zoom,
  pan,
}: TrashDropZoneProps) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (isHovered) {
      setScale(1.15);
    } else {
      setScale(1);
    }
  }, [isHovered]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 pointer-events-none select-none z-40"
      style={{
        transition: "opacity 0.3s ease",
        opacity: isVisible ? 1 : 0,
      }}
    >
      {/* Quarter circle background */}
      <div
        className="relative"
        style={{
          width: "200px",
          height: "200px",
        }}
      >
        {/* Outer glow when hovered */}
        <div
          className="absolute bottom-0 left-0 rounded-tr-full transition-all duration-300"
          style={{
            width: "200px",
            height: "200px",
            background: isHovered
              ? "radial-gradient(circle at bottom left, rgba(239, 68, 68, 0.25) 0%, rgba(239, 68, 68, 0.05) 60%, transparent 100%)"
              : "transparent",
            filter: isHovered ? "blur(15px)" : "none",
          }}
        />

        {/* Main quarter circle */}
        <div
          className="absolute bottom-0 left-0 rounded-tr-full transition-all duration-300 pointer-events-none"
          style={{
            width: "200px",
            height: "200px",
            background: isHovered
              ? "linear-gradient(135deg, rgb(239, 68, 68) 0%, rgb(220, 38, 38) 100%)"
              : "linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--muted)) 100%)",
            transform: `scale(${scale})`,
            transformOrigin: "bottom left",
          }}
        />

        {/* Icon container */}
        <div
          className="absolute flex items-center justify-center transition-all duration-300 pointer-events-none"
          style={{
            bottom: "40px",
            left: "40px",
            transform: `scale(${scale})`,
            transformOrigin: "bottom left",
          }}
        >
          {/* Trash icon with lid animation */}
          <div className="relative">
            {/* Lid */}
            <div
              className="absolute -top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full transition-all duration-300"
              style={{
                backgroundColor: isHovered ? "white" : "hsl(var(--foreground))",
                transform: isHovered
                  ? "rotate(-20deg) translateX(-4px) translateY(-6px)"
                  : "rotate(0deg) translateX(0) translateY(0)",
                transformOrigin: "right center",
              }}
            />

            {/* Main trash icon */}
            <Trash2
              size={36}
              strokeWidth={2}
              className="transition-colors duration-300"
              style={{
                color: isHovered ? "white" : "hsl(var(--foreground))",
                filter: isHovered
                  ? "drop-shadow(0 2px 8px rgba(0,0,0,0.3))"
                  : "none",
              }}
            />

            {/* Ripple effect */}
            {isHovered && (
              <>
                <div
                  className="absolute inset-0 -m-3 rounded-full border-2 animate-ping"
                  style={{
                    borderColor: "rgba(255, 255, 255, 0.6)",
                    animationDuration: "1.5s",
                  }}
                />
              </>
            )}
          </div>
        </div>

        {/* Helper text */}
        <div
          className="absolute left-0 bottom-2 text-center whitespace-nowrap text-xs font-medium transition-all duration-300 pointer-events-none"
          style={{
            width: "120px",
            color: isHovered ? "white" : "hsl(var(--muted-foreground))",
            opacity: isVisible ? 1 : 0,
          }}
        >
          {isHovered ? "Release to delete" : "Drop to delete"}
        </div>
      </div>
    </div>
  );
}
