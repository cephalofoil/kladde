"use client";

import { Globe, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExternalLinkIcon } from "@/components/icons/external-link-icon";

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
  onOpen?: () => void;
}

export function BookmarkRenderer({
  url,
  title,
  description,
  favicon,
  siteName,
  imageUrl: _imageUrl,
  displayName,
  isSelected = false,
  onEdit,
  onOpen,
}: BookmarkRendererProps) {
  const handleClick = () => {
    if (onOpen) {
      onOpen();
    } else {
      // Default behavior: open in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const getDomain = () => {
    try {
      return new URL(url).hostname;
    } catch {
      return 'Invalid URL';
    }
  };

  const getDisplayTitle = () => {
    return displayName || title || siteName || getDomain();
  };

  return (
    <div className="relative h-full">
      {/* Edit button - shows when selected */}
      {isSelected && onEdit && (
        <div className="absolute top-2 right-2 z-10">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-sky-100 text-sky-600 bg-white/90 backdrop-blur-sm rounded-lg shadow-md"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            title="Edit Bookmark"
          >
            <Edit3 className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Visual Header with Title */}
      <div className="mb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
          <span className="text-sm font-medium text-gray-700">{getDisplayTitle()}</span>
        </div>
      </div>

      {/* Bookmark Display - No borders, full space utilization */}
      <div
        onClick={handleClick}
        className="bg-gray-50/50 hover:bg-gray-100/50 transition-all duration-200 group flex h-[200px] cursor-pointer"
      >
        {/* Icon and Content Container */}
        <div className="flex items-start gap-4 flex-1 p-4">
          {/* Icon */}
          <div className="flex-shrink-0 w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
            {favicon ? (
              <span className="text-xl">{favicon}</span>
            ) : (
              <Globe className="h-6 w-6 text-gray-400" />
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {description && (
              <div className="text-sm text-gray-600 line-clamp-6 leading-relaxed mb-2">
                {description}
              </div>
            )}
            <div className="text-sm text-gray-500 truncate font-medium">
              {siteName || getDomain()}
            </div>
          </div>
        </div>

        {/* Full Height External Link Button */}
        <div className="w-16 bg-blue-500 group-hover:bg-blue-600 transition-colors flex items-center justify-center">
          <ExternalLinkIcon className="text-white" size={28} />
        </div>
      </div>
    </div>
  );
}