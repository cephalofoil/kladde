"use client";

import { ZoomIn, ZoomOut, Maximize2, Edit, Download, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface MermaidTileControlsProps {
  scale: number;
  onScaleChange: (scale: number) => void;
  onEdit: () => void;
  onExpand?: () => void;
  onCopyImage?: () => void;
  onDownloadImage?: () => void;
  className?: string;
}

export function MermaidTileControls({
  scale,
  onScaleChange,
  onEdit,
  onExpand,
  onCopyImage,
  onDownloadImage,
  className,
}: MermaidTileControlsProps) {
  const handleZoomIn = () => {
    onScaleChange(Math.min(scale + 0.1, 3));
  };

  const handleZoomOut = () => {
    onScaleChange(Math.max(scale - 0.1, 0.3));
  };

  const handleResetZoom = () => {
    onScaleChange(1);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* Zoom Controls */}
      <button
        onClick={handleZoomOut}
        className="p-1.5 hover:bg-muted rounded transition-colors"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4 text-muted-foreground" />
      </button>

      <button
        onClick={handleResetZoom}
        className="px-2 py-1 hover:bg-muted rounded transition-colors"
        title="Reset Zoom"
      >
        <span className="text-xs text-muted-foreground font-medium">
          {Math.round(scale * 100)}%
        </span>
      </button>

      <button
        onClick={handleZoomIn}
        className="p-1.5 hover:bg-muted rounded transition-colors"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="w-px h-4 bg-border mx-1" />

      {/* Edit Button */}
      <button
        onClick={onEdit}
        className="p-1.5 hover:bg-muted rounded transition-colors"
        title="Edit Diagram"
      >
        <Edit className="h-4 w-4 text-muted-foreground" />
      </button>

      {/* Expand Button */}
      {onExpand && (
        <button
          onClick={onExpand}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Open Fullscreen Editor"
        >
          <Maximize2 className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Copy Image */}
      {onCopyImage && (
        <button
          onClick={onCopyImage}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Copy as Image"
        >
          <Copy className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {/* Download Image */}
      {onDownloadImage && (
        <button
          onClick={onDownloadImage}
          className="p-1.5 hover:bg-muted rounded transition-colors"
          title="Download as PNG"
        >
          <Download className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
