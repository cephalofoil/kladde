"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { v4 as uuid } from "uuid";
import { PanelRight, History } from "lucide-react";
import { Canvas } from "./canvas";
import { Toolbar } from "./toolbar";
import { ToolSidebar } from "./tool-sidebar";
import { LayersSidebar } from "./layers-sidebar";
import { HistorySidebar } from "./history-sidebar";

import { DocumentEditorPanel } from "./document-editor";
import { BurgerMenu } from "./burger-menu";
import { CanvasTitleBar } from "./canvas-title-bar";
import { ExportImageModal } from "./export-image-modal";
import { SaveModal } from "./save-modal";
import { FindCanvas } from "./find-canvas";
import { HotkeysDialog } from "./hotkeys-dialog";
import { InviteDialog } from "./invite-dialog";
import { CollaborationBar } from "./collaboration-bar";
import {
    getFontFaceLoadString,
    measureUnboundedTextSize,
    measureWrappedTextHeightPx,
} from "./canvas/text-utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
    LayerFolder,
    NoteStyle,
    FrameStyle,
} from "@/lib/board-types";
import { areEndpointsNear, isClosedShape } from "@/lib/board-types";
import {
    getKeyFromUrl,
    importKeyFromString,
    isEncryptionSupported,
} from "@/lib/encryption";
import {
    clearBoardFileHandle,
    isFileOpenPickerSupported,
    requestOpenFile,
} from "@/lib/filesystem-storage";
import { useBoardElements } from "@/hooks/use-board-elements";
import { useFilesystemAutoSave } from "@/hooks/use-filesystem-auto-save";
import { useBoardStore } from "@/store/board-store";
import { getBoundingBox, translateElement } from "./whiteboard/utils";
import type { BoundingBox } from "./whiteboard/utils";
import { HistoryManager } from "@/lib/history-manager";
import type { CollabPermission, HistoryEntry } from "@/lib/history-types";

interface WhiteboardProps {
    boardId: string;
}

const MAX_UNDO_STACK = 100;
const STALE_AWARENESS_MS = 30_000;

