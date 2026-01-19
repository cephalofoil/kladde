"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useBoardStore, QUICK_BOARDS_WORKSPACE_ID } from "@/store/board-store";
import { parseCollabHash, type CollabRoomParams } from "@/lib/hash-router";
import { importKeyFromString } from "@/lib/encryption";

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

export default function HomePage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [collabParams, setCollabParams] = useState<CollabRoomParams | null>(
    null,
  );
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const hasCreatedBoard = useRef(false);

  // Check for collab hash on mount
  useEffect(() => {
    setIsClient(true);

    const params = parseCollabHash();
    if (params) {
      setCollabParams(params);

      // Import the encryption key
      importKeyFromString(params.encryptionKey)
        .then((key) => {
          setEncryptionKey(key);
        })
        .catch((error) => {
          console.error("[HomePage] Failed to import encryption key:", error);
        });
    }
  }, []);

  // Default behavior: create quick board (only if not a collab URL)
  useEffect(() => {
    if (isClient && !hasCreatedBoard.current && !collabParams) {
      hasCreatedBoard.current = true;

      // Get boards and count quick boards for sequential naming
      const boards = useBoardStore.getState().boards;
      const quickBoardCount = Array.from(boards.values()).filter(
        (board) => board.workstreamId === QUICK_BOARDS_WORKSPACE_ID,
      ).length;

      const boardName = `Quick Board ${quickBoardCount + 1}`;

      // Create new board in Quick Boards workspace
      const boardId = useBoardStore
        .getState()
        .createBoard(boardName, QUICK_BOARDS_WORKSPACE_ID);

      // Navigate to the new board
      router.replace(`/board/${boardId}`);
    }
  }, [isClient, router, collabParams]);

  // If this is a collab URL, render the whiteboard
  if (collabParams && isClient) {
    // Wait for encryption key to be imported
    if (!encryptionKey) {
      return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
            <p className="text-muted-foreground">Joining secure room...</p>
          </div>
        </div>
      );
    }

    return (
      <Whiteboard
        boardId={collabParams.roomId}
        collabMode={true}
        collabEncryptionKey={encryptionKey}
        collabViewOnly={collabParams.isViewOnly}
      />
    );
  }

  // Default: show loading while creating quick board
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        <p className="text-muted-foreground">Creating your quick board...</p>
      </div>
    </div>
  );
}
