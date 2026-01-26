"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { Copy, Shuffle, Pencil, Eye, Check } from "lucide-react";
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
import {
  isEncryptionSupported,
  generateEncryptionKey,
  exportKeyToString,
} from "@/lib/encryption";
import { buildCollabUrl } from "@/lib/hash-router";

interface InviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  currentName?: string;
  onNameChange?: (name: string) => void;
  isOwner?: boolean;
  /** Called when encryption key is generated - owner should update their CollaborationManager */
  onEncryptionKeyGenerated?: (key: CryptoKey) => void;
  /** Existing encryption key if already set */
  existingEncryptionKey?: string | null;
}

export function InviteDialog({
  open,
  onOpenChange,
  roomId,
  currentName,
  onNameChange,
  isOwner = true,
  onEncryptionKeyGenerated,
  existingEncryptionKey,
}: InviteDialogProps) {
  const [copiedType, setCopiedType] = useState<"edit" | "view" | null>(null);
  const [displayName, setDisplayName] = useState(currentName || "");
  const [generatedEncryptionKey, setGeneratedEncryptionKey] = useState<
    string | null
  >(null);
  const encryptionKey = existingEncryptionKey ?? generatedEncryptionKey;

  const ensureEncryptionKey = useCallback(async () => {
    if (!isEncryptionSupported()) {
      // Fallback: generate a random string if crypto not supported
      setGeneratedEncryptionKey(Math.random().toString(36).substring(2, 24));
      return;
    }

    try {
      const key = await generateEncryptionKey();
      const exportedKey = await exportKeyToString(key);
      setGeneratedEncryptionKey(exportedKey);
      // Notify parent so they can update CollaborationManager
      onEncryptionKeyGenerated?.(key);
      console.log("[InviteDialog] E2E encryption key generated");
    } catch (error) {
      console.error(
        "[InviteDialog] Failed to generate encryption key:",
        error,
      );
      // Fallback
      setGeneratedEncryptionKey(Math.random().toString(36).substring(2, 24));
    }
  }, [onEncryptionKeyGenerated]);

  useEffect(() => {
    if (!open) return;
    if (currentName) {
      setDisplayName(currentName);
    }
    if (isOwner && !existingEncryptionKey && !generatedEncryptionKey) {
      void ensureEncryptionKey();
    }
  }, [
    open,
    currentName,
    isOwner,
    existingEncryptionKey,
    generatedEncryptionKey,
    ensureEncryptionKey,
  ]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  const links = useMemo(() => {
    if (!encryptionKey) {
      return { editUrl: "", viewUrl: "" };
    }

    return {
      editUrl: buildCollabUrl(roomId, encryptionKey, false),
      viewUrl: buildCollabUrl(roomId, encryptionKey, true),
    };
  }, [roomId, encryptionKey]);

  const handleCopy = async (type: "edit" | "view") => {
    const url = type === "edit" ? links.editUrl : links.viewUrl;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2000);
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
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isOwner ? "Share Board" : "Collaboration"}</DialogTitle>
          <DialogDescription>
            {isOwner
              ? "Share a secure link to collaborate with others."
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

          {isOwner && encryptionKey && (
            <>
              <div className="w-full h-px bg-border" />

              {/* Share Links */}
              <div className="space-y-4">
                <Label>Share links</Label>

                {/* Edit Link */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Pencil className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">Edit access</div>
                      <div className="text-xs text-muted-foreground">
                        Can draw, edit, and see cursors
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={links.editUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleCopy("edit")}
                      className="shrink-0 w-24"
                    >
                      {copiedType === "edit" ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* View Link */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">View only</div>
                      <div className="text-xs text-muted-foreground">
                        Can only view, no editing
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={links.viewUrl}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleCopy("view")}
                      className="shrink-0 w-24"
                    >
                      {copiedType === "view" ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="w-full h-px bg-border" />

              {/* Info about encryption */}
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-xs font-medium">End-to-end encrypted</p>
                <p className="text-xs text-muted-foreground">
                  The encryption key is in the link. Only people with the link
                  can see the board content. The server cannot read your data.
                </p>
              </div>
            </>
          )}

          {isOwner && !encryptionKey && (
            <div className="flex items-center justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="ml-2 text-sm text-muted-foreground">
                Generating secure link...
              </span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
