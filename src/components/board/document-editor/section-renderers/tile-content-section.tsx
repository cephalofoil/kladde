"use client";

import { useMemo, useEffect, useState, useRef } from "react";
import {
  GripVertical,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BoardElement, TileContentSection } from "@/lib/board-types";
import { getTileIcon, getTileTypeColor } from "../tile-card";
import { getMermaidConfig } from "@/lib/mermaid-config";

const MERMAID_BASE_MAX_HEIGHT_PX = 180;
const MERMAID_BASE_MAX_WIDTH_PX = 606;
const MERMAID_SCALE_MIN = 0.5;
const MERMAID_SCALE_MAX = 2;
const MERMAID_SCALE_STEP = 0.1;
const HANDLE_GUTTER_PX = 28;
const HANDLE_TOP_OFFSET_PX = 6;

const clampMermaidScale = (value: number) =>
  Math.min(MERMAID_SCALE_MAX, Math.max(MERMAID_SCALE_MIN, value));

interface TileContentSectionRendererProps {
  section: TileContentSection;
  allElements: BoardElement[];
  onRemove: () => void;
  onUpdate: (updates: Partial<TileContentSection>) => void;
}

// Parse markdown to HTML
function parseMarkdown(text: string): string {
  if (!text) return "";

  const lines = text.split("\n");
  const parsed = lines.map((line) => {
    let html = line;

    // Headers
    if (html.match(/^### /)) {
      html = html.replace(/^### (.+)$/, '<h3 class="text-[17.3px] font-bold my-1">$1</h3>');
    } else if (html.match(/^## /)) {
      html = html.replace(/^## (.+)$/, '<h2 class="text-[21.3px] font-bold my-1">$1</h2>');
    } else if (html.match(/^# /)) {
      html = html.replace(/^# (.+)$/, '<h1 class="text-[26.7px] font-bold my-2">$1</h1>');
    }
    // Unordered list
    else if (html.match(/^[-*] /)) {
      html = html.replace(/^[-*] (.+)$/, '<li class="ml-3 text-[14.7px] leading-relaxed">• $1</li>');
    }
    // Ordered list
    else if (html.match(/^\d+\. /)) {
      html = html.replace(/^(\d+)\. (.+)$/, '<li class="ml-3 text-[14.7px] leading-relaxed">$1. $2</li>');
    }
    // Empty line
    else if (!html.trim()) {
      html = "<br />";
    }
    // Regular paragraph
    else {
      html = `<p class="my-0.5 text-[14.7px] leading-relaxed">${html}</p>`;
    }

    // Inline formatting
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold">$1</strong>');
    html = html.replace(/__(.+?)__/g, '<strong class="font-bold">$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em class="italic">$1</em>');
    html = html.replace(/_(.+?)_/g, '<em class="italic">$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del class="line-through">$1</del>');
    html = html.replace(
      /`(.+?)`/g,
      '<code class="bg-gray-200 px-0.5 rounded text-[12px] font-mono">$1</code>'
    );

    return html;
  });

  return parsed.join("");
}

// Mermaid renderer component for document preview
function MermaidPreview({ chart, scale }: { chart: string; scale: number }) {
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!chart) return;

    const renderMermaid = async () => {
      try {
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize(getMermaidConfig());

        const id = `mermaid-doc-${Math.random().toString(36).slice(2, 11)}`;
        const { svg } = await mermaid.render(id, chart);

        setSvgContent(svg);
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svg, "image/svg+xml");
        const svgElement = svgDoc.querySelector("svg");
        let width = 400;
        let height = 300;
        if (svgElement) {
          const viewBox = svgElement.getAttribute("viewBox");
          if (viewBox) {
            const parts = viewBox.split(/\s+/).map(Number);
            if (parts.length === 4 && parts.every((value) => Number.isFinite(value))) {
              width = parts[2];
              height = parts[3];
            }
          } else {
            const widthAttr = svgElement.getAttribute("width");
            const heightAttr = svgElement.getAttribute("height");
            if (widthAttr) width = parseFloat(widthAttr) || width;
            if (heightAttr) height = parseFloat(heightAttr) || height;
          }
        }
        setSvgSize({ width, height });
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

  const maxWidth = MERMAID_BASE_MAX_WIDTH_PX;
  const maxHeight = MERMAID_BASE_MAX_HEIGHT_PX * scale;
  const widthScale = svgSize ? maxWidth / svgSize.width : 1;
  const heightScale = svgSize ? maxHeight / svgSize.height : 1;
  const displayScale = svgSize ? Math.min(1, widthScale, heightScale) : 1;
  const displayWidth = svgSize ? svgSize.width * displayScale : maxWidth;
  const displayHeight = svgSize ? svgSize.height * displayScale : maxHeight;

  return (
    <div
      ref={containerRef}
      className="bg-white border border-gray-200 rounded p-2"
      style={{ width: displayWidth, height: displayHeight }}
    >
      <div
        className="w-full h-full flex items-center justify-center [&_svg]:w-full [&_svg]:h-full"
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </div>
  );
}

export function TileContentSectionRenderer({
  section,
  allElements,
  onRemove,
  onUpdate,
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
  const mermaidScale = clampMermaidScale(section.mermaidScale ?? 1);

  const handleMermaidScaleChange = (nextScale: number) => {
    const clamped = clampMermaidScale(nextScale);
    onUpdate({ mermaidScale: Number(clamped.toFixed(2)) });
  };

  // Render tile content based on type
  const renderContent = () => {
    if (!tileContent) {
      return <p className="text-gray-400 italic text-[14.7px]">Empty content</p>;
    }

    switch (tileType) {
      case "tile-text":
        if (tileContent.richText) {
          return (
            <div
              className="text-gray-700 text-[14.7px] leading-relaxed prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(tileContent.richText) }}
            />
          );
        }
        return null;

      case "tile-note":
        if (tileContent.noteText) {
          return (
            <div
              className="bg-yellow-50 border-yellow-400"
              style={{
                borderLeftWidth: "4px",
                paddingLeft: "10.7px",
                paddingTop: "8px",
                paddingBottom: "8px",
                marginTop: "5.3px",
                marginBottom: "5.3px",
              }}
            >
              <div
                className="text-gray-700 text-[14.7px] leading-relaxed"
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
              <pre className="text-[12px] font-mono text-gray-100 whitespace-pre-wrap">
                {tileContent.code}
              </pre>
              {tileContent.language && (
                <span className="text-[10.7px] text-gray-400 mt-1 block">
                  {tileContent.language}
                </span>
              )}
            </div>
          );
        }
        return null;

      case "tile-mermaid":
        if (tileContent.chart) {
          return (
            <div className="flex justify-center">
              <MermaidPreview chart={tileContent.chart} scale={mermaidScale} />
            </div>
          );
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
                style={{ maxHeight: "300px" }}
              />
            </div>
          );
        }
        return null;

      default:
        return (
          <p className="text-gray-400 italic text-[14.7px]">
            Unknown tile type: {tileType}
          </p>
        );
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-start gap-2 py-1 rounded transition-colors",
        isDeleted ? "bg-red-50/50" : "hover:bg-gray-50/50"
      )}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        style={{ left: -HANDLE_GUTTER_PX, top: HANDLE_TOP_OFFSET_PX }}
        aria-label="Reorder section"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>

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
            {getTileIcon(tileType, "w-3 h-3")}
          </div>
          <span className="text-[13.3px] font-medium text-gray-600 truncate">
            {tileTitle}
          </span>
          {tileType === "tile-mermaid" && tileContent?.chart && (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleMermaidScaleChange(mermaidScale - MERMAID_SCALE_STEP)}
                className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title="Reduce diagram size"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => handleMermaidScaleChange(1)}
                className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title="Reset size"
              >
                {Math.round(mermaidScale * 100)}%
              </button>
              <button
                type="button"
                onClick={() => handleMermaidScaleChange(mermaidScale + MERMAID_SCALE_STEP)}
                className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title="Increase diagram size"
              >
                +
              </button>
            </div>
          )}
          {isDeleted && (
            <div className="flex items-center gap-0.5 text-amber-600 text-[12px]">
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