export function Whiteboard({ boardId }: WhiteboardProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    // Check for collaboration mode via ?collab=1 parameter
    const isCollabMode = searchParams?.get("collab") === "1";
    const permissionParam = searchParams?.get(
        "permission",
    ) as CollabPermission | null;
    const roomId = boardId; // Always use boardId as room identifier
    // Determine if this user is the owner (they have the board locally, not joining via collab link)
    const [isOwner, setIsOwner] = useState(() => {
        // If there's no collab param, user is owner (solo mode or owner starting collab)
        if (typeof window === "undefined") return true;
        return !isCollabMode;
    });
    const isReadOnly =
        searchParams?.get("readonly") === "1" ||
        searchParams?.get("readonly") === "true" ||
        permissionParam === "view";
    const { theme, resolvedTheme } = useTheme();
    const [tool, setTool] = useState<Tool>("select");
    const [isToolLocked, setIsToolLocked] = useState(false);
    const [selectedTileType, setSelectedTileType] = useState<TileType | null>(
        null,
    );
    const [selectedNoteStyle, setSelectedNoteStyle] =
        useState<NoteStyle>("classic");
    const [frameStyle, setFrameStyle] = useState<FrameStyle>("minimal");

    // Default color based on theme: black in light mode, white in dark mode
    const getDefaultStrokeColor = () => {
        const currentTheme = resolvedTheme || theme;
        return currentTheme === "light" ? "#000000" : "#ffffff";
    };

    const [strokeColor, setStrokeColor] = useState(getDefaultStrokeColor());
    const [strokeWidth, setStrokeWidth] = useState(4);
    const [fillColor, setFillColor] = useState("transparent");
    const [opacity, setOpacity] = useState(100);
    const [strokeStyle, setStrokeStyle] = useState<
        "solid" | "dashed" | "dotted"
    >("solid");
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
    const [fontSize, setFontSize] = useState(20);
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [lineHeight, setLineHeight] = useState(1.25);
    const [fillPattern, setFillPattern] =
        useState<NonNullable<BoardElement["fillPattern"]>>("none");

    // Store pre-highlighter values to restore when switching away
    const preHighlighterRef = useRef<{
        strokeColor: string;
        strokeWidth: number;
    } | null>(null);

    const handleToolChange = useCallback(
        (nextTool: Tool) => {
            setTool((prevTool) => {
                if (nextTool === "highlighter" && prevTool !== "highlighter") {
                    // Save current values before switching to highlighter
                    preHighlighterRef.current = {
                        strokeColor: strokeColor,
                        strokeWidth: strokeWidth,
                    };
                    setStrokeColor("#fde047");
                    setOpacity(60);
                    setStrokeWidth(8); // Default highlighter width
                } else if (
                    nextTool !== "highlighter" &&
                    prevTool === "highlighter"
                ) {
                    // Restore previous values when switching away from highlighter
                    if (preHighlighterRef.current) {
                        setStrokeColor(preHighlighterRef.current.strokeColor);
                        setStrokeWidth(preHighlighterRef.current.strokeWidth);
                        preHighlighterRef.current = null;
                    }
                    setOpacity(100);
                } else if (nextTool !== "highlighter") {
                    setOpacity(100);
                }
                return nextTool;
            });
        },
        [strokeColor, strokeWidth],
    );

    // Collaboration state
    const [collaboration, setCollaboration] =
        useState<CollaborationManager | null>(null);

    // Elements state - integrated with Zustand store and optional collaboration
    const { elements, setElements, lastChangeIsRemoteRef } = useBoardElements(
        boardId,
        collaboration,
        {
            isOwner,
        },
    );
    const board = useBoardStore((s) => s.boards.get(boardId));
    const boardName = board?.name;
    const collabInvitesEnabled = useBoardStore(
        (s) => s.settings?.collabInvitesEnabled ?? true,
    );
    const [peerCount, setPeerCount] = useState(0);

    // History manager for version control (only for owner)
    const historyManagerRef = useRef<HistoryManager | null>(null);
    const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);
    const [showHistorySidebar, setShowHistorySidebar] = useState(false);
    const [isHistoryPinned, setIsHistoryPinned] = useState(false);
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
    const [activeRemoteUserCount, setActiveRemoteUserCount] = useState(0);
    const [showOwnerDisconnectModal, setShowOwnerDisconnectModal] =
        useState(false);
    const [ownerSessionEnded, setOwnerSessionEnded] = useState(false);
    const ownerSessionEndedRef = useRef(false);
    const ownerDisconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const ownerRedirectTimerRef = useRef<NodeJS.Timeout | null>(null);
    const ownerGraceDeadlineRef = useRef<number | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [followedUserId, setFollowedUserId] = useState<string | null>(null);
    const [selectedElements, setSelectedElements] = useState<BoardElement[]>(
        [],
    );
    const [clipboardElements, setClipboardElements] = useState<BoardElement[]>(
        [],
    );
    const [layerSelectionIds, setLayerSelectionIds] = useState<string[] | null>(
        null,
    );
    const [lastSelectedLayerId, setLastSelectedLayerId] = useState<
        string | null
    >(null);
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
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [showExportDialog, setShowExportDialog] = useState(false);
    const [showFindCanvas, setShowFindCanvas] = useState(false);
    const [showHotkeysDialog, setShowHotkeysDialog] = useState(false);
    const [showInviteDialog, setShowInviteDialog] = useState(false);
    const [showLayersSidebar, setShowLayersSidebar] = useState(false);
    const [isLayersPinned, setIsLayersPinned] = useState(true);
    const [layerFolders, setLayerFolders] = useState<LayerFolder[]>([]);
    const [editingDocumentId, setEditingDocumentId] = useState<string | null>(
        null,
    );
    const [pendingName, setPendingName] = useState<string | null>(null);
    const [highlightedElementIds, setHighlightedElementIds] = useState<
        string[]
    >([]);
    const [currentHighlightId, setCurrentHighlightId] = useState<string | null>(
        null,
    );
    // State for previewing historical canvas state
    const [previewElements, setPreviewElements] = useState<
        BoardElement[] | null
    >(null);
    const previewingEntryIdRef = useRef<string | null>(null);
    const clearHistoryPreview = useCallback(() => {
        if (!previewingEntryIdRef.current) return;
        setPreviewElements(null);
        setHighlightedElementIds([]);
        previewingEntryIdRef.current = null;
    }, []);
    const effectiveTool = isReadOnly ? "hand" : tool;

    // Undo/Redo stacks - store snapshots
    const undoStackRef = useRef<BoardElement[][]>([]);
    const redoStackRef = useRef<BoardElement[][]>([]);
    const isUndoingRef = useRef(false);
    const elementsRef = useRef<BoardElement[]>(elements);

    useFilesystemAutoSave({
        boardId,
        elements,
        canvasBackground,
        isOwner,
        enabled: !isReadOnly,
    });

    // Ref to store the setViewport function from Canvas
    const setViewportRef = useRef<
        ((pan: { x: number; y: number }, zoom: number) => void) | null
    >(null);
    const initialViewportRef = useRef<{
        pan: { x: number; y: number };
        zoom: number;
    } | null>(null);
    const hasAppliedInitialViewportRef = useRef(false);

    // Keep elementsRef in sync with elements
    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    // Persist handDrawn mode to localStorage
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem(
                "kladde-handdrawn-mode",
                String(handDrawnMode),
            );
        }
    }, [handDrawnMode]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const stored = localStorage.getItem(`kladde-viewport-${boardId}`);
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as {
                    pan: { x: number; y: number };
                    zoom: number;
                };
                if (
                    typeof parsed?.pan?.x === "number" &&
                    typeof parsed?.pan?.y === "number" &&
                    typeof parsed?.zoom === "number"
                ) {
                    initialViewportRef.current = parsed;
                }
            } catch {
                initialViewportRef.current = null;
            }
        }
    }, [boardId]);

    // Update default stroke color when theme changes
    useEffect(() => {
        const currentTheme = resolvedTheme || theme;
        const defaultColor = currentTheme === "light" ? "#000000" : "#ffffff";
        const oldDefaultColor =
            currentTheme === "light" ? "#ffffff" : "#000000";

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

    useEffect(() => {
        if (!collabInvitesEnabled && showInviteDialog) {
            setShowInviteDialog(false);
        }
    }, [collabInvitesEnabled, showInviteDialog]);

    // Initialize history manager for owner
    useEffect(() => {
        if (!isOwner || !pendingName) return;

        const initHistory = async () => {
            const manager = new HistoryManager(
                boardId,
                myUserId || "owner",
                pendingName,
                true,
            );
            await manager.initialize();
            historyManagerRef.current = manager;
            // Initialize prevElementsRef to current elements to avoid logging existing elements as "added"
            prevElementsRef.current = elements;
            setHistoryEntries(manager.getEntries());
        };

        initHistory();

        return () => {
            if (historyManagerRef.current) {
                historyManagerRef.current.flush(elements);
            }
        };
    }, [isOwner, boardId, pendingName, myUserId]);

    // Initialize collaboration with the user's name and E2E encryption
    // Collaboration is always enabled - owner hosts, guests join
    useEffect(() => {
        // Solo mode only when explicitly not in collab mode and owner hasn't shared
        // For now, always enable collaboration so guests can join anytime
        if (!isCollabMode && !isOwner) {
            // Guest without collab param - shouldn't happen but handle it
            console.log("[Whiteboard] Guest without collab mode");
            setConnectionStatus("disconnected");
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

            // Determine permission based on URL param or owner status
            const permission: CollabPermission = isOwner
                ? "edit"
                : permissionParam || "edit";

            collab = new CollaborationManager(roomId, name, encryptionKey, {
                readOnly: isReadOnly,
                isOwner,
                permission,
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
                let ownerPresent = false;
                let activeRemoteCount = 0;
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

                const now = Date.now();
                states.forEach((state) => {
                    if (state.user) {
                        const lastActiveAt = state.user.lastActiveAt;
                        const hasRecentActivity =
                            typeof lastActiveAt === "number" &&
                            now - lastActiveAt <= STALE_AWARENESS_MS;
                        const isStale = !hasRecentActivity;
                        if (isStale) return;
                        if (state.user.isOwner) {
                            ownerPresent = true;
                        }
                        // Track who is being followed/spectated
                        if (state.user.followingUserId) {
                            spectated.add(state.user.followingUserId);
                        }
                        // Add to collaborator list (excluding self)
                        if (state.user.id !== myId) {
                            activeRemoteCount += 1;
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

                if (!isOwner && !ownerSessionEndedRef.current) {
                    if (ownerPresent) {
                        if (ownerGraceDeadlineRef.current) {
                            clearTimeout(ownerDisconnectTimerRef.current ?? 0);
                            ownerDisconnectTimerRef.current = null;
                            ownerGraceDeadlineRef.current = null;
                            setShowOwnerDisconnectModal(false);
                        }
                    } else if (!ownerGraceDeadlineRef.current) {
                        ownerGraceDeadlineRef.current = Date.now() + 60_000;
                        ownerDisconnectTimerRef.current = setTimeout(() => {
                            setOwnerSessionEnded(true);
                            ownerSessionEndedRef.current = true;
                            setShowOwnerDisconnectModal(true);
                            ownerGraceDeadlineRef.current = null;
                            ownerDisconnectTimerRef.current = null;
                            ownerRedirectTimerRef.current = setTimeout(() => {
                                ownerRedirectTimerRef.current = null;
                                router.push("/dashboard");
                            }, 3000);
                        }, 60_000);
                    }
                }

                // Only update state if data actually changed to prevent unnecessary re-renders
                setCollaboratorUsers((prev) => {
                    if (prev.length !== users.length) return users;
                    const changed = users.some((u, i) => {
                        const prevUser = prev[i];
                        if (
                            u.id !== prevUser?.id ||
                            u.name !== prevUser?.name ||
                            u.color !== prevUser?.color
                        ) {
                            return true;
                        }

                        const nextViewport = u.viewport;
                        const prevViewport = prevUser?.viewport;
                        if (!nextViewport && !prevViewport) return false;
                        if (!nextViewport || !prevViewport) return true;
                        return (
                            nextViewport.zoom !== prevViewport.zoom ||
                            nextViewport.pan.x !== prevViewport.pan.x ||
                            nextViewport.pan.y !== prevViewport.pan.y
                        );
                    });
                    return changed ? users : prev;
                });
                setSpectatedUserIds((prev) => {
                    if (prev.size !== spectated.size) return spectated;
                    for (const id of spectated) {
                        if (!prev.has(id)) return spectated;
                    }
                    return prev;
                });
                setRemoteSelections((prev) => {
                    if (prev.length !== selections.length) return selections;
                    const changed = selections.some(
                        (s, i) =>
                            s.userId !== prev[i]?.userId ||
                            s.elementIds.length !==
                                prev[i]?.elementIds.length ||
                            s.elementIds.some(
                                (id, j) => id !== prev[i]?.elementIds[j],
                            ),
                    );
                    return changed ? selections : prev;
                });
                setActiveRemoteUserCount(activeRemoteCount);
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
            if (ownerDisconnectTimerRef.current) {
                clearTimeout(ownerDisconnectTimerRef.current);
            }
            if (ownerRedirectTimerRef.current) {
                clearTimeout(ownerRedirectTimerRef.current);
            }
        };
    }, [
        isCollabMode,
        roomId,
        isReadOnly,
        pendingName,
        isOwner,
        permissionParam,
    ]);

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

    const handleAddElement = useCallback(
        (element: BoardElement) => {
            clearHistoryPreview();
            if (isReadOnly) return;
            saveToUndoStack();

            if (collaboration) {
                collaboration.addElement(element);
            } else {
                setElements([...elements, element]);
            }
        },
        [
            clearHistoryPreview,
            collaboration,
            elements,
            saveToUndoStack,
            isReadOnly,
        ],
    );

    const handleUpdateElement = useCallback(
        (id: string, updates: Partial<BoardElement>) => {
            clearHistoryPreview();
            if (isReadOnly) return;
            const currentElement = elementsRef.current.find(
                (el) => el.id === id,
            );
            const nextUpdates =
                currentElement?.type === "frame"
                    ? { ...updates, strokeWidth: 2 }
                    : updates;
            if (collaboration) {
                collaboration.updateElement(id, nextUpdates);
            } else {
                setElements(
                    elements.map((el) =>
                        el.id === id ? { ...el, ...nextUpdates } : el,
                    ),
                );
            }
        },
        [clearHistoryPreview, collaboration, elements, isReadOnly],
    );

    const handleBatchUpdateElements = useCallback(
        (updates: Array<{ id: string; updates: Partial<BoardElement> }>) => {
            clearHistoryPreview();
            if (isReadOnly) return;
            if (updates.length === 0) return;

            if (collaboration) {
                updates.forEach(({ id, updates: elementUpdates }) => {
                    const currentElement = elementsRef.current.find(
                        (el) => el.id === id,
                    );
                    const nextUpdates =
                        currentElement?.type === "frame"
                            ? { ...elementUpdates, strokeWidth: 2 }
                            : elementUpdates;
                    collaboration.updateElement(id, nextUpdates);
                });
            } else {
                const updatesMap = new Map(
                    updates.map(({ id, updates: u }) => {
                        const currentElement = elementsRef.current.find(
                            (el) => el.id === id,
                        );
                        const nextUpdates =
                            currentElement?.type === "frame"
                                ? { ...u, strokeWidth: 2 }
                                : u;
                        return [id, nextUpdates];
                    }),
                );
                setElements(
                    elements.map((el) =>
                        updatesMap.has(el.id)
                            ? { ...el, ...updatesMap.get(el.id) }
                            : el,
                    ),
                );
            }
        },
        [clearHistoryPreview, collaboration, elements, isReadOnly],
    );

    const handleStartTransformForUndo = useCallback(() => {
        saveToUndoStack();
    }, [saveToUndoStack]);

    const handleDeleteElement = useCallback(
        (id: string) => {
            clearHistoryPreview();
            if (isReadOnly) return;
            saveToUndoStack();

            if (collaboration) {
                collaboration.deleteElement(id);
            } else {
                setElements(elements.filter((el) => el.id !== id));
            }
        },
        [
            clearHistoryPreview,
            collaboration,
            elements,
            saveToUndoStack,
            isReadOnly,
        ],
    );

    const handleDeleteElements = useCallback(
        (ids: string[]) => {
            clearHistoryPreview();
            if (isReadOnly || ids.length === 0) return;
            saveToUndoStack();

            if (collaboration) {
                ids.forEach((id) => collaboration.deleteElement(id));
            } else {
                const idSet = new Set(ids);
                setElements(elements.filter((el) => !idSet.has(el.id)));
            }
        },
        [
            clearHistoryPreview,
            collaboration,
            elements,
            saveToUndoStack,
            isReadOnly,
        ],
    );

    const handleDeleteSelectedFromLayers = useCallback(() => {
        if (selectedElements.length === 0) return;
        const ids = selectedElements.map((el) => el.id);
        handleDeleteElements(ids);
        setSelectedElements([]);
        setLayerSelectionIds(null);
        setLastSelectedLayerId(null);
    }, [selectedElements, handleDeleteElements]);

    const handleClear = useCallback(() => {
        clearHistoryPreview();
        if (isReadOnly) return;
        saveToUndoStack();

        if (collaboration) {
            collaboration.clearAll();
        } else {
            setElements([]);
        }
    }, [clearHistoryPreview, collaboration, saveToUndoStack, isReadOnly]);

    const handleSave = useCallback(() => {
        if (isReadOnly) return;
        setShowSaveModal(true);
    }, [isReadOnly]);

    const handleOpen = useCallback(async () => {
        if (isReadOnly) return;

        const loadFromContent = async (content: string) => {
            try {
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

                await clearBoardFileHandle(boardId);
            } catch (error) {
                console.error("Error loading file:", error);
                alert(
                    "Failed to load file. Please ensure it is a valid .kladde file.",
                );
            }
        };

        if (isFileOpenPickerSupported()) {
            try {
                const fileHandle = await requestOpenFile();
                if (!fileHandle) return;
                const file = await fileHandle.getFile();
                const content = await file.text();
                await loadFromContent(content);
            } catch (error) {
                console.error("Error loading file:", error);
                alert(
                    "Failed to load file. Please ensure it is a valid .kladde file.",
                );
            }
            return;
        }

        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".kladde,.shadeworks,application/json";

        input.onchange = (e: Event) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result as string;
                void loadFromContent(content);
            };

            reader.readAsText(file);
        };

        input.click();
    }, [
        isReadOnly,
        saveToUndoStack,
        collaboration,
        setElements,
        setCanvasBackground,
        boardId,
    ]);

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

    // Restore board to a specific history entry
    const handleRestoreHistory = useCallback(
        (entryId: string) => {
            if (!historyManagerRef.current || !isOwner) return;

            const restoredElements =
                historyManagerRef.current.restoreToEntry(entryId);
            if (restoredElements) {
                clearHistoryPreview();
                saveToUndoStack();
                if (collaboration) {
                    collaboration.setElements(restoredElements);
                } else {
                    setElements(restoredElements);
                }
            }
        },
        [
            clearHistoryPreview,
            isOwner,
            collaboration,
            setElements,
            saveToUndoStack,
        ],
    );

    // Preview a historical snapshot by temporarily showing that canvas state
    const handlePreviewSnapshot = useCallback(
        (entryId: string | null, highlightIds?: string[]) => {
            if (!entryId || !historyManagerRef.current) {
                // Clear preview - restore normal view
                clearHistoryPreview();
                return;
            }

            const entry = historyManagerRef.current.getEntry(entryId);
            if (entry) {
                // Show the canvas state after this change was made
                setPreviewElements(entry.afterSnapshot);
                setHighlightedElementIds(
                    highlightIds && highlightIds.length > 0
                        ? highlightIds
                        : entry.elementIds,
                );
                previewingEntryIdRef.current = entryId;
            }
        },
        [clearHistoryPreview],
    );

    // Track transform state for deferring history logging during drag/resize/rotate
    const isTransformingRef = useRef(false);
    const transformStartElementsRef = useRef<BoardElement[]>([]);
    const prevElementsRef = useRef<BoardElement[]>([]);

    // Called when drag/resize/rotate starts
    const handleStartTransform = useCallback(() => {
        clearHistoryPreview();
        handleStartTransformForUndo();
        isTransformingRef.current = true;
        transformStartElementsRef.current = [...elements];
    }, [clearHistoryPreview, elements, handleStartTransformForUndo]);

    // Called when drag/resize/rotate ends - log the changes
    const handleEndTransform = useCallback(() => {
        if (
            !isTransformingRef.current ||
            !historyManagerRef.current ||
            !isOwner
        ) {
            isTransformingRef.current = false;
            return;
        }

        const beforeElements = transformStartElementsRef.current;
        const afterElements = elements;

        // Find updated elements
        const updatedIds = afterElements
            .filter((e) => {
                const prev = beforeElements.find((p) => p.id === e.id);
                return prev && JSON.stringify(prev) !== JSON.stringify(e);
            })
            .map((e) => e.id);

        if (updatedIds.length > 0) {
            historyManagerRef.current
                .logUpdate(updatedIds, beforeElements, afterElements)
                .then(() => {
                    if (historyManagerRef.current) {
                        setHistoryEntries(
                            historyManagerRef.current.getEntries(),
                        );
                    }
                });
        }

        isTransformingRef.current = false;
        transformStartElementsRef.current = [];
        prevElementsRef.current = afterElements;
    }, [elements, isOwner]);

    // Log history entries when elements change (for owner only)
    // Skip logging during transform - will be logged on transform end
    useEffect(() => {
        if (!isOwner || !historyManagerRef.current) return;

        // Skip if we're in the middle of a transform (drag/resize/rotate)
        if (isTransformingRef.current) {
            return;
        }

        const prevElements = prevElementsRef.current;
        const prevIds = new Set(prevElements.map((e) => e.id));
        const currentIds = new Set(elements.map((e) => e.id));
        const changeUser = lastChangeIsRemoteRef.current
            ? { id: "collaborator", name: "Collaborator", isOwner: false }
            : undefined;

        // Find added elements
        const addedIds = elements
            .filter((e) => !prevIds.has(e.id))
            .map((e) => e.id);
        // Find deleted elements
        const deletedIds = prevElements
            .filter((e) => !currentIds.has(e.id))
            .map((e) => e.id);
        // Find updated elements (only non-position changes when not transforming)
        const updatedIds = elements
            .filter((e) => prevIds.has(e.id))
            .filter((e) => {
                const prev = prevElements.find((p) => p.id === e.id);
                return prev && JSON.stringify(prev) !== JSON.stringify(e);
            })
            .map((e) => e.id);

        // Update prevElementsRef before async operations
        prevElementsRef.current = elements;
        lastChangeIsRemoteRef.current = false;

        // Log operations asynchronously
        (async () => {
            if (addedIds.length > 0) {
                await historyManagerRef.current!.logAdd(
                    addedIds,
                    prevElements,
                    elements,
                    changeUser,
                );
            }
            if (deletedIds.length > 0) {
                await historyManagerRef.current!.logDelete(
                    deletedIds,
                    prevElements,
                    elements,
                    changeUser,
                );
            }
            if (updatedIds.length > 0) {
                await historyManagerRef.current!.logUpdate(
                    updatedIds,
                    prevElements,
                    elements,
                    changeUser,
                );
            }

            // Update entries state after all logging completes
            if (
                addedIds.length > 0 ||
                deletedIds.length > 0 ||
                updatedIds.length > 0
            ) {
                if (historyManagerRef.current) {
                    setHistoryEntries([
                        ...historyManagerRef.current.getEntries(),
                    ]);
                }
            }
        })();
    }, [elements, isOwner]);

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
                    if (el.type === "pen" && el.penMode === "highlighter") {
                        handleUpdateElement(el.id, {
                            strokeColor: color,
                            fillColor: color,
                            fillPattern: "solid",
                        });
                        return;
                    }
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
            const shouldShowFill =
                color !== "none" && color !== "transparent" && color.length > 0;
            const defaultFillPattern = handDrawnMode ? "hachure" : "solid";
            const nextFillPattern =
                shouldShowFill && fillPattern === "none"
                    ? defaultFillPattern
                    : fillPattern;
            if (selectedElements.length > 0) {
                saveToUndoStack();
                selectedElements.forEach((el) => {
                    if (
                        el.type === "rectangle" ||
                        el.type === "diamond" ||
                        el.type === "ellipse" ||
                        el.type === "frame" ||
                        (el.type === "pen" &&
                            el.penMode !== "highlighter" &&
                            el.isClosed &&
                            el.fillPattern !== "none")
                    ) {
                        handleUpdateElement(el.id, {
                            fillColor: color,
                            ...(shouldShowFill && el.type !== "frame"
                                ? {
                                      fillPattern:
                                          el.fillPattern === undefined ||
                                          el.fillPattern === "none"
                                              ? defaultFillPattern
                                              : el.fillPattern,
                                  }
                                : {}),
                        });
                    }
                });
            }
            setFillColor(color);
            if (nextFillPattern !== fillPattern) {
                setFillPattern(nextFillPattern);
            }
        },
        [
            selectedElements,
            saveToUndoStack,
            handleUpdateElement,
            fillPattern,
            handDrawnMode,
        ],
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

    const getUpdatedTextDimensions = (
        element: BoardElement,
        overrides: {
            fontFamily?: string;
            fontSize?: number;
            letterSpacing?: number;
            lineHeight?: number;
            textAlign?: "left" | "center" | "right";
        },
    ) => {
        const text = element.text ?? "";
        const resolvedFontFamily =
            overrides.fontFamily ?? element.fontFamily ?? fontFamily;
        const fontSize =
            overrides.fontSize ??
            element.fontSize ??
            element.strokeWidth * 4 + 12;
        const resolvedLetterSpacing =
            overrides.letterSpacing ?? element.letterSpacing ?? letterSpacing;
        const resolvedLineHeight =
            overrides.lineHeight ?? element.lineHeight ?? lineHeight;
        const resolvedTextAlign =
            overrides.textAlign ?? element.textAlign ?? textAlign;
        const isTextBox = element.isTextBox === true;
        const textBoxPadding = isTextBox ? 8 : 0;
        const minHeight = fontSize * resolvedLineHeight + textBoxPadding;

        const unboundedSize = measureUnboundedTextSize({
            text,
            fontSize,
            fontFamily: resolvedFontFamily,
            letterSpacing: resolvedLetterSpacing,
            lineHeight: resolvedLineHeight,
        });

        if (isTextBox) {
            const width = Math.max(
                element.width ?? 200,
                unboundedSize.width + Math.ceil(fontSize * 0.1),
            );
            const height = Math.max(
                minHeight,
                measureWrappedTextHeightPx({
                    text,
                    width: width - textBoxPadding,
                    fontSize,
                    lineHeight: resolvedLineHeight,
                    fontFamily: resolvedFontFamily,
                    letterSpacing: resolvedLetterSpacing,
                    textAlign: resolvedTextAlign,
                }) + textBoxPadding,
            );
            return { width, height };
        }

        const width = Math.max(
            unboundedSize.width + Math.ceil(fontSize * 0.1),
            2,
        );
        const height = Math.max(unboundedSize.height, minHeight);
        return { width, height };
    };

    const handleFontFamilyChange = useCallback(
        (font: string) => {
            if (selectedElements.length > 0) {
                saveToUndoStack();
                selectedElements.forEach((el) => {
                    if (el.type === "text") {
                        const dimensions = getUpdatedTextDimensions(el, {
                            fontFamily: font,
                        });
                        // For textBox, only expand width; for auto-width text, use exact measured width
                        const isTextBox = el.isTextBox === true;
                        const nextWidth = isTextBox
                            ? Math.max(el.width ?? 0, dimensions.width)
                            : dimensions.width;
                        const nextHeight = isTextBox
                            ? Math.max(el.height ?? 0, dimensions.height)
                            : dimensions.height;
                        handleUpdateElement(el.id, {
                            fontFamily: font,
                            width: nextWidth,
                            height: nextHeight,
                        });
                    }
                });
                if (typeof document !== "undefined" && document.fonts?.load) {
                    const loaders = selectedElements
                        .filter((el) => el.type === "text")
                        .map((el) => {
                            const fontSize =
                                el.fontSize ?? el.strokeWidth * 4 + 12;
                            const sampleText = el.text ?? "W";
                            const fontLoadString = getFontFaceLoadString(
                                fontSize,
                                font,
                            );
                            return document.fonts.load(
                                fontLoadString,
                                sampleText,
                            );
                        });
                    Promise.all(loaders)
                        .then(() => {
                            selectedElements.forEach((el) => {
                                if (el.type !== "text") return;
                                const dimensions = getUpdatedTextDimensions(
                                    el,
                                    {
                                        fontFamily: font,
                                    },
                                );
                                handleUpdateElement(el.id, {
                                    width: dimensions.width,
                                    height: dimensions.height,
                                });
                            });
                        })
                        .catch(() => {});
                }
            }
            setFontFamily(font);
        },
        [
            selectedElements,
            saveToUndoStack,
            handleUpdateElement,
            getUpdatedTextDimensions,
        ],
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
                        const dimensions = getUpdatedTextDimensions(el, {
                            fontSize: size,
                        });
                        handleUpdateElement(el.id, {
                            fontSize: size,
                            width: dimensions.width,
                            height: dimensions.height,
                        });
                    }
                });
            }
            setFontSize(size);
        },
        [
            selectedElements,
            saveToUndoStack,
            handleUpdateElement,
            getUpdatedTextDimensions,
        ],
    );

    const handleLetterSpacingChange = useCallback(
        (spacing: number) => {
            if (selectedElements.length > 0) {
                saveToUndoStack();
                selectedElements.forEach((el) => {
                    if (el.type === "text") {
                        const dimensions = getUpdatedTextDimensions(el, {
                            letterSpacing: spacing,
                        });
                        handleUpdateElement(el.id, {
                            letterSpacing: spacing,
                            width: dimensions.width,
                            height: dimensions.height,
                        });
                    }
                });
            }
            setLetterSpacing(spacing);
        },
        [
            selectedElements,
            saveToUndoStack,
            handleUpdateElement,
            getUpdatedTextDimensions,
        ],
    );

    const handleLineHeightChange = useCallback(
        (height: number) => {
            if (selectedElements.length > 0) {
                saveToUndoStack();
                selectedElements.forEach((el) => {
                    if (el.type === "text") {
                        const dimensions = getUpdatedTextDimensions(el, {
                            lineHeight: height,
                        });
                        handleUpdateElement(el.id, {
                            lineHeight: height,
                            width: dimensions.width,
                            height: dimensions.height,
                        });
                    }
                });
            }
            setLineHeight(height);
        },
        [
            selectedElements,
            saveToUndoStack,
            handleUpdateElement,
            getUpdatedTextDimensions,
        ],
    );

    const handleFillPatternChange = useCallback(
        (pattern: NonNullable<BoardElement["fillPattern"]>) => {
            if (selectedElements.length > 0) {
                saveToUndoStack();
                selectedElements.forEach((el) => {
                    if (
                        el.type === "rectangle" ||
                        el.type === "diamond" ||
                        el.type === "ellipse"
                    ) {
                        handleUpdateElement(el.id, { fillPattern: pattern });
                        return;
                    }
                    if (el.type === "pen" && el.penMode !== "highlighter") {
                        // Check if the stroke is closed (in case it wasn't detected before)
                        const isClosed =
                            el.isClosed ?? isClosedShape(el.points);
                        const endpointsInArea = areEndpointsNear(el.points);
                        if (isClosed && endpointsInArea) {
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

    const handleFrameStyleChange = useCallback(
        (style: FrameStyle) => {
            const frameSelection = selectedElements.filter(
                (el) => el.type === "frame",
            );
            if (frameSelection.length > 0) {
                saveToUndoStack();
                frameSelection.forEach((el) => {
                    handleUpdateElement(el.id, { frameStyle: style });
                });
            }
            setFrameStyle(style);
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

    // Copy elements to internal clipboard (Ctrl+C)
    const handleCopyToClipboard = useCallback(() => {
        if (selectedElements.length === 0) return;
        // Store a deep copy of selected elements
        setClipboardElements(
            selectedElements
                .filter((el) => el.type !== "laser")
                .map((el) => ({ ...el })),
        );
    }, [selectedElements, handDrawnMode]);

    // Paste elements from internal clipboard (Ctrl+V)
    const handlePaste = useCallback(() => {
        if (clipboardElements.length === 0) return;
        saveToUndoStack();

        const selectionGroupId = clipboardElements[0]?.groupId;
        const isSelectionSingleGroup =
            !!selectionGroupId &&
            clipboardElements.every((el) => el.groupId === selectionGroupId);
        const newGroupId = isSelectionSingleGroup ? uuid() : undefined;

        // Calculate combined bounding box of clipboard elements
        let minX = Infinity,
            maxX = -Infinity;
        clipboardElements.forEach((el) => {
            const box = getBoundingBox(el);
            if (box) {
                minX = Math.min(minX, box.x);
                maxX = Math.max(maxX, box.x + box.width);
            }
        });
        // Fallback if no valid bounding boxes found
        const selectionWidth = isFinite(maxX - minX) ? maxX - minX : 100;
        const horizontalOffset = selectionWidth + 20; // Place beside with 20px gap

        const copies = clipboardElements.map((el) => {
            const next: BoardElement = {
                ...el,
                id: uuid(),
                groupId: newGroupId,
            };

            if (
                el.type === "pen" ||
                el.type === "line" ||
                el.type === "arrow"
            ) {
                next.points = el.points.map((p) => ({
                    x: p.x + horizontalOffset,
                    y: p.y,
                }));
            } else {
                next.x = (el.x ?? 0) + horizontalOffset;
                next.y = el.y ?? 0;
            }

            return next;
        });

        if (copies.length === 0) return;

        // Update clipboard to the new positions so next paste goes beside these
        setClipboardElements(copies.map((el) => ({ ...el })));

        if (collaboration) {
            copies.forEach((el) => collaboration.addElement(el));
        } else {
            setElements([...elements, ...copies]);
        }
        setSelectedElements(copies);
        setLayerSelectionIds(copies.map((el) => el.id));
        if (copies.length > 0) {
            setLastSelectedLayerId(copies[0].id);
        }
    }, [
        clipboardElements,
        saveToUndoStack,
        collaboration,
        elements,
        setSelectedElements,
        setLayerSelectionIds,
        setLastSelectedLayerId,
    ]);

    // Duplicate selected elements (Ctrl+D)
    const handleCopySelected = useCallback(() => {
        if (selectedElements.length === 0) return;
        saveToUndoStack();

        const selectionGroupId = selectedElements[0]?.groupId;
        const isSelectionSingleGroup =
            !!selectionGroupId &&
            selectedElements.every((el) => el.groupId === selectionGroupId);
        const newGroupId = isSelectionSingleGroup ? uuid() : undefined;

        // Calculate combined bounding box of all selected elements
        let minX = Infinity,
            maxX = -Infinity;
        selectedElements.forEach((el) => {
            const box = getBoundingBox(el);
            if (box) {
                minX = Math.min(minX, box.x);
                maxX = Math.max(maxX, box.x + box.width);
            }
        });
        // Fallback if no valid bounding boxes found
        const selectionWidth = isFinite(maxX - minX) ? maxX - minX : 100;
        const horizontalOffset = selectionWidth + 20; // Place beside with 20px gap

        const copies = selectedElements
            .filter((el) => el.type !== "laser")
            .map((el) => {
                const next: BoardElement = {
                    ...el,
                    id: uuid(),
                    groupId: newGroupId,
                };

                if (
                    el.type === "pen" ||
                    el.type === "line" ||
                    el.type === "arrow"
                ) {
                    next.points = el.points.map((p) => ({
                        x: p.x + horizontalOffset,
                        y: p.y,
                    }));
                } else {
                    next.x = (el.x ?? 0) + horizontalOffset;
                    next.y = el.y ?? 0;
                }

                return next;
            });

        if (copies.length === 0) return;

        if (collaboration) {
            copies.forEach((el) => collaboration.addElement(el));
        } else {
            setElements([...elements, ...copies]);
        }
        setSelectedElements(copies);
        setLayerSelectionIds(copies.map((el) => el.id));
        if (copies.length > 0) {
            setLastSelectedLayerId(copies[0].id);
        }
    }, [
        selectedElements,
        saveToUndoStack,
        collaboration,
        elements,
        setSelectedElements,
        setLayerSelectionIds,
        setLastSelectedLayerId,
    ]);

    // Handle keyboard shortcuts for undo/redo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isReadOnly) return;
            // Don't trigger if typing in input
            if (
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                (e.target instanceof HTMLElement && e.target.isContentEditable)
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
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
                if (selectedElements.length === 0) return;
                e.preventDefault();
                handleCopyToClipboard();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
                e.preventDefault();
                handlePaste();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
                if (selectedElements.length === 0) return;
                e.preventDefault();
                handleCopySelected();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        handleUndo,
        handleRedo,
        handleCopyToClipboard,
        handlePaste,
        handleCopySelected,
        isReadOnly,
        selectedElements,
    ]);

    const handleDeleteSelected = useCallback(() => {
        if (selectedElements.length === 0) return;
        saveToUndoStack();

        const ids = new Set(selectedElements.map((el) => el.id));
        if (collaboration) {
            selectedElements.forEach((el) =>
                collaboration.deleteElement(el.id),
            );
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
                .forEach((el) =>
                    handleUpdateElement(el.id, { groupId: undefined }),
                );
            return;
        }

        if (selectedElements.length < 2) return;

        const newGroupId = uuid();
        selectedElements.forEach((el) =>
            handleUpdateElement(el.id, { groupId: newGroupId }),
        );
    }, [selectedElements, elements, saveToUndoStack, handleUpdateElement]);

    const handleSelectElementFromLayers = useCallback(
        (id: string, addToSelection: boolean, shiftKey?: boolean) => {
            const element = elements.find((el) => el.id === id);
            if (!element) return;

            // Sort elements by zIndex (highest first, matching sidebar display order)
            const sortedElements = [...elements].sort((a, b) => {
                const zIndexA = a.zIndex ?? 0;
                const zIndexB = b.zIndex ?? 0;
                return zIndexB - zIndexA;
            });

            let nextSelection: BoardElement[];

            if (shiftKey && lastSelectedLayerId) {
                // Shift-click: select range between last selected and current
                const lastIndex = sortedElements.findIndex(
                    (el) => el.id === lastSelectedLayerId,
                );
                const currentIndex = sortedElements.findIndex(
                    (el) => el.id === id,
                );

                if (lastIndex !== -1 && currentIndex !== -1) {
                    const startIdx = Math.min(lastIndex, currentIndex);
                    const endIdx = Math.max(lastIndex, currentIndex);
                    const rangeElements = sortedElements.slice(
                        startIdx,
                        endIdx + 1,
                    );

                    // Filter out locked elements from range selection
                    const selectableElements = rangeElements.filter(
                        (el) => !el.locked,
                    );

                    // Merge with existing selection if ctrl/cmd is also held
                    if (addToSelection) {
                        const existingIds = new Set(
                            selectedElements.map((el) => el.id),
                        );
                        const newElements = selectableElements.filter(
                            (el) => !existingIds.has(el.id),
                        );
                        nextSelection = [...selectedElements, ...newElements];
                    } else {
                        nextSelection = selectableElements;
                    }
                } else {
                    // Fallback if last selected not found
                    nextSelection = [element];
                }
            } else if (addToSelection) {
                // Ctrl/Cmd-click: toggle single element
                const isAlreadySelected = selectedElements.some(
                    (el) => el.id === id,
                );
                if (isAlreadySelected) {
                    nextSelection = selectedElements.filter(
                        (el) => el.id !== id,
                    );
                } else {
                    nextSelection = [...selectedElements, element];
                }
            } else {
                // Normal click: select only this element
                nextSelection = [element];
            }

            setSelectedElements(nextSelection);
            setLayerSelectionIds(nextSelection.map((el) => el.id));

            // Update last selected for shift-click range selection
            // Only update anchor on non-shift clicks
            if (!shiftKey) {
                setLastSelectedLayerId(id);
            }
        },
        [elements, selectedElements, lastSelectedLayerId],
    );

    const handleSelectionChange = useCallback((selection: BoardElement[]) => {
        setSelectedElements(selection);
        setLayerSelectionIds(null);
    }, []);

    const handleSelectElementsByIds = useCallback(
        (ids: string[]) => {
            if (ids.length === 0) {
                setSelectedElements([]);
                setLayerSelectionIds(null);
                return;
            }

            const source = previewElements ?? elements;
            const idSet = new Set(ids);
            const selection = source.filter((el) => idSet.has(el.id));
            setSelectedElements(selection);
            setLayerSelectionIds(selection.map((el) => el.id));
        },
        [elements, previewElements],
    );

    const handleMoveToIndex = useCallback(
        (id: string, newIndex: number) => {
            const element = elements.find((el) => el.id === id);
            if (!element) return;

            // Sort elements by zIndex (highest first, matching sidebar display)
            // Index 0 = highest zIndex (top of list), last index = lowest zIndex (bottom)
            const sortedElements = [...elements].sort((a, b) => {
                const zIndexA = a.zIndex ?? 0;
                const zIndexB = b.zIndex ?? 0;
                return zIndexB - zIndexA;
            });

            const currentIndex = sortedElements.findIndex((el) => el.id === id);
            if (currentIndex === -1) return;
            if (currentIndex === newIndex) return; // No change needed

            saveToUndoStack();

            // Get elements excluding the one we're moving
            const otherElements = sortedElements.filter((el) => el.id !== id);

            // Clamp the target index for the filtered array
            const targetIndex = Math.max(
                0,
                Math.min(newIndex, otherElements.length),
            );

            let newZIndex: number;

            if (otherElements.length === 0) {
                // Only element, keep current zIndex
                return;
            } else if (targetIndex === 0) {
                // Moving to top - get zIndex higher than current top
                newZIndex = (otherElements[0].zIndex ?? 0) + 1;
            } else if (targetIndex >= otherElements.length) {
                // Moving to bottom - get zIndex lower than current bottom
                newZIndex =
                    (otherElements[otherElements.length - 1].zIndex ?? 0) - 1;
            } else {
                // Moving between two elements - calculate midpoint
                const aboveElement = otherElements[targetIndex - 1];
                const belowElement = otherElements[targetIndex];
                const aboveZ = aboveElement.zIndex ?? 0;
                const belowZ = belowElement.zIndex ?? 0;
                newZIndex = (aboveZ + belowZ) / 2;
            }

            handleUpdateElement(id, { zIndex: newZIndex });
        },
        [elements, saveToUndoStack, handleUpdateElement],
    );

    const handleReorderElement = useCallback(
        (id: string, direction: "up" | "down") => {
            // Sort elements by zIndex (highest first, matching sidebar display)
            const sortedElements = [...elements].sort((a, b) => {
                const zIndexA = a.zIndex ?? 0;
                const zIndexB = b.zIndex ?? 0;
                return zIndexB - zIndexA;
            });

            const currentIndex = sortedElements.findIndex((el) => el.id === id);
            if (currentIndex === -1) return;

            const targetIndex =
                direction === "up" ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex < 0 || targetIndex >= sortedElements.length) return;

            // Delegate to handleMoveToIndex
            handleMoveToIndex(id, targetIndex);
        },
        [elements, handleMoveToIndex],
    );

    const handleToggleVisibility = useCallback(
        (id: string) => {
            const element = elements.find((el) => el.id === id);
            if (!element) return;

            saveToUndoStack();
            handleUpdateElement(id, { hidden: !element.hidden });
        },
        [elements, saveToUndoStack, handleUpdateElement],
    );

    const handleToggleLock = useCallback(
        (id: string) => {
            const element = elements.find((el) => el.id === id);
            if (!element) return;

            saveToUndoStack();
            handleUpdateElement(id, { locked: !element.locked });

            // If locking an element that's selected, deselect it
            if (
                !element.locked &&
                selectedElements.some((el) => el.id === id)
            ) {
                setSelectedElements(
                    selectedElements.filter((el) => el.id !== id),
                );
            }
        },
        [elements, selectedElements, saveToUndoStack, handleUpdateElement],
    );

    const handleToggleLockSelected = useCallback(() => {
        if (selectedElements.length === 0) return;
        saveToUndoStack();

        // Check if any selected element is unlocked - if so, lock all; otherwise unlock all
        const anyUnlocked = selectedElements.some((el) => !el.locked);
        selectedElements.forEach((el) => {
            handleUpdateElement(el.id, { locked: anyUnlocked });
        });
    }, [selectedElements, saveToUndoStack, handleUpdateElement]);

    const handleDuplicateElement = useCallback(
        (id: string) => {
            const element = elements.find((el) => el.id === id);
            if (!element || element.type === "laser") return;

            saveToUndoStack();

            // Calculate horizontal offset based on element width
            const box = getBoundingBox(element);
            const elementWidth = box?.width ?? 100;
            const horizontalOffset = elementWidth + 20; // Place beside with 20px gap

            const newElement: BoardElement = {
                ...element,
                id: uuid(),
                groupId: undefined,
            };

            // Offset the duplicate horizontally (beside the original)
            if (
                element.type === "pen" ||
                element.type === "line" ||
                element.type === "arrow"
            ) {
                newElement.points = element.points.map((p) => ({
                    x: p.x + horizontalOffset,
                    y: p.y,
                }));
            } else {
                newElement.x = (element.x ?? 0) + horizontalOffset;
                newElement.y = element.y ?? 0;
            }

            // Give it a higher zIndex
            const maxZIndex = Math.max(
                ...elements.map((el) => el.zIndex ?? 0),
                0,
            );
            newElement.zIndex = maxZIndex + 1;

            if (collaboration) {
                collaboration.addElement(newElement);
            } else {
                setElements([...elements, newElement]);
            }
        },
        [elements, collaboration, saveToUndoStack],
    );

    // Folder handlers
    const handleCreateFolder = useCallback(() => {
        const newFolder: LayerFolder = {
            id: uuid(),
            name: `Folder ${layerFolders.length + 1}`,
            collapsed: false,
        };
        setLayerFolders([...layerFolders, newFolder]);
    }, [layerFolders]);

    const handleDeleteFolder = useCallback(
        (folderId: string) => {
            const idsInFolder = elements
                .filter((el) => el.folderId === folderId)
                .map((el) => el.id);
            if (idsInFolder.length > 0) {
                handleDeleteElements(idsInFolder);
                const idSet = new Set(idsInFolder);
                setSelectedElements(
                    selectedElements.filter((el) => !idSet.has(el.id)),
                );
                if (layerSelectionIds) {
                    const nextLayerSelectionIds = layerSelectionIds.filter(
                        (id) => !idSet.has(id),
                    );
                    setLayerSelectionIds(
                        nextLayerSelectionIds.length > 0
                            ? nextLayerSelectionIds
                            : null,
                    );
                }
                if (lastSelectedLayerId && idSet.has(lastSelectedLayerId)) {
                    setLastSelectedLayerId(null);
                }
            }
            // Remove the folder
            setLayerFolders(layerFolders.filter((f) => f.id !== folderId));
        },
        [
            elements,
            layerFolders,
            handleDeleteElements,
            selectedElements,
            layerSelectionIds,
            lastSelectedLayerId,
        ],
    );

    const handleRenameFolder = useCallback(
        (folderId: string, newName: string) => {
            setLayerFolders(
                layerFolders.map((f) =>
                    f.id === folderId ? { ...f, name: newName } : f,
                ),
            );
        },
        [layerFolders],
    );

    const handleToggleFolderCollapse = useCallback(
        (folderId: string) => {
            setLayerFolders(
                layerFolders.map((f) =>
                    f.id === folderId ? { ...f, collapsed: !f.collapsed } : f,
                ),
            );
        },
        [layerFolders],
    );

    const selectedFrameId =
        selectedElements.length === 1 && selectedElements[0].type === "frame"
            ? selectedElements[0].id
            : null;

    const handleMoveToFolder = useCallback(
        (elementId: string, folderId: string | null) => {
            saveToUndoStack();
            handleUpdateElement(elementId, {
                folderId: folderId ?? undefined,
            });
        },
        [saveToUndoStack, handleUpdateElement],
    );

    // Sync sidebar properties with selected elements
    useEffect(() => {
        if (selectedElements.length > 0) {
            // Use the first selected element's properties to populate the sidebar
            const firstElement = selectedElements[0];
            if (firstElement.type !== "frame") {
                setStrokeColor(firstElement.strokeColor);
            }
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
            } else if (
                firstElement.fillColor &&
                firstElement.fillColor !== "none" &&
                firstElement.fillColor !== "transparent"
            ) {
                setFillPattern(handDrawnMode ? "hachure" : "solid");
            }
        }
    }, [selectedElements]);

    // Continuously track followed user's viewport
    useEffect(() => {
        if (!followedUserId || !setViewportRef.current) return;

        const followedUser = collaboratorUsers.find(
            (u) => u.id === followedUserId,
        );
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

    // Show loading while connecting
    if (!isReady) {
        return (
            <div className="flex items-center justify-center w-screen h-screen bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin" />
                    <p className="text-muted-foreground">
                        Connecting to board...
                    </p>
                </div>
            </div>
        );
    }

    const followedUser = followedUserId
        ? collaboratorUsers.find((u) => u.id === followedUserId)
        : null;
    const canInvite = isOwner && collabInvitesEnabled && !isReadOnly;

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
                        onInvite={
                            canInvite
                                ? () => setShowInviteDialog(true)
                                : undefined
                        }
                        canvasBackground={canvasBackground}
                        onCanvasBackgroundChange={setCanvasBackground}
                        handDrawnMode={handDrawnMode}
                        onHandDrawnModeChange={setHandDrawnMode}
                        isReadOnly={isReadOnly}
                        isGuest={!isOwner}
                    />
                    <CanvasTitleBar boardId={boardId} isGuest={!isOwner} />
                    {false && (
                        <a
                            href="/dashboard"
                            className="h-10 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md px-2 shadow-2xl hover:bg-muted/60 transition-colors inline-flex items-center justify-center leading-none"
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
                            myName={myName || "Connecting..."}
                            collaboratorUsers={collaboratorUsers}
                            onFollowUser={handleFollowUser}
                            followedUserId={followedUserId}
                            spectatedUserIds={spectatedUserIds}
                            isBeingSpectated={
                                myUserId
                                    ? spectatedUserIds.has(myUserId)
                                    : false
                            }
                            onInvite={
                                canInvite
                                    ? () => setShowInviteDialog(true)
                                    : undefined
                            }
                        />
                        {/* Version History Button (owner only) */}
                        {isOwner && (
                            <button
                                onClick={() =>
                                    setShowHistorySidebar((prev) =>
                                        isHistoryPinned ? true : !prev,
                                    )
                                }
                                className="h-10 w-10 rounded-md transition-all duration-200 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground shadow-2xl flex items-center justify-center"
                                aria-label="Version history"
                                title="Version history"
                            >
                                <History className="w-4 h-4" />
                            </button>
                        )}
                        <button
                            onClick={() => setShowHotkeysDialog(true)}
                            className="h-10 w-10 rounded-md transition-all duration-200 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground shadow-2xl flex items-center justify-center"
                            aria-label="Keyboard shortcuts"
                        >
                            <span className="text-base font-semibold leading-none">
                                ?
                            </span>
                        </button>
                        <button
                            onClick={() =>
                                setShowLayersSidebar((prev) =>
                                    isLayersPinned ? true : !prev,
                                )
                            }
                            className="h-10 w-10 rounded-md transition-all duration-200 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground shadow-2xl flex items-center justify-center"
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
                    open={showInviteDialog && collabInvitesEnabled}
                    onOpenChange={setShowInviteDialog}
                    roomId={roomId}
                    currentName={myName || undefined}
                    onNameChange={(newName) => {
                        setMyName(newName);
                        collaboration?.updateUserName(newName);
                    }}
                    isOwner={isOwner}
                />

                {/* Find Canvas */}
                <FindCanvas
                    isOpen={showFindCanvas}
                    onClose={() => setShowFindCanvas(false)}
                    elements={elements}
                    onFocusElement={handleFocusElement}
                    onHighlightElements={handleHighlightElements}
                />

                {!isOwner && (
                    <Dialog
                        open={showOwnerDisconnectModal}
                        onOpenChange={() => {}}
                    >
                        <DialogContent className="max-w-md [&_[data-dialog-close]]:hidden">
                            <DialogHeader>
                                <DialogTitle>
                                    {ownerSessionEnded
                                        ? "Session ended"
                                        : "Owner disconnected"}
                                </DialogTitle>
                                <DialogDescription>
                                    {ownerSessionEnded
                                        ? "This session has ended. Returning you to your dashboard..."
                                        : "The owner left the board. We will wait up to one minute for them to reconnect."}
                                </DialogDescription>
                            </DialogHeader>
                            <div className="flex justify-end">
                                <Button
                                    variant="secondary"
                                    onClick={() => router.push("/dashboard")}
                                >
                                    Back to dashboard
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}

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
                        onToolChange={handleToolChange}
                        onTileTypeSelect={setSelectedTileType}
                        selectedTileType={selectedTileType}
                        selectedNoteStyle={selectedNoteStyle}
                        onNoteStyleChange={setSelectedNoteStyle}
                        toolLock={isToolLocked}
                        onToggleToolLock={() => setIsToolLocked(!isToolLocked)}
                        isCollabMode={isCollabMode}
                    />
                )}

                {!isReadOnly && (
                    <ToolSidebar
                        selectedTool={tool}
                        currentTool={tool}
                        strokeColor={strokeColor}
                        onStrokeColorChange={handleStrokeColorChange}
                        strokeWidth={strokeWidth}
                        onStrokeWidthChange={handleStrokeWidthChange}
                        fillColor={fillColor}
                        onFillColorChange={handleFillColorChange}
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
                        frameStyle={frameStyle}
                        onFrameStyleChange={handleFrameStyleChange}
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
                        onToggleLockSelected={handleToggleLockSelected}
                        isSelectionLocked={
                            selectedElements.length > 0 &&
                            selectedElements.every((el) => el.locked)
                        }
                        rightOffset={
                            showLayersSidebar && isLayersPinned ? 320 : 0
                        }
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
                    frameStyle={frameStyle}
                    selectedTileType={selectedTileType}
                    selectedNoteStyle={selectedNoteStyle}
                    handDrawnMode={handDrawnMode}
                    collaboration={collaboration}
                    elements={previewElements || elements}
                    viewerTheme={
                        (resolvedTheme || theme) as "dark" | "light" | undefined
                    }
                    onAddElement={handleAddElement}
                    onUpdateElement={handleUpdateElement}
                    onBatchUpdateElements={handleBatchUpdateElements}
                    onDeleteElement={handleDeleteElement}
                    onDeleteMultiple={handleDeleteMultiple}
                    onStartTransform={handleStartTransform}
                    onEndTransform={handleEndTransform}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    onToolChange={isReadOnly ? undefined : handleToolChange}
                    onSetViewport={(setter) => {
                        setViewportRef.current = setter;
                        if (
                            initialViewportRef.current &&
                            !hasAppliedInitialViewportRef.current
                        ) {
                            setter(
                                initialViewportRef.current.pan,
                                initialViewportRef.current.zoom,
                            );
                            hasAppliedInitialViewportRef.current = true;
                        }
                    }}
                    onViewportChange={(pan, zoom) => {
                        if (typeof window === "undefined") return;
                        localStorage.setItem(
                            `kladde-viewport-${boardId}`,
                            JSON.stringify({ pan, zoom }),
                        );
                    }}
                    onManualViewportChange={() => setFollowedUserId(null)}
                    onSelectionChange={handleSelectionChange}
                    selectedElementIds={layerSelectionIds ?? undefined}
                    onStrokeColorChange={handleStrokeColorChange}
                    onFillColorChange={handleFillColorChange}
                    canvasBackground={canvasBackground}
                    highlightedElementIds={highlightedElementIds}
                    currentHighlightId={currentHighlightId}
                    isToolLocked={isToolLocked}
                    isEditArrowMode={isEditArrowMode}
                    remoteSelections={isReadOnly ? [] : remoteSelections}
                    hasActiveRemoteUsers={activeRemoteUserCount > 0}
                    isReadOnly={isReadOnly}
                    showRemoteCursors={!isReadOnly}
                    showUndoRedo={!isReadOnly}
                    onOpenDocumentEditor={setEditingDocumentId}
                />

                {/* Save Modal */}
                <SaveModal
                    isOpen={showSaveModal}
                    onClose={() => setShowSaveModal(false)}
                    elements={elements}
                    canvasBackground={canvasBackground}
                    boardId={boardId}
                    boardName={boardName}
                />

                {/* Export Image Dialog */}
                <ExportImageModal
                    isOpen={showExportDialog}
                    onClose={() => setShowExportDialog(false)}
                    elements={elements}
                    canvasBackground={canvasBackground}
                    selectedFrameId={selectedFrameId}
                />
            </div>

            {/* Layers Sidebar */}
            {showLayersSidebar && (
                <LayersSidebar
                    elements={elements}
                    selectedIds={new Set(selectedElements.map((el) => el.id))}
                    folders={layerFolders}
                    isPinned={isLayersPinned}
                    onTogglePin={() => setIsLayersPinned((prev) => !prev)}
                    onClose={() => setShowLayersSidebar(false)}
                    onFocusElement={handleFocusElement}
                    onHighlightElements={handleHighlightElements}
                    onSelectElement={handleSelectElementFromLayers}
                    onDeleteElement={handleDeleteElement}
                    onDeleteSelected={handleDeleteSelectedFromLayers}
                    onReorderElement={handleReorderElement}
                    onMoveToIndex={handleMoveToIndex}
                    onToggleVisibility={handleToggleVisibility}
                    onToggleLock={handleToggleLock}
                    onDuplicateElement={handleDuplicateElement}
                    onCreateFolder={handleCreateFolder}
                    onDeleteFolder={handleDeleteFolder}
                    onRenameFolder={handleRenameFolder}
                    onToggleFolderCollapse={handleToggleFolderCollapse}
                    onMoveToFolder={handleMoveToFolder}
                />
            )}

            {/* History Sidebar (owner only) */}
            {isOwner && (
                <HistorySidebar
                    isOpen={showHistorySidebar}
                    onClose={() => {
                        setShowHistorySidebar(false);
                        handlePreviewSnapshot(null);
                    }}
                    entries={historyEntries}
                    selectedElementIds={selectedElements.map((el) => el.id)}
                    onRestore={handleRestoreHistory}
                    isPinned={isHistoryPinned}
                    onPreviewSnapshot={handlePreviewSnapshot}
                />
            )}

            {/* Document Editor Panel */}
            {editingDocumentId &&
                (() => {
                    const documentElement = elements.find(
                        (el) => el.id === editingDocumentId,
                    );
                    if (!documentElement) return null;
                    return (
                        <DocumentEditorPanel
                            documentElement={documentElement}
                            allElements={elements}
                            onClose={() => setEditingDocumentId(null)}
                            onUpdateDocument={(updates) =>
                                handleUpdateElement(editingDocumentId, updates)
                            }
                        />
                    );
                })()}
        </div>
    );
}
