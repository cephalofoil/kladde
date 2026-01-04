"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { v4 as uuid } from "uuid";
import { PanelRight } from "lucide-react";
import { Canvas } from "./canvas";
import { Toolbar } from "./toolbar";
import { ToolSidebar } from "./tool-sidebar";
import { LayersSidebar } from "./layers-sidebar";

import { BurgerMenu } from "./burger-menu";
import { CanvasTitleBar } from "./canvas-title-bar";
import { ExportImageModal } from "./export-image-modal";
import { FindCanvas } from "./find-canvas";
import { HotkeysDialog } from "./hotkeys-dialog";
import { InviteDialog } from "./invite-dialog";
import { CollaborationBar } from "./collaboration-bar";
import {
  CollaborationManager,
  type ConnectionStatus,
} from "@/lib/collaboration";
import { generateFunnyName } from "@/lib/funny-names";
import type {
  Tool,
  BoardElement,
  ShadeworksFile,
  TileType,
} from "@/lib/board-types";
import { isClosedShape } from "@/lib/board-types";
import {
  getKeyFromUrl,
  importKeyFromString,
  isEncryptionSupported,
} from "@/lib/encryption";
import { useBoardElements } from "@/hooks/use-board-elements";
import { useBoardStore } from "@/store/board-store";
import { getBoundingBox, translateElement } from "./whiteboard/utils";
import type { BoundingBox } from "./whiteboard/utils";

interface WhiteboardProps {
  boardId: string;
}

const MAX_UNDO_STACK = 100;

