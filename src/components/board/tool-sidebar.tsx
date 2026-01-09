"use client";

import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
} from "react";
import { useTheme } from "next-themes";
import {
    ChevronLeft,
    ChevronRight,
    Circle,
    Minus,
    Square,
    Type,
    Pencil,
    Highlighter,
    ArrowUpToLine,
    ArrowDownToLine,
    X,
    AlignLeft,
    AlignCenter,
    AlignRight,
    ArrowRight,
    Copy,
    Trash2,
    Group,
    Ungroup,
    AlignHorizontalJustifyStart,
    AlignHorizontalJustifyCenter,
    AlignHorizontalJustifyEnd,
    AlignVerticalJustifyStart,
    AlignVerticalJustifyCenter,
    AlignVerticalJustifyEnd,
    MoreHorizontal,
    SlidersHorizontal,
    Spline,
    Lock,
    Unlock,
} from "lucide-react";
import {
    Tool,
    COLORS,
    STROKE_WIDTHS,
    HIGHLIGHTER_STROKE_WIDTHS,
    FONTS,
    FONT_SIZES,
    BoardElement,
    FrameStyle,
} from "@/lib/board-types";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/components/ui/color-picker";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ToolSidebarProps {
    selectedTool: Tool;
    strokeColor: string;
    onStrokeColorChange: (color: string) => void;
    strokeWidth: number;
    onStrokeWidthChange: (width: number) => void;
    fillColor?: string;
    onFillColorChange?: (color: string) => void;
    strokeStyle: "solid" | "dashed" | "dotted";
    onStrokeStyleChange: (style: "solid" | "dashed" | "dotted") => void;
    cornerRadius: number;
    onCornerRadiusChange: (radius: number) => void;
    connectorStyle?: "sharp" | "curved" | "elbow";
    onConnectorStyleChange?: (style: "sharp" | "curved" | "elbow") => void;
    arrowStart?: NonNullable<BoardElement["arrowStart"]>;
    onArrowStartChange?: (end: NonNullable<BoardElement["arrowStart"]>) => void;
    arrowEnd?: NonNullable<BoardElement["arrowEnd"]>;
    onArrowEndChange?: (end: NonNullable<BoardElement["arrowEnd"]>) => void;
    fontFamily: string;
    onFontFamilyChange: (font: string) => void;
    textAlign: "left" | "center" | "right";
    onTextAlignChange: (align: "left" | "center" | "right") => void;
    fontSize: number;
    onFontSizeChange: (size: number) => void;
    letterSpacing: number;
    onLetterSpacingChange: (spacing: number) => void;
    lineHeight: number;
    onLineHeightChange: (height: number) => void;
    fillPattern?: "none" | "solid";
    onFillPatternChange?: (pattern: "none" | "solid") => void;
    frameStyle: FrameStyle;
    onFrameStyleChange?: (style: FrameStyle) => void;
    lineCap?: "butt" | "round";
    onLineCapChange?: (cap: "butt" | "round") => void;
    selectedElements?: BoardElement[];
    currentTool?: Tool;
    onBringToFront?: () => void;
    onSendToBack?: () => void;
    onMoveForward?: () => void;
    onMoveBackward?: () => void;
    onAlignLeft?: () => void;
    onAlignCenterHorizontal?: () => void;
    onAlignRight?: () => void;
    onAlignTop?: () => void;
    onAlignCenterVertical?: () => void;
    onAlignBottom?: () => void;
    onCopySelected?: () => void;
    onDeleteSelected?: () => void;
    onToggleGroupSelection?: () => void;
    onToggleLockSelected?: () => void;
    isEditArrowMode?: boolean;
    onToggleEditArrowMode?: () => void;
    rightOffset?: number;
    isSelectionLocked?: boolean;
}

// Tools that have adjustable properties
const ADJUSTABLE_TOOLS: Tool[] = [
    "pen",
    "highlighter",
    "line",
    "arrow",
    "rectangle",
    "diamond",
    "ellipse",
    "text",
];

const SIDEBAR_HIDDEN_COLORS = new Set(["#a78bfa", "#c084fc", "#e879f9"]);
const HIGHLIGHT_COLORS = [
    "#fde047",
    "#fbbf24",
    "#fdba74",
    "#86efac",
    "#93c5fd",
    "#f9a8d4",
];
const FRAME_STYLE_OPTIONS: Array<{ id: FrameStyle; label: string }> = [
    { id: "minimal", label: "Minimal" },
    { id: "cutting-mat", label: "Cutting Mat" },
    { id: "notebook", label: "Notebook" },
];

const CONTROL_BUTTON =
    "rounded-md border border-input bg-background/50 shadow-xs transition-all duration-200 hover:bg-muted/60 hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";
