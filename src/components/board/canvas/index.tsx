"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { Tool, BoardElement, TileType } from "@/lib/board-types";
import { CollaborationManager } from "@/lib/collaboration";
import { CollaboratorCursors } from "../collaborator-cursor";
import { EraserTrail } from "@/lib/eraser-trail";
import type { RemoteSelection, RemoteCursor } from "./types";
import { chooseRotateHandleSide } from "./geometry";
import { measureWrappedTextHeightPx } from "./text-utils";
import { getCombinedBounds } from "./shapes";
import { useCanvasState } from "./hooks/useCanvasState";
import { useCanvasHandlers } from "./handlers/useCanvasHandlers";
import { useCanvasRenderers } from "./renderers/useCanvasRenderers";
import { HtmlTileRenderer } from "./html-tile-renderer";
import {
  getCanvasBackgroundStyle,
  getCanvasCursorStyle,
} from "./utils/canvasStyle";
import { TrashDropZone } from "./trash-drop-zone";

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
  fillPattern?: "none" | "solid" | "criss-cross";
  selectedTileType?: TileType | null;
  handDrawnMode?: boolean;
  collaboration: CollaborationManager | null;
  elements: BoardElement[];
  onAddElement: (element: BoardElement) => void;
  onUpdateElement: (id: string, updates: Partial<BoardElement>) => void;
  onBatchUpdateElements?: (
    updates: Array<{ id: string; updates: Partial<BoardElement> }>,
  ) => void;
  onDeleteElement: (id: string) => void;
  onDeleteMultiple?: (ids: string[]) => void;
  onStartTransform?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToolChange?: (tool: Tool) => void;
  onSetViewport?: (
    setter: (pan: { x: number; y: number }, zoom: number) => void,
  ) => void;
  onManualViewportChange?: () => void;
  onSelectionChange?: (elements: BoardElement[]) => void;
  onStrokeColorChange?: (color: string) => void;
  onFillColorChange?: (color: string) => void;
  canvasBackground?: "none" | "dots" | "lines" | "grid";
  highlightedElementIds?: string[];
  currentHighlightId?: string | null;
  isToolLocked?: boolean;
  isEditArrowMode?: boolean;
  remoteSelections?: RemoteSelection[];
  isReadOnly?: boolean;
  showRemoteCursors?: boolean;
  showUndoRedo?: boolean;
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
  fontSize = 24,
  letterSpacing = 0,
  lineHeight = 1.5,
  fillPattern = "none",
  selectedTileType = null,
  handDrawnMode = false,
  collaboration,
  elements,
  onAddElement,
  onUpdateElement,
  onBatchUpdateElements,
  onDeleteElement,
  onDeleteMultiple,
  onStartTransform,
  onUndo,
  onRedo,
  onToolChange,
  onSetViewport,
  onManualViewportChange,
  onSelectionChange,
  onStrokeColorChange,
  onFillColorChange,
  canvasBackground = "none",
  highlightedElementIds = [],
  currentHighlightId = null,
  isToolLocked = false,
  isEditArrowMode = false,
  remoteSelections = [],
  isReadOnly = false,
  showRemoteCursors = true,
  showUndoRedo = true,
}: CanvasProps) {
  const TEXT_CLIP_BUFFER_PX = 2;
  const LASER_HOLD_DURATION_MS = 3000;
  const LASER_FADE_DURATION_MS = 800;
  const LASER_TTL_MS = LASER_HOLD_DURATION_MS + LASER_FADE_DURATION_MS + 250;

  // Trash drop zone state
  const [isOverTrash, setIsOverTrash] = useState(false);
  const [mouseClientPos, setMouseClientPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const wasDraggingRef = useRef(false);

  // Tile editing state
  const [editingTileId, setEditingTileId] = useState<string | null>(null);

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
    },
    eraser: {
      eraserMarkedIds,
      setEraserMarkedIds,
      eraserCursorPos,
      setEraserCursorPos,
    },
    laser: { laserCursorPos, setLaserCursorPos },
    ui: {
      hoverCursor,
      lastMousePos,
      isBoxSelecting,
      selectionBox,
      inputHint,
      setInputHint,
      setShiftPressed,
    },
    refs: {
      nameTagWidthCacheRef,
      svgRef,
      containerRef,
      eraserTrailPathRef,
      eraserTrailRef,
      textInputRef,
      textEditorWrapperRef,
      textEditorMirrorRef,
      textEditorCaretRef,
      caretUpdateRafRef,
      lastEnforcedTextHeightsRef,
      lastSingleSelectedIdRef,
      expiredLaserIdsRef,
      elementsRef,
      cursorBroadcastRafRef,
      pendingDrawingElementRef,
      drawingElementBroadcastRafRef,
    },
  } = state;

  // Track shift key and other shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isReadOnly) return;
      if (e.key === "Shift") setShiftPressed(true);
      if (e.key === "Delete" && selectedIds.length > 0) {
        selectedIds.forEach((id) => onDeleteElement(id));
        setSelectedIds([]);
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
  }, [selectedIds, onDeleteElement, isReadOnly]);

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
          const newZoom = Math.max(0.1, Math.min(5, prevZoom * delta));

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
        const isDark = document.documentElement.classList.contains("dark");
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
          if (state.user && state.user.id !== myId && state.user.cursor) {
            // Check if cursor position changed
            const prevCursor = prevCursors.find((c) => c.id === state.user.id);
            const positionChanged =
              !prevCursor ||
              prevCursor.x !== state.user.cursor.x ||
              prevCursor.y !== state.user.cursor.y;

            cursors.push({
              id: state.user.id,
              name: state.user.name,
              color: state.user.color,
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
      const drawingElements: Array<{
        id: string;
        color: string;
        element: BoardElement;
      }> = [];
      states.forEach((state) => {
        if (state.user && state.user.id !== myId && state.user.drawingElement) {
          drawingElements.push({
            id: state.user.id,
            color: state.user.color,
            element: state.user.drawingElement,
          });
        }
      });
      setRemoteDrawingElements(drawingElements);
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
        height: textInput.height ?? activeFontSize * activeLineHeight,
        isTextBox: true,
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
        drawingElementBroadcastRafRef.current = requestAnimationFrame(() => {
          drawingElementBroadcastRafRef.current = null;
          collaboration.updateDrawingElement(pendingDrawingElementRef.current);
        });
      }
      return;
    }

    collaboration.updateDrawingElement(currentElement);
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
    selectedTileType,
    collaboration,
    elements,
    selectedBounds,
    selectedElements,
    onAddElement,
    onUpdateElement,
    onBatchUpdateElements,
    onDeleteElement,
    onStartTransform,
    onToolChange,
    onManualViewportChange,
    isToolLocked,
    isReadOnly,
  });

  const {
    getMousePosition,
    handleMouseMove: originalHandleMouseMove,
    handleMouseDown: originalHandleMouseDown,
    handleMouseUp: originalHandleMouseUp,
    handleMouseLeave,
    handleTextSubmit,
    handleTextChange,
  } = handlers;

  // Check if mouse is over trash zone (bottom-left quarter circle, 250px radius)
  const checkIsOverTrash = useCallback((clientX: number, clientY: number) => {
    const trashRadius = 250; // Large detection area for the quarter circle

    // Check if within quarter circle from bottom-left origin
    const dx = clientX;
    const dy = window.innerHeight - clientY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= trashRadius;
  }, []);

  // Track drag state in ref for reliable access in mouseup
  useEffect(() => {
    wasDraggingRef.current = isDragging;
  }, [isDragging]);

  // Wrapped mouse handlers with trash zone detection
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setMouseClientPos({ x: e.clientX, y: e.clientY });

      // Only check trash zone if dragging selected elements
      if (isDragging && selectedIds.length > 0) {
        wasDraggingRef.current = true; // Track that we're actively dragging
        const overTrash = checkIsOverTrash(e.clientX, e.clientY);
        if (overTrash !== isOverTrash) {
          setIsOverTrash(overTrash);
        }
      } else {
        if (isOverTrash) {
          setIsOverTrash(false);
        }
      }

      originalHandleMouseMove(e as any);
    },
    [
      isDragging,
      selectedIds.length,
      checkIsOverTrash,
      originalHandleMouseMove,
      isOverTrash,
    ],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setMouseClientPos({ x: e.clientX, y: e.clientY });
      wasDraggingRef.current = false; // Reset on mouse down
      originalHandleMouseDown(e as any);
    },
    [originalHandleMouseDown],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setMouseClientPos({ x: e.clientX, y: e.clientY });

      // Simple approach: if isOverTrash is true and we have selected items, delete them
      // The isOverTrash state is only set when actively dragging, so this is safe
      const shouldDelete = isOverTrash && selectedIds.length > 0;

      // Store delete decision before calling original handler
      const idsToDelete = shouldDelete ? [...selectedIds] : [];

      setIsOverTrash(false);
      wasDraggingRef.current = false;

      // Call original handler first to clean up drag state
      originalHandleMouseUp();

      // Then delete elements if needed (after drag cleanup)
      if (idsToDelete.length > 0) {
        // Use the batch delete function if available, otherwise fall back to individual deletes
        if (onDeleteMultiple) {
          onDeleteMultiple(idsToDelete);
        } else {
          onStartTransform?.();
          idsToDelete.forEach((id) => {
            onDeleteElement(id);
          });
        }

        setSelectedIds([]);
      }
    },
    [
      isOverTrash,
      selectedIds,
      onDeleteElement,
      onDeleteMultiple,
      onStartTransform,
      setSelectedIds,
      originalHandleMouseUp,
    ],
  );

  // Global mouse up handler to catch releases outside the SVG (e.g., over trash zone)
  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      const wasDragging = wasDraggingRef.current;
      if (!wasDragging) return;

      const shouldDelete = isOverTrash && selectedIds.length > 0;

      if (shouldDelete) {
        selectedIds.forEach((id) => onDeleteElement(id));
        setSelectedIds([]);
      }

      setIsOverTrash(false);
      wasDraggingRef.current = false;
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isOverTrash, selectedIds, onDeleteElement, setSelectedIds]);

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

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (textInputRef.current && textInput) {
      const textarea = textInputRef.current;
      const activeFontSize = editingTextStyle?.fontSize ?? fontSize;
      const activeLineHeight = editingTextStyle?.lineHeight ?? lineHeight;
      const minHeightPx = activeFontSize * activeLineHeight;
      const measuredContentHeight = measureWrappedTextHeightPx({
        text: textValue, // Use textValue state instead of textarea.value for immediate updates
        width: textInput.width ?? 200,
        fontSize: activeFontSize,
        lineHeight: activeLineHeight,
        fontFamily: editingTextStyle?.fontFamily ?? fontFamily,
        letterSpacing: editingTextStyle?.letterSpacing ?? letterSpacing,
        textAlign: editingTextStyle?.textAlign ?? textAlign,
      });

      // Use exact measured height without buffer to avoid extra space below text
      const newHeight = Math.max(measuredContentHeight, minHeightPx);
      textarea.style.height = `${newHeight}px`;

      // Always update textInput height to match content (both growing and shrinking)
      const currentHeight = textInput.height ?? 0;
      if (Math.abs(currentHeight - newHeight) > 0.5) {
        setTextInput((prev) =>
          prev ? { ...prev, height: newHeight, isTextBox: true } : prev,
        );
      }
      // Always update the actual element's text and height so the selection box and content stay in sync
      if (editingTextElementId) {
        onUpdateElement(editingTextElementId, {
          text: textValue,
          height: newHeight,
        });
      }

      // Update caret position after layout changes.
      if (caretUpdateRafRef.current === null) {
        caretUpdateRafRef.current = requestAnimationFrame(() => {
          caretUpdateRafRef.current = null;
          const textarea = textInputRef.current;
          const mirror = textEditorMirrorRef.current;
          const caret = textEditorCaretRef.current;
          if (!textarea || !mirror || !caret) return;
          if (textarea.selectionStart !== textarea.selectionEnd) {
            caret.style.display = "none";
            return;
          }
          const pos = textarea.selectionStart ?? textarea.value.length;
          mirror.textContent = "";
          mirror.append(document.createTextNode(textarea.value.slice(0, pos)));
          const marker = document.createElement("span");
          marker.textContent = "\u200b";
          mirror.append(marker);
          const mirrorRect = mirror.getBoundingClientRect();
          const markerRect = marker.getBoundingClientRect();
          caret.style.display = "block";
          caret.style.left = `${markerRect.left - mirrorRect.left}px`;
          caret.style.top = `${markerRect.top - mirrorRect.top}px`;
          caret.style.height = `${markerRect.height || activeFontSize}px`;
        });
      }
    }
  }, [
    editingTextStyle,
    fontSize,
    lineHeight,
    textValue,
    textInput,
    editingTextElementId,
    onUpdateElement,
  ]);

  const {
    renderElement,
    renderRemoteSelections,
    renderSelectionBox,
    renderHighlights,
  } = useCanvasRenderers({
    elements,
    selectedIds,
    selectedBounds,
    highlightedElementIds,
    currentHighlightId,
    remoteSelections,
    remotelyEditingTextIds,
    editingTextElementId,
    eraserMarkedIds,
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
    onStartTransform,
    onUpdateElement,
    onDeleteElement,
    setOriginalElements,
    setDraggingConnectorPoint,
    getMousePosition,
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

  // Update parent component when selection changes
  useEffect(() => {
    if (onSelectionChange) {
      const selected = elements.filter((el) => selectedIds.includes(el.id));
      onSelectionChange(selected);
    }
  }, [selectedIds, elements, onSelectionChange]);

  // Ensure selected text boxes never clip their content (e.g. after style changes like letterSpacing).
  useEffect(() => {
    selectedIds.forEach((id) => {
      const el = elements.find((e) => e.id === id);
      if (!el || el.type !== "text" || !el.isTextBox) return;
      if (textInput && editingTextElementId === id) return;
      if (el.width == null || el.height == null) return;

      const fs = el.fontSize ?? el.strokeWidth * 4 + 12;
      const lh = el.lineHeight ?? 1.4;
      const ff = el.fontFamily || "var(--font-inter)";

      const required = Math.max(
        fs * lh,
        measureWrappedTextHeightPx({
          text: el.text || "",
          width: el.width,
          fontSize: fs,
          lineHeight: lh,
          fontFamily: ff,
          letterSpacing: el.letterSpacing ?? 0,
          textAlign: el.textAlign ?? "left",
        }),
      );

      if (required <= el.height + 0.5) return;

      const last = lastEnforcedTextHeightsRef.current.get(id);
      if (last && Math.abs(last - required) <= 0.5) return;
      lastEnforcedTextHeightsRef.current.set(id, required);
      onUpdateElement(id, { height: required });
    });
  }, [editingTextElementId, elements, onUpdateElement, selectedIds, textInput]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-background"
      style={{ cursor: cursorStyle }}
      onMouseDownCapture={(e) => {
        if (!editingTileId) return;
        const target = e.target as Element | null;
        const insideActiveTile = target?.closest?.(
          `[data-tile-id="${editingTileId}"]`,
        );
        if (!insideActiveTile) setEditingTileId(null);
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      {/* Canvas Background */}
      {canvasBackground !== "none" && (
        <div
          className="absolute inset-0 pointer-events-none text-foreground opacity-[0.08] dark:opacity-[0.05]"
          style={{ ...backgroundStyle, zIndex: 0 }}
        />
      )}

      {/* Main SVG Canvas */}
      <svg ref={svgRef} className="w-full h-full" style={{ zIndex: 1 }}>
        <defs>
          <filter id="laser-glow" x="-50%" y="-50%" width="200%" height="200%">
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

          {/* Pattern definitions for pen fill */}
          {/* Criss-cross pattern - diagonal lines both ways with organic spacing */}
          <pattern
            id="fill-pattern-criss-cross"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            {/* Diagonal lines going one way */}
            <line
              x1="0"
              y1="0"
              x2="24"
              y2="24"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.6"
              strokeLinecap="round"
            />
            <line
              x1="-6"
              y1="0"
              x2="18"
              y2="24"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.5"
              strokeLinecap="round"
            />
            <line
              x1="6"
              y1="0"
              x2="30"
              y2="24"
              stroke="currentColor"
              strokeWidth="1.2"
              opacity="0.5"
              strokeLinecap="round"
            />
            <line
              x1="-12"
              y1="0"
              x2="12"
              y2="24"
              stroke="currentColor"
              strokeWidth="0.9"
              opacity="0.4"
              strokeLinecap="round"
            />
            <line
              x1="12"
              y1="0"
              x2="36"
              y2="24"
              stroke="currentColor"
              strokeWidth="0.9"
              opacity="0.4"
              strokeLinecap="round"
            />
            {/* Diagonal lines going the other way */}
            <line
              x1="0"
              y1="24"
              x2="24"
              y2="0"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.6"
              strokeLinecap="round"
            />
            <line
              x1="-6"
              y1="24"
              x2="18"
              y2="0"
              stroke="currentColor"
              strokeWidth="0.9"
              opacity="0.5"
              strokeLinecap="round"
            />
            <line
              x1="6"
              y1="24"
              x2="30"
              y2="0"
              stroke="currentColor"
              strokeWidth="1.1"
              opacity="0.5"
              strokeLinecap="round"
            />
            <line
              x1="-12"
              y1="24"
              x2="12"
              y2="0"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity="0.4"
              strokeLinecap="round"
            />
            <line
              x1="12"
              y1="24"
              x2="36"
              y2="0"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.4"
              strokeLinecap="round"
            />
          </pattern>
        </defs>
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {/* Render all elements sorted by zIndex */}
          {[...elements]
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

          {/* Render box selection rectangle */}
          {isBoxSelecting && selectionBox && (
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
              height={fontSize * lineHeight}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth * 0.5}
              strokeDasharray="4,4"
              opacity={0.5}
              rx={4}
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
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 2 }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {[...elements]
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
                  onUpdate={(updates) => onUpdateElement(el.id, updates)}
                  onDelete={() => onDeleteElement(el.id)}
                />
              </div>
            ))}
        </div>
      </div>

      {/* Canvas Overlay (selection, in-progress drawings, cursors) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 3 }}
      >
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

          {/* Render box selection rectangle */}
          {isBoxSelecting && selectionBox && (
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
              height={fontSize * lineHeight}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth * 0.5}
              strokeDasharray="4,4"
              opacity={0.5}
              rx={4}
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
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <CollaboratorCursors cursors={remoteCursors} pan={pan} zoom={zoom} />
        </div>
      )}

      {/* Text Input */}
      {textInput && (
        <div
          ref={textEditorWrapperRef}
          className="absolute pointer-events-auto"
          style={{
            left: textInput.x * zoom + pan.x,
            top: textInput.y * zoom + pan.y,
            width: textInput.width ?? 200,
            height:
              textInput.height ??
              (editingTextStyle?.fontSize ?? fontSize) *
                (editingTextStyle?.lineHeight ?? lineHeight),
            transform: `scale(${zoom})`,
            transformOrigin: "top left",
            overflow: "visible",
          }}
        >
          <textarea
            ref={textInputRef}
            value={textValue}
            wrap="soft"
            rows={1}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            onChange={(e) => handleTextChange(e.target.value)}
            onSelect={() => {
              if (caretUpdateRafRef.current !== null) return;
              caretUpdateRafRef.current = requestAnimationFrame(() => {
                caretUpdateRafRef.current = null;
                const textarea = textInputRef.current;
                const mirror = textEditorMirrorRef.current;
                const caret = textEditorCaretRef.current;
                if (!textarea || !mirror || !caret) return;
                if (textarea.selectionStart !== textarea.selectionEnd) {
                  caret.style.display = "none";
                  return;
                }
                const pos = textarea.selectionStart ?? textarea.value.length;
                mirror.textContent = "";
                mirror.append(
                  document.createTextNode(textarea.value.slice(0, pos)),
                );
                const marker = document.createElement("span");
                marker.textContent = "\u200b";
                mirror.append(marker);
                const mirrorRect = mirror.getBoundingClientRect();
                const markerRect = marker.getBoundingClientRect();
                caret.style.display = "block";
                caret.style.left = `${markerRect.left - mirrorRect.left}px`;
                caret.style.top = `${markerRect.top - mirrorRect.top}px`;
                caret.style.height = `${markerRect.height || (editingTextStyle?.fontSize ?? fontSize)}px`;
              });
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setTextInput(null);
                setTextValue("");
                setEditingTextElementId(null);
                setEditingTextStyle(null);
              }
            }}
            onBlur={(e) => {
              // Don't close if clicking on sidebar or other UI elements
              const relatedTarget = e.relatedTarget as HTMLElement;
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
                handleTextSubmit();
              } else {
                setTextInput(null);
                setTextValue("");
                setEditingTextElementId(null);
                setEditingTextStyle(null);
              }
            }}
            className="absolute inset-0 bg-transparent outline-none text-foreground resize-none"
            style={{
              width: "100%",
              height: "100%",
              fontSize: editingTextStyle?.fontSize ?? fontSize,
              fontFamily: editingTextStyle?.fontFamily ?? fontFamily,
              letterSpacing: `${editingTextStyle?.letterSpacing ?? letterSpacing}px`,
              color: editingTextStyle?.strokeColor ?? strokeColor,
              lineHeight: (
                editingTextStyle?.lineHeight ?? lineHeight
              ).toString(),
              textAlign: editingTextStyle?.textAlign ?? textAlign,
              padding: 0,
              margin: 0,
              border: 0,
              outline:
                "2px dashed color-mix(in oklab, var(--accent) 60%, transparent)",
              outlineOffset: "0px",
              boxSizing: "content-box",
              overflow: "visible",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
              caretColor: "transparent",
            }}
          />
          <div
            ref={textEditorCaretRef}
            className="shadeworks-text-caret"
            style={{
              position: "absolute",
              width: "2px",
              backgroundColor: "var(--accent)",
              borderRadius: "1px",
              top: 0,
              left: 0,
              display: "none",
            }}
          />
          <div
            ref={textEditorMirrorRef}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              visibility: "hidden",
              pointerEvents: "none",
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              wordBreak: "break-word",
              fontSize: `${editingTextStyle?.fontSize ?? fontSize}px`,
              fontFamily: editingTextStyle?.fontFamily ?? fontFamily,
              letterSpacing: `${editingTextStyle?.letterSpacing ?? letterSpacing}px`,
              lineHeight: (
                editingTextStyle?.lineHeight ?? lineHeight
              ).toString(),
              textAlign: editingTextStyle?.textAlign ?? textAlign,
              padding: 0,
              margin: 0,
              boxSizing: "content-box",
            }}
          />
        </div>
      )}

      {/* Undo/Redo and Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex items-center gap-2 select-none">
        {showUndoRedo && (
          <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border rounded-md p-1.5 shadow-xl">
            <button
              onClick={onUndo}
              className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
              title="Undo (Ctrl+Z)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
            </button>
            <button
              onClick={onRedo}
              className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
              title="Redo (Ctrl+Y)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6 6m6-6l-6-6"
                />
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 bg-card/95 backdrop-blur-md border border-border rounded-md p-1.5 shadow-xl">
          <button
            onClick={() => {
              setZoom((prev) => Math.max(0.1, prev - 0.1));
              onManualViewportChange?.();
            }}
            className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
            title="Zoom Out"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 12H4"
              />
            </svg>
          </button>
          <span className="text-xs font-medium text-foreground min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => {
              setZoom((prev) => Math.min(5, prev + 0.1));
              onManualViewportChange?.();
            }}
            className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
            title="Zoom In"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <div className="w-px h-4 bg-border" />
          <button
            onClick={() => {
              setZoom(1);
              onManualViewportChange?.();
            }}
            className="p-1.5 rounded-sm hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-all text-xs"
            title="Reset Zoom"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Trash Drop Zone */}
      <TrashDropZone
        isVisible={selectedIds.length > 0 && isDragging}
        isHovered={isOverTrash}
        onDrop={() => {
          selectedIds.forEach((id) => onDeleteElement(id));
          setSelectedIds([]);
        }}
        zoom={zoom}
        pan={pan}
      />
    </div>
  );
}
