"use client";

import { Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SaveStatusIndicatorProps {
  show: boolean;
  isDirty?: boolean;
  isSaving?: boolean;
  storageFolderName?: string | null;
  className?: string;
}

export function SaveStatusIndicator({
  show,
  isDirty = false,
  isSaving = false,
  storageFolderName = null,
  className,
}: SaveStatusIndicatorProps) {
  if (!show) return null;

  const folderLabel = storageFolderName
    ? `Stored in workspace folder: ${storageFolderName}`
    : "Stored in workspace folder";

  const label = isSaving
    ? "Saving to workspace folder..."
    : isDirty
      ? "Unsaved changes"
      : folderLabel;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center justify-center h-10 w-10 rounded-md bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent shadow-2xl",
            isSaving || isDirty
              ? "text-muted-foreground"
              : "text-emerald-600 dark:text-emerald-400",
            className,
          )}
        >
          <Save className="h-4 w-4" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
