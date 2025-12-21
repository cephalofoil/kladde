"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBoardStore } from "@/stores/board-management-store";
import type { BoardData } from "@/types/canvas";
import { CanvasWorkspace } from "@/components/canvas-workspace";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings, Share2, RefreshCw } from "lucide-react";

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initPhase, setInitPhase] = useState<string>("Starting");
  const [initializationComplete, setInitializationComplete] = useState(false);

  // Reset initialization state when boardId changes
  useEffect(() => {
    setInitializationComplete(false);
    setIsLoading(true);
    setError(null);
    setInitPhase("Starting");
  }, [boardId]);

  const boardManagement = useBoardStore();
  // Simplified hydration state for better reliability
  const [hydrated, setHydrated] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [currentBoardData, setCurrentBoardData] = useState<BoardData | null>(
    null,
  );

  // Simplified hydration logic
  useEffect(() => {
    let isMounted = true;

    const checkAndSetHydrated = () => {
      const persist = useBoardStore.persist;

      // Simple check: if persist is available and has hydrated, or if we have any data, we're ready
      const isReady = persist?.hasHydrated?.() ?? false;

      if (isReady && isMounted) {
        setHydrated(true);
        return true;
      }

      return false;
    };

    // Check immediately
    if (checkAndSetHydrated()) {
      return;
    }

    // Set up hydration callback
    const persist = useBoardStore.persist;
    const unsubscribe = persist?.onFinishHydration?.(() => {
      if (isMounted) {
        setHydrated(true);
      }
    });

    // Fallback timeout to prevent hanging
    const timeout = setTimeout(() => {
      if (isMounted) {
        setHydrated(true);
      }
    }, 2000);

    return () => {
      isMounted = false;
      unsubscribe?.();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !boardId || initializationComplete) {
      if (!hydrated || !boardId) {
        setInitPhase("Waiting for store rehydration");
      }
      return;
    }

    let cancelled = false;
    const timeoutId: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (!cancelled && !initializationComplete && isLoading) {
        setError("Board initialization timed out. Please try refreshing.");
        setIsLoading(false);
      } else if (!cancelled && initializationComplete) {
        // Ignore
      }
    }, 10000);
    const initializeBoard = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setInitPhase("Initializing board");

        const state = useBoardStore.getState();

        // Ensure we have minimal store structure
        if (state.workstreams.length === 0) {
          state.ensureDefaultWorkstream();
        }

        // Enhanced board discovery with fallback logic
        let foundBoard = state.boards.find((b) => b.id === boardId);

        if (!foundBoard && boardId) {
          // Validate board ID format first
          const isValidUUID =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              boardId,
            );

          if (!isValidUUID) {
            throw new Error(
              `Invalid board ID format. Please check the URL or access the board through the dashboard.`,
            );
          }

          // Create/recover the board
          foundBoard = state.ensureBoardExists(boardId);
        }

        // Load board data and initialize canvas
        const boardData = state.loadBoardData(boardId);
        setCurrentBoardData(boardData);
        state.switchToBoard(boardId);

        if (!cancelled) {
          setInitPhase("Complete");
          setIsLoading(false);
          setInitializationComplete(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err).replace("Error: ", ""));
          setIsLoading(false);
        }
      } finally {
        // Clear timeout on completion
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    initializeBoard();

    return () => {
      cancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [boardId, hydrated, initializationComplete, isLoading]);

  // Retry function for error recovery
  const retryInitialization = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setInitPhase("Starting");
    setInitializationComplete(false);
    // No need to toggle hydrated state - just reset completion flag
  }, []);

  const currentBoard = boardManagement.boards.find((b) => b.id === boardId);

  // Manual save function - get current data from canvas workspace
  const handleManualSave = useCallback(() => {
    if (boardId && isDirty) {
      try {
        // Trigger save through a custom event that canvas workspace will listen to
        window.dispatchEvent(
          new CustomEvent("manual-save-requested", {
            detail: { boardId },
          }),
        );
        setIsDirty(false);
      } catch {
        // Ignore
      }
    }
  }, [boardId, isDirty]);

  const currentWorkstream = currentBoard
    ? boardManagement.workstreams.find(
        (w) => w.id === currentBoard.workstreamId,
      )
    : null;

  const handleBackToWorkstream = () => {
    if (currentWorkstream) {
      router.push(`/workstream/${currentWorkstream.id}`);
    } else {
      router.push("/");
    }
  };

  const handleBoardSettings = () => {
    router.push(`/board/${boardId}/settings`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading board...</p>
          <p className="text-sm text-gray-500 mt-2">Phase: {initPhase}</p>
          {boardId && (
            <p className="text-xs text-gray-400 mt-1">Board ID: {boardId}</p>
          )}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen p-4">
        <Alert className="max-w-lg">
          <AlertDescription>
            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-red-800 mb-1">
                  Board Loading Failed
                </h4>
                <p className="text-sm">{error}</p>
              </div>

              {boardId && (
                <div className="text-xs text-gray-600">
                  <p>Board ID: {boardId}</p>
                  <p>Last Phase: {initPhase}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={retryInitialization}
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
                <Button
                  onClick={() => router.push("/")}
                  variant="outline"
                  size="sm"
                >
                  Go to Dashboard
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!currentBoard) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Board not found or failed to load
          </p>
          <Button onClick={() => router.push("/")} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Board Header removed: controls now in overlay LogoBar */}

      {/* Canvas Workspace */}
      <div className="flex-1 overflow-hidden">
        <CanvasWorkspace
          boardId={boardId}
          initialBoardData={currentBoardData || undefined}
          onDataChange={(hasChanges) => setIsDirty(hasChanges)}
        />
      </div>
    </div>
  );
}
