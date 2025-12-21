"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { generateId } from "@/lib/id";

interface MermaidRendererProps {
  chart: string;
  width: number;
  height: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  onOffsetChange?: (offsetX: number, offsetY: number) => void;
  isInteractive?: boolean;
  onSvgReady?: (svgContent: string) => void;
}

export function MermaidRenderer({
  chart,
  width,
  height,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  onOffsetChange,
  isInteractive = false,
  onSvgReady,
}: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, offsetX: 0, offsetY: 0 });

  useEffect(() => {
    let mounted = true;

    const renderMermaid = async () => {
      try {
        // Skip rendering if chart is empty
        if (!chart || chart.trim() === "") {
          if (mounted) {
            setSvgContent("");
            setError("");
          }
          return;
        }

        // Dynamic import of mermaid
        const mermaid = await import("mermaid");

        if (!mounted) return;

        // Initialize mermaid
        mermaid.default.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        });

        // Generate unique ID
        const id = generateId("mermaid");

        // Render the chart as-is (no auto-fixing)
        const { svg } = await mermaid.default.render(id, chart);

        if (mounted) {
          setSvgContent(svg);
          setError("");
          onSvgReady?.(svg);
        }
      } catch (err) {
        if (mounted) {
          // Just show a simple error without crashing
          setError("Invalid Mermaid syntax");
          console.error("Mermaid render error:", err);
          setSvgContent("");
        }
      }
    };

    renderMermaid();

    return () => {
      mounted = false;
    };
  }, [chart, onSvgReady]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      offsetX,
      offsetY,
    });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !isInteractive) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    const newOffsetX = dragStart.offsetX + deltaX;
    const newOffsetY = dragStart.offsetY + deltaY;
    
    // Constrain offsets to keep diagram within tile bounds
    const maxOffsetX = Math.max(0, (width * scale - width) / 2);
    const maxOffsetY = Math.max(0, (height * scale - height) / 2);
    
    const constrainedOffsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, newOffsetX));
    const constrainedOffsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, newOffsetY));
    
    onOffsetChange?.(constrainedOffsetX, constrainedOffsetY);
  }, [isDragging, isInteractive, dragStart, width, height, scale, onOffsetChange]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 text-red-600 text-sm">
        <div className="text-center">
          <div className="font-medium">⚠️ Mermaid Error</div>
          <div className="text-xs mt-1">{error}</div>
        </div>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="w-full h-full flex items-center justify-center p-4 text-gray-500 text-sm">
        <div className="text-center">
          <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
          <div>Rendering diagram...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center overflow-hidden ${
        isInteractive ? "cursor-grab active:cursor-grabbing" : ""
      }`}
      style={{ width, height }}
      onMouseDown={handleMouseDown}
    >
      <div
        className="max-w-full max-h-full"
        dangerouslySetInnerHTML={{ __html: svgContent }}
        style={{
          transform: `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`,
          transformOrigin: "center center",
          transition: isDragging ? "none" : "transform 0.1s ease-out",
        }}
      />
    </div>
  );
}
