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
  const [isOpen, setIsOpen] = useState(false);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (isHovered) {
      setIsOpen(true);
      setScale(1.2);
    } else {
      setIsOpen(false);
      setScale(1);
    }
  }, [isHovered]);

  if (!isVisible) return null;

  return (
    <div
      className="fixed bottom-6 left-6 z-50 pointer-events-none select-none"
      style={{
        transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
        transform: `scale(${isVisible ? 1 : 0})`,
      }}
    >
      <div
        className="relative pointer-events-auto"
        style={{
          transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          transform: `scale(${scale})`,
        }}
      >
        {/* Outer glow ring when hovered */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: isHovered
              ? "radial-gradient(circle, rgba(239, 68, 68, 0.3) 0%, rgba(239, 68, 68, 0) 70%)"
              : "transparent",
            filter: "blur(20px)",
            transform: "scale(1.5)",
            transition: "all 0.3s ease",
            opacity: isHovered ? 1 : 0,
          }}
        />

        {/* Main trash can circle */}
        <div
          className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
          style={{
            background: isHovered
              ? "linear-gradient(135deg, rgb(239, 68, 68) 0%, rgb(220, 38, 38) 100%)"
              : "linear-gradient(135deg, rgb(148, 163, 184) 0%, rgb(100, 116, 139) 100%)",
            transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            border: "3px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          {/* Trash icon with lid animation */}
          <div
            className="relative"
            style={{
              transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
              transform: isOpen ? "translateY(-2px)" : "translateY(0)",
            }}
          >
            {/* Lid */}
            <div
              className="absolute -top-2 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-white rounded-full"
              style={{
                transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                transform: isOpen
                  ? "rotate(-15deg) translateX(-3px) translateY(-4px)"
                  : "rotate(0deg) translateX(0) translateY(0)",
                transformOrigin: "right center",
              }}
            />

            {/* Main can body */}
            <Trash2
              className="text-white"
              size={32}
              strokeWidth={2.5}
              style={{
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              }}
            />
          </div>

          {/* Ripple effect on hover */}
          {isHovered && (
            <>
              <div
                className="absolute inset-0 rounded-full border-2 border-white"
                style={{
                  animation: "ripple 1.5s cubic-bezier(0, 0, 0.2, 1) infinite",
                  opacity: 0,
                }}
              />
              <div
                className="absolute inset-0 rounded-full border-2 border-white"
                style={{
                  animation:
                    "ripple 1.5s cubic-bezier(0, 0, 0.2, 1) infinite 0.5s",
                  opacity: 0,
                }}
              />
            </>
          )}
        </div>

        {/* Helper text */}
        <div
          className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium px-3 py-1 rounded-full"
          style={{
            background: isHovered
              ? "rgba(239, 68, 68, 0.9)"
              : "rgba(100, 116, 139, 0.9)",
            color: "white",
            transition: "all 0.3s ease",
            opacity: isVisible ? 1 : 0,
            backdropFilter: "blur(8px)",
          }}
        >
          {isHovered ? "Release to delete" : "Drag here to delete"}
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
                @keyframes ripple {
                    0% {
                        transform: scale(1);
                        opacity: 0.6;
                    }
                    100% {
                        transform: scale(1.8);
                        opacity: 0;
                    }
                }
            `,
        }}
      />
    </div>
  );
}
