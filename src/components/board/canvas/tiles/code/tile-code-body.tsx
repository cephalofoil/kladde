import { memo } from "react";
import type { BoardElement } from "@/lib/board-types";
import type { CodeThemeName } from "@/lib/code-themes";
import { CodeRenderer } from "./code-renderer";

interface CodeTileBodyProps {
    content?: BoardElement["tileContent"];
    isSelected: boolean;
    isEditing: boolean;
    codeScale?: number;
    codeWordWrap?: boolean;
    codeTheme?: CodeThemeName;
    highlightedLines?: number[];
    onChange: (code: string) => void;
    onHighlightedLinesChange?: (lines: number[]) => void;
    onFinish: () => void;
    onClick?: (event: React.MouseEvent) => void;
    onClickCapture?: (event: React.MouseEvent) => void;
    onMouseDownCapture?: (event: React.MouseEvent) => void;
}

export const CodeTileBody = memo(function CodeTileBody({
    content,
    isSelected,
    isEditing,
    codeScale,
    codeWordWrap,
    codeTheme,
    highlightedLines,
    onChange,
    onHighlightedLinesChange,
    onFinish,
    onClick,
    onClickCapture,
    onMouseDownCapture,
}: CodeTileBodyProps) {
    return (
        <div
            className="absolute left-0 right-0 bottom-0 top-12 rounded-b-lg overflow-hidden pointer-events-auto"
            onMouseDownCapture={onMouseDownCapture}
            onClick={onClick}
            onClickCapture={onClickCapture}
        >
            <CodeRenderer
                code={content?.code || ""}
                language={content?.language || "javascript"}
                scale={codeScale}
                wordWrap={codeWordWrap}
                theme={codeTheme}
                highlightedLines={highlightedLines}
                isSelected={isSelected}
                onChange={onChange}
                onHighlightedLinesChange={onHighlightedLinesChange}
                onFinish={onFinish}
                isEditing={isEditing}
                readOnly={!isEditing}
            />
        </div>
    );
});