export function Whiteboard({ boardId }: WhiteboardProps) {
  const searchParams = useSearchParams();
  const sessionId = searchParams?.get("session"); // Check for collaboration session
  const roomId = sessionId || boardId; // Use sessionId for collab, boardId for solo
  const isReadOnly =
    searchParams?.get("readonly") === "1" ||
    searchParams?.get("readonly") === "true";
  const { theme, resolvedTheme } = useTheme();
  const [tool, setTool] = useState<Tool>("select");
  const [isToolLocked, setIsToolLocked] = useState(false);
  const [selectedTileType, setSelectedTileType] = useState<TileType | null>(
    null,
  );

  // Default color based on theme: black in light mode, white in dark mode
  const getDefaultStrokeColor = () => {
    const currentTheme = resolvedTheme || theme;
    return currentTheme === "light" ? "#000000" : "#ffffff";
  };

  const [strokeColor, setStrokeColor] = useState(getDefaultStrokeColor());
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [fillColor, setFillColor] = useState("transparent");
  const [opacity, setOpacity] = useState(100);
  const [strokeStyle, setStrokeStyle] = useState<"solid" | "dashed" | "dotted">(
    "solid",
  );
  const [lineCap, setLineCap] = useState<"butt" | "round">("round");
  const [connectorStyle, setConnectorStyle] = useState<
    "sharp" | "curved" | "elbow"
  >("sharp");
  const [arrowStart, setArrowStart] =
    useState<NonNullable<BoardElement["arrowStart"]>>("arrow");
  const [arrowEnd, setArrowEnd] =
    useState<NonNullable<BoardElement["arrowEnd"]>>("arrow");
  const [cornerRadius, setCornerRadius] = useState(0);
  const [fontFamily, setFontFamily] = useState("var(--font-inter)");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">(
    "left",
  );
  const [fontSize, setFontSize] = useState(24);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [lineHeight, setLineHeight] = useState(1.5);
  const [fillPattern, setFillPattern] = useState<
    "none" | "solid" | "criss-cross"
  >("none");

  // Collaboration state
  const [collaboration, setCollaboration] =
    useState<CollaborationManager | null>(null);

  // Elements state - integrated with Zustand store and optional collaboration
  const { elements, setElements } = useBoardElements(boardId, collaboration);
  const [peerCount, setPeerCount] = useState(0);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("connecting");
  const [myName, setMyName] = useState<string | null>(null);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [collaboratorUsers, setCollaboratorUsers] = useState<
    Array<{
      id: string;
      name: string;
      color: string;
      viewport?: { pan: { x: number; y: number }; zoom: number };
    }>
  >([]);
  const [remoteSelections, setRemoteSelections] = useState<
    Array<{
      userId: string;
      userName: string;
      userColor: string;
      elementIds: string[];
    }>
  >([]);
  const [spectatedUserIds, setSpectatedUserIds] = useState<Set<string>>(
    new Set(),
  );
  const [isReady, setIsReady] = useState(false);
  const [followedUserId, setFollowedUserId] = useState<string | null>(null);
  const [selectedElements, setSelectedElements] = useState<BoardElement[]>([]);
  const [isEditArrowMode, setIsEditArrowMode] = useState(false);
  const [canvasBackground, setCanvasBackground] = useState<
    "none" | "dots" | "lines" | "grid"
  >("none");
  const [handDrawnMode, setHandDrawnMode] = useState(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kladde-handdrawn-mode");
      return saved === "true";
    }
    return false;
  });
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveFileName, setSaveFileName] = useState("");
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showFindCanvas, setShowFindCanvas] = useState(false);
  const [showHotkeysDialog, setShowHotkeysDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showLayersSidebar, setShowLayersSidebar] = useState(false);
  const [pendingName, setPendingName] = useState<string | null>(null);
  const [highlightedElementIds, setHighlightedElementIds] = useState<string[]>(
    [],
  );
  const [currentHighlightId, setCurrentHighlightId] = useState<string | null>(
    null,
  );
  const [hideLogoBar, setHideLogoBar] = useState(false);
  const effectiveTool = isReadOnly ? "hand" : tool;

  // Undo/Redo stacks - store snapshots
  const undoStackRef = useRef<BoardElement[][]>([]);
  const redoStackRef = useRef<BoardElement[][]>([]);
  const isUndoingRef = useRef(false);
  const elementsRef = useRef<BoardElement[]>(elements);

  // Ref to store the setViewport function from Canvas
  const setViewportRef = useRef<
    ((pan: { x: number; y: number }, zoom: number) => void) | null
  >(null);

  // Keep elementsRef in sync with elements
  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Persist handDrawn mode to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kladde-handdrawn-mode", String(handDrawnMode));
    }
  }, [handDrawnMode]);

  // Update default stroke color when theme changes
  useEffect(() => {
    const currentTheme = resolvedTheme || theme;
    const defaultColor = currentTheme === "light" ? "#000000" : "#ffffff";
    const oldDefaultColor = currentTheme === "light" ? "#ffffff" : "#000000";

    // Update current stroke color if it's a default color
    if (strokeColor === "#ffffff" || strokeColor === "#000000") {
      setStrokeColor(defaultColor);
    }

    // Update all existing elements that use default colors (black/white)
    const elementsToUpdate = elements.filter(
      (element) =>
        element.strokeColor === oldDefaultColor ||
        element.fillColor === oldDefaultColor,
    );

    if (elementsToUpdate.length > 0) {
      const updatedElements = elements.map((element) => {
        const updates: Partial<BoardElement> = {};
        if (element.strokeColor === oldDefaultColor) {
          updates.strokeColor = defaultColor;
        }
        if (element.fillColor === oldDefaultColor) {
          updates.fillColor = defaultColor;
        }
        return Object.keys(updates).length > 0
          ? { ...element, ...updates }
          : element;
      });
      setElements(updatedElements);
    }
  }, [theme, resolvedTheme]);

  // Ensure a display name exists for collaboration.
  useEffect(() => {
    const existingName = sessionStorage.getItem("kladde-name");
    if (existingName) {
      setPendingName(existingName);
    } else {
      const name = generateFunnyName();
      sessionStorage.setItem("kladde-name", name);
      setPendingName(name);
    }
  }, [isReadOnly]);

  // Initialize collaboration with the user's name and E2E encryption
  // ONLY when there's a session parameter (opt-in collaboration)
  useEffect(() => {
    // Solo mode: no collaboration needed
    if (!sessionId) {
      console.log("[Whiteboard] Solo mode - no collaboration");
      setConnectionStatus("connected");
      setPeerCount(0);
      setIsReady(true);
      return;
    }

    // Wait for name to be set (either from storage or join modal)
    if (!pendingName) return;

    let mounted = true;
    let collab: CollaborationManager | null = null;
    let unsubAwareness: (() => void) | null = null;
    let unsubConnection: (() => void) | null = null;

    const initializeCollaboration = async () => {
      const name = pendingName;
      if (mounted) setMyName(name);

      // Try to get encryption key from URL hash
      let encryptionKey: CryptoKey | undefined;
      if (isEncryptionSupported()) {
        const keyString = getKeyFromUrl();
        if (keyString) {
          try {
            encryptionKey = await importKeyFromString(keyString);
            console.log("[Whiteboard] E2E encryption enabled");
          } catch (error) {
            console.error(
              "[Whiteboard] Failed to import encryption key:",
              error,
            );
          }
        } else {
          console.log(
            "[Whiteboard] No encryption key in URL, room is not encrypted",
          );
        }
      }

      if (!mounted) return;

      collab = new CollaborationManager(roomId, name, encryptionKey, {
        readOnly: isReadOnly,
      });

      // Set collaboration - this triggers useBoardElements hook to handle sync
      setCollaboration(collab);
      setMyUserId(collab.getUserInfo().id);

      // Note: Element loading and syncing is now handled by useBoardElements hook
      // No need to manually subscribe or load elements here

      // Subscribe to awareness changes for user count and collaborator info
      unsubAwareness = collab.onAwarenessChange((states) => {
        if (!mounted || !collab) return;
        // Extract collaborator user info (excluding current user)
        const users: Array<{
          id: string;
          name: string;
          color: string;
          viewport?: { pan: { x: number; y: number }; zoom: number };
        }> = [];
        // Track which users are being spectated
        const spectated = new Set<string>();
        // Track remote selections (elements selected by other users)
        const selections: Array<{
          userId: string;
          userName: string;
          userColor: string;
          elementIds: string[];
        }> = [];
        const myId = collab!.getUserInfo().id;

        states.forEach((state) => {
          if (state.user) {
            // Track who is being followed/spectated
            if (state.user.followingUserId) {
              spectated.add(state.user.followingUserId);
            }
            // Add to collaborator list (excluding self)
            if (state.user.id !== myId) {
              users.push({
                id: state.user.id,
                name: state.user.name,
                color: state.user.color,
                viewport: state.user.viewport,
              });
              // Track their selections
              if (
                state.user.selectedElementIds &&
                state.user.selectedElementIds.length > 0
              ) {
                selections.push({
                  userId: state.user.id,
                  userName: state.user.name,
                  userColor: state.user.color,
                  elementIds: state.user.selectedElementIds,
                });
              }
            }
          }
        });
        setCollaboratorUsers(users);
        setSpectatedUserIds(spectated);
        setRemoteSelections(selections);
      });

      // Subscribe to connection status changes
      unsubConnection = collab.onConnectionChange((status, peers) => {
        if (mounted) {
          setConnectionStatus(status);
          setPeerCount(peers);
        }
      });

      if (mounted) setIsReady(true);
    };

    initializeCollaboration();

    return () => {
      mounted = false;
      unsubAwareness?.();
      unsubConnection?.();
      collab?.destroy();
    };
  }, [sessionId, roomId, isReadOnly, pendingName]);

  // Save state to undo stack
  const saveToUndoStack = useCallback(() => {
    if (isUndoingRef.current) return;

    const snapshot = JSON.parse(JSON.stringify(elementsRef.current));
    undoStackRef.current = [...undoStackRef.current, snapshot].slice(
      -MAX_UNDO_STACK,
    );
    redoStackRef.current = []; // Clear redo on new action
  }, []);

  // Apply state to collaboration
  const applyState = useCallback(
    (newElements: BoardElement[]) => {
      if (collaboration) {
        collaboration.clearAll();
        newElements.forEach((el) => collaboration.addElement(el));
      } else {
        setElements(newElements);
      }
    },
    [collaboration],
  );

  // Undo function - instant
  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;

    isUndoingRef.current = true;

    // Save current to redo
    const currentSnapshot = JSON.parse(JSON.stringify(elementsRef.current));
    redoStackRef.current = [...redoStackRef.current, currentSnapshot];

    // Pop from undo
    const previousState = undoStackRef.current.pop()!;

    // Apply
    applyState(previousState);

    // Reset flag immediately
    requestAnimationFrame(() => {
      isUndoingRef.current = false;
    });
  }, [applyState]);

  // Redo function - instant
  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;

    isUndoingRef.current = true;

    // Save current to undo
    const currentSnapshot = JSON.parse(JSON.stringify(elementsRef.current));
    undoStackRef.current = [...undoStackRef.current, currentSnapshot];

    // Pop from redo
    const nextState = redoStackRef.current.pop()!;

    // Apply
    applyState(nextState);

    // Reset flag immediately
    requestAnimationFrame(() => {
      isUndoingRef.current = false;
    });
  }, [applyState]);

  // Handle keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReadOnly) return;
      // Don't trigger if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, isReadOnly]);

  const handleAddElement = useCallback(
    (element: BoardElement) => {
      if (isReadOnly) return;
      saveToUndoStack();

      if (collaboration) {
        collaboration.addElement(element);
      } else {
        setElements([...elements, element]);
      }
    },
    [collaboration, elements, saveToUndoStack, isReadOnly],
  );

  const handleUpdateElement = useCallback(
    (id: string, updates: Partial<BoardElement>) => {
      if (isReadOnly) return;
      if (collaboration) {
        collaboration.updateElement(id, updates);
      } else {
        setElements(
          elements.map((el) => (el.id === id ? { ...el, ...updates } : el)),
        );
      }
    },
    [collaboration, elements, isReadOnly],
  );

  const handleBatchUpdateElements = useCallback(
    (updates: Array<{ id: string; updates: Partial<BoardElement> }>) => {
      if (isReadOnly) return;
      if (updates.length === 0) return;

      if (collaboration) {
        updates.forEach(({ id, updates: elementUpdates }) => {
          collaboration.updateElement(id, elementUpdates);
        });
      } else {
        const updatesMap = new Map(
          updates.map(({ id, updates: u }) => [id, u]),
        );
        setElements(
          elements.map((el) =>
            updatesMap.has(el.id) ? { ...el, ...updatesMap.get(el.id) } : el,
          ),
        );
      }
    },
    [collaboration, elements, isReadOnly],
  );

  const handleStartTransform = useCallback(() => {
    saveToUndoStack();
  }, [saveToUndoStack]);

  const handleDeleteElement = useCallback(
    (id: string) => {
      if (isReadOnly) return;
      saveToUndoStack();

      if (collaboration) {
        collaboration.deleteElement(id);
      } else {
        setElements(elements.filter((el) => el.id !== id));
      }
    },
    [collaboration, elements, saveToUndoStack, isReadOnly],
  );

  const handleDeleteElements = useCallback(
    (ids: string[]) => {
      if (isReadOnly || ids.length === 0) return;
      saveToUndoStack();

      if (collaboration) {
        ids.forEach((id) => collaboration.deleteElement(id));
      } else {
        const idSet = new Set(ids);
        setElements(elements.filter((el) => !idSet.has(el.id)));
      }
    },
    [collaboration, elements, saveToUndoStack, isReadOnly],
  );

  const handleClear = useCallback(() => {
    if (isReadOnly) return;
    saveToUndoStack();

    if (collaboration) {
      collaboration.clearAll();
    } else {
      setElements([]);
    }
  }, [collaboration, saveToUndoStack, isReadOnly]);

  const handleSave = useCallback(() => {
    if (isReadOnly) return;
    // Set default filename with current date
    setSaveFileName(`kladde-${new Date().toISOString().split("T")[0]}`);
    setShowSaveDialog(true);
  }, [isReadOnly]);

  const handleConfirmSave = useCallback(() => {
    if (isReadOnly) return;
    const kladdeFile: ShadeworksFile = {
      type: "kladde",
      version: 1,
      elements: elements,
      appState: {
        canvasBackground: canvasBackground,
      },
    };

    const jsonString = JSON.stringify(kladdeFile, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    // Ensure .kladde extension
    const fileName = saveFileName.endsWith(".kladde")
      ? saveFileName
      : `${saveFileName}.kladde`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowSaveDialog(false);
    setSaveFileName("");
  }, [elements, canvasBackground, saveFileName, isReadOnly]);

  const handleOpen = useCallback(() => {
    if (isReadOnly) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".kladde,.shadeworks,application/json";

    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const data: ShadeworksFile = JSON.parse(content);

          // Validate file format (support both old and new format)
          if (data.type !== "kladde" && data.type !== "shadeworks") {
            alert("Invalid file format. Please select a .kladde file.");
            return;
          }

          // Save current state to undo before loading
          saveToUndoStack();

          // Load elements
          if (collaboration) {
            collaboration.clearAll();
            data.elements.forEach((el) => collaboration.addElement(el));
          } else {
            setElements(data.elements);
          }

          // Load app state
          if (data.appState?.canvasBackground) {
            setCanvasBackground(data.appState.canvasBackground);
          }
        } catch (error) {
          console.error("Error loading file:", error);
          alert(
            "Failed to load file. Please ensure it is a valid .kladde file.",
          );
        }
      };

      reader.readAsText(file);
    };

    input.click();
  }, [collaboration, saveToUndoStack, isReadOnly]);

  const handleExportImage = useCallback(() => {
    setShowExportDialog(true);
  }, []);

  const handleFindOnCanvas = useCallback(() => {
    setShowFindCanvas(true);
  }, []);

  const handleFocusElement = useCallback((element: BoardElement) => {
    // Pan viewport to center on the element
    if (setViewportRef.current) {
      let centerX = 0;
      let centerY = 0;

      if (
        element.type === "text" ||
        element.type === "rectangle" ||
        element.type === "ellipse" ||
        element.type === "diamond" ||
        element.type === "frame" ||
        element.type === "tile"
      ) {
        centerX = (element.x ?? 0) + (element.width ?? 0) / 2;
        centerY = (element.y ?? 0) + (element.height ?? 0) / 2;
      } else if (
        element.type === "pen" ||
        element.type === "line" ||
        element.type === "arrow"
      ) {
        const xs = element.points.map((p) => p.x);
        const ys = element.points.map((p) => p.y);
        centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      }

      // Get viewport dimensions (assuming window size)
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Pan to center the element
      const panX = viewportWidth / 2 - centerX;
      const panY = viewportHeight / 2 - centerY;

      setViewportRef.current({ x: panX, y: panY }, 1);
    }

    // Select the element
    setSelectedElements([element]);
  }, []);

  const handleHighlightElements = useCallback(
    (ids: string[], currentId?: string | null) => {
      setHighlightedElementIds(ids);
      setCurrentHighlightId(currentId ?? null);
    },
    [],
  );

  const handleFollowUser = useCallback((userId: string) => {
    // Toggle follow mode - if clicking the same user, unfollow
    setFollowedUserId((prev) => (prev === userId ? null : userId));
  }, []);

  const handleBringToFront = useCallback(() => {
    if (selectedElements.length === 0) return;
    saveToUndoStack();

    const maxZIndex = Math.max(...elements.map((el) => el.zIndex || 0), 0);
    selectedElements.forEach((selectedEl) => {
      handleUpdateElement(selectedEl.id, { zIndex: maxZIndex + 1 });
    });
  }, [selectedElements, elements, saveToUndoStack, handleUpdateElement]);

  const handleSendToBack = useCallback(() => {
    if (selectedElements.length === 0) return;
    saveToUndoStack();

    const minZIndex = Math.min(...elements.map((el) => el.zIndex || 0), 0);
    selectedElements.forEach((selectedEl) => {
      handleUpdateElement(selectedEl.id, { zIndex: minZIndex - 1 });
    });
  }, [selectedElements, elements, saveToUndoStack, handleUpdateElement]);

  // Handle property changes - apply to selected elements if any, otherwise update defaults
  const handleStrokeColorChange = useCallback(
    (color: string) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          handleUpdateElement(el.id, { strokeColor: color });
        });
      }
      setStrokeColor(color);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleStrokeWidthChange = useCallback(
    (width: number) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          handleUpdateElement(el.id, { strokeWidth: width });
        });
      }
      setStrokeWidth(width);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleFillColorChange = useCallback(
    (color: string) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (
            el.type === "rectangle" ||
            el.type === "diamond" ||
            el.type === "ellipse" ||
            el.type === "frame" ||
            (el.type === "pen" && el.isClosed && el.fillPattern !== "none")
          ) {
            handleUpdateElement(el.id, { fillColor: color });
          }
        });
      }
      setFillColor(color);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleOpacityChange = useCallback(
    (newOpacity: number) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          handleUpdateElement(el.id, { opacity: newOpacity });
        });
      }
      setOpacity(newOpacity);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleStrokeStyleChange = useCallback(
    (style: "solid" | "dashed" | "dotted") => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          handleUpdateElement(el.id, { strokeStyle: style });
        });
      }
      setStrokeStyle(style);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleCornerRadiusChange = useCallback(
    (radius: number) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (
            el.type === "rectangle" ||
            el.type === "diamond" ||
            el.type === "frame"
          ) {
            handleUpdateElement(el.id, { cornerRadius: radius });
          }
        });
      }
      setCornerRadius(radius);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleFontFamilyChange = useCallback(
    (font: string) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (el.type === "text") {
            handleUpdateElement(el.id, { fontFamily: font });
          }
        });
      }
      setFontFamily(font);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleTextAlignChange = useCallback(
    (align: "left" | "center" | "right") => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (el.type === "text") {
            handleUpdateElement(el.id, { textAlign: align });
          }
        });
      }
      setTextAlign(align);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleFontSizeChange = useCallback(
    (size: number) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (el.type === "text") {
            handleUpdateElement(el.id, { fontSize: size });
          }
        });
      }
      setFontSize(size);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleLetterSpacingChange = useCallback(
    (spacing: number) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (el.type === "text") {
            handleUpdateElement(el.id, { letterSpacing: spacing });
          }
        });
      }
      setLetterSpacing(spacing);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleLineHeightChange = useCallback(
    (height: number) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (el.type === "text") {
            handleUpdateElement(el.id, { lineHeight: height });
          }
        });
      }
      setLineHeight(height);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleFillPatternChange = useCallback(
    (pattern: "none" | "solid" | "criss-cross") => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (el.type === "pen") {
            // Check if the stroke is closed (in case it wasn't detected before)
            const isClosed = el.isClosed ?? isClosedShape(el.points);
            if (isClosed) {
              handleUpdateElement(el.id, {
                fillPattern: pattern,
                isClosed: true, // Make sure isClosed is set
              });
            }
          }
        });
      }
      setFillPattern(pattern);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleLineCapChange = useCallback(
    (cap: "butt" | "round") => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          handleUpdateElement(el.id, { lineCap: cap });
        });
      }
      setLineCap(cap);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleConnectorStyleChange = useCallback(
    (style: "sharp" | "curved" | "elbow") => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (el.type === "line" || el.type === "arrow") {
            handleUpdateElement(el.id, { connectorStyle: style });
          }
        });
      }
      setConnectorStyle(style);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleArrowStartChange = useCallback(
    (end: NonNullable<BoardElement["arrowStart"]>) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (el.type === "arrow") {
            handleUpdateElement(el.id, { arrowStart: end });
          }
        });
      }
      setArrowStart(end);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleArrowEndChange = useCallback(
    (end: NonNullable<BoardElement["arrowEnd"]>) => {
      if (selectedElements.length > 0) {
        saveToUndoStack();
        selectedElements.forEach((el) => {
          if (el.type === "arrow") {
            handleUpdateElement(el.id, { arrowEnd: end });
          }
        });
      }
      setArrowEnd(end);
    },
    [selectedElements, saveToUndoStack, handleUpdateElement],
  );

  const handleMoveForward = useCallback(() => {
    if (selectedElements.length === 0) return;
    saveToUndoStack();

    selectedElements.forEach((el) => {
      const currentZIndex = el.zIndex ?? 0;
      handleUpdateElement(el.id, { zIndex: currentZIndex + 1 });
    });
  }, [selectedElements, saveToUndoStack, handleUpdateElement]);

  const handleMoveBackward = useCallback(() => {
    if (selectedElements.length === 0) return;
    saveToUndoStack();

    selectedElements.forEach((el) => {
      const currentZIndex = el.zIndex ?? 0;
      handleUpdateElement(el.id, { zIndex: currentZIndex - 1 });
    });
  }, [selectedElements, saveToUndoStack, handleUpdateElement]);

  const handleAlignLeft = useCallback(() => {
    if (selectedElements.length < 2) return;
    saveToUndoStack();
    const bounds = selectedElements
      .map((el) => ({ el, b: getBoundingBox(el) }))
      .filter((x) => x.b) as Array<{
      el: BoardElement;
      b: BoundingBox;
    }>;
    if (bounds.length < 2) return;
    const target = Math.min(...bounds.map(({ b }) => b.x));
    bounds.forEach(({ el, b }) =>
      handleUpdateElement(el.id, translateElement(el, target - b.x, 0)),
    );
  }, [selectedElements, saveToUndoStack, handleUpdateElement]);

  const handleAlignCenterHorizontal = useCallback(() => {
    if (selectedElements.length < 2) return;
    saveToUndoStack();
    const bounds = selectedElements
      .map((el) => ({ el, b: getBoundingBox(el) }))
      .filter((x) => x.b) as Array<{
      el: BoardElement;
      b: BoundingBox;
    }>;
    if (bounds.length < 2) return;
    const minX = Math.min(...bounds.map(({ b }) => b.x));
    const maxX = Math.max(...bounds.map(({ b }) => b.x + b.width));
    const target = (minX + maxX) / 2;
    bounds.forEach(({ el, b }) =>
      handleUpdateElement(
        el.id,
        translateElement(el, target - (b.x + b.width / 2), 0),
      ),
    );
  }, [selectedElements, saveToUndoStack, handleUpdateElement]);

  const handleAlignRight = useCallback(() => {
    if (selectedElements.length < 2) return;
    saveToUndoStack();
    const bounds = selectedElements
      .map((el) => ({ el, b: getBoundingBox(el) }))
      .filter((x) => x.b) as Array<{
      el: BoardElement;
      b: BoundingBox;
    }>;
    if (bounds.length < 2) return;
    const target = Math.max(...bounds.map(({ b }) => b.x + b.width));
    bounds.forEach(({ el, b }) =>
      handleUpdateElement(
        el.id,
        translateElement(el, target - (b.x + b.width), 0),
      ),
    );
  }, [selectedElements, saveToUndoStack, handleUpdateElement]);

  const handleAlignTop = useCallback(() => {
    if (selectedElements.length < 2) return;
    saveToUndoStack();
    const bounds = selectedElements
      .map((el) => ({ el, b: getBoundingBox(el) }))
      .filter((x) => x.b) as Array<{
      el: BoardElement;
      b: BoundingBox;
    }>;
    if (bounds.length < 2) return;
    const target = Math.min(...bounds.map(({ b }) => b.y));
    bounds.forEach(({ el, b }) =>
      handleUpdateElement(el.id, translateElement(el, 0, target - b.y)),
    );
  }, [selectedElements, saveToUndoStack, handleUpdateElement]);

  const handleAlignCenterVertical = useCallback(() => {
    if (selectedElements.length < 2) return;
    saveToUndoStack();
    const bounds = selectedElements
      .map((el) => ({ el, b: getBoundingBox(el) }))
      .filter((x) => x.b) as Array<{
      el: BoardElement;
      b: BoundingBox;
    }>;
    if (bounds.length < 2) return;
    const minY = Math.min(...bounds.map(({ b }) => b.y));
    const maxY = Math.max(...bounds.map(({ b }) => b.y + b.height));
    const target = (minY + maxY) / 2;
    bounds.forEach(({ el, b }) =>
      handleUpdateElement(
        el.id,
        translateElement(el, 0, target - (b.y + b.height / 2)),
      ),
    );
  }, [selectedElements, saveToUndoStack, handleUpdateElement]);

  const handleAlignBottom = useCallback(() => {
    if (selectedElements.length < 2) return;
    saveToUndoStack();
    const bounds = selectedElements
      .map((el) => ({ el, b: getBoundingBox(el) }))
      .filter((x) => x.b) as Array<{
      el: BoardElement;
      b: BoundingBox;
    }>;
    if (bounds.length < 2) return;
    const target = Math.max(...bounds.map(({ b }) => b.y + b.height));
    bounds.forEach(({ el, b }) =>
      handleUpdateElement(
        el.id,
        translateElement(el, 0, target - (b.y + b.height)),
      ),
    );
  }, [selectedElements, saveToUndoStack, handleUpdateElement]);

  const handleCopySelected = useCallback(() => {
    if (selectedElements.length === 0) return;
    saveToUndoStack();

    const selectionGroupId = selectedElements[0]?.groupId;
    const isSelectionSingleGroup =
      !!selectionGroupId &&
      selectedElements.every((el) => el.groupId === selectionGroupId);
    const newGroupId = isSelectionSingleGroup ? uuid() : undefined;
    const offset = 12;

    const copies = selectedElements
      .filter((el) => el.type !== "laser")
      .map((el) => {
        const next: BoardElement = {
          ...el,
          id: uuid(),
          groupId: newGroupId,
        };

        if (el.type === "pen" || el.type === "line" || el.type === "arrow") {
          next.points = el.points.map((p) => ({
            x: p.x + offset,
            y: p.y + offset,
          }));
        } else {
          next.x = (el.x ?? 0) + offset;
          next.y = (el.y ?? 0) + offset;
        }

        return next;
      });

    if (copies.length === 0) return;

    if (collaboration) {
      copies.forEach((el) => collaboration.addElement(el));
    } else {
      setElements([...elements, ...copies]);
    }
  }, [selectedElements, saveToUndoStack, collaboration, elements]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedElements.length === 0) return;
    saveToUndoStack();

    const ids = new Set(selectedElements.map((el) => el.id));
    if (collaboration) {
      selectedElements.forEach((el) => collaboration.deleteElement(el.id));
    } else {
      setElements(elements.filter((el) => !ids.has(el.id)));
    }
  }, [selectedElements, saveToUndoStack, collaboration, elements]);

  const handleDeleteMultiple = useCallback(
    (idsToDelete: string[]) => {
      if (isReadOnly) return;
      if (idsToDelete.length === 0) return;
      saveToUndoStack();

      const ids = new Set(idsToDelete);
      if (collaboration) {
        idsToDelete.forEach((id) => collaboration.deleteElement(id));
      } else {
        setElements(elements.filter((el) => !ids.has(el.id)));
      }
    },
    [collaboration, elements, saveToUndoStack, isReadOnly],
  );

  const canEditArrow =
    selectedElements.length === 1 &&
    (selectedElements[0].type === "line" ||
      selectedElements[0].type === "arrow") &&
    (selectedElements[0].points?.length ?? 0) >= 3;

  useEffect(() => {
    if (!canEditArrow) setIsEditArrowMode(false);
  }, [canEditArrow]);

  useEffect(() => {
    if (tool !== "select") setIsEditArrowMode(false);
  }, [tool]);

  const handleToggleEditArrowMode = useCallback(() => {
    if (!canEditArrow) return;
    setIsEditArrowMode((v) => !v);
  }, [canEditArrow]);

  const handleToggleGroupSelection = useCallback(() => {
    if (selectedElements.length === 0) return;
    saveToUndoStack();

    const selectionGroupId = selectedElements[0]?.groupId;
    const isSelectionSingleGroup =
      !!selectionGroupId &&
      selectedElements.every((el) => el.groupId === selectionGroupId);

    if (isSelectionSingleGroup && selectionGroupId) {
      elements
        .filter((el) => el.groupId === selectionGroupId)
        .forEach((el) => handleUpdateElement(el.id, { groupId: undefined }));
      return;
    }

    if (selectedElements.length < 2) return;

    const newGroupId = uuid();
    selectedElements.forEach((el) =>
      handleUpdateElement(el.id, { groupId: newGroupId }),
    );
  }, [selectedElements, elements, saveToUndoStack, handleUpdateElement]);

  const handleSelectElementFromLayers = useCallback(
    (id: string, addToSelection: boolean) => {
      const element = elements.find((el) => el.id === id);
      if (!element) return;

      if (addToSelection) {
        const isAlreadySelected = selectedElements.some((el) => el.id === id);
        if (isAlreadySelected) {
          setSelectedElements(selectedElements.filter((el) => el.id !== id));
        } else {
          setSelectedElements([...selectedElements, element]);
        }
      } else {
        setSelectedElements([element]);
      }
    },
    [elements, selectedElements],
  );

  const handleReorderElement = useCallback(
    (id: string, direction: "up" | "down") => {
      const element = elements.find((el) => el.id === id);
      if (!element) return;

      saveToUndoStack();

      // Sort elements by zIndex to get the proper order
      const sortedElements = [...elements].sort((a, b) => {
        const zIndexA = a.zIndex ?? 0;
        const zIndexB = b.zIndex ?? 0;
        return zIndexA - zIndexB;
      });

      const currentIndex = sortedElements.findIndex((el) => el.id === id);
      if (currentIndex === -1) return;

      // Get the element to swap with
      const swapIndex =
        direction === "up" ? currentIndex + 1 : currentIndex - 1;
      if (swapIndex < 0 || swapIndex >= sortedElements.length) return;

      const currentElement = sortedElements[currentIndex];
      const swapElement = sortedElements[swapIndex];

      const currentZIndex = currentElement.zIndex ?? 0;
      const swapZIndex = swapElement.zIndex ?? 0;

      // Swap the zIndex values
      handleUpdateElement(currentElement.id, { zIndex: swapZIndex });
      handleUpdateElement(swapElement.id, { zIndex: currentZIndex });
    },
    [elements, saveToUndoStack, handleUpdateElement],
  );

  // Sync sidebar properties with selected elements
  useEffect(() => {
    if (selectedElements.length > 0) {
      // Use the first selected element's properties to populate the sidebar
      const firstElement = selectedElements[0];
      setStrokeColor(firstElement.strokeColor);
      setStrokeWidth(firstElement.strokeWidth);
      if (firstElement.fillColor !== undefined) {
        setFillColor(firstElement.fillColor);
      }
      if (firstElement.opacity !== undefined) {
        setOpacity(firstElement.opacity);
      }
      if (firstElement.strokeStyle !== undefined) {
        setStrokeStyle(firstElement.strokeStyle);
      }
      if (firstElement.lineCap !== undefined) {
        setLineCap(firstElement.lineCap);
      }
      if (firstElement.connectorStyle !== undefined) {
        setConnectorStyle(firstElement.connectorStyle);
      }
      if (firstElement.arrowStart !== undefined) {
        setArrowStart(firstElement.arrowStart);
      }
      if (firstElement.arrowEnd !== undefined) {
        setArrowEnd(firstElement.arrowEnd);
      }
      const cornerRadiusElements = selectedElements.filter(
        (el) => el.type === "rectangle" || el.type === "frame",
      );
      if (cornerRadiusElements.length > 0) {
        setCornerRadius(cornerRadiusElements[0].cornerRadius ?? 0);
      }
      if (firstElement.fontFamily !== undefined) {
        setFontFamily(firstElement.fontFamily);
      }
      if (firstElement.textAlign !== undefined) {
        setTextAlign(firstElement.textAlign);
      }
      if (firstElement.fontSize !== undefined) {
        setFontSize(firstElement.fontSize);
      }
      if (firstElement.letterSpacing !== undefined) {
        setLetterSpacing(firstElement.letterSpacing);
      }
      if (firstElement.lineHeight !== undefined) {
        setLineHeight(firstElement.lineHeight);
      }
      if (firstElement.fillPattern !== undefined) {
        setFillPattern(firstElement.fillPattern);
      }
    }
  }, [selectedElements]);

  // Continuously track followed user's viewport
  useEffect(() => {
    if (!followedUserId || !setViewportRef.current) return;

    const followedUser = collaboratorUsers.find((u) => u.id === followedUserId);
    if (followedUser && followedUser.viewport) {
      setViewportRef.current(
        followedUser.viewport.pan,
        followedUser.viewport.zoom,
      );
    }
  }, [followedUserId, collaboratorUsers]);

  // Broadcast who we're following to other users
  useEffect(() => {
    if (collaboration) {
      collaboration.updateFollowingUser(followedUserId);
    }
  }, [collaboration, followedUserId]);

  // Broadcast selected elements to other users
  const selectedIdsKey = useMemo(() => {
    if (selectedElements.length === 0) return "";
    return selectedElements
      .map((el) => el.id)
      .slice()
      .sort()
      .join("|");
  }, [selectedElements]);
  const lastSentSelectedIdsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!collaboration) return;
    if (lastSentSelectedIdsKeyRef.current === selectedIdsKey) return;

    lastSentSelectedIdsKeyRef.current = selectedIdsKey;
    const selectedIds = selectedIdsKey ? selectedIdsKey.split("|") : [];
    collaboration.updateSelectedElements(selectedIds);
  }, [collaboration, selectedIdsKey]);

  // Hide the logo bar in smaller windows (match ToolSidebar condensed thresholds).
  useEffect(() => {
    const update = () => {
      setHideLogoBar(window.innerHeight < 920 || window.innerWidth < 1100);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Show loading while connecting
  if (!isReady) {
    return (
      <div className="flex items-center justify-center w-screen h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Connecting to board...</p>
        </div>
      </div>
    );
  }

  const followedUser = followedUserId
    ? collaboratorUsers.find((u) => u.id === followedUserId)
    : null;

  return (
    <div className="relative w-screen h-screen overflow-hidden flex">
      {/* Main Content Area */}
      <div className="relative flex-1 overflow-hidden">
        {/* Burger Menu and Title Bar - Top Left */}
        <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
          <BurgerMenu
            onClear={handleClear}
            onSave={handleSave}
            onOpen={handleOpen}
            onExportImage={handleExportImage}
            onFindOnCanvas={handleFindOnCanvas}
            onHelp={() => setShowHotkeysDialog(true)}
            onInvite={() => setShowInviteDialog(true)}
            canvasBackground={canvasBackground}
            onCanvasBackgroundChange={setCanvasBackground}
            handDrawnMode={handDrawnMode}
            onHandDrawnModeChange={setHandDrawnMode}
            isReadOnly={isReadOnly}
          />
          {!hideLogoBar && <CanvasTitleBar boardId={boardId} />}
          {false && !hideLogoBar && (
            <a
              href="/dashboard"
              className="h-10 bg-card/95 backdrop-blur-md border border-border rounded-md px-2 shadow-2xl hover:bg-muted/60 transition-colors inline-flex items-center justify-center leading-none"
            >
              <img
                src={
                  (resolvedTheme || theme) === "light"
                    ? "/kladde-logo.svg"
                    : "/kladde-logo-bright-540.svg"
                }
                alt="Kladde"
                className="h-5 w-auto"
              />
            </a>
          )}
        </div>

        {/* Collaboration + Hotkeys - Top Right */}
        {!isReadOnly && (
          <div className="absolute top-4 right-4 z-50 flex items-stretch gap-2">
            <CollaborationBar
              peerCount={peerCount}
              connectionStatus={connectionStatus}
              myName={myName || "Connecting..."}
              collaboratorUsers={collaboratorUsers}
              onFollowUser={handleFollowUser}
              followedUserId={followedUserId}
              spectatedUserIds={spectatedUserIds}
              isBeingSpectated={
                myUserId ? spectatedUserIds.has(myUserId) : false
              }
              onInvite={() => setShowInviteDialog(true)}
            />
            <button
              onClick={() => setShowHotkeysDialog(true)}
              className="h-10 w-10 rounded-md transition-all duration-200 bg-card/95 backdrop-blur-md border border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground shadow-2xl flex items-center justify-center"
              aria-label="Keyboard shortcuts"
            >
              <span className="text-base font-semibold leading-none">?</span>
            </button>
            <button
              onClick={() => setShowLayersSidebar(!showLayersSidebar)}
              className="h-10 w-10 rounded-md transition-all duration-200 bg-card/95 backdrop-blur-md border border-border hover:bg-muted/60 text-muted-foreground hover:text-foreground shadow-2xl flex items-center justify-center"
              aria-label="Toggle layers sidebar"
            >
              <PanelRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <HotkeysDialog
          open={showHotkeysDialog}
          onOpenChange={setShowHotkeysDialog}
        />

        <InviteDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          roomId={roomId}
          currentName={myName || undefined}
          onNameChange={(newName) => {
            setMyName(newName);
            collaboration?.updateUserName(newName);
          }}
        />

        {/* Find Canvas */}
        <FindCanvas
          isOpen={showFindCanvas}
          onClose={() => setShowFindCanvas(false)}
          elements={elements}
          onFocusElement={handleFocusElement}
          onHighlightElements={handleHighlightElements}
        />

        {/* Colored frame when following a user */}
        {followedUser && (
          <div
            className="absolute inset-0 pointer-events-none z-[100]"
            style={{
              boxShadow: `inset 0 0 0 4px ${followedUser.color}`,
            }}
          >
            <div
              className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-card/95 backdrop-blur-md border-2 shadow-lg flex items-center gap-2 pointer-events-auto"
              style={{ borderColor: followedUser.color }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: followedUser.color }}
              />
              <span className="text-sm font-medium">
                Following {followedUser.name}
              </span>
              <button
                onClick={() => setFollowedUserId(null)}
                className="ml-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {!isReadOnly && (
          <Toolbar
            currentTool={tool}
            onToolChange={setTool}
            onTileTypeSelect={setSelectedTileType}
            selectedTileType={selectedTileType}
            toolLock={isToolLocked}
            onToggleToolLock={() => setIsToolLocked(!isToolLocked)}
            isCollabMode={!!sessionId}
          />
        )}

        {!isReadOnly && (
          <ToolSidebar
            selectedTool={tool}
            strokeColor={strokeColor}
            onStrokeColorChange={handleStrokeColorChange}
            strokeWidth={strokeWidth}
            onStrokeWidthChange={handleStrokeWidthChange}
            fillColor={fillColor}
            onFillColorChange={handleFillColorChange}
            opacity={opacity}
            onOpacityChange={handleOpacityChange}
            strokeStyle={strokeStyle}
            onStrokeStyleChange={handleStrokeStyleChange}
            lineCap={lineCap}
            onLineCapChange={handleLineCapChange}
            connectorStyle={connectorStyle}
            onConnectorStyleChange={handleConnectorStyleChange}
            arrowStart={arrowStart}
            onArrowStartChange={handleArrowStartChange}
            arrowEnd={arrowEnd}
            onArrowEndChange={handleArrowEndChange}
            cornerRadius={cornerRadius}
            onCornerRadiusChange={handleCornerRadiusChange}
            fontFamily={fontFamily}
            onFontFamilyChange={handleFontFamilyChange}
            textAlign={textAlign}
            onTextAlignChange={handleTextAlignChange}
            fontSize={fontSize}
            onFontSizeChange={handleFontSizeChange}
            letterSpacing={letterSpacing}
            onLetterSpacingChange={handleLetterSpacingChange}
            lineHeight={lineHeight}
            onLineHeightChange={handleLineHeightChange}
            fillPattern={fillPattern}
            onFillPatternChange={handleFillPatternChange}
            selectedElements={selectedElements}
            onBringToFront={handleBringToFront}
            onSendToBack={handleSendToBack}
            onMoveForward={handleMoveForward}
            onMoveBackward={handleMoveBackward}
            onAlignLeft={handleAlignLeft}
            onAlignCenterHorizontal={handleAlignCenterHorizontal}
            onAlignRight={handleAlignRight}
            onAlignTop={handleAlignTop}
            onAlignCenterVertical={handleAlignCenterVertical}
            onAlignBottom={handleAlignBottom}
            onCopySelected={handleCopySelected}
            onDeleteSelected={handleDeleteSelected}
            onToggleGroupSelection={handleToggleGroupSelection}
            isEditArrowMode={isEditArrowMode}
            onToggleEditArrowMode={handleToggleEditArrowMode}
          />
        )}

        <Canvas
          tool={effectiveTool}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          fillColor={fillColor}
          opacity={opacity}
          strokeStyle={strokeStyle}
          lineCap={lineCap}
          connectorStyle={connectorStyle}
          arrowStart={arrowStart}
          arrowEnd={arrowEnd}
          cornerRadius={cornerRadius}
          fontFamily={fontFamily}
          textAlign={textAlign}
          fontSize={fontSize}
          letterSpacing={letterSpacing}
          lineHeight={lineHeight}
          fillPattern={fillPattern}
          selectedTileType={selectedTileType}
          handDrawnMode={handDrawnMode}
          collaboration={collaboration}
          elements={elements}
          onAddElement={handleAddElement}
          onUpdateElement={handleUpdateElement}
          onBatchUpdateElements={handleBatchUpdateElements}
          onDeleteElement={handleDeleteElement}
          onDeleteMultiple={handleDeleteMultiple}
          onStartTransform={handleStartTransform}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onToolChange={isReadOnly ? undefined : setTool}
          onSetViewport={(setter) => {
            setViewportRef.current = setter;
          }}
          onManualViewportChange={() => setFollowedUserId(null)}
          onSelectionChange={setSelectedElements}
          onStrokeColorChange={handleStrokeColorChange}
          onFillColorChange={handleFillColorChange}
          canvasBackground={canvasBackground}
          highlightedElementIds={highlightedElementIds}
          currentHighlightId={currentHighlightId}
          isToolLocked={isToolLocked}
          isEditArrowMode={isEditArrowMode}
          remoteSelections={isReadOnly ? [] : remoteSelections}
          isReadOnly={isReadOnly}
          showRemoteCursors={!isReadOnly}
          showUndoRedo={!isReadOnly}
        />

        {/* Save File Dialog */}
        {showSaveDialog && (
          <div className="fixed inset-0 z-200 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card/95 backdrop-blur-md border border-border rounded-xl shadow-2xl p-6 w-96 max-w-[90vw]">
              <h2 className="text-lg font-semibold mb-4">Save Kladde File</h2>
              <div className="mb-4">
                <label
                  htmlFor="filename"
                  className="block text-sm font-medium mb-2 text-muted-foreground"
                >
                  File name
                </label>
                <input
                  id="filename"
                  type="text"
                  className="w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-accent"
                  value={saveFileName}
                  onChange={(e) => setSaveFileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleConfirmSave();
                    } else if (e.key === "Escape") {
                      setShowSaveDialog(false);
                    }
                  }}
                  autoFocus
                  placeholder="Enter file name"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {saveFileName && !saveFileName.endsWith(".kladde")}
                </p>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowSaveDialog(false)}
                  className="px-4 py-2 rounded-md bg-background hover:bg-muted transition-colors border border-border"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSave}
                  disabled={!saveFileName.trim()}
                  className="px-4 py-2 rounded-md bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Export Image Dialog */}
        <ExportImageModal
          isOpen={showExportDialog}
          onClose={() => setShowExportDialog(false)}
          elements={elements}
          canvasBackground={canvasBackground}
        />
      </div>

      {/* Layers Sidebar */}
      {showLayersSidebar && (
        <LayersSidebar
          elements={elements}
          selectedIds={new Set(selectedElements.map((el) => el.id))}
          onClose={() => setShowLayersSidebar(false)}
          onSelectElement={handleSelectElementFromLayers}
          onDeleteElement={handleDeleteElement}
          onReorderElement={handleReorderElement}
        />
      )}
    </div>
  );
}
