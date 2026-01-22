"use client";

import {
    useEffect,
    useState,
    useCallback,
    useRef,
    useMemo,
    useLayoutEffect,
} from "react";
import type {
    Tool,
    BoardElement,
    TileType,
    NoteStyle,
    FrameStyle,
    BoardComment,
} from "@/lib/board-types";
import { CollaborationManager } from "@/lib/collaboration";
import { CollaboratorCursors } from "../collaborator-cursor";
import { EraserTrail } from "@/lib/eraser-trail";
import type { RemoteSelection, RemoteCursor } from "./types";
import { chooseRotateHandleSide } from "./geometry";
import {
    measureUnboundedTextSize,
    measureWrappedTextHeightPx,
} from "./text-utils";
import { getBoundingBox, getCombinedBounds } from "./shapes";
import { useCanvasState } from "./hooks/useCanvasState";
import { useCanvasHandlers } from "./handlers/useCanvasHandlers";
import { useCanvasRenderers } from "./renderers/useCanvasRenderers";
import { HtmlTileRenderer } from "./html-tile-renderer";
import {
    getCanvasBackgroundStyle,
    getCanvasCursorStyle,
} from "./utils/canvasStyle";
import { getEventTargetInfo } from "./utils/eventTargeting";
import { isInViewport } from "./utils/viewport";

import { getFrameMembershipUpdates } from "./utils/frameSections";
import {
    GripVertical,
    Undo2,
    Redo2,
    Minus,
    Plus,
    MessageCircle,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    Check,
    Trash2,
    X,
    SmilePlus,
    ArrowUpRight,
} from "lucide-react";
import { EmojiPicker } from "@/components/ui/emoji-picker";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Kbd } from "@/components/ui/kbd";
import { getModifierKey, isMac } from "@/lib/platform";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import Link from "next/link";

interface CanvasProps {
    tool: Tool;
    strokeColor: string;
    strokeWidth: number;
    fillColor?: string;
    opacity?: number;
    strokeStyle?: "solid" | "dashed" | "dotted";
    lineCap?: "butt" | "round";
    connectorStyle?: "sharp" | "curved" | "elbow";
    arrowStart?: NonNullable<BoardElement["arrowStart"]>;
    arrowEnd?: NonNullable<BoardElement["arrowEnd"]>;
    cornerRadius?: number;
    fontFamily?: string;
    textAlign?: "left" | "center" | "right";
    fontSize?: number;
    letterSpacing?: number;
    lineHeight?: number;
    fillPattern?: BoardElement["fillPattern"];
    frameStyle?: FrameStyle;
    selectedTileType?: TileType | null;
    selectedNoteStyle?: NoteStyle;
    handDrawnMode?: boolean;
    collaboration: CollaborationManager | null;
    elements: BoardElement[];
    comments?: BoardComment[];
    viewerTheme?: "dark" | "light";
    onAddElement: (element: BoardElement) => void;
    onUpdateElement: (id: string, updates: Partial<BoardElement>) => void;
    onBatchUpdateElements?: (
        updates: Array<{ id: string; updates: Partial<BoardElement> }>,
    ) => void;
    onDeleteElement: (id: string) => void;
    onDeleteMultiple?: (ids: string[]) => void;
    onStartTransform?: () => void;
    onEndTransform?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    canUndo?: boolean;
    canRedo?: boolean;
    onToolChange?: (tool: Tool) => void;
    onSetViewport?: (
        setter: (pan: { x: number; y: number }, zoom: number) => void,
    ) => void;
    onManualViewportChange?: () => void;
    onViewportChange?: (pan: { x: number; y: number }, zoom: number) => void;
    onSelectionChange?: (elements: BoardElement[]) => void;
    selectedElementIds?: string[];
    onStrokeColorChange?: (color: string) => void;
    onFillColorChange?: (color: string) => void;
    canvasBackground?: "none" | "dots" | "lines" | "grid";
    highlightedElementIds?: string[];
    currentHighlightId?: string | null;
    isToolLocked?: boolean;
    isEditArrowMode?: boolean;
    remoteSelections?: RemoteSelection[];
    hasActiveRemoteUsers?: boolean;
    isReadOnly?: boolean;
    showRemoteCursors?: boolean;
    showUndoRedo?: boolean;
    onOpenDocumentEditor?: (elementId: string) => void;
    onOpenMermaidEditor?: (elementId: string) => void;
    onPaste?: () => void;
    onCut?: () => void;
    onCopy?: () => void;
    onDuplicate?: () => void;
    onWrapInFrame?: () => void;
    onCopyStyles?: () => void;
    onPasteStyles?: () => void;
    onBringForward?: () => void;
    onSendBackward?: () => void;
    onBringToFront?: () => void;
    onSendToBack?: () => void;
    onFlipHorizontal?: () => void;
    onFlipVertical?: () => void;
    onAddLink?: () => void;
    onCopyLinkToObject?: () => void;
    onLockSelected?: () => void;
    onDeleteSelected?: () => void;
    hasStylesToPaste?: boolean;
    onAddComment?: (payload: {
        x: number;
        y: number;
        elementId?: string | null;
    }) => string | null;
    onAddCommentMessage?: (commentId: string, text: string) => void;
    onToggleCommentReaction?: (
        commentId: string,
        messageId: string,
        emoji: string,
    ) => void;
    onDeleteComment?: (commentId: string) => void;
    onToggleCommentResolved?: (commentId: string) => void;
    onSelectAllComments?: () => void;
    onSelectAllElements?: () => void;
    onSelectComment?: (commentId: string) => void;
    onFocusComment?: (comment: BoardComment) => void;
    onFocusCommentAt?: (point: { x: number; y: number }) => void;
    onCommentSeen?: (commentId: string) => void;
    showResolvedComments?: boolean;
    selectedCommentIds?: string[];
    currentUserId?: string | null;
    viewMode?: boolean;
    onToggleViewMode?: () => void;
    snapToObjects?: boolean;
    onToggleSnapToObjects?: () => void;
    onTextEditingChange?: (isEditing: boolean) => void;
}

