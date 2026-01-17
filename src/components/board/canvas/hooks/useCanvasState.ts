import { useRef, useState, useMemo } from "react";
import type { BoardElement, Point } from "@/lib/board-types";
import type { EraserTrail } from "@/lib/eraser-trail";
import type {
  RemoteSelection,
  RemoteCursor,
  ResizeHandle,
  RotateHandleSide,
  ConnectorDragKind,
  BoundingBox,
} from "../types";
import type { AlignmentGuide } from "../utils/alignmentGuides";

interface UseCanvasStateProps {
  elements: BoardElement[];
  remoteSelections?: RemoteSelection[];
}

export function useCanvasState({
  elements,
  remoteSelections = [],
}: UseCanvasStateProps) {
  // Compute a set of element IDs that are selected by remote users (locked for editing)
  const remotelySelectedIds = useMemo(() => {
    const ids = new Set<string>();
    remoteSelections.forEach((sel) => {
      sel.elementIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [remoteSelections]);

  // Create a map from element ID to the remote user who selected it
  const remoteSelectionByElementId = useMemo(() => {
    const map = new Map<string, { userName: string; userColor: string }>();
    remoteSelections.forEach((sel) => {
      sel.elementIds.forEach((id) => {
        // First user to select wins (shouldn't happen in practice)
        if (!map.has(id)) {
          map.set(id, {
            userName: sel.userName,
            userColor: sel.userColor,
          });
        }
      });
    });
    return map;
  }, [remoteSelections]);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<BoardElement | null>(
    null,
  );
  const [startPoint, setStartPoint] = useState<Point | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<RemoteCursor[]>([]);
  const [remoteDrawingElements, setRemoteDrawingElements] = useState<
    Array<{ id: string; color: string; element: BoardElement }>
  >([]);
  const remotelyEditingTextIds = useMemo(() => {
    const ids = new Set<string>();
    remoteDrawingElements.forEach(({ element }) => {
      if (element.type === "text") ids.add(element.id);
    });
    return ids;
  }, [remoteDrawingElements]);

  // Transform state (drag, resize, rotate)
  const [isDragging, setIsDragging] = useState(false);
  const [hasDragMoved, setHasDragMoved] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [originalElements, setOriginalElements] = useState<BoardElement[]>([]);
  const [originalBounds, setOriginalBounds] = useState<BoundingBox | null>(
    null,
  );
  const [isRotating, setIsRotating] = useState(false);
  const [rotateStart, setRotateStart] = useState<{
    elementId: string;
    center: Point;
    startPointerAngleRad: number;
    startRotationDeg: number;
  } | null>(null);
  const [rotateHandleSide, setRotateHandleSide] =
    useState<RotateHandleSide>("n");
  const [draggingConnectorPoint, setDraggingConnectorPoint] = useState<{
    index: number;
    kind: ConnectorDragKind;
    axis?: "x" | "y";
    indices?: [number, number];
    range?: [number, number];
    edgeKey?: string;
    anchor?: Point;
  } | null>(null);

  // Viewport state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Text editing state
  const [textInput, setTextInput] = useState<{
    x: number;
    y: number;
    width?: number;
    height?: number;
    isTextBox?: boolean;
  } | null>(null);
  const [textValue, setTextValue] = useState("");
  const [editingTextElementId, setEditingTextElementId] = useState<
    string | null
  >(null);
  const [editingTextStyle, setEditingTextStyle] = useState<{
    strokeColor: string;
    strokeWidth: number;
    opacity: number;
    fontFamily: string;
    textAlign: "left" | "center" | "right";
    fontSize: number;
    letterSpacing: number;
    lineHeight: number;
  } | null>(null);
  // Track when editing text inside a shape (rectangle, diamond, ellipse)
  const [editingShapeTextId, setEditingShapeTextId] = useState<string | null>(
    null,
  );

  // Eraser state
  const [eraserMarkedIds, setEraserMarkedIds] = useState<Set<string>>(
    new Set(),
  );
  const [eraserCursorPos, setEraserCursorPos] = useState<Point | null>(null);

  // Laser pointer state
  const [laserCursorPos, setLaserCursorPos] = useState<Point | null>(null);

  // Connection snapping state
  const [snapTarget, setSnapTarget] = useState<{
    elementId: string;
    point: Point;
    position: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
    outOfLineOfSight?: boolean;
  } | null>(null);
  // Track snap targets for start and end points during arrow creation
  const [startSnapTarget, setStartSnapTarget] = useState<{
    elementId: string;
    point: Point;
    position: "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
  } | null>(null);

  // Alignment guides state (for smart guides during drag)
  const [alignmentGuides, setAlignmentGuides] = useState<AlignmentGuide[]>([]);

  // UI state
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);
  const [lastMousePos, setLastMousePos] = useState<Point>({ x: 0, y: 0 });
  const [isBoxSelecting, setIsBoxSelecting] = useState(false);
  const [selectionBox, setSelectionBox] = useState<BoundingBox | null>(null);
  const [isLassoSelecting, setIsLassoSelecting] = useState(false);
  const [lassoPoints, setLassoPoints] = useState<Point[]>([]);
  const [editingFrameLabelId, setEditingFrameLabelId] = useState<string | null>(
    null,
  );
  const [frameLabelValue, setFrameLabelValue] = useState("");
  const [inputHint, setInputHint] = useState<"mouse" | "trackpad">("mouse");
  const [shiftPressed, setShiftPressed] = useState(false);

  // Arrow handle hover state for preview feature
  const [arrowHandleHover, setArrowHandleHover] = useState<{
    elementId: string;
    position: "n" | "e" | "s" | "w";
    showPreview: boolean;
  } | null>(null);
  const arrowHandleHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for DOM elements
  const nameTagWidthCacheRef = useRef<Map<string, number>>(new Map());
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const eraserTrailPathRef = useRef<SVGPathElement>(null);
  const eraserTrailRef = useRef<EraserTrail | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const textEditorWrapperRef = useRef<HTMLDivElement>(null);
  const textSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastEnforcedTextHeightsRef = useRef<Map<string, number>>(new Map());
  const lastSingleSelectedIdRef = useRef<string | null>(null);

  // Refs for internal state
  const expiredLaserIdsRef = useRef<Set<string>>(new Set());
  const elementsRef = useRef(elements);
  const pendingCursorPosRef = useRef<Point | null>(null);
  const cursorBroadcastRafRef = useRef<number | null>(null);
  const pendingDrawingElementRef = useRef<BoardElement | null>(null);
  const drawingElementBroadcastRafRef = useRef<number | null>(null);

  return {
    drawing: {
      isDrawing,
      setIsDrawing,
      currentElement,
      setCurrentElement,
      startPoint,
      setStartPoint,
    },
    selection: {
      selectedIds,
      setSelectedIds,
      remoteCursors,
      setRemoteCursors,
      remoteDrawingElements,
      setRemoteDrawingElements,
      remotelyEditingTextIds,
      remotelySelectedIds,
      remoteSelectionByElementId,
    },
    transform: {
      isDragging,
      setIsDragging,
      hasDragMoved,
      setHasDragMoved,
      isResizing,
      setIsResizing,
      isRotating,
      setIsRotating,
      dragStart,
      setDragStart,
      resizeHandle,
      setResizeHandle,
      originalElements,
      setOriginalElements,
      originalBounds,
      setOriginalBounds,
      rotateStart,
      setRotateStart,
      rotateHandleSide,
      setRotateHandleSide,
      draggingConnectorPoint,
      setDraggingConnectorPoint,
    },
    viewport: {
      pan,
      setPan,
      zoom,
      setZoom,
      isPanning,
      setIsPanning,
      panStart,
      setPanStart,
    },
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
    laser: {
      laserCursorPos,
      setLaserCursorPos,
    },
    snapping: {
      snapTarget,
      setSnapTarget,
      startSnapTarget,
      setStartSnapTarget,
      alignmentGuides,
      setAlignmentGuides,
    },
    ui: {
      hoverCursor,
      setHoverCursor,
      lastMousePos,
      setLastMousePos,
      isBoxSelecting,
      setIsBoxSelecting,
      selectionBox,
      setSelectionBox,
      isLassoSelecting,
      setIsLassoSelecting,
      lassoPoints,
      setLassoPoints,
      editingFrameLabelId,
      setEditingFrameLabelId,
      frameLabelValue,
      setFrameLabelValue,
      inputHint,
      setInputHint,
      shiftPressed,
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
      textSaveTimeoutRef,
      lastEnforcedTextHeightsRef,
      lastSingleSelectedIdRef,
      expiredLaserIdsRef,
      elementsRef,
      pendingCursorPosRef,
      cursorBroadcastRafRef,
      pendingDrawingElementRef,
      drawingElementBroadcastRafRef,
      arrowHandleHoverTimerRef,
    },
  };
}

export type CanvasState = ReturnType<typeof useCanvasState>;
