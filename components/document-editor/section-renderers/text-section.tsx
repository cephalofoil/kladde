"use client";

import React, { useState } from "react";
import type { DocumentSection } from "@/types/canvas";
import { AlignLeft, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface TextSectionProps {
  section: DocumentSection;
  onUpdate: (updates: Partial<DocumentSection>) => void;
  onRemove: () => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function TextSection({
  section,
  onUpdate,
  onRemove,
  isDragging = false,
  dragHandleProps,
}: TextSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(section.text || "");

  const handleSave = () => {
    onUpdate({ text: editText });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setEditText(section.text || "");
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`border-2 border-dashed border-gray-300 bg-white rounded-lg p-4 mb-2 transition-all ${
        isDragging ? "opacity-50 scale-95" : "opacity-100"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing hover:bg-gray-200 rounded p-1"
          >
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          <AlignLeft className="w-4 h-4 text-gray-600" />
          <div className="text-xs text-gray-500">Text block</div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {isEditing ? (
        <Textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="Enter text..."
          className="min-h-[80px]"
          autoFocus
        />
      ) : (
        <div
          className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap cursor-text hover:bg-gray-50 rounded px-2 py-1 min-h-[60px]"
          onClick={() => setIsEditing(true)}
        >
          {section.text || "Click to add text"}
        </div>
      )}
    </div>
  );
}
