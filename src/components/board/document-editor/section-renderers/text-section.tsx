"use client";

import { useRef, useEffect } from "react";
import { GripVertical, X } from "lucide-react";
import type { TextSection } from "@/lib/board-types";

interface TextSectionRendererProps {
  section: TextSection;
  onUpdate: (updates: Partial<TextSection>) => void;
  onRemove: () => void;
}

export function TextSectionRenderer({
  section,
  onUpdate,
  onRemove,
}: TextSectionRendererProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }, [section.content]);

  return (
    <div className="group relative flex items-start gap-1 py-1 hover:bg-gray-50/50 rounded transition-colors">
      {/* Drag Handle */}
      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing pt-1">
        <GripVertical className="w-3 h-3 text-gray-400" />
      </div>

      {/* Content */}
      <textarea
        ref={textareaRef}
        value={section.content}
        onChange={(e) => onUpdate({ content: e.target.value })}
        placeholder="Enter text..."
        className="flex-1 bg-transparent border-none outline-none text-gray-700 placeholder:text-gray-300 resize-none overflow-hidden"
        style={{ fontSize: "9px", lineHeight: 1.6, minHeight: "20px" }}
        rows={1}
      />

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
