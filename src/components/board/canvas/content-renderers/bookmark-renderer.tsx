"use client";

import { ExternalLink, Globe, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

interface BookmarkRendererProps {
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  siteName?: string;
  imageUrl?: string;
  displayName?: string;
  isSelected?: boolean;
  onEdit?: () => void;
  className?: string;
}

export function BookmarkRenderer({
  url,
  title,
  description,
  favicon,
  siteName,
  imageUrl,
  displayName,
  isSelected = false,
  onEdit,
  className,
}: BookmarkRendererProps) {
  const handleOpenLink = () => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-white dark:bg-neutral-900 rounded overflow-hidden",
        className,
      )}
    >
      {/* Image Preview (if available) */}
      {imageUrl && (
        <div className="w-full h-32 overflow-hidden bg-gray-100 dark:bg-neutral-800 flex-shrink-0">
          <img
            src={imageUrl}
            alt={title || "Bookmark preview"}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Hide image on error
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col gap-2 overflow-hidden">
        {/* Favicon and Site Name */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          {favicon ? (
            <img
              src={favicon}
              alt=""
              className="w-4 h-4"
              onError={(e) => {
                // Replace with globe icon on error
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <Globe className="w-4 h-4" />
          )}
          <span className="truncate">
            {siteName || displayName || new URL(url).hostname}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
          {title || displayName || "Untitled Bookmark"}
        </h3>

        {/* Description */}
        {description && (
          <p className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3 flex-1">
            {description}
          </p>
        )}

        {/* URL */}
        <div className="text-xs text-accent dark:text-accent truncate mt-auto">
          {url}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-neutral-800 border-t border-gray-200 dark:border-neutral-700">
        <button
          onClick={handleOpenLink}
          className="flex items-center gap-1 text-xs text-accent dark:text-accent hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Open Link
        </button>
        {isSelected && onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <Edit className="h-3 w-3" />
            Edit
          </button>
        )}
      </div>
    </div>
  );
}
