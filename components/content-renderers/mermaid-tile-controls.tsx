"use client";

import { Minus, Plus, Edit3, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MermaidTileControlsProps {
  scale: number;
  onScaleChange: (scale: number) => void;
  onEdit: () => void;
  onCopyImage?: () => void;
  onDownloadImage?: () => void;
  className?: string;
}

export function MermaidTileControls({
  scale,
  onScaleChange,
  onEdit,
  onCopyImage,
  onDownloadImage,
  className = "",
}: MermaidTileControlsProps) {
  const handleScaleOut = () => {
    const newScale = Math.max(0.5, scale - 0.1);
    onScaleChange(newScale);
  };

  const handleScaleIn = () => {
    const newScale = Math.min(3, scale + 0.1);
    onScaleChange(newScale);
  };

  const handleResetScale = () => {
    onScaleChange(1);
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {/* Minus Button - Zoom Out */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-sky-100 text-sky-600"
        onClick={handleScaleOut}
        title="Zoom Out"
      >
        <Minus className="h-4 w-4" />
      </Button>

      {/* Scale Display */}
      <div className="text-sm text-sky-600 font-medium min-w-[3rem] text-center px-1">
        {Math.round(scale * 100)}%
      </div>

      {/* Plus Button - Zoom In */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-sky-100 text-sky-600"
        onClick={handleScaleIn}
        title="Zoom In"
      >
        <Plus className="h-4 w-4" />
      </Button>

      {/* Reset Scale Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-sky-100 text-sky-600"
        onClick={handleResetScale}
        title="Reset Scale"
      >
        <span className="text-xs font-bold">1:1</span>
      </Button>

      {/* Edit Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-sky-100 text-sky-600"
        onClick={onEdit}
        title="Edit Diagram"
      >
        <Edit3 className="h-4 w-4" />
      </Button>

      {/* Separator */}
      <div className="w-px h-6 bg-sky-200 mx-1" />

      {/* Copy Image Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-sky-100 text-sky-600"
        onClick={onCopyImage}
        title="Copy as Image"
      >
        <Copy className="h-4 w-4" />
      </Button>

      {/* Download Image Button */}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-sky-100 text-sky-600"
        onClick={onDownloadImage}
        title="Download as Image"
      >
        <Download className="h-4 w-4" />
      </Button>
    </div>
  );
}
