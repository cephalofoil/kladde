"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/board-store";
import { useIsClient } from "@/hooks/use-is-client";

export default function BoardPage() {
  const router = useRouter();
  const isClient = useIsClient();
  const createBoard = useBoardStore((s) => s.createBoard);
  const currentWorkstreamId = useBoardStore((s) => s.ui.currentWorkstreamId);

  useEffect(() => {
    if (isClient) {
      // Create a new board in the store
      const boardId = createBoard("Untitled Board", currentWorkstreamId);

      // Navigate to the new board
      router.replace(`/board/${boardId}`);
    }
  }, [isClient, createBoard, currentWorkstreamId, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        <p className="text-muted-foreground">Creating your board...</p>
      </div>
    </div>
  );
}
