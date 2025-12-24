"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore, QUICK_BOARDS_WORKSPACE_ID } from "@/store/board-store";

export default function HomePage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const hasCreatedBoard = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient && !hasCreatedBoard.current) {
      hasCreatedBoard.current = true;

      // Get boards and count quick boards for sequential naming
      const boards = useBoardStore.getState().boards;
      const quickBoardCount = Array.from(boards.values()).filter(
        (board) => board.workstreamId === QUICK_BOARDS_WORKSPACE_ID
      ).length;

      const boardName = `Quick Board ${quickBoardCount + 1}`;

      // Create new board in Quick Boards workspace
      const boardId = useBoardStore.getState().createBoard(boardName, QUICK_BOARDS_WORKSPACE_ID);

      // Navigate to the new board
      router.replace(`/board/${boardId}`);
    }
  }, [isClient, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        <p className="text-muted-foreground">Creating your quick board...</p>
      </div>
    </div>
  );
}
