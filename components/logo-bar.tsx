"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useBoardStore } from "@/stores/board-management-store";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Download, Upload, Settings, Save, Check, X, FileJson, ImageIcon } from "lucide-react";
import { useState, useRef } from "react";

export function LogoBar() {
  const router = useRouter();
  const currentBoardId = useBoardStore((s) => s.currentBoardId);
  const boards = useBoardStore((s) => s.boards);
  const workstreams = useBoardStore((s) => s.workstreams);
  const saveBoardData = useBoardStore((s) => s.saveBoardData);
  const flushNow = useBoardStore((s) => s.flushNow);
  const updateBoard = useBoardStore((s) => s.updateBoard);
  const status = useBoardStore((s) => s.status);

  const { boardName, workstreamName, workstreamId, lastSaved } = useMemo(() => {
    const board = boards.find((b) => b.id === currentBoardId);
    const ws = board ? workstreams.find((w) => w.id === board.workstreamId) : null;
    return {
      boardName: board?.name ?? "Board",
      workstreamName: ws?.name ?? "Workspace",
      workstreamId: ws?.id ?? null,
      lastSaved: board?.updatedAt,
    };
  }, [boards, workstreams, currentBoardId]);

  const handleWorkspaceClick = () => {
    if (workstreamId) router.push(`/workstream/${workstreamId}`);
  };

  const handleSave = async () => {
    if (!currentBoardId) return;
    
    // Update the board's updatedAt timestamp
    updateBoard(currentBoardId, { updatedAt: new Date() });
    
    // Save board data locally
    saveBoardData(currentBoardId);
    
    // Trigger immediate remote sync
    await flushNow();
  };

  const handleSettings = () => {
    if (currentBoardId) router.push(`/board/${currentBoardId}/settings`);
  };

  const handleExportImages = () => {
    // Dispatch event to get selected tiles from canvas workspace
    const event = new CustomEvent("export-images-requested");
    window.dispatchEvent(event);
  };

  const handleExportBoard = () => {
    if (!currentBoardId) return;
    const state = useBoardStore.getState();
    const boardData = state.boardData[currentBoardId];
    if (!boardData) return;
    
    const exportData = {
      version: "1.0",
      boardId: currentBoardId,
      boardData: boardData,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `board-${currentBoardId}-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        window.dispatchEvent(
          new CustomEvent("import-board-data-requested", { detail: raw }),
        );
      } catch (err) {
        console.error("Import failed", err);
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const formatLastSaved = (date: Date | undefined) => {
    if (!date) return "Never saved";
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getSaveStatus = () => {
    const isSaved = status === "idle" && lastSaved;
    const isError = status === "error";
    
    return {
      isSaved,
      isError,
      isSaving: status !== "idle" && status !== "error",
      text: isSaved 
        ? `Saved ${formatLastSaved(lastSaved)}`
        : isError 
        ? "Save failed"
        : "Not saved"
    };
  };

  const saveStatus = getSaveStatus();
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      {/* Left pill: Logo + Workspace / Board */}
      <div className="absolute top-4 left-4 z-10">
        <div className="flex items-center gap-3 bg-card border rounded-lg px-3 py-2 shadow-lg">
          <Image
            src="/kladde-logo.svg"
            alt="Kladde"
            width={80}
            height={22}
            className="h-8 w-auto"
          />
          <div className="flex items-center gap-3">
            {/* Workspace clickable tile with separate hover */}
            <Button
              variant="ghost"
              size="sm"
              className="px-2 py-1 rounded-md hover:bg-muted"
              onClick={handleWorkspaceClick}
              title="Go to Workspace"
            >
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500" />
                <span className="">{workstreamName}</span>
              </span>
            </Button>

            {/* Breadcrumb separator */}
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="text-muted-foreground/60"
            >
              <path
                d="M4.5 3L7.5 6L4.5 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Board name button (non-clickable) */}
            <Button
              variant="ghost"
              size="sm"
              className="px-2 py-1 rounded-md hover:bg-muted pointer-events-none"
            >
              <span className="inline-flex items-center gap-2">
                <span className="font-semibold">{boardName}</span>
              </span>
            </Button>
          </div>
        </div>
      </div>

      {/* Right pill: actions (save, share icon, settings icon) */}
      <div className="absolute top-4 right-4 z-10">
        <div className="flex items-center gap-1 bg-card border rounded-lg px-2 py-2 shadow-lg">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={handleSave}
                disabled={saveStatus.isSaving}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <Save 
                  className={`h-4 w-4 ${
                    isHovered
                      ? saveStatus.isSaved 
                        ? 'text-green-600' 
                        : saveStatus.isError 
                        ? 'text-red-600' 
                        : 'text-foreground'
                      : 'text-foreground'
                  }`} 
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="flex items-center gap-2">
                {saveStatus.isSaved ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <X className="h-4 w-4 text-red-600" />
                )}
                <span>{saveStatus.text}</span>
              </div>
            </TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Export"
              >
                <Download className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleExportImages}>
                <ImageIcon className="h-4 w-4 mr-2" />
                Export Selected Images
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportBoard} disabled={!currentBoardId}>
                <FileJson className="h-4 w-4 mr-2" />
                Export Board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title="Import"
              >
                <Upload className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Import</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" />
                Import Workspace
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="sm"
            title="Settings"
            onClick={handleSettings}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImport}
      />
    </>
  );
}
