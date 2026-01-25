import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useBoardStore } from "@/store/board-store";
import type { BoardComment } from "@/lib/board-types";
import type { CollaborationManager } from "@/lib/collaboration";

interface UseBoardCommentsOptions {
  isOwner?: boolean;
}

const EMPTY_COMMENTS: BoardComment[] = [];

function deduplicateComments(comments: BoardComment[]): BoardComment[] {
  const seen = new Map<string, BoardComment>();
  for (const comment of comments) {
    seen.set(comment.id, comment);
  }
  return Array.from(seen.values());
}

export function useBoardComments(
  boardId: string,
  collaboration: CollaborationManager | null,
  options: UseBoardCommentsOptions = {},
) {
  const { isOwner = true } = options;
  const boardData = useBoardStore((s) => s.boardData.get(boardId));
  const storeComments = useMemo(
    () => boardData?.comments || EMPTY_COMMENTS,
    [boardData?.comments],
  );
  const setStoreComments = useBoardStore((s) => s.setComments);
  const replaceStoreComments = useBoardStore((s) => s.replaceComments);

  const storeCommentsRef = useRef(storeComments);
  useEffect(() => {
    storeCommentsRef.current = storeComments;
  }, [storeComments]);

  const replaceStoreCommentsRef = useRef(replaceStoreComments);
  useEffect(() => {
    replaceStoreCommentsRef.current = replaceStoreComments;
  }, [replaceStoreComments]);

  const [comments, setCommentsInternal] = useState<BoardComment[]>(() => {
    return isOwner ? storeComments : EMPTY_COMMENTS;
  });

  const initializedFromCollabRef = useRef(false);
  const hasSyncedStoreRef = useRef(false);
  const lastChangeIsRemoteRef = useRef(false);

  useEffect(() => {
    if (!isOwner) return;
    if (collaboration) return;
    const timer = setTimeout(() => {
      setStoreComments(boardId, comments);
    }, 500);
    return () => clearTimeout(timer);
  }, [comments, boardId, setStoreComments, isOwner, collaboration]);

  useEffect(() => {
    if (collaboration) return;
    if (!isOwner) return;
    if (hasSyncedStoreRef.current) return;

    const currentStoreComments = storeCommentsRef.current;
    if (currentStoreComments.length > 0) {
      hasSyncedStoreRef.current = true;
      setCommentsInternal(deduplicateComments(currentStoreComments));
    }
  }, [collaboration, isOwner]);

  useEffect(() => {
    if (!collaboration) {
      initializedFromCollabRef.current = false;
      return;
    }

    let mounted = true;
    const currentStoreComments = storeCommentsRef.current;
    if (
      isOwner &&
      currentStoreComments.length > 0 &&
      !initializedFromCollabRef.current
    ) {
      collaboration.setComments(currentStoreComments);
      initializedFromCollabRef.current = true;
    }

    const loadInitialComments = async () => {
      const collabComments = await collaboration.getCommentsAsync();
      if (mounted && collabComments.length > 0) {
        setCommentsInternal(deduplicateComments(collabComments));
      } else if (mounted && isOwner && currentStoreComments.length > 0) {
        setCommentsInternal(deduplicateComments(currentStoreComments));
      }
    };

    loadInitialComments();

    const unsubscribe = collaboration.onCommentsChange((newComments, info) => {
      if (!mounted) return;
      lastChangeIsRemoteRef.current = info?.isRemote ?? false;
      const deduplicated = deduplicateComments(newComments);
      setCommentsInternal((prev) => {
        if (prev.length !== deduplicated.length) return deduplicated;
        const changed = deduplicated.some((comment, i) => {
          const prevComment = prev[i];
          if (!prevComment || comment.id !== prevComment.id) return true;
          return JSON.stringify(comment) !== JSON.stringify(prevComment);
        });
        return changed ? deduplicated : prev;
      });
      if (isOwner) {
        replaceStoreCommentsRef.current(boardId, deduplicated);
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [collaboration, boardId, isOwner]);

  const updateComments = useCallback(
    (nextComments: BoardComment[]) => {
      const deduplicated = deduplicateComments(nextComments);
      setCommentsInternal(deduplicated);
      if (collaboration) {
        lastChangeIsRemoteRef.current = false;
        collaboration.setComments(deduplicated);
      }
    },
    [collaboration],
  );

  return { comments, setComments: updateComments, lastChangeIsRemoteRef };
}
