"use client";

import { useBoardStore } from "@/store/board-store";
import { Folder, Plus, Edit2, Trash2, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

export function WorkstreamSidebar() {
  const [isCreating, setIsCreating] = useState(false);
  const [newWorkstreamName, setNewWorkstreamName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const workstreamsMap = useBoardStore((s) => s.workstreams);
  const workstreams = useMemo(
    () => Array.from(workstreamsMap.values()),
    [workstreamsMap],
  );
  const currentWorkstreamId = useBoardStore((s) => s.ui.currentWorkstreamId);
  const createWorkstream = useBoardStore((s) => s.createWorkstream);
  const updateWorkstream = useBoardStore((s) => s.updateWorkstream);
  const deleteWorkstream = useBoardStore((s) => s.deleteWorkstream);

  const switchWorkstream = (id: string) => {
    useBoardStore.setState((state) => ({
      ui: { ...state.ui, currentWorkstreamId: id },
    }));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newWorkstreamName.trim()) {
      const colors = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"];
      const color = colors[Math.floor(Math.random() * colors.length)];
      createWorkstream(newWorkstreamName.trim(), color);
      setNewWorkstreamName("");
      setIsCreating(false);
    }
  };

  const handleEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditName(name);
  };

  const handleSaveEdit = (id: string) => {
    if (editName.trim()) {
      updateWorkstream(id, { name: editName.trim() });
    }
    setEditingId(null);
    setEditName("");
  };

  const handleDelete = (id: string, name: string) => {
    if (id === "personal") return; // Can't delete personal
    if (
      confirm(`Delete workstream "${name}"? Boards will be moved to Personal.`)
    ) {
      deleteWorkstream(id);
    }
  };

  return (
    <aside className="w-64 border-r bg-white dark:bg-sidebar border-border">
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="border-b border-border p-4">
          <h2 className="text-lg font-semibold text-foreground">Workstreams</h2>
        </div>

        {/* Workstream List */}
        <div className="flex-1 overflow-y-auto p-2">
          {workstreams.map((workstream) => {
            const boardCount = workstream.metadata.boardCount;
            const isActive = currentWorkstreamId === workstream.id;
            const isEditing = editingId === workstream.id;

            return (
              <div
                key={workstream.id}
                className={`group relative mb-1 rounded-lg ${
                  isActive
                    ? "bg-secondary"
                    : "hover:bg-muted/50"
                }`}
              >
                <button
                  onClick={() => switchWorkstream(workstream.id)}
                  className="flex w-full items-center gap-2 p-3 text-left"
                >
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: workstream.color }}
                  />
                  {isEditing ? (
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => handleSaveEdit(workstream.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit(workstream.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      className="flex-1 rounded border border-primary bg-background px-1 text-sm text-foreground outline-none"
                    />
                  ) : (
                    <>
                      <span className="flex-1 truncate text-sm font-medium text-foreground">
                        {workstream.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {boardCount}
                      </span>
                    </>
                  )}
                </button>

                {/* Actions (show on hover) */}
                {!isEditing && workstream.id !== "personal" && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(workstream.id, workstream.name);
                      }}
                      className="rounded p-1 hover:bg-muted"
                      title="Rename"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(workstream.id, workstream.name);
                      }}
                      className="rounded p-1 hover:bg-red-100 dark:hover:bg-red-900/30"
                      title="Delete"
                    >
                      <Trash2 className="h-3 w-3 text-red-600" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Create New Workstream */}
          {isCreating ? (
            <form onSubmit={handleCreate} className="mt-2 p-2">
              <input
                type="text"
                value={newWorkstreamName}
                onChange={(e) => setNewWorkstreamName(e.target.value)}
                onBlur={() => {
                  if (!newWorkstreamName.trim()) setIsCreating(false);
                }}
                placeholder="Workstream name"
                autoFocus
                className="w-full rounded border border-primary bg-background px-2 py-1 text-sm text-foreground outline-none"
              />
            </form>
          ) : (
            <button
              onClick={() => setIsCreating(true)}
              className="mt-2 flex w-full items-center gap-2 rounded-lg p-3 text-left text-sm text-muted-foreground hover:bg-muted/50"
            >
              <Plus className="h-4 w-4" />
              New Workstream
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
