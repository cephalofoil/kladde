"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MermaidRendererProps {
  chart: string;
  width?: number;
  height?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  onOffsetChange?: (offsetX: number, offsetY: number) => void;
  isInteractive?: boolean;
  onSvgReady?: (svg: string) => void;
  className?: string;
}

export function MermaidRenderer({
  chart,
  width = 400,
  height = 300,
  scale = 1,
  offsetX = 0,
  offsetY = 0,
  onOffsetChange,
  isInteractive = false,
  onSvgReady,
  className,
}: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const updateTheme = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    updateTheme();
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!chart) return;

    const renderMermaid = async () => {
      try {
        // Dynamically import mermaid
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: isDarkMode ? "dark" : "default",
          securityLevel: "loose",
        });

        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

        // Render the diagram
        const { svg } = await mermaid.render(id, chart);

        setSvgContent(svg);
        setError("");
        onSvgReady?.(svg);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to render diagram");
        setSvgContent("");
      }
    };

    renderMermaid();
  }, [chart, isDarkMode, onSvgReady]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isInteractive) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - offsetX, y: e.clientY - offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !isInteractive) return;
    const newOffsetX = e.clientX - panStart.x;
    const newOffsetY = e.clientY - panStart.y;
    onOffsetChange?.(newOffsetX, newOffsetY);
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  useEffect(() => {
    if (isPanning) {
      const handleGlobalMouseUp = () => setIsPanning(false);
      document.addEventListener("mouseup", handleGlobalMouseUp);
      return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
    }
  }, [isPanning]);

  if (error) {
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/10 rounded p-4",
          className
        )}
      >
        <div className="text-center">
          <div className="text-red-600 dark:text-red-400 font-medium mb-2">
            Mermaid Error
          </div>
          <div className="text-xs text-red-500 dark:text-red-300 max-w-md">
            {error}
          </div>
        </div>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className={cn("w-full h-full flex items-center justify-center", className)}>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Rendering diagram...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full h-full overflow-hidden relative",
        isInteractive && "cursor-move",
        className
      )}
      style={{ width, height }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <div
        style={{
          transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
          transformOrigin: "top left",
          transition: isPanning ? "none" : "transform 0.1s ease-out",
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
