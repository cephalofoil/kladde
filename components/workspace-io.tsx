"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useBoardStore } from "@/stores/board-management-store";
import { EXPORT_SCHEMA_VERSION } from "@/lib/constants";

export function WorkspaceIO() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const boardStore = useBoardStore();

  const handleExport = () => {
    const data = JSON.stringify(
      {
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        workstreams: boardStore.workstreams,
        currentWorkstreamId: boardStore.currentWorkstreamId,
        boards: boardStore.boards,
        currentBoardId: boardStore.currentBoardId,
        boardData: boardStore.boardData,
      },
      null,
      2,
    );
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "workspace.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const raw = JSON.parse(event.target?.result as string);
        if (!Array.isArray(raw.workstreams) || !Array.isArray(raw.boards)) {
          throw new Error("Invalid workspace file: missing required arrays");
        }

        // revive date fields on workstreams
        const workstreams = raw.workstreams.map(
          (w: Record<string, unknown>) => ({
            ...w,
            createdAt: w.createdAt
              ? new Date(w.createdAt as string)
              : new Date(),
            updatedAt: w.updatedAt
              ? new Date(w.updatedAt as string)
              : new Date(),
            metadata: {
              ...((w.metadata as Record<string, unknown>) || {}),
              lastAccessed: (w.metadata as Record<string, unknown>)
                ?.lastAccessed
                ? new Date(
                    (w.metadata as Record<string, unknown>)
                      .lastAccessed as string,
                  )
                : undefined,
            },
          }),
        );
        const wsIds = new Set(
          workstreams.map((w: Record<string, unknown>) => w.id as string),
        );

        // filter out orphan boards and revive their date fields
        const boards = raw.boards
          .filter((b: Record<string, unknown>) =>
            wsIds.has(b.workstreamId as string),
          )
          .map((b: Record<string, unknown>) => ({
            ...b,
            createdAt: b.createdAt
              ? new Date(b.createdAt as string)
              : new Date(),
            updatedAt: b.updatedAt
              ? new Date(b.updatedAt as string)
              : new Date(),
            lastAccessed: b.lastAccessed
              ? new Date(b.lastAccessed as string)
              : new Date(),
          }));

        // validate/set currentWorkstreamId
        const currentWorkstreamId = wsIds.has(raw.currentWorkstreamId)
          ? raw.currentWorkstreamId
          : (workstreams[0]?.id ?? null);
        // validate/set currentBoardId
        const boardIds = new Set(
          boards.map((b: Record<string, unknown>) => b.id as string),
        );
        const currentBoardId = boardIds.has(raw.currentBoardId)
          ? raw.currentBoardId
          : (boards[0]?.id ?? null);

        useBoardStore.setState((state) => ({
          ...state,
          workstreams,
          currentWorkstreamId,
          boards,
          currentBoardId,
          boardData: raw.boardData ?? {},
          drafts: {},
          patchQueue: [],
          dirtyPaths: new Set<string>(),
          status: "idle",
        }));
      } catch (err) {
        console.error("Import failed", err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={handleExport}>
        Export
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
      >
        Import
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImport}
      />
    </div>
  );
}
