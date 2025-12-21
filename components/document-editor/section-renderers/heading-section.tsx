"use client";

import React, { useState } from "react";
import type { DocumentSection } from "@/types/canvas";
import { Heading, X, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HeadingSectionProps {
  section: DocumentSection;
  onUpdate: (updates: Partial<DocumentSection>) => void;
  onRemove: () => void;
  isDragging?: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

export function HeadingSection({
  section,
  onUpdate,
  onRemove,
  isDragging = false,
  dragHandleProps,
}: HeadingSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(section.text || "");

  const handleSave = () => {
    onUpdate({ text: editText });
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setEditText(section.text || "");
      setIsEditing(false);
    }
  };

  const getHeadingStyle = () => {
    switch (section.level) {
      case 1:
        return "text-2xl font-bold";
      case 2:
        return "text-xl font-semibold";
      case 3:
        return "text-lg font-medium";
      default:
        return "text-lg font-medium";
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
          <Heading className="w-4 h-4 text-gray-600" />
          <div className="flex-1">
            <div className="text-xs text-gray-500">
              Heading {section.level || 2}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Select
            value={String(section.level || 2)}
            onValueChange={(value) => onUpdate({ level: Number(value) as 1 | 2 | 3 })}
          >
            <SelectTrigger className="w-16 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">H1</SelectItem>
              <SelectItem value="2">H2</SelectItem>
              <SelectItem value="3">H3</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={onRemove}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isEditing ? (
        <Input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="Enter heading text..."
          className="text-base"
          autoFocus
        />
      ) : (
        <div
          className={`${getHeadingStyle()} text-gray-900 cursor-text hover:bg-gray-50 rounded px-2 py-1`}
          onClick={() => setIsEditing(true)}
        >
          {section.text || "Click to edit heading"}
        </div>
      )}
    </div>
  );
}