const CONTROL_BUTTON_SELECTED = "bg-muted/70 border-foreground/20 shadow-sm";
const SWATCH_BASE =
    "w-6 h-6 rounded-md border border-input/50 transition-all duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function ToolSidebar({
    selectedTool,
    strokeColor,
    onStrokeColorChange,
    strokeWidth,
    onStrokeWidthChange,
    fillColor = "transparent",
    onFillColorChange,
    strokeStyle,
    onStrokeStyleChange,
    cornerRadius,
    onCornerRadiusChange,
    connectorStyle = "sharp",
    onConnectorStyleChange,
    arrowStart = "arrow",
    onArrowStartChange,
    arrowEnd = "arrow",
    onArrowEndChange,
    fontFamily,
    onFontFamilyChange,
    textAlign,
    onTextAlignChange,
    fontSize,
    onFontSizeChange,
    letterSpacing,
    onLetterSpacingChange,
    lineHeight,
    onLineHeightChange,
    fillPattern = "none",
    onFillPatternChange,
    frameStyle = "minimal",
    onFrameStyleChange,
    lineCap = "round",
    onLineCapChange,
    selectedElements = [],
    currentTool,
    onBringToFront,
    onSendToBack,
    onMoveForward,
    onMoveBackward,
    onAlignLeft,
    onAlignCenterHorizontal,
    onAlignRight,
    onAlignTop,
    onAlignCenterVertical,
    onAlignBottom,
    onCopySelected,
    onDeleteSelected,
    onToggleGroupSelection,
    onToggleLockSelected,
    isEditArrowMode = false,
    onToggleEditArrowMode,
    rightOffset = 0,
    isSelectionLocked = false,
}: ToolSidebarProps) {
    const { theme, resolvedTheme } = useTheme();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isCondensed, setIsCondensed] = useState(false);
    const [showStrokeColorPicker, setShowStrokeColorPicker] = useState(false);
    const [showFillColorPicker, setShowFillColorPicker] = useState(false);
    const [openArrowEndMenu, setOpenArrowEndMenu] = useState<
        "start" | "end" | null
    >(null);
    const [arrowEndMenuPos, setArrowEndMenuPos] = useState<{
        left: number;
        top: number;
    } | null>(null);
    const [openStrokeMenu, setOpenStrokeMenu] = useState(false);
    const [openFillMenu, setOpenFillMenu] = useState(false);
    const [openOptionsMenu, setOpenOptionsMenu] = useState(false);
    const [openMoreMenu, setOpenMoreMenu] = useState(false);
    const arrowStartButtonRef = useRef<HTMLButtonElement | null>(null);
    const arrowEndButtonRef = useRef<HTMLButtonElement | null>(null);
    const arrowEndMenuRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const update = () => {
            // Condense earlier so the sidebar stays usable in smaller windows.
            setIsCondensed(
                window.innerHeight < 920 || window.innerWidth < 1100,
            );
        };
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    useEffect(() => {
        if (!openArrowEndMenu) return;

        const handlePointerDownCapture = (e: PointerEvent) => {
            const target = e.target as Node | null;
            if (!target) return;

            const menuEl = arrowEndMenuRef.current;
            if (menuEl?.contains(target)) return;

            const startTrigger = arrowStartButtonRef.current;
            if (startTrigger?.contains(target)) return;

            const endTrigger = arrowEndButtonRef.current;
            if (endTrigger?.contains(target)) return;

            setOpenArrowEndMenu(null);
        };

        window.addEventListener("pointerdown", handlePointerDownCapture, {
            capture: true,
        });
        return () => {
            window.removeEventListener(
                "pointerdown",
                handlePointerDownCapture,
                {
                    capture: true,
                },
            );
        };
    }, [openArrowEndMenu]);

    const arrowEndOptions = useMemo(
        () =>
            [
                { id: "none", label: "None" },
                { id: "arrow", label: "Arrow" },
                { id: "triangle", label: "Triangle" },
                { id: "triangle-outline", label: "Triangle Outline" },
                { id: "diamond", label: "Diamond" },
                { id: "diamond-outline", label: "Diamond Outline" },
                { id: "circle", label: "Circle" },
                { id: "circle-outline", label: "Circle Outline" },
                { id: "bar", label: "Bar" },
            ] as Array<{
                id: NonNullable<BoardElement["arrowEnd"]>;
                label: string;
            }>,
        [],
    );

    const renderArrowEndPreview = (
        endType: NonNullable<BoardElement["arrowEnd"]>,
    ) => {
        const stroke = "currentColor";
        const sw = 1.8;
        const cx = 18;
        const cy = 10;

        switch (endType) {
            case "none":
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="23"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                    </svg>
                );
            case "arrow":
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="20"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                        <line
                            x1="20"
                            y1={cy}
                            x2="14.5"
                            y2="6.5"
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                        <line
                            x1="20"
                            y1={cy}
                            x2="14.5"
                            y2="13.5"
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                    </svg>
                );
            case "triangle":
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="13"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                        <polygon points="13,5 23,10 13,15" fill={stroke} />
                    </svg>
                );
            case "triangle-outline":
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="13"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                        <polygon
                            points="13,5 23,10 13,15"
                            fill="none"
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinejoin="round"
                        />
                    </svg>
                );
            case "diamond":
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="12.5"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                        <polygon
                            points="12.5,10 17.5,5 22.5,10 17.5,15"
                            fill={stroke}
                        />
                    </svg>
                );
            case "diamond-outline":
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="12.5"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                        <polygon
                            points="12.5,10 17.5,5 22.5,10 17.5,15"
                            fill="none"
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinejoin="round"
                        />
                    </svg>
                );
            case "circle":
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="13"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                        <circle cx={cx} cy={cy} r="4.2" fill={stroke} />
                    </svg>
                );
            case "circle-outline":
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="13"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                        <circle
                            cx={cx}
                            cy={cy}
                            r="4.2"
                            fill="none"
                            stroke={stroke}
                            strokeWidth={sw}
                        />
                    </svg>
                );
            case "bar":
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="16"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                        <line
                            x1={cx}
                            y1="4.5"
                            x2={cx}
                            y2="15.5"
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                    </svg>
                );
            default:
                return (
                    <svg
                        width="28"
                        height="20"
                        viewBox="0 0 28 20"
                        className="text-foreground"
                    >
                        <line
                            x1="3"
                            y1={cy}
                            x2="23"
                            y2={cy}
                            stroke={stroke}
                            strokeWidth={sw}
                            strokeLinecap="round"
                        />
                    </svg>
                );
        }
    };

    const openArrowMenu = (which: "start" | "end") => {
        const ref = which === "start" ? arrowStartButtonRef : arrowEndButtonRef;
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) {
            setOpenArrowEndMenu(which);
            return;
        }

        const menuWidth = 260;
        const padding = 8;
        const left = Math.min(
            Math.max(padding, rect.right - menuWidth),
            window.innerWidth - menuWidth - padding,
        );
        const top = Math.min(
            Math.max(padding, rect.bottom + 8),
            window.innerHeight - padding,
        );

        setArrowEndMenuPos({ left, top });
        setOpenArrowEndMenu(which);
    };

    // Don't show sidebar for non-adjustable tools
    if (
        !ADJUSTABLE_TOOLS.includes(selectedTool) &&
        selectedElements.length === 0
    ) {
        return null;
    }

    const hasSelectedElements = selectedElements.length > 0;
    const selectionGroupId = selectedElements[0]?.groupId;
    const isSelectionSingleGroup =
        !!selectionGroupId &&
        selectedElements.every((el) => el.groupId === selectionGroupId);
    const showAlign =
        hasSelectedElements &&
        selectedElements.length > 1 &&
        !!onAlignLeft &&
        !!onAlignCenterHorizontal &&
        !!onAlignRight &&
        !!onAlignTop &&
        !!onAlignCenterVertical &&
        !!onAlignBottom;
    const showActions =
        hasSelectedElements &&
        currentTool === "select" &&
        (!!onCopySelected || !!onDeleteSelected || !!onToggleGroupSelection);
    const canEditArrow =
        selectedElements.length === 1 &&
        (selectedElements[0].type === "line" ||
            selectedElements[0].type === "arrow") &&
        (selectedElements[0].points?.length ?? 0) >= 3 &&
        !!onToggleEditArrowMode;
    const showGroupAction =
        hasSelectedElements &&
        !!onToggleGroupSelection &&
        (selectedElements.length > 1 || isSelectionSingleGroup);
    const showLayerOrderActions =
        hasSelectedElements &&
        !!onBringToFront &&
        !!onSendToBack &&
        !!onMoveForward &&
        !!onMoveBackward;
    const showMoreMenu = showLayerOrderActions || showAlign || showGroupAction;

    // Reorder colors based on theme: black first in light mode, white first in dark mode
    const currentTheme = resolvedTheme || theme;
    const orderedColors =
        currentTheme === "light"
            ? COLORS
            : [COLORS[1], COLORS[0], ...COLORS.slice(2)];
    const sidebarColors = orderedColors.filter(
        (color) => !SIDEBAR_HIDDEN_COLORS.has(color),
    );
    const isHighlighterElement = (el: BoardElement) =>
        el.type === "pen" && el.penMode === "highlighter";
    const useHighlightPalette =
        selectedTool === "highlighter" ||
        (hasSelectedElements && selectedElements.every(isHighlighterElement));
    const paletteColors = useHighlightPalette
        ? HIGHLIGHT_COLORS
        : sidebarColors;

    // Determine what controls to show based on selected elements or current tool
    const showFill = hasSelectedElements
        ? selectedElements.some(
              (el) =>
                  el.type === "rectangle" ||
                  el.type === "diamond" ||
                  el.type === "ellipse" ||
                  el.type === "frame" ||
                  (el.type === "pen" && el.isClosed && fillPattern !== "none"),
          )
        : selectedTool === "rectangle" ||
          selectedTool === "diamond" ||
          selectedTool === "ellipse" ||
          ((selectedTool === "pen" || selectedTool === "highlighter") &&
              fillPattern !== "none");

    const showFillPatternControls = hasSelectedElements
        ? selectedElements.some((el) => el.type === "pen")
        : selectedTool === "pen" || selectedTool === "highlighter";

    const showCornerRadius = hasSelectedElements
        ? selectedElements.some(
              (el) =>
                  el.type === "rectangle" ||
                  el.type === "diamond" ||
                  el.type === "frame",
          )
        : selectedTool === "rectangle" || selectedTool === "diamond";

    const isTextTool = hasSelectedElements
        ? selectedElements.some((el) => el.type === "text")
        : selectedTool === "text";

    const isFrameOnlySelection =
        hasSelectedElements &&
        selectedElements.every((el) => el.type === "frame");
    const isFrameToolActive = !hasSelectedElements && selectedTool === "frame";
    const selectedFrameStyles = selectedElements
        .filter((el) => el.type === "frame")
        .map((el) => el.frameStyle ?? "minimal");
    const hasFrameSelection = selectedFrameStyles.length > 0;
    const uniformFrameStyle =
        selectedFrameStyles.length > 0 &&
        selectedFrameStyles.every((style) => style === selectedFrameStyles[0])
            ? selectedFrameStyles[0]
            : frameStyle;
    const showFrameStyleControls = isFrameToolActive || hasFrameSelection;
    const showStrokeWidthAndStyle =
        !isTextTool && !isFrameOnlySelection && !isFrameToolActive;
    const showLineCapControls = hasSelectedElements
        ? selectedElements.some(
              (el) => el.type === "line" || el.type === "arrow",
          )
        : selectedTool === "line" || selectedTool === "arrow";

    const showConnectorControls = hasSelectedElements
        ? selectedElements.some(
              (el) => el.type === "line" || el.type === "arrow",
          )
        : selectedTool === "line" || selectedTool === "arrow";

    const showArrowControls = hasSelectedElements
        ? selectedElements.some((el) => el.type === "arrow")
        : selectedTool === "arrow";

    const swatchStyle = (color: string): CSSProperties => {
        if (color === "transparent") {
            return {
                backgroundImage:
                    "linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%, hsl(var(--muted))), linear-gradient(45deg, hsl(var(--muted)) 25%, transparent 25%, transparent 75%, hsl(var(--muted)) 75%, hsl(var(--muted)))",
                backgroundSize: "10px 10px",
                backgroundPosition: "0 0, 5px 5px",
            };
        }
        return { backgroundColor: color };
    };

    const iconButton = cn(
        CONTROL_BUTTON,
        // Match toolbar tool button corners/sizing.
        "h-8 w-8 p-0 flex items-center justify-center rounded-sm bg-background/70 hover:bg-muted/60",
    );

    const optionsControls = (
        <>
            {isTextTool && (
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Font
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                        {FONTS.map((font) => (
                            <Button
                                key={font.value}
                                onClick={() => onFontFamilyChange(font.value)}
                                className={cn(
                                    "h-8 w-full justify-center px-2 text-xs",
                                    CONTROL_BUTTON,
                                    fontFamily === font.value
                                        ? CONTROL_BUTTON_SELECTED
                                        : undefined,
                                )}
                                variant="outline"
                                size="sm"
                                style={{ fontFamily: font.value }}
                            >
                                {font.name}
                            </Button>
                        ))}
                    </div>
                </div>
            )}

            {isTextTool && (
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Size &amp; Align
                    </label>
                    <div className="flex gap-1">
                        <Select
                            value={fontSize.toString()}
                            onValueChange={(value) =>
                                onFontSizeChange(Number(value))
                            }
                        >
                            <SelectTrigger className="flex-1 h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {FONT_SIZES.map((size) => (
                                    <SelectItem
                                        key={size}
                                        value={size.toString()}
                                    >
                                        {size}px
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <ToggleGroup
                            type="single"
                            value={textAlign}
                            onValueChange={(value) => {
                                if (!value) return;
                                onTextAlignChange(
                                    value as "left" | "center" | "right",
                                );
                            }}
                            variant="outline"
                            size="sm"
                            className="gap-1"
                        >
                            <ToggleGroupItem
                                value="left"
                                aria-label="Align left"
                                className={cn(
                                    CONTROL_BUTTON,
                                    "h-8 w-8 p-0 data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                                )}
                            >
                                <AlignLeft className="w-3.5 h-3.5" />
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="center"
                                aria-label="Align center"
                                className={cn(
                                    CONTROL_BUTTON,
                                    "h-8 w-8 p-0 data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                                )}
                            >
                                <AlignCenter className="w-3.5 h-3.5" />
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="right"
                                aria-label="Align right"
                                className={cn(
                                    CONTROL_BUTTON,
                                    "h-8 w-8 p-0 data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                                )}
                            >
                                <AlignRight className="w-3.5 h-3.5" />
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                </div>
            )}

            {isTextTool && (
                <div className="space-y-3">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Spacing
                    </label>
                    <div className="space-y-3">
                        <Slider
                            label="Letter"
                            showValue
                            unit="px"
                            value={[letterSpacing]}
                            onValueChange={([v]) => onLetterSpacingChange(v)}
                            min={-2}
                            max={10}
                            step={0.5}
                        />
                        <Slider
                            label="Line"
                            showValue
                            value={[lineHeight]}
                            onValueChange={([v]) => onLineHeightChange(v)}
                            min={1}
                            max={3}
                            step={0.1}
                        />
                    </div>
                </div>
            )}

            {showFrameStyleControls && onFrameStyleChange && (
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Frame Style
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                        {FRAME_STYLE_OPTIONS.map((styleOption) => {
                            const isActive =
                                uniformFrameStyle === styleOption.id;
                            return (
                                <button
                                    key={styleOption.id}
                                    type="button"
                                    onClick={() =>
                                        onFrameStyleChange(styleOption.id)
                                    }
                                    className={cn(
                                        CONTROL_BUTTON,
                                        "h-auto py-2 px-1 flex flex-col items-center gap-1",
                                        isActive
                                            ? CONTROL_BUTTON_SELECTED
                                            : undefined,
                                    )}
                                    title={styleOption.label}
                                    aria-pressed={isActive}
                                >
                                    <div
                                        className={cn(
                                            "relative h-8 w-full rounded-sm border border-border/60 overflow-hidden",
                                            isActive
                                                ? "border-foreground/30"
                                                : "border-border/60",
                                        )}
                                    >
                                        {styleOption.id === "minimal" && (
                                            <div className="absolute inset-0 bg-background" />
                                        )}
                                        {styleOption.id === "cutting-mat" && (
                                            <div
                                                className="absolute inset-0"
                                                style={{
                                                    backgroundColor:
                                                        "#2d6f5e",
                                                    backgroundImage:
                                                        "linear-gradient(to right, rgba(92, 184, 159, 0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(92, 184, 159, 0.5) 1px, transparent 1px)",
                                                    backgroundSize: "6px 6px",
                                                }}
                                            />
                                        )}
                                        {styleOption.id === "notebook" && (
                                            <div className="absolute inset-0 bg-[#f5f0e5]">
                                                <div className="absolute left-0 top-0 bottom-0 w-2 bg-[#1e5a5a]" />
                                                <div className="absolute right-0 top-2 w-3 h-4 bg-[#e8dcc8]" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                        {styleOption.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {showStrokeWidthAndStyle && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Stroke Width
                        </label>
                        <span className="text-xs text-muted-foreground tabular-nums">
                            {strokeWidth}px
                        </span>
                    </div>
                    <ToggleGroup
                        type="single"
                        value={strokeWidth.toString()}
                        onValueChange={(value) => {
                            if (!value) return;
                            onStrokeWidthChange(Number(value));
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full justify-between gap-2"
                    >
                        {(useHighlightPalette
                            ? HIGHLIGHTER_STROKE_WIDTHS
                            : STROKE_WIDTHS
                        ).map((width) => (
                            <ToggleGroupItem
                                key={width}
                                value={width.toString()}
                                aria-label={`Stroke width ${width}px`}
                                className={cn(
                                    "flex-1 aspect-square min-w-0 px-0",
                                    CONTROL_BUTTON,
                                    "data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                                )}
                            >
                                <div className="flex flex-col items-center justify-center gap-1 w-full">
                                    <div
                                        className="w-[70%] bg-foreground/90 rounded-full"
                                        style={{
                                            height: useHighlightPalette
                                                ? Math.min(width / 2, 16)
                                                : width,
                                        }}
                                    />
                                </div>
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
            )}

            {showStrokeWidthAndStyle &&
                showLineCapControls &&
                onLineCapChange && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Line Cap
                            </label>
                            <span className="text-xs text-muted-foreground capitalize">
                                {lineCap}
                            </span>
                        </div>
                        <ToggleGroup
                            type="single"
                            value={lineCap}
                            onValueChange={(value) => {
                                if (!value) return;
                                onLineCapChange(value as "butt" | "round");
                            }}
                            variant="outline"
                            size="sm"
                            className="w-full justify-between gap-2"
                        >
                            <ToggleGroupItem
                                value="butt"
                                aria-label="Butt line cap"
                                className={cn(
                                    "flex-1 h-9 min-w-0 px-0",
                                    CONTROL_BUTTON,
                                    "data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                                )}
                                title="Butt (flat)"
                            >
                                <svg
                                    width="28"
                                    height="20"
                                    viewBox="0 0 28 20"
                                    className="text-foreground"
                                >
                                    <line
                                        x1="4"
                                        y1="10"
                                        x2="24"
                                        y2="10"
                                        stroke="currentColor"
                                        strokeWidth="6"
                                        strokeLinecap="butt"
                                    />
                                </svg>
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="round"
                                aria-label="Round line cap"
                                className={cn(
                                    "flex-1 h-9 min-w-0 px-0",
                                    CONTROL_BUTTON,
                                    "data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                                )}
                                title="Round"
                            >
                                <svg
                                    width="28"
                                    height="20"
                                    viewBox="0 0 28 20"
                                    className="text-foreground"
                                >
                                    <line
                                        x1="4"
                                        y1="10"
                                        x2="24"
                                        y2="10"
                                        stroke="currentColor"
                                        strokeWidth="6"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </ToggleGroupItem>
                        </ToggleGroup>
                    </div>
                )}

            {showConnectorControls && onConnectorStyleChange && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Corner
                        </label>
                        <span className="text-xs text-muted-foreground capitalize">
                            {connectorStyle}
                        </span>
                    </div>
                    <ToggleGroup
                        type="single"
                        value={connectorStyle}
                        onValueChange={(value) => {
                            if (!value) return;
                            onConnectorStyleChange(
                                value as "sharp" | "curved" | "elbow",
                            );
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full justify-between gap-2"
                    >
                        <ToggleGroupItem
                            value="sharp"
                            aria-label="Sharp corner"
                            className={cn(
                                "flex-1 h-10 min-w-0 px-0",
                                CONTROL_BUTTON,
                                "data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                            )}
                            title="Sharp corner"
                        >
                            <svg
                                width="24"
                                height="16"
                                viewBox="0 0 24 16"
                                className="text-foreground"
                            >
                                <polyline
                                    points="2,14 10,6 22,2"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="curved"
                            aria-label="Curved"
                            className={cn(
                                "flex-1 h-10 min-w-0 px-0",
                                CONTROL_BUTTON,
                                "data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                            )}
                            title="Curved"
                        >
                            <svg
                                width="24"
                                height="16"
                                viewBox="0 0 24 16"
                                className="text-foreground"
                            >
                                <path
                                    d="M 2 14 Q 10 4 22 2"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                />
                            </svg>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="elbow"
                            aria-label="Elbow"
                            className={cn(
                                "flex-1 h-10 min-w-0 px-0",
                                CONTROL_BUTTON,
                                "data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                            )}
                            title="Elbow"
                        >
                            <svg
                                width="24"
                                height="16"
                                viewBox="0 0 24 16"
                                className="text-foreground"
                            >
                                <polyline
                                    points="2,14 14,14 14,2 22,2"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            )}

            {showArrowControls && onArrowStartChange && onArrowEndChange && (
                <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Arrow Ends
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1 relative">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                Start
                            </div>
                            <button
                                type="button"
                                ref={arrowStartButtonRef}
                                onClick={() => {
                                    if (openArrowEndMenu === "start") {
                                        setOpenArrowEndMenu(null);
                                        return;
                                    }
                                    openArrowMenu("start");
                                }}
                                className={cn(
                                    CONTROL_BUTTON,
                                    "h-10 w-full flex items-center justify-center",
                                    openArrowEndMenu === "start"
                                        ? CONTROL_BUTTON_SELECTED
                                        : undefined,
                                )}
                                title="Start marker"
                            >
                                {renderArrowEndPreview(arrowStart)}
                            </button>
                        </div>

                        <div className="space-y-1 relative">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                End
                            </div>
                            <button
                                type="button"
                                ref={arrowEndButtonRef}
                                onClick={() => {
                                    if (openArrowEndMenu === "end") {
                                        setOpenArrowEndMenu(null);
                                        return;
                                    }
                                    openArrowMenu("end");
                                }}
                                className={cn(
                                    CONTROL_BUTTON,
                                    "h-10 w-full flex items-center justify-center",
                                    openArrowEndMenu === "end"
                                        ? CONTROL_BUTTON_SELECTED
                                        : undefined,
                                )}
                                title="End marker"
                            >
                                {renderArrowEndPreview(arrowEnd)}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showFillPatternControls && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Fill Pattern
                        </label>
                        <span className="text-xs text-muted-foreground capitalize">
                            {fillPattern}
                        </span>
                    </div>
                    <ToggleGroup
                        type="single"
                        value={fillPattern}
                        onValueChange={(value) => {
                            if (!value) return;
                            onFillPatternChange?.(value as "none" | "solid");
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full justify-between gap-2"
                    >
                        <ToggleGroupItem
                            value="none"
                            aria-label="No fill pattern"
                            className={cn(
                                "flex-1 h-9 min-w-0 px-0",
                                CONTROL_BUTTON,
                                "data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                            )}
                        >
                            <span className="text-xs">None</span>
                        </ToggleGroupItem>
                        <ToggleGroupItem
                            value="solid"
                            aria-label="Solid fill pattern"
                            className={cn(
                                "flex-1 h-9 min-w-0 px-0",
                                CONTROL_BUTTON,
                                "data-[state=on]:bg-muted/70 data-[state=on]:border-foreground/20 data-[state=on]:shadow-sm",
                            )}
                        >
                            <div className="w-6 h-6 rounded-sm bg-foreground/30" />
                        </ToggleGroupItem>
                    </ToggleGroup>
                </div>
            )}

            {showCornerRadius && (
                <div className="space-y-2">
                    <Slider
                        label="Corner Radius"
                        showValue
                        unit="px"
                        value={[cornerRadius]}
                        onValueChange={([v]) => onCornerRadiusChange(v)}
                        min={0}
                        max={50}
                        step={1}
                    />
                </div>
            )}
        </>
    );

    const condensedSidebar = (
        <div
            className="fixed top-1/2 -translate-y-1/2 z-[110] select-none transition-all duration-300"
            style={{ right: `${16 + rightOffset}px` }}
        >
            <div className="bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md shadow-2xl py-2 px-1.5 flex flex-col items-center gap-2 max-h-[calc(100vh-160px)] overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                <DropdownMenu
                    open={openStrokeMenu}
                    onOpenChange={setOpenStrokeMenu}
                >
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={iconButton}
                            title="Stroke color"
                            style={swatchStyle(strokeColor)}
                        />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        side="left"
                        align="center"
                        className="w-56 p-3"
                    >
                        <DropdownMenuLabel>Stroke</DropdownMenuLabel>
                        <div className="mt-2 grid grid-cols-7 gap-1">
                            {paletteColors.map((color) => (
                                <button
                                    key={`stroke-${color}`}
                                    type="button"
                                    onClick={() => {
                                        onStrokeColorChange(color);
                                        setOpenStrokeMenu(false);
                                    }}
                                    className={cn(
                                        "h-6 w-6 rounded-md border border-input transition-transform hover:scale-110",
                                        strokeColor === color
                                            ? "scale-105"
                                            : undefined,
                                    )}
                                    style={{ backgroundColor: color }}
                                    title={color}
                                />
                            ))}
                            <button
                                type="button"
                                onClick={() => {
                                    setShowStrokeColorPicker(true);
                                    setOpenStrokeMenu(false);
                                }}
                                className="h-6 w-6 rounded-md border border-input overflow-hidden"
                                title="Custom color"
                            >
                                <div
                                    className="w-full h-full"
                                    style={{
                                        background:
                                            "linear-gradient(135deg, #ff0000 0%, #ff7f00 14%, #ffff00 28%, #00ff00 42%, #0000ff 57%, #4b0082 71%, #9400d3 85%, #ff0000 100%)",
                                    }}
                                />
                            </button>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                {showFill && onFillColorChange && (
                    <DropdownMenu
                        open={openFillMenu}
                        onOpenChange={setOpenFillMenu}
                    >
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className={iconButton}
                                title="Fill color"
                                style={swatchStyle(fillColor)}
                            />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="left"
                            align="center"
                            className="w-56 p-3"
                        >
                            <div className="flex items-center justify-between">
                                <DropdownMenuLabel>Fill</DropdownMenuLabel>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onFillColorChange("transparent");
                                        setOpenFillMenu(false);
                                    }}
                                    className={cn(
                                        "text-[10px] uppercase tracking-wider transition-colors",
                                        fillColor === "transparent"
                                            ? "text-muted-foreground/70 cursor-default"
                                            : "text-muted-foreground hover:text-foreground",
                                    )}
                                    disabled={fillColor === "transparent"}
                                    title="Clear fill"
                                >
                                    Clear
                                </button>
                            </div>
                            <div className="mt-2 grid grid-cols-7 gap-1">
                                {paletteColors.map((color) => (
                                    <button
                                        key={`fill-${color}`}
                                        type="button"
                                        onClick={() => {
                                            onFillColorChange(color);
                                            setOpenFillMenu(false);
                                        }}
                                        className={cn(
                                            "h-6 w-6 rounded-md border border-input transition-transform hover:scale-110",
                                            fillColor === color
                                                ? "scale-105"
                                                : undefined,
                                        )}
                                        style={{ backgroundColor: color }}
                                        title={color}
                                    />
                                ))}
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowFillColorPicker(true);
                                        setOpenFillMenu(false);
                                    }}
                                    className={cn(
                                        "h-6 w-6 rounded-md border border-input overflow-hidden",
                                        fillColor !== "transparent" &&
                                            !paletteColors.includes(fillColor)
                                            ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
                                            : undefined,
                                    )}
                                    title="Custom fill color"
                                >
                                    <div
                                        className="w-full h-full"
                                        style={{
                                            background:
                                                "linear-gradient(135deg, #ff0000 0%, #ff7f00 14%, #ffff00 28%, #00ff00 42%, #0000ff 57%, #4b0082 71%, #9400d3 85%, #ff0000 100%)",
                                        }}
                                    />
                                </button>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}

                <DropdownMenu
                    open={openOptionsMenu}
                    onOpenChange={setOpenOptionsMenu}
                >
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className={iconButton}
                            title="Options"
                            aria-label="Options"
                        >
                            <SlidersHorizontal className="w-5 h-5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        side="left"
                        align="center"
                        className="w-[320px] p-3"
                    >
                        <DropdownMenuLabel>Options</DropdownMenuLabel>
                        <div className="mt-3 space-y-4">{optionsControls}</div>
                    </DropdownMenuContent>
                </DropdownMenu>

                {hasSelectedElements && onCopySelected && (
                    <button
                        type="button"
                        onClick={onCopySelected}
                        className={iconButton}
                        title="Copy"
                        aria-label="Copy"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                )}

                {hasSelectedElements && onDeleteSelected && (
                    <button
                        type="button"
                        onClick={onDeleteSelected}
                        className={cn(iconButton, "hover:text-destructive")}
                        title="Delete"
                        aria-label="Delete"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                )}

                {hasSelectedElements && onToggleLockSelected && (
                    <button
                        type="button"
                        onClick={onToggleLockSelected}
                        className={cn(
                            iconButton,
                            isSelectionLocked && "text-amber-500",
                        )}
                        title={isSelectionLocked ? "Unlock" : "Lock"}
                        aria-label={isSelectionLocked ? "Unlock" : "Lock"}
                    >
                        {isSelectionLocked ? (
                            <Lock className="w-5 h-5" />
                        ) : (
                            <Unlock className="w-5 h-5" />
                        )}
                    </button>
                )}

                {showMoreMenu && (
                    <DropdownMenu
                        open={openMoreMenu}
                        onOpenChange={setOpenMoreMenu}
                    >
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className={iconButton}
                                title="More"
                                aria-label="More"
                            >
                                <MoreHorizontal className="w-5 h-5" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="left"
                            align="center"
                            className="w-72 p-3"
                        >
                            {showLayerOrderActions && (
                                <>
                                    <DropdownMenuLabel>
                                        Layers
                                    </DropdownMenuLabel>
                                    <div className="mt-2 grid grid-cols-4 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onBringToFront?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Bring to Front"
                                        >
                                            <ArrowUpToLine className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onMoveForward?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Move Forward"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5 -rotate-90" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onMoveBackward?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Move Backward"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onSendToBack?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Send to Back"
                                        >
                                            <ArrowDownToLine className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </>
                            )}

                            {showAlign && (
                                <>
                                    <DropdownMenuSeparator className="my-3" />
                                    <DropdownMenuLabel>Align</DropdownMenuLabel>
                                    <div className="mt-2 grid grid-cols-3 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onAlignLeft?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Align left"
                                            aria-label="Align left"
                                        >
                                            <AlignHorizontalJustifyStart className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onAlignCenterHorizontal?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Align center (horizontal)"
                                            aria-label="Align center (horizontal)"
                                        >
                                            <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onAlignRight?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Align right"
                                            aria-label="Align right"
                                        >
                                            <AlignHorizontalJustifyEnd className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                    <div className="mt-1 grid grid-cols-3 gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onAlignTop?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Align top"
                                            aria-label="Align top"
                                        >
                                            <AlignVerticalJustifyStart className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onAlignCenterVertical?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Align center (vertical)"
                                            aria-label="Align center (vertical)"
                                        >
                                            <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                onAlignBottom?.();
                                                setOpenMoreMenu(false);
                                            }}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title="Align bottom"
                                            aria-label="Align bottom"
                                        >
                                            <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </>
                            )}

                            {showGroupAction && (
                                <>
                                    <DropdownMenuSeparator className="my-3" />
                                    <DropdownMenuLabel>
                                        Actions
                                    </DropdownMenuLabel>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            onToggleGroupSelection?.();
                                            setOpenMoreMenu(false);
                                        }}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "mt-2 h-9 w-full flex items-center justify-center gap-2 text-sm",
                                        )}
                                        title={
                                            isSelectionSingleGroup
                                                ? "Ungroup"
                                                : "Group"
                                        }
                                        aria-label={
                                            isSelectionSingleGroup
                                                ? "Ungroup"
                                                : "Group"
                                        }
                                    >
                                        {isSelectionSingleGroup ? (
                                            <Ungroup className="w-4 h-4" />
                                        ) : (
                                            <Group className="w-4 h-4" />
                                        )}
                                        <span>
                                            {isSelectionSingleGroup
                                                ? "Ungroup"
                                                : "Group"}
                                        </span>
                                    </button>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
            </div>
        </div>
    );

    const fullSidebar = (
        <div
            className={cn(
                "fixed top-1/2 -translate-y-1/2 z-[110] transition-all duration-300 ease-out select-none",
                isCollapsed ? "translate-x-[calc(100%-3rem)]" : "translate-x-0",
            )}
            style={{ right: `${16 + rightOffset}px` }}
        >
            <div className="relative bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md shadow-2xl overflow-hidden">
                {/* Collapse/Expand Button */}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className={cn(
                        "absolute -left-10 top-1/2 -translate-y-1/2 w-8 h-16 bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent border-r-0 rounded-l-md flex items-center justify-center",
                        "transition-all duration-200 hover:bg-muted/60 hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                    )}
                >
                    {isCollapsed ? (
                        <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                    ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                </button>

                {/* Sidebar Content */}
                <div
                    className={cn(
                        "w-56 p-3 space-y-3 max-h-[calc(100vh-160px)] overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
                        isCollapsed && "opacity-0 pointer-events-none",
                    )}
                >
                    {/* Header */}
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                        {selectedTool === "pen" && (
                            <Pencil className="w-4 h-4 text-foreground" />
                        )}
                        {selectedTool === "highlighter" && (
                            <Highlighter className="w-4 h-4 text-foreground" />
                        )}
                        {selectedTool === "line" && (
                            <Minus className="w-4 h-4 text-foreground" />
                        )}
                        {selectedTool === "arrow" && (
                            <ArrowRight className="w-4 h-4 text-foreground" />
                        )}
                        {selectedTool === "rectangle" && (
                            <Square className="w-4 h-4 text-foreground" />
                        )}
                        {selectedTool === "ellipse" && (
                            <Circle className="w-4 h-4 text-foreground" />
                        )}
                        {selectedTool === "text" && (
                            <Type className="w-4 h-4 text-foreground" />
                        )}
                        <span className="text-sm font-semibold text-foreground capitalize">
                            {hasSelectedElements
                                ? `${selectedElements.length} Selected`
                                : `${selectedTool} Properties`}
                        </span>
                    </div>

                    {/* Fill Color (for shapes) */}
                    {showFill && onFillColorChange && (
                        <>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                        Fill Color
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onFillColorChange("transparent")
                                        }
                                        className={cn(
                                            "text-[10px] uppercase tracking-wider transition-colors",
                                            fillColor === "transparent"
                                                ? "text-muted-foreground/70 cursor-default"
                                                : "text-muted-foreground hover:text-foreground",
                                        )}
                                        disabled={fillColor === "transparent"}
                                        title="Clear fill"
                                    >
                                        Clear
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {paletteColors.map((color) => (
                                        <button
                                            key={`fill-${color}`}
                                            onClick={() =>
                                                onFillColorChange(
                                                    fillColor === color
                                                        ? "transparent"
                                                        : color,
                                                )
                                            }
                                            className={cn(
                                                SWATCH_BASE,
                                                fillColor === color
                                                    ? "scale-105"
                                                    : undefined,
                                            )}
                                            style={{
                                                backgroundColor: color,
                                                boxShadow:
                                                    fillColor === color
                                                        ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${color}, 0 0 14px ${color}66`
                                                        : undefined,
                                            }}
                                            title={color}
                                        />
                                    ))}
                                    {/* Custom color picker */}
                                    <button
                                        onClick={() =>
                                            setShowFillColorPicker(true)
                                        }
                                        className={cn(
                                            SWATCH_BASE,
                                            "cursor-pointer overflow-hidden",
                                            fillColor !== "transparent" &&
                                                !paletteColors.includes(
                                                    fillColor,
                                                )
                                                ? "scale-105"
                                                : undefined,
                                        )}
                                        title="Custom fill color"
                                    >
                                        <div
                                            className="w-full h-full"
                                            style={{
                                                background:
                                                    "linear-gradient(135deg, #ff0000 0%, #ff7f00 14%, #ffff00 28%, #00ff00 42%, #0000ff 57%, #4b0082 71%, #9400d3 85%, #ff0000 100%)",
                                            }}
                                        />
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    

                    {/* Stroke Color */}
                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Stroke Color
                        </label>
                        <div className="flex flex-wrap gap-1">
                            {paletteColors.map((color) => (
                                <button
                                    key={color}
                                    onClick={() => onStrokeColorChange(color)}
                                    className={cn(
                                        SWATCH_BASE,
                                        strokeColor === color
                                            ? "scale-105"
                                            : undefined,
                                    )}
                                    style={{
                                        backgroundColor: color,
                                        boxShadow:
                                            strokeColor === color
                                                ? `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${color}, 0 0 14px ${color}66`
                                                : undefined,
                                    }}
                                    title={color}
                                />
                            ))}
                            {/* Custom color picker */}
                            <button
                                onClick={() => setShowStrokeColorPicker(true)}
                                className={cn(
                                    SWATCH_BASE,
                                    "cursor-pointer overflow-hidden",
                                )}
                                title="Custom color"
                            >
                                <div
                                    className="w-full h-full"
                                    style={{
                                        background:
                                            "linear-gradient(135deg, #ff0000 0%, #ff7f00 14%, #ffff00 28%, #00ff00 42%, #0000ff 57%, #4b0082 71%, #9400d3 85%, #ff0000 100%)",
                                    }}
                                />
                            </button>
                        </div>
                    </div>

                    {optionsControls}

                    {/* Layer Order (when elements are selected) */}
                    {hasSelectedElements &&
                        onBringToFront &&
                        onSendToBack &&
                        onMoveForward &&
                        onMoveBackward && (
                            <div className="space-y-2 pt-2 border-t border-border">
                                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    Layer Order
                                </label>
                                <div className="grid grid-cols-4 gap-1">
                                    <button
                                        onClick={onBringToFront}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "h-9 flex items-center justify-center",
                                        )}
                                        title="Bring to Front"
                                    >
                                        <ArrowUpToLine className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={onMoveForward}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "h-9 flex items-center justify-center",
                                        )}
                                        title="Move Forward"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5 -rotate-90" />
                                    </button>
                                    <button
                                        onClick={onMoveBackward}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "h-9 flex items-center justify-center",
                                        )}
                                        title="Move Backward"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                                    </button>
                                    <button
                                        onClick={onSendToBack}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "h-9 flex items-center justify-center",
                                        )}
                                        title="Send to Back"
                                    >
                                        <ArrowDownToLine className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                    {/* Align (multi selection) */}
                    {showAlign && (
                        <div className="space-y-2 pt-2 border-t border-border">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Align
                            </label>
                            <div className="grid grid-cols-3 gap-1">
                                <button
                                    onClick={onAlignLeft}
                                    className={cn(
                                        CONTROL_BUTTON,
                                        "h-9 flex items-center justify-center",
                                    )}
                                    title="Align left"
                                    aria-label="Align left"
                                >
                                    <AlignHorizontalJustifyStart className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={onAlignCenterHorizontal}
                                    className={cn(
                                        CONTROL_BUTTON,
                                        "h-9 flex items-center justify-center",
                                    )}
                                    title="Align center (horizontal)"
                                    aria-label="Align center (horizontal)"
                                >
                                    <AlignHorizontalJustifyCenter className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={onAlignRight}
                                    className={cn(
                                        CONTROL_BUTTON,
                                        "h-9 flex items-center justify-center",
                                    )}
                                    title="Align right"
                                    aria-label="Align right"
                                >
                                    <AlignHorizontalJustifyEnd className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <div className="grid grid-cols-3 gap-1">
                                <button
                                    onClick={onAlignTop}
                                    className={cn(
                                        CONTROL_BUTTON,
                                        "h-9 flex items-center justify-center",
                                    )}
                                    title="Align top"
                                    aria-label="Align top"
                                >
                                    <AlignVerticalJustifyStart className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={onAlignCenterVertical}
                                    className={cn(
                                        CONTROL_BUTTON,
                                        "h-9 flex items-center justify-center",
                                    )}
                                    title="Align center (vertical)"
                                    aria-label="Align center (vertical)"
                                >
                                    <AlignVerticalJustifyCenter className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={onAlignBottom}
                                    className={cn(
                                        CONTROL_BUTTON,
                                        "h-9 flex items-center justify-center",
                                    )}
                                    title="Align bottom"
                                    aria-label="Align bottom"
                                >
                                    <AlignVerticalJustifyEnd className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    {showActions && (
                        <div className="space-y-2 pt-2 border-t border-border">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                Actions
                            </label>
                            <div className={cn("grid gap-1", "grid-cols-5")}>
                                {onCopySelected && (
                                    <button
                                        onClick={onCopySelected}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "h-9 flex items-center justify-center",
                                        )}
                                        title="Copy"
                                        aria-label="Copy"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onDeleteSelected && (
                                    <button
                                        onClick={onDeleteSelected}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "h-9 flex items-center justify-center",
                                        )}
                                        title="Delete"
                                        aria-label="Delete"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onToggleGroupSelection &&
                                    (selectedElements.length > 1 ||
                                        isSelectionSingleGroup) && (
                                        <button
                                            onClick={onToggleGroupSelection}
                                            className={cn(
                                                CONTROL_BUTTON,
                                                "h-9 flex items-center justify-center",
                                            )}
                                            title={
                                                isSelectionSingleGroup
                                                    ? "Ungroup"
                                                    : "Group"
                                            }
                                            aria-label={
                                                isSelectionSingleGroup
                                                    ? "Ungroup"
                                                    : "Group"
                                            }
                                        >
                                            {isSelectionSingleGroup ? (
                                                <Ungroup className="w-3.5 h-3.5" />
                                            ) : (
                                                <Group className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    )}
                                {canEditArrow && (
                                    <button
                                        onClick={onToggleEditArrowMode}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "h-9 flex items-center justify-center",
                                            isEditArrowMode &&
                                                CONTROL_BUTTON_SELECTED,
                                        )}
                                        title="Edit arrow"
                                        aria-label="Edit arrow"
                                    >
                                        <Spline className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                {onToggleLockSelected && (
                                    <button
                                        onClick={onToggleLockSelected}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "h-9 flex items-center justify-center",
                                            isSelectionLocked &&
                                                "text-amber-500",
                                        )}
                                        title={
                                            isSelectionLocked
                                                ? "Unlock"
                                                : "Lock"
                                        }
                                        aria-label={
                                            isSelectionLocked
                                                ? "Unlock"
                                                : "Lock"
                                        }
                                    >
                                        {isSelectionLocked ? (
                                            <Lock className="w-3.5 h-3.5" />
                                        ) : (
                                            <Unlock className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <>
            {isCondensed ? condensedSidebar : fullSidebar}

            {/* Stroke Color Picker Modal */}
            <ColorPicker
                value={strokeColor}
                onChange={onStrokeColorChange}
                isOpen={showStrokeColorPicker}
                onClose={() => setShowStrokeColorPicker(false)}
                title="Custom Stroke Color"
                position="auto"
                showAlpha={true}
                showEyedropper={true}
                showSwatches={true}
            />

            {/* Fill Color Picker Modal */}
            <ColorPicker
                value={fillColor}
                onChange={(color) => onFillColorChange?.(color)}
                isOpen={showFillColorPicker}
                onClose={() => setShowFillColorPicker(false)}
                title="Custom Fill Color"
                position="auto"
                showAlpha={true}
                showEyedropper={true}
                showSwatches={true}
            />

            {/* Arrow End Picker Menu - Outside overflow container */}
            {openArrowEndMenu && arrowEndMenuPos && (
                <>
                    <div
                        className="fixed z-[9999] w-[260px] bg-card/95 backdrop-blur-md border border-border/60 dark:border-transparent rounded-md shadow-2xl p-2"
                        style={{
                            left: arrowEndMenuPos.left,
                            top: arrowEndMenuPos.top,
                        }}
                        ref={arrowEndMenuRef}
                    >
                        <div className="grid grid-cols-2 gap-1">
                            {arrowEndOptions.map((opt) => {
                                const isSelected =
                                    openArrowEndMenu === "start"
                                        ? arrowStart === opt.id
                                        : arrowEnd === opt.id;
                                return (
                                    <button
                                        key={`${openArrowEndMenu}-${opt.id}`}
                                        type="button"
                                        onClick={() => {
                                            if (openArrowEndMenu === "start")
                                                onArrowStartChange?.(opt.id);
                                            else onArrowEndChange?.(opt.id);
                                            setOpenArrowEndMenu(null);
                                        }}
                                        className={cn(
                                            CONTROL_BUTTON,
                                            "h-10 flex items-center justify-center hover:bg-muted/60",
                                            isSelected
                                                ? CONTROL_BUTTON_SELECTED
                                                : undefined,
                                        )}
                                        title={opt.label}
                                    >
                                        {renderArrowEndPreview(opt.id)}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
