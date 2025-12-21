"use client";

import React from "react";
import { DocLinesIcon } from "@/components/icons/doc-lines-icon";

interface DocumentContent {
  title: string;
  description: string;
  status: "draft" | "in-progress" | "review" | "completed";
  dueDate?: string;
  assignees: string[];
  tags: string[];
  attachments: Array<{
    name: string;
    size: string;
    type: string;
  }>;
  subtasks: Array<{
    id: string;
    text: string;
    completed: boolean;
    isBlocker?: boolean;
  }>;
  comments: Array<{
    id: string;
    author: string;
    text: string;
    timestamp: string;
  }>;
}

interface DocumentRendererProps {
  content: DocumentContent;
  onUpdate: (updates: Partial<DocumentContent>) => void;
  isEditing?: boolean;
  onOpenSideView?: (content: DocumentContent) => void;
}

export function DocumentRenderer({
  content,
  onOpenSideView,
}: DocumentRendererProps) {
  const handleOpenSideView = () => {
    if (onOpenSideView) {
      onOpenSideView(content);
    }
  };

  // Only render the compact view - side view is handled by parent
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div
        className="cursor-pointer group flex-1 flex items-center justify-center"
        onClick={handleOpenSideView}
      >
        <DocLinesIcon className="w-16 h-16 text-gray-600 transition-all duration-200 group-hover:text-blue-600 group-hover:scale-110" />
      </div>
      <div className="text-sm font-semibold text-center text-gray-700 px-2 pb-2">
        {content.title}
      </div>
    </div>
  );
}
