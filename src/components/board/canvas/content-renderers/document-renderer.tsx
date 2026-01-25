"use client";

import { cn } from "@/lib/utils";
import type {
  DocumentContent,
  DocumentSection,
  TileType,
} from "@/lib/board-types";
import { getTileIcon } from "@/components/board/document-editor/tile-card";

interface DocumentRendererProps {
  documentContent?: DocumentContent;
  className?: string;
}

export function DocumentRenderer({
  documentContent,
  className,
}: DocumentRendererProps) {
  const sections = documentContent?.layout?.sections || [];
  const tileTypes = sections
    .filter((section: DocumentSection) => section.type === "tile-content")
    .map((section) => section.cachedTileType)
    .filter((type): type is TileType => Boolean(type));
  const uniqueTileTypes = Array.from(new Set(tileTypes));
  const fallbackTypes: TileType[] = ["tile-text", "tile-note", "tile-image"];
  const iconTypes = (
    uniqueTileTypes.length > 0 ? uniqueTileTypes : fallbackTypes
  ).slice(0, 3);
  const extraCount = Math.max(
    0,
    (uniqueTileTypes.length > 0 ? uniqueTileTypes.length : fallbackTypes.length) -
      iconTypes.length,
  );

  return (
    <div className={cn("relative w-full h-full rounded-lg overflow-hidden", className)}>
      <div
        className="absolute inset-0"
        style={{
          background: `
            repeating-linear-gradient(
              90deg,
              rgba(0, 0, 0, 0.03) 0px,
              transparent 1px,
              transparent 2px,
              rgba(0, 0, 0, 0.03) 3px
            ),
            linear-gradient(135deg, rgba(0,0,0,0.02) 0%, transparent 100%),
            linear-gradient(to bottom, #c5a572 0%, #b89968 100%)
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="absolute inset-0 p-6 pb-16 flex flex-col">
        <div className="flex items-center justify-between -mt-2 text-sm font-bold text-[#3b2f22]/80">
          <span className="pl-4">DOCUMENT TILE</span>
        </div>

        <div className="mt-10 space-y-8 flex-1">
          <div className="border-b-[2.5px] border-[#4a4a4a] opacity-70" />
          <div className="border-b-[2.5px] border-[#4a4a4a] opacity-70" />
          <div className="border-b-[2.5px] border-[#4a4a4a] opacity-70" />
        </div>

        <div className="mt-auto flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[#3b2f22]">
            {iconTypes.map((type) => (
              <span key={type}>{getTileIcon(type, "h-6 w-6")}</span>
            ))}
            {extraCount > 0 && (
              <span className="text-[10px] font-semibold">+{extraCount}</span>
            )}
          </div>
          <div className="h-0.5 flex-1 rounded-full bg-[#3b2f22]/20" />
        </div>
      </div>
    </div>
  );
}
