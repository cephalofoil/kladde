"use client";

import { useState, useEffect, useCallback } from "react";
import { Download, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
    BoardComment,
    BoardElement,
    ShadeworksFile,
} from "@/lib/board-types";

interface SaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    elements: BoardElement[];
    comments?: BoardComment[];
    canvasBackground: "none" | "dots" | "lines" | "grid";
    boardId?: string;
    boardName?: string;
}

interface SaveOptionProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    selected?: boolean;
    disabled?: boolean;
    badge?: string;
    onClick?: () => void;
    extra?: React.ReactNode;
}

function SaveOption({
    icon,
    title,
    description,
    selected,
    disabled,
    badge,
    onClick,
    extra,
}: SaveOptionProps) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
        }
    };

    return (
        <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            onClick={disabled ? undefined : onClick}
            onKeyDown={handleKeyDown}
            className={cn(
                "w-full flex items-start gap-3 rounded-lg border p-4 text-left transition-all",
                selected
                    ? "border-accent bg-accent/10 ring-2 ring-accent/20"
                    : disabled
                      ? "border-muted bg-muted/30 opacity-60 cursor-not-allowed"
                      : "border-border hover:border-muted-foreground/50 hover:bg-muted/30 cursor-pointer",
            )}
        >
            <div
                className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    selected
                        ? "bg-accent text-accent-foreground"
                        : "bg-muted text-muted-foreground",
                )}
            >
                {icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span
                        className={cn(
                            "font-medium",
                            disabled && "text-muted-foreground",
                        )}
                    >
                        {title}
                    </span>
                    {badge && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                            {badge}
                        </span>
                    )}
                    {selected && <Check className="h-4 w-4 text-accent" />}
                </div>
                <p
                    className={cn(
                        "text-sm mt-0.5",
                        disabled
                            ? "text-muted-foreground/70"
                            : "text-muted-foreground",
                    )}
                >
                    {description}
                </p>
                {extra}
            </div>
        </div>
    );
}

export function SaveModal({
    isOpen,
    onClose,
    elements,
    comments = [],
    canvasBackground,
    boardId: _boardId,
    boardName,
}: SaveModalProps) {
    const [fileName, setFileName] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Initialize state when modal opens
    useEffect(() => {
        if (isOpen) {
            const defaultName =
                boardName || `kladde-${new Date().toISOString().split("T")[0]}`;
            setFileName(defaultName);
            setSaveSuccess(false);
        }
    }, [isOpen, boardName]);

    const handleSave = useCallback(async () => {
        if (!fileName.trim()) return;

        setIsSaving(true);
        setSaveSuccess(false);

        try {
            const kladdeFile: ShadeworksFile = {
                type: "kladde",
                version: 1,
                elements: elements,
                comments: comments,
                appState: {
                    canvasBackground: canvasBackground,
                },
            };

            const jsonString = JSON.stringify(kladdeFile, null, 2);
            const fileNameWithExt = fileName.endsWith(".kladde")
                ? fileName
                : `${fileName}.kladde`;

            // Download as file
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileNameWithExt;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setSaveSuccess(true);
            setTimeout(() => onClose(), 500);
        } catch (error) {
            console.error("Failed to save:", error);
        } finally {
            setIsSaving(false);
        }
    }, [fileName, elements, comments, canvasBackground, onClose]);

    // Handle keyboard shortcuts
    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            } else if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSave();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose, handleSave]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-xl shadow-2xl w-[480px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
                    <h2 className="text-lg font-semibold">Export Board File</h2>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {/* File name input */}
                    <div>
                        <label
                            htmlFor="save-filename"
                            className="block text-sm font-medium mb-2 text-muted-foreground"
                        >
                            File name
                        </label>
                        <input
                            id="save-filename"
                            type="text"
                            className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            autoFocus
                            placeholder="Enter file name"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            {fileName && !fileName.endsWith(".kladde") && (
                                <span>.kladde extension will be added</span>
                            )}
                        </p>
                    </div>

                    {/* Save destination options */}
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-muted-foreground">
                            Export destination
                        </label>
                        <SaveOption
                            icon={<Download className="h-5 w-5" />}
                            title="Download"
                            description="Download a detached .kladde file to your downloads folder"
                            selected
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border/60 bg-muted/30">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-md bg-background hover:bg-muted transition-colors border border-border text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!fileName.trim() || isSaving}
                        className={cn(
                            "px-4 py-2 rounded-md transition-colors text-sm font-medium",
                            saveSuccess
                                ? "bg-green-600 hover:bg-green-600 text-white"
                                : "bg-accent hover:bg-accent/90",
                            "disabled:opacity-50 disabled:cursor-not-allowed",
                        )}
                    >
                        {isSaving ? (
                            "Saving..."
                        ) : saveSuccess ? (
                            <span className="flex items-center gap-1.5">
                                <Check className="h-4 w-4" />
                                Saved
                            </span>
                        ) : (
                            "Export"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
