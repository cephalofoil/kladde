"use client";

import { Plus, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  BoardElement,
  DocumentSection,
  FrameStyle,
} from "@/lib/board-types";

interface FramesPickerProps {
  frames: BoardElement[];
  onAddFrame: (frame: BoardElement) => void;
  documentSections: DocumentSection[];
}

const getFrameStyleLabel = (style?: FrameStyle) => {
  switch (style) {
    case "cutting-mat":
      return "Cutting Mat";
    case "notebook":
      return "Notebook";
    case "minimal":
    default:
      return "Minimal";
  }
};

const getFrameStyleClass = (style?: FrameStyle) => {
  switch (style) {
    case "cutting-mat":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "notebook":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "minimal":
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
};

interface FrameCardProps {
  frame: BoardElement;
  isAdded: boolean;
  onAdd: () => void;
}

function FrameCard({ frame, isAdded, onAdd }: FrameCardProps) {
  const label = frame.label?.trim() || "Frame";
  const frameStyle = frame.frameStyle || "minimal";
  const isDisabled = isAdded;

  return (
    <div
      className={cn(
        "group relative p-2 rounded-lg border transition-colors",
        isAdded
          ? "border-green-500/30 bg-green-500/5"
          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <div
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded border",
            getFrameStyleClass(frameStyle)
          )}
        >
          <Square className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-medium truncate flex-1">{label}</span>
      </div>

      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
        Style: {getFrameStyleLabel(frameStyle)}
      </p>

      <button
        onClick={onAdd}
        disabled={isDisabled}
        className={cn(
          "w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
          isAdded
            ? "bg-green-500/10 text-green-600 cursor-default"
            : "bg-primary/10 hover:bg-primary/20 text-primary"
        )}
      >
        {isAdded ? (
          "Added"
        ) : (
          <>
            <Plus className="w-3 h-3" />
            Add
          </>
        )}
      </button>
    </div>
  );
}

export function FramesPicker({
  frames,
  onAddFrame,
  documentSections,
}: FramesPickerProps) {
  const isFrameInDocument = (frameId: string) => {
    return documentSections.some(
      (section) => section.type === "frame-image" && section.frameId === frameId
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-2">
        {frames.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <p className="text-sm text-muted-foreground">No frames available.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create frames on the canvas to add them here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {frames.map((frame) => (
              <FrameCard
                key={frame.id}
                frame={frame}
                isAdded={isFrameInDocument(frame.id)}
                onAdd={() => onAddFrame(frame)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
