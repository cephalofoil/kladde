"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface MermaidRendererProps {
  chart: string;
  width?: number;
  height?: number;
  scale?: number;
  onSvgReady?: (svg: string) => void;
  className?: string;
}

export function MermaidRenderer({
  chart,
  width = 400,
  height = 300,
  scale = 1,
  onSvgReady,
  className,
}: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
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
          theme: "neutral",
          securityLevel: "loose",
          htmlLabels: true,
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
        <div className="text-sm text-muted-foreground">
          Rendering diagram...
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "w-full h-full overflow-hidden relative flex items-center justify-center",
        "[&_svg]:max-w-full [&_svg]:max-h-full [&_svg]:w-auto [&_svg]:h-auto",
        className
      )}
      style={{ width, height, pointerEvents: "none" }}
    >
      <div
        className="w-full h-full flex items-center justify-center"
        style={{
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: "center center",
          transition: "transform 0.1s ease-out",
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}
