import { memo } from "react";
import type { BoardElement } from "@/lib/board-types";
import { cn } from "@/lib/utils";
import { RichTextRenderer } from "./rich-text-renderer";

interface TextTileBodyProps {
    content?: BoardElement["tileContent"];
    readOnly: boolean;
    autoFocus: boolean;
    showFloatingToolbar: boolean;
    toolbarVariant?: "floating" | "inline";
    toolbarVisible?: boolean;
    textClassName?: string;
    onUpdate?: (updates: Partial<BoardElement>) => void;
    onMouseDownCapture?: (event: React.MouseEvent) => void;
    onMouseMoveCapture?: (event: React.MouseEvent) => void;
    onMouseUpCapture?: (event: React.MouseEvent) => void;
}

export const TextTileBody = memo(function TextTileBody({
    content,
    readOnly,
    autoFocus,
    showFloatingToolbar,
    toolbarVariant,
    toolbarVisible,
    textClassName,
    onUpdate,
    onMouseDownCapture,
    onMouseMoveCapture,
    onMouseUpCapture,
}: TextTileBodyProps) {
    return (
        <div
            className={cn(
                "absolute left-0 right-0 bottom-0 top-12 overflow-hidden rounded-b-lg",
                "pointer-events-auto",
            )}
            data-canvas-interactive="true"
            onMouseDownCapture={onMouseDownCapture}
            onMouseMoveCapture={onMouseMoveCapture}
            onMouseUpCapture={onMouseUpCapture}
        >
            <RichTextRenderer
                content={content?.richText || ""}
                onChange={(text) =>
                    onUpdate?.({
                        tileContent: { ...content, richText: text },
                    })
                }
                readOnly={readOnly}
                autoFocus={autoFocus}
                showFloatingToolbar={showFloatingToolbar}
                toolbarVariant={toolbarVariant}
                toolbarVisible={toolbarVisible}
                className={cn("h-full bg-transparent", textClassName)}
            />
        </div>
    );
});
