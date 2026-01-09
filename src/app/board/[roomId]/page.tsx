"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { useBoardStore } from "@/store/board-store";

// Dynamic import to avoid SSR issues with Y.js
const Whiteboard = dynamic(
  () => import("@/components/board/whiteboard").then((mod) => mod.Whiteboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-muted-foreground">Loading board...</p>
        </div>
      </div>
    ),
  },
);

interface PageProps {
  params: Promise<{
    roomId: string;
  }>;
}

export default function BoardRoomPage({ params }: PageProps) {
  const { roomId: boardId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isClient, setIsClient] = useState(false);

  // Check if this is a collaboration join link
  const isCollabMode = searchParams?.get("collab") === "1";

  const loadBoard = useBoardStore((s) => s.loadBoard);
  const board = useBoardStore((s) => s.boards.get(boardId));

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      // If joining via collab link, don't require local board
      if (isCollabMode) {
        return;
      }

      // Try to load the board (owner mode)
      const loadedBoard = loadBoard(boardId);

      // If board doesn't exist and not in collab mode, redirect to dashboard
      if (!loadedBoard) {
        router.push("/dashboard");
      }
    }
  }, [isClient, boardId, loadBoard, router, isCollabMode]);

  // Wait for client-side hydration
  if (!isClient) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <p className="text-muted-foreground">Loading board...</p>
        </div>
      </div>
    );
  }

  // If in collab mode (guest), render whiteboard even without local board
  if (isCollabMode) {
    return <Whiteboard boardId={boardId} />;
  }

  // If board doesn't exist (owner mode), show loading while redirecting
  if (!board) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <p className="text-muted-foreground">
            Board not found. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return <Whiteboard boardId={boardId} />;
}
