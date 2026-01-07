"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Link as LinkIcon, Check, X } from "lucide-react";

interface BookmarkInputRendererProps {
  initialUrl?: string;
  initialDisplayName?: string;
  onSave: (data: {
    url: string;
    title?: string;
    description?: string;
    favicon?: string;
    siteName?: string;
    imageUrl?: string;
    displayName?: string;
  }) => void;
  onCancel?: () => void;
  width?: number;
  height?: number;
  className?: string;
}

export function BookmarkInputRenderer({
  initialUrl = "",
  initialDisplayName = "",
  onSave,
  onCancel,
  width,
  height,
  className,
}: BookmarkInputRendererProps) {
  const [url, setUrl] = useState(initialUrl);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    // Basic URL validation
    let validUrl = url.trim();
    if (!validUrl.startsWith("http://") && !validUrl.startsWith("https://")) {
      validUrl = "https://" + validUrl;
    }

    try {
      new URL(validUrl);
    } catch {
      setError("Please enter a valid URL");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // For now, just save the URL and display name
      // In the future, we can add an API route to fetch metadata
      onSave({
        url: validUrl,
        displayName: displayName.trim() || validUrl,
        title: displayName.trim() || validUrl,
      });
    } catch (err) {
      setError("Failed to save bookmark");
      console.error("Bookmark save error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col bg-white dark:bg-neutral-900 rounded p-4 gap-4",
        className,
      )}
      style={{ width, height }}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <LinkIcon className="h-4 w-4" />
        Add Bookmark
      </div>

      {/* URL Input */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-600 dark:text-gray-400">URL</label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="https://example.com"
          className={cn(
            "w-full px-3 py-2 text-sm rounded border",
            "bg-white dark:bg-neutral-800",
            "border-gray-300 dark:border-gray-600",
            "text-gray-900 dark:text-gray-100",
            "placeholder:text-gray-400 dark:placeholder:text-gray-500",
            "focus:outline-none focus:ring-2 focus:ring-accent",
          )}
          autoFocus
          disabled={isLoading}
        />
      </div>

      {/* Display Name Input */}
      <div className="flex flex-col gap-2">
        <label className="text-xs text-gray-600 dark:text-gray-400">
          Display Name (Optional)
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="My Bookmark"
          className={cn(
            "w-full px-3 py-2 text-sm rounded border",
            "bg-white dark:bg-neutral-800",
            "border-gray-300 dark:border-gray-600",
            "text-gray-900 dark:text-gray-100",
            "placeholder:text-gray-400 dark:placeholder:text-gray-500",
            "focus:outline-none focus:ring-2 focus:ring-accent",
          )}
          disabled={isLoading}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-auto">
        <button
          onClick={handleCancel}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors",
            "text-gray-700 dark:text-gray-300",
            "hover:bg-gray-100 dark:hover:bg-neutral-700",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors",
            "bg-accent hover:bg-accent/90 text-accent-foreground",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-3 w-3" />
              Save
            </>
          )}
        </button>
      </div>

      {/* Help Text */}
      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Press Enter to save, Esc to cancel
      </div>
    </div>
  );
}
