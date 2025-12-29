"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import {
  GripVertical,
  X,
  Type,
  StickyNote,
  Code2,
  GitBranch,
  Image,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardElement, TileContentSection } from "@/lib/board-types";

interface TileContentSectionRendererProps {
  section: TileContentSection;
  allElements: BoardElement[];
  onRemove: () => void;
}

const getTileIcon = (tileType: string | undefined) => {
  switch (tileType) {
    case "tile-text":
      return <Type className="w-3 h-3" />;
    case "tile-note":
      return <StickyNote className="w-3 h-3" />;
    case "tile-code":
      return <Code2 className="w-3 h-3" />;
    case "tile-mermaid":
      return <GitBranch className="w-3 h-3" />;
    case "tile-image":
      return <Image className="w-3 h-3" />;
    default:
      return <Type className="w-3 h-3" />;
  }
};

const getTileTypeColor = (tileType: string | undefined) => {
  switch (tileType) {
    case "tile-text":
      return "bg-blue-500";
    case "tile-note":
      return "bg-yellow-500";
    case "tile-code":
      return "bg-green-500";
    case "tile-mermaid":
      return "bg-purple-500";
    case "tile-image":
      return "bg-pink-500";
    default:
      return "bg-gray-500";
  }
};

// Parse markdown to HTML
function parseMarkdown(text: string): string {
  if (!text) return "";

  const lines = text.split("\n");
  const parsed = lines.map((line) => {
    let html = line;

    // Headers
    if (html.match(/^### /)) {
      html = html.replace(/^### (.+)$/, '<h3 class="text-sm font-bold my-1">$1</h3>');
    } else if (html.match(/^## /)) {
      html = html.replace(/^## (.+)$/, '<h2 class="text-base font-bold my-1">$1</h2>');
    } else if (html.match(/^# /)) {
      html = html.replace(/^# (.+)$/, '<h1 class="text-lg font-bold my-2">$1</h1>');
    }
    // Unordered list
    else if (html.match(/^[-*] /)) {
      html = html.replace(/^[-*] (.+)$/, '<li class="ml-3">• $1</li>');
    }
    // Ordered list
    else if (html.match(/^\d+\. /)) {
      html = html.replace(/^(\d+)\. (.+)$/, '<li class="ml-3">$1. $2</li>');
    }
    // Empty line
    else if (!html.trim()) {
      html = "<br />";
    }
    // Regular paragraph
    else {
      html = `<p class="my-0.5">${html}</p>`;
    }

    // Inline formatting
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong class="font-bold">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
    html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del class="line-through">$1</del>');
    html = html.replace(
      /`(.+?)`/g,
      '<code class="bg-gray-200 px-0.5 rounded text-[8px] font-mono">$1</code>'
    );

    return html;
  });

  return parsed.join("");
}

// Mermaid renderer component for document preview
function MermaidPreview({ chart }: { chart: string }) {
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chart) return;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "default",
          securityLevel: "loose",
        });

        const id = `mermaid-doc-${Math.random().toString(36).slice(2, 11)}`;
        const { svg } = await mermaid.render(id, chart);

        setSvgContent(svg);
        setError("");
      } catch (err) {
        console.error("Mermaid rendering error:", err);
        setError(err instanceof Error ? err.message : "Failed to render diagram");
        setSvgContent("");
      }
    };

    renderMermaid();
  }, [chart]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded p-2 text-center">
        <p className="text-[8px] text-red-600">Error: {error}</p>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="bg-purple-50 border border-purple-200 rounded p-2 text-center">
        <p className="text-[8px] text-purple-600">Rendering diagram...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-white border border-gray-200 rounded p-2 overflow-hidden"
      style={{ maxHeight: "200px" }}
    >
      <div
        className="w-full flex items-center justify-center [&_svg]:max-w-full [&_svg]:max-h-[180px] [&_svg]:w-auto [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}

export function TileContentSectionRenderer({
  section,
  allElements,
  onRemove,
}: TileContentSectionRendererProps) {
  // Try to find the live tile, fall back to cached content
  const liveTile = useMemo(
    () => allElements.find((el) => el.id === section.tileId),
    [allElements, section.tileId]
  );

  const tileType = liveTile?.tileType || section.cachedTileType;
  const tileTitle = liveTile?.tileTitle || section.cachedTileTitle || "Untitled";
  const tileContent = liveTile?.tileContent || section.cachedContent;
  const isDeleted = !liveTile && section.cachedContent;

  // Render tile content based on type
  const renderContent = () => {
    if (!tileContent) {
      return <p className="text-gray-400 italic text-[9px]">Empty content</p>;
    }

    switch (tileType) {
      case "tile-text":
        if (tileContent.richText) {
          return (
            <div
              className="text-gray-700 text-[9px] leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(tileContent.richText) }}
            />
          );
        }
        return null;

      case "tile-note":
        if (tileContent.noteText) {
          return (
            <div className="bg-yellow-50 border-l-2 border-yellow-400 pl-2 py-1">
              <div
                className="text-gray-700 text-[9px] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(tileContent.noteText) }}
              />
            </div>
          );
        }
        return null;

      case "tile-code":
        if (tileContent.code) {
          return (
            <div className="bg-gray-800 rounded p-2 overflow-x-auto">
              <pre className="text-[8px] font-mono text-gray-100 whitespace-pre-wrap">
                {tileContent.code}
              </pre>
              {tileContent.language && (
                <span className="text-[7px] text-gray-400 mt-1 block">
                  {tileContent.language}
                </span>
              )}
            </div>
          );
        }
        return null;

      case "tile-mermaid":
        if (tileContent.chart) {
          return <MermaidPreview chart={tileContent.chart} />;
        }
        return null;

      case "tile-image":
        if (tileContent.imageSrc) {
          return (
            <div className="flex justify-center">
              <img
                src={tileContent.imageSrc}
                alt={tileContent.imageAlt || "Image"}
                className="max-w-full h-auto rounded"
                style={{ maxHeight: "150px" }}
              />
            </div>
          );
        }
        return null;

      default:
        return (
          <p className="text-gray-400 italic text-[9px]">
            Unknown tile type: {tileType}
          </p>
        );
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-1 py-1 rounded transition-colors",
        isDeleted ? "bg-red-50/50" : "hover:bg-gray-50/50"
      )}
    >
      {/* Drag Handle */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing pt-0.5">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header with type badge and title */}
        <div className="flex items-center gap-1 mb-1">
          <div
            className={cn(
              "flex items-center justify-center w-4 h-4 rounded text-white",
              getTileTypeColor(tileType)
            )}
          >
            {getTileIcon(tileType)}
          </div>
          <span className="text-[9px] font-medium text-gray-600 truncate">
            {tileTitle}
          </span>
          {isDeleted && (
            <div className="flex items-center gap-0.5 text-amber-600 text-[8px]">
              <AlertTriangle className="w-2.5 h-2.5" />
              <span>Source deleted</span>
            </div>
          )}
        </div>

        {/* Tile Content */}
        <div className="pl-5">{renderContent()}</div>
      </div>

      {/* Remove Button */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-100 rounded"
      >
        <X className="w-3 h-3 text-red-500" />
      </button>
    </div>
  );
}
