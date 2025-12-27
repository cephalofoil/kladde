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
        {/* SVG for dashed quarter circle outline */}
        <svg
          className="absolute bottom-0 left-0 pointer-events-none"
          width="200"
          height="200"
          viewBox="0 0 200 200"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "bottom left",
            transition: "transform 0.3s ease",
          }}
        >
          <path
            d="M 0 0 A 200 200 0 0 1 200 200"
            fill="none"
            strokeWidth="3"
            strokeDasharray="8 6"
            className="transition-all duration-300"
            style={{
              stroke: isHovered ? "rgb(239, 68, 68)" : "hsl(var(--accent))",
            }}
          />
        </svg>

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
          {/* Trash icon */}
          <div className="relative">
            {/* Main trash icon */}
            <Trash2
              size={36}
              strokeWidth={2}
              className="transition-colors duration-300 text-black dark:text-white"
              style={{
                color: isHovered ? "rgb(239, 68, 68)" : undefined,
              }}
            />
          </div>
        </div>

        {/* Helper text */}
        <div
          className="absolute left-0 bottom-2 text-center whitespace-nowrap text-xs font-medium transition-all duration-300 pointer-events-none text-black dark:text-white"
          style={{
            width: "120px",
            opacity: isVisible ? 1 : 0,
            color: isHovered ? "rgb(239, 68, 68)" : undefined,
          }}
        >
          {isHovered ? "Release to delete" : "Drop to delete"}
        </div>
      </div>
    </div>
  );
}
