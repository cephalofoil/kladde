"use client";

import React, { useEffect, useRef, useState } from "react";
import type { DocumentSection, TileData } from "@/types/canvas";
import {
  Code2,
  FileText,
  BarChart3,
  StickyNote,
  X,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import mermaid from "mermaid";

interface TileContentSectionProps {
  section: DocumentSection;
  tile: TileData | undefined;
  onRemove: () => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function TileContentSection({
  section,
  tile,
  onRemove,
  isDragging = false,
  dragHandleProps,
}: TileContentSectionProps) {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const [mermaidSvg, setMermaidSvg] = useState<string>("");
  const [mermaidError, setMermaidError] = useState<string>("");

  // Initialize mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
    });
  }, []);

  // Render mermaid diagram
  useEffect(() => {
    if (tile?.type === "mermaid" && tile.content?.chart) {
      const renderDiagram = async () => {
        try {
          const id = `mermaid-${section.id}`;
          const { svg } = await mermaid.render(id, tile.content.chart);
          setMermaidSvg(svg);
          setMermaidError("");
        } catch (error) {
          console.error("Mermaid rendering error:", error);
          setMermaidError(
            error instanceof Error ? error.message : "Failed to render diagram",
          );
        }
      };
      renderDiagram();
    }
  }, [tile?.type, tile?.content?.chart, section.id]);

  if (!tile) {
    return (
      <div className="border-2 border-dashed border-red-300 bg-red-50 rounded-lg p-4 mb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600">
            <FileText className="w-4 h-4" />
            <span className="text-sm font-medium">Tile not found</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-red-500 mt-1">
          The connected tile may have been deleted
        </p>
      </div>
    );
  }

  const getTileIcon = () => {
    switch (tile.type) {
      case "text":
        return <FileText className="w-4 h-4" />;
      case "code":
        return <Code2 className="w-4 h-4" />;
      case "mermaid":
        return <BarChart3 className="w-4 h-4" />;
      case "note":
        return <StickyNote className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTileColor = () => {
    switch (tile.type) {
      case "text":
        return "border-slate-300 bg-slate-50";
      case "code":
        return "border-slate-600 bg-slate-900";
      case "mermaid":
        return "border-sky-300 bg-sky-50";
      case "note":
        return "border-amber-300 bg-amber-50";
      default:
        return "border-gray-300 bg-gray-50";
    }
  };

  const getTextColor = () => {
    switch (tile.type) {
      case "code":
        return "text-slate-100";
      default:
        return "text-gray-800";
    }
  };

  const renderContent = () => {
    switch (tile.type) {
      case "text":
        return (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {tile.content.text || "Empty text tile"}
          </div>
        );
      case "code":
        return (
          <pre className="text-xs font-mono overflow-x-auto">
            <code>{tile.content.code || "// No code"}</code>
          </pre>
        );
      case "mermaid":
        if (mermaidError) {
          return (
            <div className="text-sm text-center text-red-600 py-4 border border-red-300 rounded bg-red-50">
              ⚠️ Error rendering diagram: {mermaidError}
            </div>
          );
        }
        if (mermaidSvg) {
          return (
            <div
              ref={mermaidRef}
              className="flex items-center justify-center py-4"
              dangerouslySetInnerHTML={{ __html: mermaidSvg }}
            />
          );
        }
        return (
          <div className="text-sm text-center text-gray-600 py-4">
            📊 Rendering diagram...
          </div>
        );
      case "note":
        return (
          <div className="text-sm leading-relaxed">
            {tile.content.text || "Empty note"}
          </div>
        );
      default:
        return (
          <div className="text-sm text-gray-500">Unsupported tile type</div>
        );
    }
  };

  return (
    <div
      className={`border-2 rounded-lg p-4 mb-2 transition-all ${
        isDragging ? "opacity-50 scale-95" : "opacity-100"
      } ${getTileColor()}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing hover:bg-gray-200 rounded p-1"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          {getTileIcon()}
          <div className="flex-1">
            <div className={`text-sm font-medium ${getTextColor()}`}>
              {tile.title || "Untitled"}
            </div>
            <div className="text-xs text-gray-500 capitalize">
              {tile.type} tile
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <X className="w-4 h-4" />
        </Button>
      </div>
      <div className={`${getTextColor()}`}>{renderContent()}</div>
    </div>
  );
}
