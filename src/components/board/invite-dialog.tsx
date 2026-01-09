"use client";

import { useMemo, useState, useEffect } from "react";
import { Copy, Shuffle, Pencil, MessageSquare, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateFunnyName } from "@/lib/funny-names";
import type { CollabPermission } from "@/lib/history-types";
import { cn } from "@/lib/utils";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  currentName?: string;
  onNameChange?: (name: string) => void;
  isOwner?: boolean;
}

const permissionOptions: {
  value: CollabPermission;
  label: string;
  description: string;
  icon: typeof Pencil;
}[] = [
  {
    value: "edit",
    label: "Can edit",
    description: "Full editing access to the board",
    icon: Pencil,
  },
  {
    value: "comment",
    label: "Can comment",
    description: "View and add comments (coming soon)",
    icon: MessageSquare,
  },
  {
    value: "view",
    label: "Can view",
    description: "View-only access, no editing",
    icon: Eye,
  },
];

export function InviteDialog({
  open,
  onOpenChange,
  roomId,
  currentName,
  onNameChange,
  isOwner = true,
}: InviteDialogProps) {
  const [copied, setCopied] = useState<CollabPermission | null>(null);
  const [displayName, setDisplayName] = useState(currentName || "");
  const [selectedPermission, setSelectedPermission] =
    useState<CollabPermission>("edit");

  // Sync display name with current name when dialog opens
  useEffect(() => {
    if (open && currentName) {
      setDisplayName(currentName);
    }
  }, [open, currentName]);

  const links = useMemo(() => {
    if (typeof window === "undefined") {
      return { editUrl: "", commentUrl: "", viewUrl: "" };
    }
    const hash = window.location.hash || "";
    const baseUrl = new URL(`/board/${roomId}`, window.location.origin);

    // Edit URL - full access
    const editUrl = new URL(baseUrl.toString());
    editUrl.searchParams.set("collab", "1");

    // Comment URL - comment permission
    const commentUrl = new URL(baseUrl.toString());
    commentUrl.searchParams.set("collab", "1");
    commentUrl.searchParams.set("permission", "comment");

    // View URL - read-only
    const viewUrl = new URL(baseUrl.toString());
    viewUrl.searchParams.set("collab", "1");
    viewUrl.searchParams.set("permission", "view");

    return {
      editUrl: `${editUrl.toString()}${hash}`,
      commentUrl: `${commentUrl.toString()}${hash}`,
      viewUrl: `${viewUrl.toString()}${hash}`,
    };
  }, [roomId, open]);

  const getUrlForPermission = (permission: CollabPermission): string => {
    switch (permission) {
      case "edit":
        return links.editUrl;
      case "comment":
        return links.commentUrl;
      case "view":
        return links.viewUrl;
    }
  };

  const handleCopy = async (permission: CollabPermission) => {
    const url = getUrlForPermission(permission);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(permission);
      window.setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      console.error("Failed to copy invite link:", error);
    }
  };

  const handleNameChange = (newName: string) => {
    setDisplayName(newName);
    if (onNameChange && newName.trim()) {
      onNameChange(newName.trim());
      sessionStorage.setItem("kladde-name", newName.trim());
    }
  };

  const handleRandomizeName = () => {
    const randomName = generateFunnyName();
    handleNameChange(randomName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isOwner ? "Share Board" : "Collaboration"}</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Share a link to collaborate with others on this board."
              : "Set your display name for collaboration."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display-name">Your display name</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                id="display-name"
                value={displayName}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Enter your name..."
                className="flex-1"
                data-dialog-initial-focus
              />
              <Button
                type="button"
                variant="secondary"
                onClick={handleRandomizeName}
                className="sm:w-36"
                title="Generate random name"
              >
                <Shuffle className="h-4 w-4" />
                Random
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This name will be visible to other collaborators.
            </p>
          </div>

          {isOwner && (
            <>
              <div className="w-full h-px bg-border" />

              {/* Permission Selection */}
              <div className="space-y-3">
                <Label>Link permissions</Label>
                <div className="grid gap-2">
                  {permissionOptions.map((option) => {
                    const Icon = option.icon;
                    const isSelected = selectedPermission === option.value;
                    const isDisabled = option.value === "comment"; // Comment is placeholder

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => setSelectedPermission(option.value)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50",
                          isDisabled && "opacity-50 cursor-not-allowed",
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted",
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {option.label}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {option.description}
                          </div>
                        </div>
                        <div
                          className={cn(
                            "w-4 h-4 rounded-full border-2",
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/30",
                          )}
                        >
                          {isSelected && (
                            <div className="w-full h-full rounded-full bg-primary-foreground scale-50" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="w-full h-px bg-border" />

              {/* Share Link */}
              <div className="space-y-2">
                <Label htmlFor="invite-link">Share link</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="invite-link"
                    value={getUrlForPermission(selectedPermission)}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleCopy(selectedPermission)}
                    className="sm:w-36"
                  >
                    <Copy className="h-4 w-4" />
                    {copied === selectedPermission ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedPermission === "edit" &&
                    "Anyone with this link can edit and see cursors."}
                  {selectedPermission === "comment" &&
                    "Anyone with this link can view and add comments."}
                  {selectedPermission === "view" &&
                    "Anyone with this link can view only."}
                </p>
              </div>

              {/* Info about local storage */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">
                  Board data is saved locally on your device. Guests can
                  collaborate in real-time but won't save any data locally.
                </p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
