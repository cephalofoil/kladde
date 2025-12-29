"use client";

import { FileText, FileUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DocumentContent } from "@/lib/board-types";

interface DocumentRendererProps {
  documentContent?: DocumentContent;
  className?: string;
}

export function DocumentRenderer({
  documentContent,
  className,
}: DocumentRendererProps) {
  const title = documentContent?.title || "Untitled Document";
  const description = documentContent?.description || "";
  const sectionCount = documentContent?.layout?.sections?.length || 0;

  return (
    <div
      className={cn(
        "h-full flex flex-col items-center justify-center p-4 text-center",
        className
      )}
    >
      {/* Document Icon */}
      <div className="relative mb-3">
        <div className="w-16 h-20 bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 border-gray-200 dark:border-gray-600 flex flex-col overflow-hidden">
          {/* Document header area */}
          <div className="h-4 bg-orange-100 dark:bg-orange-900/30 border-b border-gray-200 dark:border-gray-600" />
          {/* Content lines */}
          <div className="flex-1 p-1.5 space-y-1">
            <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full w-full" />
            <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full w-3/4" />
            <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full w-5/6" />
            <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full w-2/3" />
          </div>
        </div>
        {/* A4 label */}
        <div className="absolute -bottom-1 -right-1 bg-orange-500 text-white text-[8px] font-bold px-1 py-0.5 rounded">
          A4
        </div>
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 line-clamp-2 mb-1">
        {title}
      </h3>

      {/* Description */}
      {description && (
        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">
          {description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
        <span>{sectionCount} section{sectionCount !== 1 ? "s" : ""}</span>
        <span>•</span>
        <span>Click to edit</span>
      </div>
    </div>
  );
}
