"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/store/board-store";

export default function BoardPage() {
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const createBoard = useBoardStore((s) => s.createBoard);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isClient) {
      // Create a new board in the store
      const boardId = createBoard("Untitled Board");

      // Navigate to the new board
      router.replace(`/board/${boardId}`);
    }
  }, [isClient, createBoard, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        <p className="text-muted-foreground">Creating your board...</p>
      </div>
    </div>
  );
}
