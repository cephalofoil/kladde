"use client";

import { useState, useEffect, useMemo } from "react";
import type { ComponentType } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/stores/board-management-store";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { FileText, Folder, Plus, Home, Layout } from "lucide-react";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface CommandAction {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  action: () => void;
  group: string;
  keywords?: string[];
  meta?: string;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [isOpen, setIsOpen] = useState(open || false);
  const router = useRouter();
  const boardManagement = useBoardStore();



  // Only add event listener on client side
  useEffect(() => {
    if (typeof window !== "undefined") {
      const handleKeyDownClient = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          setIsOpen(true);
        }
      };

      document.addEventListener("keydown", handleKeyDownClient);
      return () => document.removeEventListener("keydown", handleKeyDownClient);
    }
  }, []);

  // Sync with external control
  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    onOpenChange?.(open);
  };

  // Generate command actions
  const actions = useMemo((): CommandAction[] => {
    const actions: CommandAction[] = [];

    // Navigation actions
    actions.push(
      {
        id: "nav-dashboard",
        label: "Go to Dashboard",
        icon: Home,
        action: () => router.push("/"),
        group: "Navigation",
      },
      {
        id: "nav-templates",
        label: "Browse Templates",
        icon: Layout,
        action: () => router.push("/templates"),
        group: "Navigation",
      },
    );

    // Recent boards (last 5)
    const toTime = (d?: string | number | Date) =>
      d ? new Date(d).getTime() || 0 : 0;
    const recentBoards = [...boardManagement.boards]
      .sort((a, b) => toTime(b.lastAccessed) - toTime(a.lastAccessed))
      .slice(0, 5);

    recentBoards.forEach((board) => {
      const workstream = boardManagement.workstreams.find(
        (w) => w.id === board.workstreamId,
      );
      actions.push({
        id: `board-${board.id}`,
        label: board.name,
        icon: FileText,
        action: () => {
          boardManagement.updateLastAccessed(board.id);
          router.push(`/board/${board.id}`);
        },
        group: "Recent Boards",
        keywords: [
          board.name.toLowerCase(),
          ...(board.description ? [board.description.toLowerCase()] : []),
          ...board.tags.map((tag) => tag.toLowerCase()),
          ...(workstream ? [workstream.name.toLowerCase()] : []),
        ],
        meta: workstream ? `in ${workstream.name}` : undefined,
      });
    });

    // All workstreams
    boardManagement.workstreams.forEach((workstream) => {
      actions.push({
        id: `workstream-${workstream.id}`,
        label: workstream.name,
        icon: Folder,
        action: () => router.push(`/workstream/${workstream.id}`),
        group: "Workstreams",
        keywords: [
          workstream.name.toLowerCase(),
          ...(workstream.description
            ? [workstream.description.toLowerCase()]
            : []),
        ],
        meta: `${boardManagement.getWorkstreamBoards(workstream.id).length} boards`,
      });
    });

    // Quick actions
    if (useBoardStore.getState().workstreams.length > 0) {
      const { createBoard, currentWorkstreamId, workstreams, boards } =
        useBoardStore.getState();
      const defaultWorkstream =
        workstreams.find((ws) => ws.id === currentWorkstreamId) ??
        workstreams[0];
      actions.push({
        id: "create-board",
        label: "Create New Board",
        icon: Plus,
        action: () => {
          const newBoardId = createBoard({
            workstreamId: defaultWorkstream.id,
            name: `New Board ${boards.length + 1}`,
            description: "",
            tags: [],
            metadata: {
              tileCount: 0,
              connectionCount: 0,
              canvasBounds: { width: 0, height: 0, minX: 0, minY: 0 },
            },
            settings: {
              isPublic: false,
              allowComments: true,
              backgroundColor: "#ffffff",
              gridVisible: true,
            },
          });
          if (newBoardId) {
            router.push(`/board/${newBoardId}`);
          }
        },
        group: "Actions",
        keywords: ["create", "new", "board", "add"],
      });
    }

    // All boards (if there are many, group them)
    if (boardManagement.boards.length > 5) {
      const allBoards = [...boardManagement.boards]
        .filter((board) => !recentBoards.find((rb) => rb.id === board.id)) // Exclude recent boards
        .sort((a, b) => a.name.localeCompare(b.name));

      allBoards.forEach((board) => {
        const workstream = boardManagement.workstreams.find(
          (w) => w.id === board.workstreamId,
        );
        actions.push({
          id: `all-board-${board.id}`,
          label: board.name,
          icon: FileText,
          action: () => {
            boardManagement.updateLastAccessed(board.id);
            router.push(`/board/${board.id}`);
          },
          group: "All Boards",
          keywords: [
            board.name.toLowerCase(),
            ...(board.description ? [board.description.toLowerCase()] : []),
            ...board.tags.map((tag) => tag.toLowerCase()),
            ...(workstream ? [workstream.name.toLowerCase()] : []),
          ],
          meta: workstream ? `in ${workstream.name}` : undefined,
        });
      });
    }

    return actions;
  }, [boardManagement, router]);

  // Group actions
  const groupedActions = actions.reduce(
    (acc, action) => {
      if (!acc[action.group]) {
        acc[action.group] = [];
      }
      acc[action.group].push(action);
      return acc;
    },
    {} as Record<string, CommandAction[]>,
  );

  const handleSelect = (action: CommandAction) => {
    setIsOpen(false);
    // Small delay to allow dialog to close before navigation
    setTimeout(() => {
      action.action();
    }, 100);
  };

  return (
    <CommandDialog open={isOpen} onOpenChange={handleOpenChange}>
      <CommandInput placeholder="Search boards, workstreams, or actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {Object.entries(groupedActions).map(
          ([group, groupActions], groupIndex) => (
            <div key={group}>
              <CommandGroup heading={group}>
                {groupActions.map((action) => (
                  <CommandItem
                    value={[
                      action.label,
                      action.meta ?? "",
                      ...(action.keywords ?? []),
                    ].join(" ")}
                    key={action.id}
                    onSelect={() => handleSelect(action)}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <action.icon className="h-4 w-4 text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">
                        {action.label}
                      </div>
                      {action.meta && (
                        <div className="text-xs text-gray-500">
                          {action.meta}
                        </div>
                      )}
                    </div>

                    {/* Show recent indicator for recent boards */}
                    {group === "Recent Boards" && (
                      <Badge variant="secondary" className="text-xs">
                        Recent
                      </Badge>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {groupIndex < Object.keys(groupedActions).length - 1 && (
                <CommandSeparator />
              )}
            </div>
          ),
        )}
      </CommandList>

      {/* Help text */}
      <div className="border-t px-3 py-2 text-xs text-gray-500 flex items-center justify-between">
        <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.5 text-xs bg-gray-100 rounded">⌘K</kbd>
          <span>to open</span>
        </span>
      </div>
    </CommandDialog>
  );
}

// Hook for using the command palette
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  const toggle = () => setIsOpen((prev) => !prev);

  return {
    isOpen,
    open,
    close,
    toggle,
    CommandPalette: () => (
      <CommandPalette open={isOpen} onOpenChange={setIsOpen} />
    ),
  };
}
