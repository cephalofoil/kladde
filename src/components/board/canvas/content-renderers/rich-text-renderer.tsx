"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface RichTextRendererProps {
  content: string;
  onChange?: (content: string) => void;
  onFinish?: () => void;
  readOnly?: boolean;
  autoFocus?: boolean;
  className?: string;
}

export function RichTextRenderer({
  content,
  onChange,
  onFinish,
  readOnly = false,
  autoFocus = false,
  className,
}: RichTextRendererProps) {
  const [localContent, setLocalContent] = useState(content);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalContent(newValue);
    onChange?.(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onFinish?.();
    }
  };

  if (readOnly) {
    return (
      <div className={cn("w-full h-full overflow-auto whitespace-pre-wrap", className)}>
        {content || "No content"}
      </div>
    );
  }

  return (
    <textarea
      value={localContent}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={onFinish}
      className={cn(
        "w-full h-full bg-transparent border-none outline-none resize-none p-2",
        "text-sm text-gray-900 dark:text-gray-100",
        "placeholder:text-gray-400 dark:placeholder:text-gray-500",
        className
      )}
      placeholder="Type your text here..."
      autoFocus={autoFocus}
    />
  );
}
