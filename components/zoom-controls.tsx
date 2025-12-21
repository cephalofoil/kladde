"use client";

import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom?: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onResetZoom }: ZoomControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-card border rounded-lg p-2 shadow-lg">
      <Button variant="ghost" size="sm" onClick={onZoomOut} title="Zoom Out">
        <ZoomOut className="h-4 w-4" />
      </Button>
      <div className="px-2 py-1 text-xs font-mono bg-muted rounded min-w-[60px] text-center">
        {Math.round(zoom * 100)}%
      </div>
      <Button variant="ghost" size="sm" onClick={onZoomIn} title="Zoom In">
        <ZoomIn className="h-4 w-4" />
      </Button>
      {onResetZoom && (
        <Button variant="ghost" size="sm" onClick={onResetZoom} title="Reset View">
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