export function Canvas({
    tool,
    strokeColor,
    strokeWidth,
    fillColor = "transparent",
    opacity = 100,
    strokeStyle = "solid",
    lineCap = "round",
    connectorStyle = "sharp",
    arrowStart = "arrow",
    arrowEnd = "arrow",
    cornerRadius = 0,
    fontFamily = "var(--font-inter)",
    textAlign = "left",
    fontSize = 20,
    letterSpacing = 0,
    lineHeight = 1.25,
    fillPattern = "none",
    frameStyle = "minimal",
    selectedTileType = null,
    selectedNoteStyle = "classic",
    handDrawnMode = false,
    collaboration,
    elements,
    comments = [],
    viewerTheme,
    onAddElement,
    onUpdateElement,
    onBatchUpdateElements,
    onDeleteElement,
    onDeleteMultiple,
    onStartTransform,
    onEndTransform,
    onUndo,
    onRedo,
    canUndo = false,
    canRedo = false,
    onToolChange,
    onSetViewport,
    onManualViewportChange,
    onViewportChange,
    onSelectionChange,
    selectedElementIds,
    onStrokeColorChange,
    onFillColorChange,
    canvasBackground = "none",
    highlightedElementIds = [],
    currentHighlightId = null,
    isToolLocked = false,
    isEditArrowMode = false,
    remoteSelections = [],
    hasActiveRemoteUsers = false,
    isReadOnly = false,
    showRemoteCursors = true,
    showUndoRedo = true,
    onOpenDocumentEditor,
    onOpenMermaidEditor,
    onPaste,
    onCut,
    onCopy,
    onDuplicate,
    onWrapInFrame,
    onCopyStyles,
    onPasteStyles,
    onBringForward,
    onSendBackward,
    onBringToFront,
    onSendToBack,
    onFlipHorizontal,
    onFlipVertical,
    onAddLink,
    onCopyLinkToObject,
    onLockSelected,
    onDeleteSelected,
    hasStylesToPaste,
    onAddComment,
    onAddCommentMessage,
    onToggleCommentReaction,
    onDeleteComment,
    onToggleCommentResolved,
    onSelectAllComments,
    onSelectAllElements,
    onSelectComment,
    onFocusComment,
    onFocusCommentAt,
    onCommentSeen,
    showResolvedComments = false,
    selectedCommentIds = [],
    currentUserId,
    viewMode = false,
    onToggleViewMode,
    snapToObjects = true,
    onToggleSnapToObjects,
    onTextEditingChange,
}: CanvasProps) {
    const TEXT_CLIP_BUFFER_PX = 2;
    const LASER_HOLD_DURATION_MS = 3000;
    const LASER_FADE_DURATION_MS = 800;
    const LASER_TTL_MS = LASER_HOLD_DURATION_MS + LASER_FADE_DURATION_MS + 250;
    const modKey = useMemo(() => getModifierKey(), []);
    const shiftKey = useMemo(() => (isMac() ? "⇧" : "Shift"), []);
    const altKey = useMemo(() => (isMac() ? "⌥" : "Alt"), []);
    const undoShortcut = useMemo(() => `${modKey}+Z`, [modKey]);
    const redoShortcut = useMemo(
        () => (isMac() ? `${modKey}+${shiftKey}+Z` : `${modKey}+Y`),
        [modKey, shiftKey],
    );

    // Tile editing state
    const [editingTileId, setEditingTileId] = useState<string | null>(null);
    const [containerSize, setContainerSize] = useState({
        width: 0,
        height: 0,
    });
    const [contextMenu, setContextMenu] = useState<{
        screenX: number;
        screenY: number;
        worldX: number;
        worldY: number;
        elementId: string | null;
    } | null>(null);
    const contextMenuRef = useRef<HTMLDivElement | null>(null);
    const contextMenuElement = useMemo(() => {
        if (!contextMenu?.elementId) return null;
        return elements.find((el) => el.id === contextMenu.elementId) ?? null;
    }, [contextMenu?.elementId, elements]);

    const [activeCommentId, setActiveCommentId] = useState<string | null>(null);
    const activeCommentIdRef = useRef<string | null>(null);
    const [pinnedCommentId, setPinnedCommentId] = useState<string | null>(null);
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>(
        {},
    );
    const [emojiPicker, setEmojiPicker] = useState<{
        commentId: string;
        messageId: string;
        x: number;
        y: number;
    } | null>(null);
    const emojiPickerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        activeCommentIdRef.current = activeCommentId;
    }, [activeCommentId]);

    useEffect(() => {
        if (!emojiPicker) return;
        const handlePointerDown = (event: MouseEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest?.('[data-emoji-trigger="true"]')) return;
            if (emojiPickerRef.current?.contains(target)) return;
            setEmojiPicker(null);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setEmojiPicker(null);
        };
        window.addEventListener("mousedown", handlePointerDown);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("mousedown", handlePointerDown);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [emojiPicker]);

    // Refs for edit states to avoid dependency array issues
    const editingTextElementIdRef = useRef<string | null>(null);
    const editingTileIdRef = useRef<string | null>(null);

    const state = useCanvasState({ elements, remoteSelections });
    const {
        drawing: { isDrawing, currentElement, startPoint },
        selection: {
            selectedIds,
            setSelectedIds,
            remoteCursors,
            setRemoteCursors,
            remoteDrawingElements,
            setRemoteDrawingElements,
            remotelyEditingTextIds,
        },
        transform: {
            isDragging,
            hasDragMoved,
            isResizing,
            isRotating,
            resizeHandle,
            originalElements,
            setOriginalElements,
            rotateHandleSide,
            setRotateHandleSide,
            draggingConnectorPoint,
            setDraggingConnectorPoint,
        },
        viewport: { pan, setPan, zoom, setZoom, isPanning },
        text: {
            textInput,
            setTextInput,
            textValue,
            setTextValue,
            editingTextElementId,
            setEditingTextElementId,
            editingTextStyle,
            setEditingTextStyle,
            editingShapeTextId,
            setEditingShapeTextId,
        },
        eraser: {
            eraserMarkedIds,
            setEraserMarkedIds,
            eraserCursorPos,
            setEraserCursorPos,
        },
        laser: { laserCursorPos, setLaserCursorPos },
        snapping: {
            snapTarget,
            setSnapTarget,
            alignmentGuides,
            distanceGuides,
        },
        ui: {
            hoverCursor,
            lastMousePos,
            isBoxSelecting,
            selectionBox,
            isLassoSelecting,
            lassoPoints,
            editingFrameLabelId,
            frameLabelValue,
            setEditingFrameLabelId,
            setFrameLabelValue,
            inputHint,
            setInputHint,
            setShiftPressed,
            arrowHandleHover,
            setArrowHandleHover,
        },
        refs: {
            nameTagWidthCacheRef,
            svgRef,
            containerRef,
            eraserTrailPathRef,
            eraserTrailRef,
            textInputRef,
            textEditorWrapperRef,
            lastEnforcedTextHeightsRef,
            lastSingleSelectedIdRef,
            expiredLaserIdsRef,
            elementsRef,
            cursorBroadcastRafRef,
            pendingDrawingElementRef,
            drawingElementBroadcastRafRef,
            arrowHandleHoverTimerRef,
        },
    } = state;
    const selectedIdsRef = useRef<string[]>([]);

    useEffect(() => {
        selectedIdsRef.current = selectedIds;
    }, [selectedIds]);

    useEffect(() => {
        onTextEditingChange?.(!!textInput);
    }, [onTextEditingChange, textInput]);

    useLayoutEffect(() => {
        if (!contextMenu || !contextMenuRef.current || !containerRef.current)
            return;
        const menuRect = contextMenuRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const padding = 8;
        const maxLeft = Math.max(
            padding,
            containerRect.width - menuRect.width - padding,
        );
        const maxTop = Math.max(
            padding,
            containerRect.height - menuRect.height - padding,
        );
        const clampedLeft = Math.min(
            Math.max(contextMenu.screenX, padding),
            maxLeft,
        );
        const clampedTop = Math.min(
            Math.max(contextMenu.screenY, padding),
            maxTop,
        );
        if (
            clampedLeft !== contextMenu.screenX ||
            clampedTop !== contextMenu.screenY
        ) {
            setContextMenu((prev) =>
                prev
                    ? {
                          ...prev,
                          screenX: clampedLeft,
                          screenY: clampedTop,
                      }
                    : prev,
            );
        }
    }, [contextMenu, containerRef]);

    useEffect(() => {
        if (!emojiPicker) return;
        const container = containerRef.current;
        if (!container) return;
        const handleWheel = (event: WheelEvent) => {
            const target = event.target as HTMLElement | null;
            if (emojiPickerRef.current?.contains(target)) {
                event.stopPropagation();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
        };
        container.addEventListener("wheel", handleWheel, {
            passive: false,
            capture: true,
        });
        return () => {
            container.removeEventListener("wheel", handleWheel, true);
        };
    }, [emojiPicker]);

    useEffect(() => {
        if (!selectedElementIds) return;
        const uniqueIds = Array.from(new Set(selectedElementIds));
        const current = selectedIdsRef.current;
        if (
            uniqueIds.length === current.length &&
            uniqueIds.every((id) => current.includes(id))
        ) {
            return;
        }
        setSelectedIds(uniqueIds);
    }, [selectedElementIds, setSelectedIds]);

    // Keep refs in sync with edit states
    useEffect(() => {
        editingTextElementIdRef.current = editingTextElementId;
        editingTileIdRef.current = editingTileId;
    }, [editingTextElementId, editingTileId]);

    // Stable reference for delete function to avoid useEffect dependency array size changes
    const handleDeleteSelectedRef = useRef<(ids: string[]) => void>(() => {});
    handleDeleteSelectedRef.current = (ids: string[]) => {
        if (onDeleteMultiple) {
            onDeleteMultiple(ids);
        } else {
            ids.forEach((id) => onDeleteElement(id));
        }
    };

    // Stable references for update functions to prevent infinite loops in useEffect
    // (these functions change on every elements change, which would re-trigger effects)
    const onUpdateElementRef = useRef(onUpdateElement);
    onUpdateElementRef.current = onUpdateElement;

    const onBatchUpdateElementsRef = useRef(onBatchUpdateElements);
    onBatchUpdateElementsRef.current = onBatchUpdateElements;

    // Track shift key and other shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isReadOnly) return;
            if (e.key === "Shift") setShiftPressed(true);

            // Handle Delete and Backspace keys for selected elements
            // Don't delete if user is typing in an input, textarea, or contentEditable element
            if (
                (e.key === "Delete" || e.key === "Backspace") &&
                selectedIds.length > 0
            ) {
                // Check if user is editing text or in an editable element
                const isEditingText =
                    e.target instanceof HTMLInputElement ||
                    e.target instanceof HTMLTextAreaElement ||
                    (e.target instanceof HTMLElement &&
                        e.target.isContentEditable);

                // Don't delete elements if editing text or if a tile/text element is being edited
                if (
                    !isEditingText &&
                    !editingTextElementIdRef.current &&
                    !editingTileIdRef.current
                ) {
                    e.preventDefault(); // Prevent browser back navigation on Backspace
                    handleDeleteSelectedRef.current(selectedIds);
                    setSelectedIds([]);
                }
            }

            if (e.key === "Escape") {
                setSelectedIds([]);
                setTextInput(null);
                setEditingTileId(null);
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === "Shift") setShiftPressed(false);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [selectedIds, isReadOnly]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const platform = navigator.platform || "";
        const userAgent = navigator.userAgent || "";
        const isMacLike =
            /Mac|iPhone|iPad|iPod/.test(platform) ||
            /Mac|iPhone|iPad|iPod/.test(userAgent);
        const hasTouch = navigator.maxTouchPoints > 0;
        setInputHint(isMacLike || hasTouch ? "trackpad" : "mouse");
    }, []);

    // Wheel zoom handler with native event listener to prevent browser zoom
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            // Prevent browser back/forward navigation on horizontal scroll
            if (Math.abs(e.deltaX) > 0) {
                e.preventDefault();
            }

            if (e.ctrlKey || e.metaKey) {
                // Zoom with Ctrl/Cmd + Scroll
                e.preventDefault();

                const rect = container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const delta = e.deltaY > 0 ? 0.9 : 1.1;

                setZoom((prevZoom) => {
                    const newZoom = Math.max(
                        0.1,
                        Math.min(5, prevZoom * delta),
                    );

                    // Calculate world position under cursor before zoom
                    const worldX = (mouseX - pan.x) / prevZoom;
                    const worldY = (mouseY - pan.y) / prevZoom;

                    // Adjust pan so the same world position stays under cursor
                    setPan({
                        x: mouseX - worldX * newZoom,
                        y: mouseY - worldY * newZoom,
                    });

                    return newZoom;
                });
                // User manually zoomed - stop following
                onManualViewportChange?.();
            } else if (
                !e.ctrlKey &&
                !e.metaKey &&
                (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) > 0)
            ) {
                // Two-finger trackpad pan (no modifier keys)
                e.preventDefault();
                setPan((prev) => ({
                    x: prev.x - e.deltaX,
                    y: prev.y - e.deltaY,
                }));
                // User manually panned - stop following
                onManualViewportChange?.();
            }
        };

        container.addEventListener("wheel", handleWheel, { passive: false });
        return () => container.removeEventListener("wheel", handleWheel);
    }, [pan]);

    // Initialize eraser trail
    useEffect(() => {
        if (eraserTrailPathRef.current && !eraserTrailRef.current) {
            // Detect theme - check if dark mode is active
            const isDark = document.documentElement.classList.contains("dark");
            eraserTrailRef.current = new EraserTrail(
                eraserTrailPathRef.current,
                isDark ? "dark" : "light",
            );
        }

        // Update theme when it changes
        const observer = new MutationObserver(() => {
            if (eraserTrailRef.current) {
                const isDark =
                    document.documentElement.classList.contains("dark");
                eraserTrailRef.current.setTheme(isDark ? "dark" : "light");
            }
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => {
            observer.disconnect();
            if (eraserTrailRef.current) {
                eraserTrailRef.current.clear();
            }
        };
    }, []);

    // Track remote cursors and drawing elements
    useEffect(() => {
        if (!collaboration) return;

        const unsubscribe = collaboration.onAwarenessChange((states) => {
            const myId = collaboration.getUserInfo().id;
            const now = Date.now();

            setRemoteCursors((prevCursors) => {
                const cursors: RemoteCursor[] = [];

                states.forEach((state) => {
                    // Ensure user has a valid id (non-empty string) before adding cursor
                    if (
                        state.user &&
                        state.user.id &&
                        state.user.id !== myId &&
                        state.user.cursor
                    ) {
                        // Check if cursor position changed
                        const prevCursor = prevCursors.find(
                            (c) => c.id === state.user.id,
                        );
                        const positionChanged =
                            !prevCursor ||
                            prevCursor.x !== state.user.cursor.x ||
                            prevCursor.y !== state.user.cursor.y;

                        cursors.push({
                            id: state.user.id,
                            name: state.user.name || "Guest",
                            color: state.user.color || "#888888",
                            x: state.user.cursor.x,
                            y: state.user.cursor.y,
                            lastActivity: positionChanged
                                ? now
                                : (prevCursor?.lastActivity ?? now),
                        });
                    }
                });

                return cursors;
            });

            // Track remote drawing elements (in-progress drawings from other users)
            // Handle async decryption of encrypted drawing elements
            const processDrawingElements = async () => {
                const drawingElements: Array<{
                    id: string;
                    color: string;
                    element: BoardElement;
                }> = [];

                for (const [, state] of states) {
                    if (
                        state.user &&
                        state.user.id !== myId &&
                        state.user.drawingElement
                    ) {
                        // Decrypt if necessary (handles both encrypted and plaintext)
                        const decrypted =
                            await collaboration.decryptDrawingElement(
                                state.user.drawingElement,
                            );
                        if (decrypted) {
                            drawingElements.push({
                                id: state.user.id,
                                color: state.user.color,
                                element: decrypted,
                            });
                        }
                    }
                }

                setRemoteDrawingElements(drawingElements);
            };

            void processDrawingElements();
        });

        return unsubscribe;
    }, [collaboration]);

    // Broadcast current drawing element to other users
    useEffect(() => {
        if (!collaboration) return;

        // Prefer sending a live text draft while editing; otherwise send in-progress drawings.
        if (textInput) {
            const activeFontSize = editingTextStyle?.fontSize ?? fontSize;
            const activeLineHeight = editingTextStyle?.lineHeight ?? lineHeight;
            const isTextBox = textInput.isTextBox ?? true;
            const textBoxPadding = isTextBox ? 8 : 0;
            const draft: BoardElement = {
                id:
                    editingTextElementId ??
                    `text-draft-${collaboration.getUserInfo().id}`,
                type: "text",
                points: [],
                text: textValue,
                x: textInput.x,
                y: textInput.y,
                width: textInput.width ?? 200,
                height:
                    textInput.height ??
                    activeFontSize * activeLineHeight + textBoxPadding,
                isTextBox,
                strokeColor: editingTextStyle?.strokeColor ?? strokeColor,
                strokeWidth: editingTextStyle?.strokeWidth ?? strokeWidth,
                opacity: editingTextStyle?.opacity ?? opacity,
                fontFamily: editingTextStyle?.fontFamily ?? fontFamily,
                textAlign: editingTextStyle?.textAlign ?? textAlign,
                fontSize: editingTextStyle?.fontSize ?? fontSize,
                letterSpacing: editingTextStyle?.letterSpacing ?? letterSpacing,
                lineHeight: editingTextStyle?.lineHeight ?? lineHeight,
                scaleX: 1,
                scaleY: 1,
            };
            pendingDrawingElementRef.current = draft;
            if (drawingElementBroadcastRafRef.current === null) {
                drawingElementBroadcastRafRef.current = requestAnimationFrame(
                    () => {
                        drawingElementBroadcastRafRef.current = null;
                        void collaboration.updateDrawingElement(
                            pendingDrawingElementRef.current,
                        );
                    },
                );
            }
            return;
        }

        void collaboration.updateDrawingElement(currentElement);
    }, [
        collaboration,
        currentElement,
        editingTextElementId,
        editingTextStyle,
        fontFamily,
        fontSize,
        letterSpacing,
        lineHeight,
        opacity,
        strokeColor,
        strokeWidth,
        textAlign,
        textInput,
        textValue,
    ]);

    // Broadcast viewport changes to other users
    useEffect(() => {
        if (!collaboration) return;
        collaboration.updateViewport(pan, zoom);
    }, [collaboration, pan, zoom]);

    useEffect(() => {
        onViewportChange?.(pan, zoom);
    }, [onViewportChange, pan, zoom]);

    // Periodically delete expired laser elements so they don't stick around if the creator disconnects mid-fade.
    useEffect(() => {
        const interval = window.setInterval(() => {
            const now = Date.now();
            elementsRef.current.forEach((el) => {
                if (el.type !== "laser") return;
                if (!el.timestamp) return;
                if (expiredLaserIdsRef.current.has(el.id)) return;
                if (now - el.timestamp < LASER_TTL_MS) return;

                expiredLaserIdsRef.current.add(el.id);
                onDeleteElement(el.id);
            });
        }, 2000);

        return () => window.clearInterval(interval);
    }, [LASER_TTL_MS, onDeleteElement]);

    useEffect(() => {
        elementsRef.current = elements;
    }, [elements]);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const updateSize = () => {
            setContainerSize({
                width: container.clientWidth,
                height: container.clientHeight,
            });
        };

        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(container);

        return () => observer.disconnect();
    }, [containerRef]);

    useEffect(() => {
        return () => {
            if (cursorBroadcastRafRef.current !== null) {
                cancelAnimationFrame(cursorBroadcastRafRef.current);
            }
            if (drawingElementBroadcastRafRef.current !== null) {
                cancelAnimationFrame(drawingElementBroadcastRafRef.current);
            }
        };
    }, []);

    // Clear eraser marked IDs when tool changes
    useEffect(() => {
        if (tool !== "eraser") {
            setEraserMarkedIds(new Set());
            setEraserCursorPos(null);
            // Clear eraser trail when switching away from eraser
            if (eraserTrailRef.current) {
                eraserTrailRef.current.clear();
            }
        }
        if (tool !== "laser") {
            setLaserCursorPos(null);
        }
    }, [tool]);

    // Expose viewport setter to parent component
    useEffect(() => {
        if (onSetViewport) {
            onSetViewport((newPan, newZoom) => {
                setPan(newPan);
                setZoom(newZoom);
            });
        }
    }, [onSetViewport]);

    // Get selected elements and their combined bounds
    const selectedElements = selectedIds
        .map((id) => elements.find((el) => el.id === id))
        .filter(Boolean) as BoardElement[];
    const selectedBounds = getCombinedBounds(selectedIds, elements);

    const viewportBounds = useMemo(
        () => ({
            x: -pan.x / zoom,
            y: -pan.y / zoom,
            width: containerSize.width / zoom,
            height: containerSize.height / zoom,
        }),
        [containerSize.height, containerSize.width, pan.x, pan.y, zoom],
    );

    const visibleElements = useMemo(() => {
        const margin = 200 / zoom;
        return elements.filter((el) => {
            // Hidden elements are never visible
            if (el.hidden) return false;
            if (selectedIds.includes(el.id)) return true;
            const bounds = getBoundingBox(el);
            if (!bounds) return true;
            return isInViewport(bounds, viewportBounds, margin);
        });
    }, [elements, selectedIds, viewportBounds, zoom]);

    // Decide which side gets the rotate handle at selection time (keeps stable while rotating).
    useEffect(() => {
        if (selectedIds.length === 1) {
            const id = selectedIds[0];
            if (lastSingleSelectedIdRef.current !== id) {
                lastSingleSelectedIdRef.current = id;
                const el = elements.find((e) => e.id === id);
                const rotationDeg = el?.rotation ?? 0;
                setRotateHandleSide(chooseRotateHandleSide(rotationDeg));
            }
            return;
        }

        lastSingleSelectedIdRef.current = null;
        setRotateHandleSide("n");
    }, [elements, selectedIds]);

    const handlers = useCanvasHandlers({
        state,
        tool,
        strokeColor,
        strokeWidth,
        fillColor,
        opacity,
        strokeStyle,
        lineCap,
        connectorStyle,
        arrowStart,
        arrowEnd,
        cornerRadius,
        fontFamily,
        textAlign,
        fontSize,
        letterSpacing,
        lineHeight,
        fillPattern,
        frameStyle,
        selectedTileType,
        selectedNoteStyle,
        handDrawnMode,
        collaboration,
        elements,
        selectedBounds,
        selectedElements,
        onAddElement,
        onUpdateElement,
        onBatchUpdateElements,
        onDeleteElement,
        onDeleteMultiple,
        onStartTransform,
        onEndTransform,
        onToolChange,
        onManualViewportChange,
        isToolLocked,
        isReadOnly,
        hasActiveRemoteUsers,
        snapToObjects,
    });

    const {
        getMousePosition,
        handleMouseMove,
        handleMouseDown,
        handleDoubleClick,
        handleMouseUp,
        handleMouseLeave,
        handleTextSubmit,
        handleTextChange,
    } = handlers;

    // While editing an existing text element, allow style changes (letter spacing, font, etc)
    // to apply immediately and persist on submit.
    useEffect(() => {
        if (!textInput) return;
        setEditingTextStyle((prev) => {
            if (!prev) return prev;
            return {
                ...prev,
                strokeColor,
                strokeWidth,
                opacity,
                fontFamily,
                textAlign,
                fontSize,
                letterSpacing,
                lineHeight,
            };
        });
    }, [
        fontFamily,
        fontSize,
        letterSpacing,
        lineHeight,
        opacity,
        strokeColor,
        strokeWidth,
        textAlign,
        textInput,
    ]);

    const textInputMetrics = useMemo(() => {
        if (!textInput) return null;
        const activeFontSize = editingTextStyle?.fontSize ?? fontSize;
        const activeLineHeight = editingTextStyle?.lineHeight ?? lineHeight;
        const activeFontFamily = editingTextStyle?.fontFamily ?? fontFamily;
        const activeLetterSpacing =
            editingTextStyle?.letterSpacing ?? letterSpacing;
        const minHeightPx = activeFontSize * activeLineHeight;
        const isTextBox = textInput.isTextBox ?? true;

        if (isTextBox) {
            return {
                width: textInput.width ?? 200,
                height: textInput.height ?? minHeightPx,
                isTextBox,
            };
        }

        return {
            width:
                textInput.width ??
                measureUnboundedTextSize({
                    text: textValue,
                    fontSize: activeFontSize,
                    fontFamily: activeFontFamily,
                    letterSpacing: activeLetterSpacing,
                    lineHeight: activeLineHeight,
                }).width,
            height:
                textInput.height ??
                measureUnboundedTextSize({
                    text: textValue,
                    fontSize: activeFontSize,
                    fontFamily: activeFontFamily,
                    letterSpacing: activeLetterSpacing,
                    lineHeight: activeLineHeight,
                }).height,
            isTextBox,
        };
    }, [
        editingTextStyle,
        fontFamily,
        fontSize,
        letterSpacing,
        lineHeight,
        textInput,
        textValue,
    ]);

    useEffect(() => {
        if (!textInput) return;
        if (tool === "text") return;
        if (editingTextStyle) return;
        if (textValue.trim()) {
            handleTextSubmit({ skipToolChange: true });
        } else {
            setTextInput(null);
            setTextValue("");
            setEditingTextElementId(null);
            setEditingShapeTextId(null);
            setEditingTextStyle(null);
        }
    }, [
        tool,
        textInput,
        textValue,
        editingTextStyle,
        handleTextSubmit,
        setTextInput,
        setTextValue,
        setEditingTextElementId,
        setEditingShapeTextId,
        setEditingTextStyle,
    ]);

    // Auto-resize textarea to fit content
    useEffect(() => {
        if (textInputRef.current && textInput) {
            const textarea = textInputRef.current;
            const activeFontSize = editingTextStyle?.fontSize ?? fontSize;
            const activeLineHeight = editingTextStyle?.lineHeight ?? lineHeight;
            const activeFontFamily = editingTextStyle?.fontFamily ?? fontFamily;
            const activeLetterSpacing =
                editingTextStyle?.letterSpacing ?? letterSpacing;
            const activeTextAlign = editingTextStyle?.textAlign ?? textAlign;
            const isTextBox = textInput.isTextBox ?? true;
            const minHeightPx = activeFontSize * activeLineHeight;

            let nextWidth = textInput.width ?? 200;
            let nextHeight = minHeightPx;

            if (isTextBox) {
                const textBoxPadding = 8; // 4px on each side
                const measuredContentHeight = measureWrappedTextHeightPx({
                    text: textValue, // Use textValue state instead of textarea.value for immediate updates
                    width: nextWidth - textBoxPadding, // Account for horizontal padding
                    fontSize: activeFontSize,
                    lineHeight: activeLineHeight,
                    fontFamily: activeFontFamily,
                    letterSpacing: activeLetterSpacing,
                    textAlign: activeTextAlign,
                });
                nextHeight = Math.max(
                    measuredContentHeight + textBoxPadding,
                    minHeightPx + textBoxPadding,
                );
            } else {
                const measured = measureUnboundedTextSize({
                    text: textValue,
                    fontSize: activeFontSize,
                    fontFamily: activeFontFamily,
                    letterSpacing: activeLetterSpacing,
                    lineHeight: activeLineHeight,
                });
                const scrollWidth =
                    Math.ceil(textarea.scrollWidth) || measured.width;
                const scrollHeight =
                    Math.ceil(textarea.scrollHeight) || measured.height;
                nextWidth = Math.max(measured.width, scrollWidth);
                nextHeight = Math.max(measured.height, scrollHeight);
                textarea.style.width = `${nextWidth}px`;
            }

            // Use exact measured height without buffer to avoid extra space below text
            textarea.style.height = `${nextHeight}px`;

            // Always update textInput size to match content (both growing and shrinking)
            // But skip height updates for shape text - we want to keep the shape's height for centering
            const currentHeight = textInput.height ?? 0;
            const currentWidth = textInput.width ?? 0;
            const sizeEpsilon = isTextBox ? 0.5 : 1.5;
            if (isTextBox && !editingShapeTextId) {
                if (Math.abs(currentHeight - nextHeight) > sizeEpsilon) {
                    setTextInput((prev) =>
                        prev
                            ? {
                                  ...prev,
                                  height: nextHeight,
                                  isTextBox,
                              }
                            : prev,
                    );
                }
            } else if (
                !editingShapeTextId &&
                (Math.abs(currentHeight - nextHeight) > sizeEpsilon ||
                    Math.abs(currentWidth - nextWidth) > sizeEpsilon)
            ) {
                setTextInput((prev) =>
                    prev
                        ? {
                              ...prev,
                              width: nextWidth,
                              height: nextHeight,
                              isTextBox,
                          }
                        : prev,
                );
            }

            // Update the actual element's text and size so the selection box and content stay in sync
            // Use ref to avoid re-triggering this effect when onUpdateElement changes
            // Add guard to skip no-op updates (prevents infinite loops and unnecessary collab syncs)
            if (editingTextElementId) {
                const el = elements.find((e) => e.id === editingTextElementId);
                const textChanged = el?.text !== textValue;
                const heightChanged =
                    Math.abs((el?.height ?? 0) - nextHeight) > sizeEpsilon;
                const widthChanged =
                    !isTextBox &&
                    Math.abs((el?.width ?? 0) - nextWidth) > sizeEpsilon;
                if (textChanged || heightChanged || widthChanged) {
                    onUpdateElementRef.current(editingTextElementId, {
                        text: textValue,
                        height: nextHeight,
                        width: isTextBox ? el?.width : nextWidth,
                    });
                }
            }
        }
    }, [
        editingTextStyle,
        elements,
        fontSize,
        lineHeight,
        textValue,
        textInput,
        editingTextElementId,
        fontFamily,
        letterSpacing,
        textAlign,
    ]);

    const {
        renderElement,
        renderRemoteSelections,
        renderSelectionBox,
        renderHighlights,
        renderSnapTargetHighlight,
    } = useCanvasRenderers({
        elements,
        selectedIds,
        selectedBounds,
        highlightedElementIds,
        currentHighlightId,
        remoteSelections,
        remotelyEditingTextIds,
        editingTextElementId,
        editingShapeTextId,
        eraserMarkedIds,
        snapTarget,
        zoom,
        connectorStyle,
        isEditArrowMode,
        draggingConnectorPoint,
        originalElements,
        lastMousePos,
        rotateHandleSide,
        isRotating,
        nameTagWidthCacheRef,
        handDrawnMode,
        viewerTheme,
        onStartTransform,
        onUpdateElement,
        onDeleteElement,
        onAddElement,
        setOriginalElements,
        setDraggingConnectorPoint,
        setSelectedIds,
        getMousePosition,
        strokeColor,
        strokeWidth,
        opacity,
        strokeStyle,
        arrowStart,
        arrowEnd,
        arrowHandleHover,
        setArrowHandleHover,
        arrowHandleHoverTimerRef,
    });

    const cursorStyle = getCanvasCursorStyle({
        tool,
        isDragging,
        isPanning,
        isRotating,
        isResizing,
        resizeHandle,
        selectedIds,
        elements,
        hoverCursor,
    });

    const backgroundStyle = getCanvasBackgroundStyle({
        canvasBackground,
        pan,
        zoom,
    });

    const lassoPath =
        lassoPoints.length > 1
            ? `M ${lassoPoints.map((p) => `${p.x} ${p.y}`).join(" L ")}`
            : null;

    useEffect(() => {
        if (!editingFrameLabelId) return;
        const labelEl = document.querySelector(
            `[data-frame-label-input="true"][data-element-id="${editingFrameLabelId}"]`,
        ) as HTMLElement | null;
        if (!labelEl) return;
        labelEl.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(labelEl);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
    }, [editingFrameLabelId]);

    const handleFrameLabelCommit = useCallback(
        (value?: string) => {
            if (!editingFrameLabelId) return;
            const nextLabel = (value ?? frameLabelValue).trim() || "Frame";
            onUpdateElement(editingFrameLabelId, { label: nextLabel });
            setEditingFrameLabelId(null);
        },
        [
            editingFrameLabelId,
            frameLabelValue,
            onUpdateElement,
            setEditingFrameLabelId,
        ],
    );

    // Update parent component when selection changes
    useEffect(() => {
        if (onSelectionChange) {
            const selected = elements.filter((el) =>
                selectedIds.includes(el.id),
            );
            onSelectionChange(selected);
        }
    }, [selectedIds, elements, onSelectionChange]);

    useEffect(() => {
        if (isReadOnly) return;
        if (isDragging || isResizing || isDrawing || isPanning) return;
        const updates = getFrameMembershipUpdates(elements);
        if (updates.length === 0) return;
        if (onBatchUpdateElementsRef.current) {
            onBatchUpdateElementsRef.current(updates);
        } else {
            updates.forEach(({ id, updates: elementUpdates }) => {
                onUpdateElementRef.current(id, elementUpdates);
            });
        }
    }, [elements, isDragging, isResizing, isDrawing, isPanning, isReadOnly]);

    // Ensure selected text boxes never clip their content (e.g. after style changes like letterSpacing).
    useEffect(() => {
        selectedIds.forEach((id) => {
            const el = elements.find((e) => e.id === id);
            if (!el || el.type !== "text" || !el.isTextBox) return;
            if (textInput && editingTextElementId === id) return;
            if (el.width == null || el.height == null) return;

            const fs = el.fontSize ?? el.strokeWidth * 4 + 12;
            const lh = el.lineHeight ?? 1.25;
            const ff = el.fontFamily || "var(--font-inter)";

            const textBoxPadding = el.isTextBox ? 8 : 0; // 4px on each side for text boxes
            const required = Math.max(
                fs * lh + textBoxPadding,
                measureWrappedTextHeightPx({
                    text: el.text || "",
                    width: el.width - textBoxPadding,
                    fontSize: fs,
                    lineHeight: lh,
                    fontFamily: ff,
                    letterSpacing: el.letterSpacing ?? 0,
                    textAlign: el.textAlign ?? "left",
                }) + textBoxPadding,
            );

            if (required <= el.height + 0.5) return;

            const last = lastEnforcedTextHeightsRef.current.get(id);
            if (last && Math.abs(last - required) <= 0.5) return;
            lastEnforcedTextHeightsRef.current.set(id, required);
            onUpdateElementRef.current(id, { height: required });
        });
    }, [editingTextElementId, elements, selectedIds, textInput]);

    const isTextBoxEditing = textInput?.isTextBox ?? true;

    const resolveCommentAnchor = useCallback(
        (comment: BoardComment) => {
            if (comment.elementId) {
                const element = elements.find(
                    (item) => item.id === comment.elementId,
                );
                const box = element ? getBoundingBox(element) : null;
                if (box) {
                    const offsetX =
                        comment.offset?.x ?? Math.max(0, box.width / 2);
                    const offsetY =
                        comment.offset?.y ?? Math.max(0, box.height / 2);
                    return { x: box.x + offsetX, y: box.y + offsetY };
                }
            }
            return { x: comment.x, y: comment.y };
        },
        [elements],
    );

    const openContextMenu = useCallback(
        (event: React.MouseEvent) => {
            if (!containerRef.current) return;
            const { target, isInteractive } = getEventTargetInfo(event);
            if (isInteractive) return;
            event.preventDefault();
            const rect = containerRef.current.getBoundingClientRect();
            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;
            const worldX = (screenX - pan.x) / zoom;
            const worldY = (screenY - pan.y) / zoom;
            const elementId =
                target
                    ?.closest?.("[data-element-id]")
                    ?.getAttribute("data-element-id") ?? null;
            if (elementId && !selectedIdsRef.current.includes(elementId)) {
                setSelectedIds([elementId]);
            }
            setContextMenu({
                screenX,
                screenY,
                worldX,
                worldY,
                elementId,
            });
        },
        [pan.x, pan.y, zoom],
    );

    const handleCopy = useCallback(
        async (format: "png" | "svg" | "text") => {
            if (!containerRef.current || !svgRef.current) return;

            const rect = containerRef.current.getBoundingClientRect();
            const width = Math.max(1, Math.floor(rect.width));
            const height = Math.max(1, Math.floor(rect.height));
            const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
            clone.setAttribute("width", `${width}`);
            clone.setAttribute("height", `${height}`);
            clone.setAttribute("viewBox", `0 0 ${width} ${height}`);
            clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
            const svgString = new XMLSerializer().serializeToString(clone);

            if (format === "text") {
                try {
                    const targetElements = contextMenu?.elementId
                        ? elements.filter(
                              (el) => el.id === contextMenu.elementId,
                          )
                        : selectedElementIds && selectedElementIds.length > 0
                          ? elements.filter((el) =>
                                selectedElementIds.includes(el.id),
                            )
                          : elements;
                    await navigator.clipboard.writeText(
                        JSON.stringify(targetElements, null, 2),
                    );
                } catch (error) {
                    console.warn("Failed to copy text to clipboard:", error);
                }
                return;
            }

            if (format === "svg") {
                try {
                    const blob = new Blob([svgString], {
                        type: "image/svg+xml",
                    });
                    await navigator.clipboard.write([
                        new ClipboardItem({ "image/svg+xml": blob }),
                    ]);
                } catch (error) {
                    console.warn("Failed to copy SVG to clipboard:", error);
                }
                return;
            }

            const blob = new Blob([svgString], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.onload = async () => {
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) return;
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob(async (pngBlob) => {
                    if (!pngBlob) return;
                    try {
                        await navigator.clipboard.write([
                            new ClipboardItem({ "image/png": pngBlob }),
                        ]);
                    } catch (error) {
                        console.warn("Failed to copy PNG to clipboard:", error);
                    }
                });
                URL.revokeObjectURL(url);
            };
            img.src = url;
        },
        [contextMenu?.elementId, elements, selectedElementIds],
    );

    const handleCommentNav = useCallback(
        (direction: "prev" | "next") => {
            if (comments.length === 0) return;
            const currentId = activeCommentIdRef.current;
            const currentIndex = comments.findIndex(
                (comment) => comment.id === currentId,
            );
            const baseIndex = currentIndex === -1 ? 0 : currentIndex;
            const nextIndex =
                direction === "prev"
                    ? (baseIndex - 1 + comments.length) % comments.length
                    : (baseIndex + 1) % comments.length;
            const nextComment = comments[nextIndex];
            if (!nextComment) return;
            setEmojiPicker(null);
            setActiveCommentId(nextComment.id);
            setPinnedCommentId(nextComment.id);
            const anchor = resolveCommentAnchor(nextComment);
            const menuOffsetX = 40;
            const menuWidth = 288;
            const menuHeight = 220;
            onFocusCommentAt?.({
                x: anchor.x + (menuOffsetX + menuWidth / 2) / zoom,
                y: anchor.y + menuHeight / 2 / zoom,
            });
        },
        [comments, onFocusCommentAt, resolveCommentAnchor, zoom],
    );

    const handleEmojiPicker = useCallback(
        (
            commentId: string,
            messageId: string,
            event?: React.MouseEvent<HTMLButtonElement>,
        ) => {
            const target = event?.currentTarget ?? null;
            const containerRect = containerRef.current?.getBoundingClientRect();
            if (target && containerRect) {
                const rect = target.getBoundingClientRect();
                setEmojiPicker({
                    commentId,
                    messageId,
                    x: rect.left - containerRect.left,
                    y: rect.bottom - containerRect.top + 8,
                });
            } else {
                setEmojiPicker({ commentId, messageId, x: 0, y: 0 });
            }
        },
        [containerRef],
    );

    const handleCommentHoverStart = useCallback(
        (commentId: string) => {
            if (pinnedCommentId && pinnedCommentId !== commentId) return;
            setActiveCommentId(commentId);
            onCommentSeen?.(commentId);
        },
        [onCommentSeen, pinnedCommentId],
    );

    const handleCommentHoverEnd = useCallback(() => {
        if (pinnedCommentId) return;
        if (emojiPicker) return; // Don't close if emoji picker is open
        setActiveCommentId(null);
    }, [pinnedCommentId, emojiPicker]);

    const visibleComments = showResolvedComments
        ? comments
        : comments.filter((comment) => !comment.resolved);

    const formatTimestamp = (timestamp: number) => {
        const now = Date.now();
        const diffMs = Math.max(0, now - timestamp);
        const diffMinutes = Math.floor(diffMs / 60000);
        if (diffMinutes < 1) return "just now";
        if (diffMinutes < 60) return `${diffMinutes}min ago`;
        const diffHours = Math.floor(diffMinutes / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return "a day ago";
        if (diffDays < 7) return `${diffDays} days ago`;
        return new Date(timestamp).toLocaleDateString();
    };
    const getInitials = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return "?";
        const parts = trimmed.split(/\s+/).slice(0, 2);
        return parts.map((part) => part[0]?.toUpperCase()).join("");
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-background select-none"
            style={{ cursor: cursorStyle }}
            onMouseDownCapture={(e) => {
                const eventTarget = e.target as Element | null;
                if (
                    contextMenu &&
                    eventTarget?.closest?.('[data-context-menu="true"]')
                ) {
                    return;
                }
                if (contextMenu) {
                    setContextMenu(null);
                }
                if (eventTarget?.closest?.('[data-comment-menu="true"]')) {
                    return;
                }
                if (eventTarget?.closest?.('[data-comment-icon="true"]')) {
                    return;
                }
                if (emojiPickerRef.current?.contains(eventTarget)) {
                    return;
                }
                if (pinnedCommentId || activeCommentId) {
                    const closingId = pinnedCommentId ?? activeCommentId;
                    if (closingId) {
                        const closingComment = comments.find(
                            (c) => c.id === closingId,
                        );
                        const draft = commentDrafts[closingId] ?? "";
                        if (
                            closingComment &&
                            (closingComment.messages?.length ?? 0) === 0 &&
                            !draft.trim()
                        ) {
                            onDeleteComment?.(closingId);
                        }
                    }
                    setPinnedCommentId(null);
                    setActiveCommentId(null);
                    setEmojiPicker(null);
                }
                if (!editingTileId) return;
                const { target: tileTarget } = getEventTargetInfo(e);
                const insideActiveTile = tileTarget?.closest?.(
                    `[data-tile-id="${editingTileId}"]`,
                );
                if (!insideActiveTile) setEditingTileId(null);
            }}
            onMouseDown={handleMouseDown}
            onDoubleClickCapture={handleDoubleClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onContextMenu={openContextMenu}
        >
            {/* Canvas Background */}
            {canvasBackground !== "none" && (
                <div
                    className="absolute inset-0 pointer-events-none text-foreground opacity-[0.08] dark:opacity-[0.05] z-0"
                    style={backgroundStyle}
                />
            )}

            {/* Main SVG Canvas */}
            <svg ref={svgRef} className="relative z-10 w-full h-full">
                <defs>
                    <filter
                        id="laser-glow"
                        x="-50%"
                        y="-50%"
                        width="200%"
                        height="200%"
                    >
                        {/* Create multiple blur layers for stronger glow */}
                        <feGaussianBlur stdDeviation="3" result="blur1" />
                        <feGaussianBlur stdDeviation="6" result="blur2" />
                        <feGaussianBlur stdDeviation="9" result="blur3" />

                        {/* Brighten the glow */}
                        <feColorMatrix
                            in="blur1"
                            result="brightBlur1"
                            type="matrix"
                            values="1.5 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 1 0"
                        />
                        <feColorMatrix
                            in="blur2"
                            result="brightBlur2"
                            type="matrix"
                            values="1.3 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0.8 0"
                        />
                        <feColorMatrix
                            in="blur3"
                            result="brightBlur3"
                            type="matrix"
                            values="1.2 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0 0
                      0 0 0 0.6 0"
                        />

                        {/* Merge all layers */}
                        <feMerge>
                            <feMergeNode in="brightBlur3" />
                            <feMergeNode in="brightBlur2" />
                            <feMergeNode in="brightBlur1" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Render all elements sorted by zIndex */}
                    {[...visibleElements]
                        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                        .map((el) => renderElement(el))}

                    {/* Render remote users' in-progress drawings */}
                    {remoteDrawingElements.map(({ id, color, element }) => (
                        <g key={`remote-drawing-${id}`} opacity={0.7}>
                            {renderElement(
                                element.type === "text"
                                    ? element
                                    : {
                                          ...element,
                                          strokeColor: color,
                                      },
                                true,
                            )}
                        </g>
                    ))}

                    {/* Render current element being drawn */}
                    {currentElement && renderElement(currentElement, true)}

                    {/* Render remote user selections (colored frames with name tags) */}
                    {renderRemoteSelections()}

                    {/* Render selection box */}
                    {tool === "select" && renderSelectionBox()}

                    {/* Render search result highlights */}
                    {renderHighlights()}

                    {/* Render snap target highlight */}
                    {renderSnapTargetHighlight()}

                    {/* Render box selection rectangle */}
                    {isBoxSelecting &&
                        selectionBox &&
                        Number.isFinite(selectionBox.x) &&
                        Number.isFinite(selectionBox.y) &&
                        Number.isFinite(selectionBox.width) &&
                        Number.isFinite(selectionBox.height) && (
                            <rect
                                x={selectionBox.x}
                                y={selectionBox.y}
                                width={selectionBox.width}
                                height={selectionBox.height}
                                fill="rgba(98, 114, 164, 0.2)"
                                stroke="var(--accent)"
                                strokeWidth={1}
                                strokeDasharray="4,4"
                            />
                        )}

                    {/* Render text box preview while dragging */}
                    {tool === "text" && isDrawing && startPoint && (
                        <rect
                            x={Math.min(startPoint.x, lastMousePos.x)}
                            y={Math.min(startPoint.y, lastMousePos.y)}
                            width={Math.abs(lastMousePos.x - startPoint.x)}
                            height={fontSize * lineHeight + 8}
                            fill="none"
                            stroke="var(--accent)"
                            strokeWidth={1}
                        />
                    )}

                    {/* Eraser trail animation */}
                    <path ref={eraserTrailPathRef} />

                    {/* Eraser cursor circle */}
                    {tool === "eraser" && eraserCursorPos && (
                        <circle
                            cx={eraserCursorPos.x}
                            cy={eraserCursorPos.y}
                            r={strokeWidth * 2}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1 / zoom}
                            opacity={0.5}
                            pointerEvents="none"
                        />
                    )}

                    {/* Laser pointer cursor - glowing red dot with white center */}
                    {tool === "laser" && laserCursorPos && (
                        <g pointerEvents="none">
                            {/* Outer glow - large red blur */}
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={8 / zoom}
                                fill="#ff0000"
                                opacity={0.3}
                                filter="blur(4px)"
                            />
                            {/* Middle glow - medium red blur */}
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={5 / zoom}
                                fill="#ff0000"
                                opacity={0.5}
                                filter="blur(2px)"
                            />
                            {/* Main red dot */}
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={3 / zoom}
                                fill="#ff0000"
                                opacity={0.9}
                            />
                            {/* White center dot */}
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={1 / zoom}
                                fill="#ffffff"
                            />
                        </g>
                    )}
                </g>
            </svg>

            {/* Tile Layer (DOM, supports rich editors) */}
            {/* isolation:isolate ensures element zIndex values stay within this stacking context */}
            <div className="absolute inset-0 pointer-events-none z-20 isolate">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: "0 0",
                    }}
                >
                    {[...visibleElements]
                        .filter((el) => el.type === "tile")
                        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                        .map((el) => (
                            <div
                                key={el.id}
                                className="pointer-events-auto"
                                style={{ zIndex: el.zIndex || 0 }}
                            >
                                <HtmlTileRenderer
                                    element={el}
                                    isSelected={selectedIds.includes(el.id)}
                                    isTextEditing={editingTileId === el.id}
                                    onRequestTextEdit={() => {
                                        setEditingTileId(el.id);
                                        setSelectedIds([el.id]);
                                    }}
                                    onUpdate={(updates) =>
                                        onUpdateElement(el.id, updates)
                                    }
                                    onDelete={() => onDeleteElement(el.id)}
                                    onOpenDocumentEditor={onOpenDocumentEditor}
                                    onOpenMermaidEditor={onOpenMermaidEditor}
                                />
                            </div>
                        ))}
                </div>
            </div>

            {/* Comments Layer */}
            {comments.length > 0 && (
                <div className="absolute inset-0 z-[70] pointer-events-none">
                    {visibleComments.map((comment) => {
                        const anchor = resolveCommentAnchor(comment);
                        const screenX = anchor.x * zoom + pan.x;
                        const screenY = anchor.y * zoom + pan.y;
                        if (
                            !Number.isFinite(screenX) ||
                            !Number.isFinite(screenY)
                        ) {
                            return null;
                        }
                        const isOpen = activeCommentId === comment.id;
                        const isPinned = pinnedCommentId === comment.id;
                        const isSelected = selectedCommentIds.includes(
                            comment.id,
                        );
                        const draft = commentDrafts[comment.id] || "";
                        const messages = comment.messages || [];
                        return (
                            <div
                                key={comment.id}
                                className="absolute pointer-events-auto"
                                style={{
                                    left: screenX,
                                    top: screenY,
                                }}
                            >
                                <div
                                    className={cn("group relative")}
                                    onMouseEnter={() =>
                                        handleCommentHoverStart(comment.id)
                                    }
                                    onMouseLeave={handleCommentHoverEnd}
                                >
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (isPinned) {
                                                setPinnedCommentId(null);
                                                setActiveCommentId(null);
                                            } else {
                                                setPinnedCommentId(comment.id);
                                                setActiveCommentId(comment.id);
                                            }
                                            onSelectComment?.(comment.id);
                                            onCommentSeen?.(comment.id);
                                        }}
                                        data-comment-icon="true"
                                        className="size-9 text-muted-foreground hover:text-foreground flex items-center justify-center"
                                    >
                                        <MessageCircle className="size-5" />
                                    </button>
                                    <div
                                        className={cn(
                                            "absolute left-10 top-0 w-80 max-h-[480px] flex flex-col rounded-xl border border-border bg-card shadow-xl opacity-0 pointer-events-none transition-opacity overflow-hidden",
                                            (isOpen || isPinned) &&
                                                "opacity-100 pointer-events-auto",
                                        )}
                                        data-comment-menu="true"
                                    >
                                        {/* Header */}
                                        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleCommentNav("prev")
                                                    }
                                                    className="size-7 rounded-md hover:bg-muted transition-colors flex items-center justify-center"
                                                    aria-label="Previous comment"
                                                >
                                                    <ChevronLeft className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleCommentNav("next")
                                                    }
                                                    className="size-7 rounded-md hover:bg-muted transition-colors flex items-center justify-center"
                                                    aria-label="Next comment"
                                                >
                                                    <ChevronRight className="size-4" />
                                                </button>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onToggleCommentResolved?.(
                                                            comment.id,
                                                        )
                                                    }
                                                    className={cn(
                                                        "size-7 rounded-md hover:bg-muted transition-colors flex items-center justify-center",
                                                        comment.resolved &&
                                                            "text-emerald-500",
                                                    )}
                                                    aria-label={
                                                        comment.resolved
                                                            ? "Mark unresolved"
                                                            : "Mark resolved"
                                                    }
                                                    title="Mark as resolved"
                                                >
                                                    <Check className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        onDeleteComment?.(
                                                            comment.id,
                                                        )
                                                    }
                                                    className="size-7 rounded-md hover:bg-muted transition-colors flex items-center justify-center text-destructive hover:text-destructive"
                                                    aria-label="Delete thread"
                                                    title="Delete thread"
                                                >
                                                    <Trash2 className="size-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setPinnedCommentId(
                                                            null,
                                                        );
                                                        setActiveCommentId(
                                                            null,
                                                        );
                                                        setEmojiPicker(null);
                                                    }}
                                                    className="size-7 rounded-md hover:bg-muted transition-colors flex items-center justify-center"
                                                    aria-label="Close"
                                                    title="Close"
                                                >
                                                    <X className="size-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Comments */}
                                        <ScrollArea className="flex-1 min-h-0">
                                            <div className="p-3 space-y-4">
                                                {messages.length === 0 ? (
                                                    <p className="text-sm text-muted-foreground">
                                                        No comments yet. Be the
                                                        first to comment.
                                                    </p>
                                                ) : (
                                                    messages.map((message) => {
                                                        const authorName =
                                                            message.author
                                                                ?.name ||
                                                            "Guest";
                                                        const messageTime =
                                                            message.createdAt ||
                                                            Date.now();
                                                        return (
                                                            <div
                                                                key={message.id}
                                                                className="group/message"
                                                            >
                                                                <div className="flex items-start gap-2.5">
                                                                    <Avatar className="size-7 shrink-0">
                                                                        <AvatarFallback className="text-[10px] text-white font-medium bg-gradient-to-br from-primary/80 to-primary">
                                                                            {getInitials(
                                                                                authorName,
                                                                            )}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-medium text-sm">
                                                                                {
                                                                                    authorName
                                                                                }
                                                                            </span>
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {formatTimestamp(
                                                                                    messageTime,
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                        <p className="text-sm text-foreground/90 mt-0.5 leading-relaxed">
                                                                            {
                                                                                message.text
                                                                            }
                                                                        </p>

                                                                        {/* Reactions */}
                                                                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                                            {(
                                                                                message.reactions ||
                                                                                []
                                                                            ).map(
                                                                                (
                                                                                    reaction,
                                                                                ) => {
                                                                                    const count =
                                                                                        reaction
                                                                                            .userIds
                                                                                            .length;
                                                                                    const hasReacted =
                                                                                        !!currentUserId &&
                                                                                        reaction.userIds.includes(
                                                                                            currentUserId,
                                                                                        );
                                                                                    return (
                                                                                        <button
                                                                                            key={
                                                                                                reaction.emoji
                                                                                            }
                                                                                            type="button"
                                                                                            onClick={() =>
                                                                                                onToggleCommentReaction?.(
                                                                                                    comment.id,
                                                                                                    message.id,
                                                                                                    reaction.emoji,
                                                                                                )
                                                                                            }
                                                                                            className={cn(
                                                                                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors",
                                                                                                hasReacted
                                                                                                    ? "bg-primary/10 border-primary/30 text-primary"
                                                                                                    : "bg-muted/50 border-transparent hover:bg-muted",
                                                                                            )}
                                                                                        >
                                                                                            <span>
                                                                                                {
                                                                                                    reaction.emoji
                                                                                                }
                                                                                            </span>
                                                                                            <span className="font-sans">
                                                                                                {
                                                                                                    count
                                                                                                }
                                                                                            </span>
                                                                                        </button>
                                                                                    );
                                                                                },
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                data-emoji-trigger="true"
                                                                                onClick={(
                                                                                    event,
                                                                                ) =>
                                                                                    handleEmojiPicker(
                                                                                        comment.id,
                                                                                        message.id,
                                                                                        event,
                                                                                    )
                                                                                }
                                                                                className="inline-flex items-center justify-center size-6 rounded-full hover:bg-muted transition-colors opacity-0 group-hover/message:opacity-100"
                                                                                aria-label="Add emoji reaction"
                                                                            >
                                                                                <SmilePlus className="size-3.5 text-muted-foreground" />
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        </ScrollArea>

                                        {/* Reply Input */}
                                        <div className="border-t border-border p-3 bg-card shrink-0">
                                            <form
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    if (!draft.trim()) return;
                                                    onAddCommentMessage?.(
                                                        comment.id,
                                                        draft,
                                                    );
                                                    setCommentDrafts(
                                                        (prev) => ({
                                                            ...prev,
                                                            [comment.id]: "",
                                                        }),
                                                    );
                                                }}
                                                className="flex items-center gap-2"
                                            >
                                                <Avatar className="size-7 shrink-0">
                                                    <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-medium">
                                                        {getInitials("You")}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="flex-1 relative">
                                                    <input
                                                        type="text"
                                                        value={draft}
                                                        onChange={(event) =>
                                                            setCommentDrafts(
                                                                (prev) => ({
                                                                    ...prev,
                                                                    [comment.id]:
                                                                        event
                                                                            .target
                                                                            .value,
                                                                }),
                                                            )
                                                        }
                                                        placeholder="Reply, @mention someone..."
                                                        className="w-full pr-10 h-9 text-sm bg-muted/50 border-0 rounded-md px-3 outline-none focus:ring-1 focus:ring-ring"
                                                    />
                                                    <button
                                                        type="submit"
                                                        disabled={!draft.trim()}
                                                        className="absolute right-1 top-1/2 -translate-y-1/2 size-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        aria-label="Send"
                                                    >
                                                        <ChevronRight className="size-4" />
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {emojiPicker && (
                <div className="absolute inset-0 z-[75] pointer-events-none">
                    <div
                        ref={emojiPickerRef}
                        className="absolute pointer-events-auto"
                        style={{ left: emojiPicker.x, top: emojiPicker.y }}
                        onWheel={(event) => event.stopPropagation()}
                    >
                        <EmojiPicker
                            onEmojiSelect={(emoji) => {
                                onToggleCommentReaction?.(
                                    emojiPicker.commentId,
                                    emojiPicker.messageId,
                                    emoji,
                                );
                                setEmojiPicker(null);
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Frame labels + handles */}
            <div className="absolute inset-0 pointer-events-none z-35 isolate">
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: "0 0",
                    }}
                >
                    {[...visibleElements]
                        .filter((el) => el.type === "frame")
                        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                        .map((el) => {
                            const labelText =
                                (el.label ?? "Frame").trim() || "Frame";
                            const isEditing = editingFrameLabelId === el.id;
                            const isSelected = selectedIds.includes(el.id);
                            const labelX = (el.x ?? 0) + 8;
                            const labelY = (el.y ?? 0) - 36;

                            return (
                                <div
                                    key={`frame-label-${el.id}`}
                                    className="absolute pointer-events-auto"
                                    style={{
                                        left: labelX,
                                        top: labelY,
                                        zIndex: (el.zIndex || 0) + 1,
                                    }}
                                >
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            data-frame-handle="true"
                                            data-element-id={el.id}
                                            className={cn(
                                                "h-5 w-5 rounded-sm flex items-center justify-center text-muted-foreground/80 bg-transparent transition-colors cursor-grab active:cursor-grabbing",
                                                isSelected
                                                    ? "text-foreground"
                                                    : "hover:text-foreground hover:bg-muted/40",
                                            )}
                                            title="Drag frame"
                                            aria-label="Drag frame"
                                        >
                                            <GripVertical className="h-3.5 w-3.5" />
                                        </button>
                                        <span
                                            role="textbox"
                                            data-frame-label="true"
                                            data-element-id={el.id}
                                            data-frame-label-input={
                                                isEditing ? "true" : undefined
                                            }
                                            contentEditable={isEditing}
                                            suppressContentEditableWarning
                                            onPointerDown={(e) => {
                                                e.stopPropagation();
                                                setSelectedIds([el.id]);
                                                if (!isEditing) {
                                                    setFrameLabelValue(
                                                        labelText,
                                                    );
                                                    setEditingFrameLabelId(
                                                        el.id,
                                                    );
                                                }
                                            }}
                                            onInput={(e) =>
                                                setFrameLabelValue(
                                                    e.currentTarget
                                                        .textContent || "",
                                                )
                                            }
                                            onBlur={(e) => {
                                                if (isEditing) {
                                                    const nextValue =
                                                        e.currentTarget
                                                            .textContent || "";
                                                    setFrameLabelValue(
                                                        nextValue,
                                                    );
                                                    handleFrameLabelCommit(
                                                        nextValue,
                                                    );
                                                }
                                            }}
                                            onKeyDown={(e) => {
                                                if (!isEditing) return;
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    const nextValue =
                                                        e.currentTarget
                                                            .textContent || "";
                                                    setFrameLabelValue(
                                                        nextValue,
                                                    );
                                                    handleFrameLabelCommit(
                                                        nextValue,
                                                    );
                                                } else if (e.key === "Escape") {
                                                    e.preventDefault();
                                                    setEditingFrameLabelId(
                                                        null,
                                                    );
                                                    setFrameLabelValue(
                                                        labelText,
                                                    );
                                                }
                                                e.stopPropagation();
                                            }}
                                            className={cn(
                                                "min-w-[120px] max-w-[240px] h-6 inline-flex items-center px-2 text-[14px] leading-none font-semibold font-[var(--font-heading)] bg-card/90 backdrop-blur-md outline-none",
                                                isEditing
                                                    ? "border-b border-ring bg-background"
                                                    : "rounded-md hover:bg-muted/60 transition-colors cursor-text",
                                                !isEditing && "truncate",
                                            )}
                                            style={{
                                                color: el.strokeColor,
                                                borderColor:
                                                    isEditing || isSelected
                                                        ? el.strokeColor
                                                        : undefined,
                                            }}
                                        >
                                            {labelText}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                </div>
            </div>

            {/* Canvas Overlay (selection, in-progress drawings, cursors) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
                <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Render remote users' in-progress drawings */}
                    {remoteDrawingElements.map(({ id, color, element }) => (
                        <g key={`remote-drawing-${id}`} opacity={0.7}>
                            {renderElement(
                                element.type === "text"
                                    ? element
                                    : {
                                          ...element,
                                          strokeColor: color,
                                      },
                                true,
                            )}
                        </g>
                    ))}

                    {/* Render current element being drawn */}
                    {currentElement && renderElement(currentElement, true)}

                    {/* Render remote user selections (colored frames with name tags) */}
                    {renderRemoteSelections()}

                    {/* Render selection box */}
                    {tool === "select" && renderSelectionBox()}

                    {/* Render search result highlights */}
                    {renderHighlights()}

                    {/* Render snap target highlight */}
                    {renderSnapTargetHighlight()}

                    {/* Render alignment guides */}
                    {alignmentGuides.map((guide, i) => (
                        <line
                            key={`alignment-guide-${i}`}
                            x1={
                                guide.type === "vertical"
                                    ? guide.position
                                    : guide.start
                            }
                            y1={
                                guide.type === "horizontal"
                                    ? guide.position
                                    : guide.start
                            }
                            x2={
                                guide.type === "vertical"
                                    ? guide.position
                                    : guide.end
                            }
                            y2={
                                guide.type === "horizontal"
                                    ? guide.position
                                    : guide.end
                            }
                            stroke="var(--accent)"
                            strokeWidth={1 / zoom}
                            strokeDasharray={`${4 / zoom},${4 / zoom}`}
                            opacity={0.8}
                            pointerEvents="none"
                        />
                    ))}

                    {/* Render distance guides with measurements */}
                    {distanceGuides.map((guide, i) => {
                        const isHorizontal = guide.axis === "horizontal";
                        const isReference = guide.isReference ?? false;
                        const midPoint = (guide.gapStart + guide.gapEnd) / 2;
                        const capSize = 6 / zoom;
                        const fontSize = 10 / zoom;
                        const labelPadX = 4 / zoom;
                        const labelPadY = 2 / zoom;
                        const labelText = Math.round(guide.distance).toString();
                        const labelWidth =
                            (labelText.length * 6) / zoom + labelPadX * 2;
                        const labelHeight = fontSize + labelPadY * 2;
                        const labelX = isHorizontal
                            ? midPoint
                            : guide.crossAxisPosition;
                        const labelY = isHorizontal
                            ? guide.crossAxisPosition
                            : midPoint;
                        const labelOffsetY = isHorizontal
                            ? -(labelHeight / 2 + 4 / zoom)
                            : 0;
                        const labelOffsetX = isHorizontal
                            ? 0
                            : labelWidth / 2 + 4 / zoom;

                        return (
                            <g key={`distance-guide-${i}`} pointerEvents="none">
                                {/* Measurement line */}
                                <line
                                    x1={
                                        isHorizontal
                                            ? guide.gapStart
                                            : guide.crossAxisPosition
                                    }
                                    y1={
                                        isHorizontal
                                            ? guide.crossAxisPosition
                                            : guide.gapStart
                                    }
                                    x2={
                                        isHorizontal
                                            ? guide.gapEnd
                                            : guide.crossAxisPosition
                                    }
                                    y2={
                                        isHorizontal
                                            ? guide.crossAxisPosition
                                            : guide.gapEnd
                                    }
                                    stroke="var(--accent)"
                                    strokeWidth={1 / zoom}
                                    opacity={isReference ? 0.35 : 0.8}
                                    strokeDasharray={
                                        isReference
                                            ? `${4 / zoom},${3 / zoom}`
                                            : undefined
                                    }
                                />
                                {isReference ? (
                                    <>
                                        {/* Reference gap label */}
                                        <rect
                                            x={
                                                labelX +
                                                labelOffsetX -
                                                labelWidth / 2
                                            }
                                            y={
                                                labelY +
                                                labelOffsetY -
                                                labelHeight / 2
                                            }
                                            width={labelWidth}
                                            height={labelHeight}
                                            rx={3 / zoom}
                                            ry={3 / zoom}
                                            fill="var(--accent)"
                                            opacity={0.6}
                                        />
                                        <text
                                            x={labelX + labelOffsetX}
                                            y={labelY + labelOffsetY}
                                            fill="white"
                                            fontSize={fontSize}
                                            fontFamily="system-ui, sans-serif"
                                            fontWeight="500"
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                            opacity={0.9}
                                        >
                                            {labelText}
                                        </text>
                                    </>
                                ) : (
                                    <>
                                        {/* Start cap */}
                                        <line
                                            x1={
                                                isHorizontal
                                                    ? guide.gapStart
                                                    : guide.crossAxisPosition -
                                                      capSize / 2
                                            }
                                            y1={
                                                isHorizontal
                                                    ? guide.crossAxisPosition -
                                                      capSize / 2
                                                    : guide.gapStart
                                            }
                                            x2={
                                                isHorizontal
                                                    ? guide.gapStart
                                                    : guide.crossAxisPosition +
                                                      capSize / 2
                                            }
                                            y2={
                                                isHorizontal
                                                    ? guide.crossAxisPosition +
                                                      capSize / 2
                                                    : guide.gapStart
                                            }
                                            stroke="var(--accent)"
                                            strokeWidth={1 / zoom}
                                            opacity={0.8}
                                        />
                                        {/* End cap */}
                                        <line
                                            x1={
                                                isHorizontal
                                                    ? guide.gapEnd
                                                    : guide.crossAxisPosition -
                                                      capSize / 2
                                            }
                                            y1={
                                                isHorizontal
                                                    ? guide.crossAxisPosition -
                                                      capSize / 2
                                                    : guide.gapEnd
                                            }
                                            x2={
                                                isHorizontal
                                                    ? guide.gapEnd
                                                    : guide.crossAxisPosition +
                                                      capSize / 2
                                            }
                                            y2={
                                                isHorizontal
                                                    ? guide.crossAxisPosition +
                                                      capSize / 2
                                                    : guide.gapEnd
                                            }
                                            stroke="var(--accent)"
                                            strokeWidth={1 / zoom}
                                            opacity={0.8}
                                        />
                                        {/* Distance label background */}
                                        <rect
                                            x={
                                                labelX +
                                                labelOffsetX -
                                                labelWidth / 2
                                            }
                                            y={
                                                labelY +
                                                labelOffsetY -
                                                labelHeight / 2
                                            }
                                            width={labelWidth}
                                            height={labelHeight}
                                            rx={3 / zoom}
                                            ry={3 / zoom}
                                            fill="var(--accent)"
                                        />
                                        {/* Distance label text */}
                                        <text
                                            x={labelX + labelOffsetX}
                                            y={labelY + labelOffsetY}
                                            fill="white"
                                            fontSize={fontSize}
                                            fontFamily="system-ui, sans-serif"
                                            fontWeight="500"
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                        >
                                            {labelText}
                                        </text>
                                    </>
                                )}
                            </g>
                        );
                    })}

                    {/* Render lasso selection */}
                    {isLassoSelecting && lassoPath && (
                        <path
                            d={`${lassoPath}${lassoPoints.length > 2 ? " Z" : ""}`}
                            fill="rgba(98, 114, 164, 0.12)"
                            stroke="var(--accent)"
                            strokeWidth={1}
                            strokeDasharray="4,4"
                        />
                    )}

                    {/* Render box selection rectangle */}
                    {isBoxSelecting &&
                        selectionBox &&
                        Number.isFinite(selectionBox.x) &&
                        Number.isFinite(selectionBox.y) &&
                        Number.isFinite(selectionBox.width) &&
                        Number.isFinite(selectionBox.height) && (
                            <rect
                                x={selectionBox.x}
                                y={selectionBox.y}
                                width={selectionBox.width}
                                height={selectionBox.height}
                                fill="rgba(98, 114, 164, 0.2)"
                                stroke="var(--accent)"
                                strokeWidth={1}
                                strokeDasharray="4,4"
                            />
                        )}

                    {/* Eraser trail animation */}
                    <path ref={eraserTrailPathRef} />

                    {/* Eraser cursor circle */}
                    {tool === "eraser" && eraserCursorPos && (
                        <circle
                            cx={eraserCursorPos.x}
                            cy={eraserCursorPos.y}
                            r={strokeWidth * 2}
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={1 / zoom}
                            opacity={0.5}
                        />
                    )}

                    {/* Laser pointer cursor - glowing red dot with white center */}
                    {tool === "laser" && laserCursorPos && (
                        <g>
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={8 / zoom}
                                fill="#ff0000"
                                opacity={0.3}
                                filter="blur(4px)"
                            />
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={5 / zoom}
                                fill="#ff0000"
                                opacity={0.5}
                                filter="blur(2px)"
                            />
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={3 / zoom}
                                fill="#ff0000"
                                opacity={0.9}
                            />
                            <circle
                                cx={laserCursorPos.x}
                                cy={laserCursorPos.y}
                                r={1 / zoom}
                                fill="#ffffff"
                            />
                        </g>
                    )}
                </g>
            </svg>

            {/* Remote Cursors - Animated (not scaled with zoom) */}
            {showRemoteCursors && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-[25]">
                    <CollaboratorCursors
                        cursors={remoteCursors}
                        pan={pan}
                        zoom={zoom}
                    />
                </div>
            )}

            {/* Text Input */}
            {textInput &&
                (() => {
                    const editingShape = editingShapeTextId
                        ? elements.find((el) => el.id === editingShapeTextId)
                        : null;
                    const shapeVerticalAlign =
                        editingShape?.textVerticalAlign ?? "middle";
                    const isShapeText = !!editingShapeTextId;

                    // Calculate flex alignment for shape text to match rendered text
                    const shapeAlignItems =
                        shapeVerticalAlign === "top"
                            ? "flex-start"
                            : shapeVerticalAlign === "bottom"
                              ? "flex-end"
                              : "center";

                    // For shape text, we need to position the textarea exactly like the rendered text
                    // The rendered text uses a flex container with alignItems for vertical positioning
                    // We replicate that same structure here
                    const textareaElement = (
                        <textarea
                            ref={textInputRef}
                            value={textValue}
                            wrap={isShapeText ? "soft" : "off"}
                            rows={isShapeText ? undefined : 1}
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            autoComplete="off"
                            onChange={(e) => handleTextChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Escape") {
                                    setTextInput(null);
                                    setTextValue("");
                                    setEditingTextElementId(null);
                                    setEditingShapeTextId(null);
                                    setEditingTextStyle(null);
                                }
                            }}
                            onBlur={(e) => {
                                // Don't close if clicking on sidebar or other UI elements
                                const relatedTarget =
                                    e.relatedTarget as HTMLElement;
                                if (
                                    relatedTarget &&
                                    (relatedTarget.closest(".fixed.right-4") || // Sidebar
                                        relatedTarget.tagName === "BUTTON" ||
                                        relatedTarget.tagName === "SELECT" ||
                                        relatedTarget.tagName === "INPUT")
                                ) {
                                    return;
                                }
                                // Save text on blur if there's content
                                if (textValue.trim()) {
                                    handleTextSubmit({
                                        skipSelect: true,
                                    });
                                    setSelectedIds([]);
                                } else {
                                    setTextInput(null);
                                    setTextValue("");
                                    setEditingTextElementId(null);
                                    setEditingShapeTextId(null);
                                    setEditingTextStyle(null);
                                    setSelectedIds([]);
                                }
                            }}
                            className={`bg-transparent resize-none ${isShapeText ? "" : "absolute inset-0"}`}
                            style={{
                                width: "100%",
                                fontSize:
                                    editingTextStyle?.fontSize ?? fontSize,
                                fontFamily:
                                    editingTextStyle?.fontFamily ?? fontFamily,
                                fontWeight: 500,
                                letterSpacing: `${editingTextStyle?.letterSpacing ?? letterSpacing}px`,
                                color:
                                    editingTextStyle?.strokeColor ??
                                    strokeColor,
                                lineHeight: (
                                    editingTextStyle?.lineHeight ?? lineHeight
                                ).toString(),
                                textAlign: isShapeText
                                    ? "center"
                                    : (editingTextStyle?.textAlign ??
                                      textAlign),
                                padding: isShapeText
                                    ? 0
                                    : isTextBoxEditing
                                      ? 4
                                      : 0,
                                margin: 0,
                                border: 0,
                                outline: isShapeText
                                    ? "none"
                                    : isTextBoxEditing
                                      ? "1px solid color-mix(in oklab, var(--accent) 60%, transparent)"
                                      : "none",
                                outlineOffset: "0px",
                                boxSizing: "border-box",
                                overflow: isShapeText ? "visible" : "hidden",
                                wordBreak:
                                    isTextBoxEditing || isShapeText
                                        ? "break-word"
                                        : "normal",
                                overflowWrap:
                                    isTextBoxEditing || isShapeText
                                        ? "anywhere"
                                        : "normal",
                                whiteSpace:
                                    isTextBoxEditing || isShapeText
                                        ? "pre-wrap"
                                        : "pre",
                                caretColor:
                                    editingTextStyle?.strokeColor ??
                                    strokeColor,
                                ...(isShapeText
                                    ? {
                                          height: "auto",
                                          minHeight: 0,
                                          verticalAlign: "top",
                                          display: "block",
                                          marginTop: "+8px", // Compensate for textarea baseline offset
                                      }
                                    : { height: "100%" }),
                            }}
                        />
                    );

                    return (
                        <div
                            ref={textEditorWrapperRef}
                            className="pointer-events-auto"
                            style={{
                                position: "absolute",
                                zIndex: 40,
                                left: textInput.x * zoom + pan.x,
                                top: textInput.y * zoom + pan.y,
                                width: isShapeText
                                    ? (textInput.width ?? 200)
                                    : (textInputMetrics?.width ??
                                      textInput.width ??
                                      200),
                                height: isShapeText
                                    ? (textInput.height ?? 100)
                                    : (textInputMetrics?.height ??
                                      textInput.height ??
                                      (editingTextStyle?.fontSize ?? fontSize) *
                                          (editingTextStyle?.lineHeight ??
                                              lineHeight)),
                                transform: `scale(${zoom})`,
                                transformOrigin: "top left",
                                overflow: "visible",
                                // For shape text, use flex to match renderShapeText exactly
                                ...(isShapeText && {
                                    display: "flex",
                                    alignItems: shapeAlignItems,
                                    justifyContent: "center",
                                    padding: "8px",
                                    boxSizing: "border-box" as const,
                                }),
                            }}
                        >
                            {textareaElement}
                        </div>
                    );
                })()}

            {/* Zoom Controls and Undo/Redo */}
            <div
                className="absolute bottom-4 left-4 z-[80] flex items-center gap-2 select-none"
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md p-1 shadow-xl">
                    <button
                        onClick={() => {
                            setZoom((prev) => Math.max(0.1, prev - 0.1));
                            onManualViewportChange?.();
                        }}
                        className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all"
                        title="Zoom Out"
                    >
                        <Minus className="w-4 h-4" />
                    </button>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => {
                                    // Calculate center of viewport in world coordinates
                                    const centerX = containerSize.width / 2;
                                    const centerY = containerSize.height / 2;
                                    const worldX = (centerX - pan.x) / zoom;
                                    const worldY = (centerY - pan.y) / zoom;
                                    // Adjust pan so same world position stays at center with zoom=1
                                    setPan({
                                        x: centerX - worldX,
                                        y: centerY - worldY,
                                    });
                                    setZoom(1);
                                    onManualViewportChange?.();
                                }}
                                className="h-8 min-w-[3rem] px-2 text-xs font-medium text-foreground text-center hover:text-foreground/80 transition-colors"
                            >
                                {Math.round(zoom * 100)}%
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={8}>
                            Reset zoom
                        </TooltipContent>
                    </Tooltip>
                    <button
                        onClick={() => {
                            setZoom((prev) => Math.min(5, prev + 0.1));
                            onManualViewportChange?.();
                        }}
                        className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-all"
                        title="Zoom In"
                    >
                        <Plus className="w-4 h-4" />
                    </button>
                </div>
                {/* Undo/Redo */}
                {showUndoRedo && (
                    <div className="flex items-center gap-0.5 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md p-1 shadow-xl">
                        <button
                            onClick={onUndo}
                            disabled={!canUndo}
                            className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-md transition-all",
                                canUndo
                                    ? "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                    : "text-muted-foreground/40 cursor-not-allowed",
                            )}
                            title={`Undo (${undoShortcut})`}
                        >
                            <Undo2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onRedo}
                            disabled={!canRedo}
                            className={cn(
                                "flex items-center justify-center w-8 h-8 rounded-md transition-all",
                                canRedo
                                    ? "hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                    : "text-muted-foreground/40 cursor-not-allowed",
                            )}
                            title={`Redo (${redoShortcut})`}
                        >
                            <Redo2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
            {contextMenu && (
                <div
                    className="absolute z-[90] pointer-events-auto"
                    style={{
                        left: contextMenu.screenX,
                        top: contextMenu.screenY,
                    }}
                    onMouseDown={(event) => event.stopPropagation()}
                    data-context-menu="true"
                >
                    <div
                        ref={contextMenuRef}
                        className="min-w-[260px] rounded-sm border border-border bg-popover text-popover-foreground shadow-xl py-1 text-[12px] [&_[data-slot=kbd]]:text-[11px] [&_[data-slot=kbd]]:h-[18px] [&_[data-slot=kbd]]:min-w-[18px] [&_[data-slot=kbd]]:px-1 [&_[data-slot=kbd]]:rounded-[4px]"
                    >
                        {/* Cut/Copy/Paste */}
                        {contextMenu.elementId && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onCut?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Cut</span>
                                    <Kbd>{`${modKey}+X`}</Kbd>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onCopy?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Copy</span>
                                    <Kbd>{`${modKey}+C`}</Kbd>
                                </button>
                            </>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                onPaste?.();
                                setContextMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                        >
                            <span>Paste</span>
                            <Kbd>{`${modKey}+V`}</Kbd>
                        </button>

                        {!contextMenu.elementId && (
                            <>
                                <div className="my-1 h-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSelectAllElements?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Select all</span>
                                    <Kbd>{`${modKey}+A`}</Kbd>
                                </button>
                                {(onToggleViewMode ||
                                    onToggleSnapToObjects) && (
                                    <>
                                        <div className="my-1 h-px bg-border" />
                                        {onToggleViewMode && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onToggleViewMode();
                                                    setContextMenu(null);
                                                }}
                                                className="relative w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                            >
                                                {viewMode && (
                                                    <Check className="absolute left-1 h-3.5 w-3.5 opacity-90" />
                                                )}
                                                <span>View mode</span>
                                                <Kbd>{`${altKey}+R`}</Kbd>
                                            </button>
                                        )}
                                        {onToggleSnapToObjects && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onToggleSnapToObjects();
                                                    setContextMenu(null);
                                                }}
                                                className="relative w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                            >
                                                {snapToObjects && (
                                                    <Check className="absolute left-1 h-3.5 w-3.5 opacity-90" />
                                                )}
                                                <span>Snap to objects</span>
                                                <Kbd>{`${altKey}+S`}</Kbd>
                                            </button>
                                        )}
                                    </>
                                )}
                            </>
                        )}

                        {/* Wrap in frame - only when element selected */}
                        {contextMenu.elementId &&
                            !selectedIds.some((id) => {
                                const element = elements.find(
                                    (el) => el.id === id,
                                );
                                return element?.frameId;
                            }) && (
                                <>
                                    <div className="my-1 h-px bg-border" />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onWrapInFrame?.();
                                            setContextMenu(null);
                                        }}
                                        className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                    >
                                        <span>Wrap selection in frame</span>
                                    </button>
                                </>
                            )}

                        {/* Copy as PNG/SVG */}
                        <div className="my-1 h-px bg-border" />
                        <button
                            type="button"
                            onClick={() => {
                                void handleCopy("png");
                                setContextMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                        >
                            <span>Copy to clipboard as PNG</span>
                            <Kbd>{`${shiftKey}+${altKey}+C`}</Kbd>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                void handleCopy("svg");
                                setContextMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                        >
                            <span>Copy to clipboard as SVG</span>
                        </button>

                        {/* Copy/Paste styles - only when element selected */}
                        {contextMenu.elementId && (
                            <>
                                <div className="my-1 h-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        onCopyStyles?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Copy styles</span>
                                    <Kbd>{`${modKey}+${altKey}+C`}</Kbd>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onPasteStyles?.();
                                        setContextMenu(null);
                                    }}
                                    disabled={!hasStylesToPaste}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span>Paste styles</span>
                                    <Kbd>{`${modKey}+${altKey}+V`}</Kbd>
                                </button>
                            </>
                        )}

                        {/* Z-order controls - only when element selected */}
                        {contextMenu.elementId && (
                            <>
                                <div className="my-1 h-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSendBackward?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Send backward</span>
                                    <Kbd>{`${modKey}+[`}</Kbd>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onBringForward?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Bring forward</span>
                                    <Kbd>{`${modKey}+]`}</Kbd>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onSendToBack?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Send to back</span>
                                    <Kbd>{`${modKey}+${shiftKey}+[`}</Kbd>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onBringToFront?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Bring to front</span>
                                    <Kbd>{`${modKey}+${shiftKey}+]`}</Kbd>
                                </button>
                            </>
                        )}

                        {/* Flip controls - only when element selected */}
                        {contextMenu.elementId && (
                            <>
                                <div className="my-1 h-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        onFlipHorizontal?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Flip horizontal</span>
                                    <Kbd>{`${shiftKey}+H`}</Kbd>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onFlipVertical?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Flip vertical</span>
                                    <Kbd>{`${shiftKey}+V`}</Kbd>
                                </button>
                            </>
                        )}

                        {/* Link controls - only when element selected */}
                        {contextMenu.elementId && (
                            <>
                                <div className="my-1 h-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        onAddLink?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>
                                        {contextMenuElement?.link
                                            ? "Edit link"
                                            : "Add link"}
                                    </span>
                                    <Kbd>{`${modKey}+K`}</Kbd>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onCopyLinkToObject?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Copy link to object</span>
                                </button>
                            </>
                        )}

                        {/* Duplicate/Lock/Delete - only when element selected */}
                        {contextMenu.elementId && (
                            <>
                                <div className="my-1 h-px bg-border" />
                                <button
                                    type="button"
                                    onClick={() => {
                                        onDuplicate?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Duplicate</span>
                                    <Kbd>{`${modKey}+D`}</Kbd>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onLockSelected?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>
                                        {contextMenuElement?.locked
                                            ? "Unlock"
                                            : "Lock"}
                                    </span>
                                    <Kbd>{`${modKey}+${shiftKey}+L`}</Kbd>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onDeleteSelected?.();
                                        setContextMenu(null);
                                    }}
                                    className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] text-destructive hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                                >
                                    <span>Delete</span>
                                    <Kbd>Delete</Kbd>
                                </button>
                            </>
                        )}

                        {/* Add comment - always available */}
                        <div className="my-1 h-px bg-border" />
                        <button
                            type="button"
                            onClick={() => {
                                const id = onAddComment?.({
                                    x: contextMenu.worldX,
                                    y: contextMenu.worldY,
                                    elementId: contextMenu.elementId,
                                });
                                setActiveCommentId(id || null);
                                setContextMenu(null);
                            }}
                            className="w-full flex items-center justify-between px-5 py-1.5 text-[12px] hover:bg-muted/80 dark:hover:bg-muted/40 transition-colors"
                        >
                            <span>Add comment</span>
                        </button>
                    </div>
                </div>
            )}
            <div
                className="absolute bottom-4 right-4 z-[80] flex items-center"
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
            >
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Link
                            href="/privacy"
                            className="group inline-flex"
                            aria-label="End-to-end encryption details"
                        >
                            <ShieldCheck
                                className="h-6 w-6 transition-colors group-hover:[&>path:first-child]:fill-accent/90 [&>path:first-child]:fill-accent [&>path:first-child]:stroke-transparent [&>path:last-child]:stroke-background"
                                strokeWidth={2}
                            />
                        </Link>
                    </TooltipTrigger>
                    <TooltipContent
                        side="top"
                        sideOffset={8}
                        className="max-w-[200px] text-center"
                    >
                        <span className="block">
                            End-to-end encryption keeps
                        </span>
                        <span className="block">your board encrypted in</span>
                        <span className="block">your browser. Learn more.</span>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
