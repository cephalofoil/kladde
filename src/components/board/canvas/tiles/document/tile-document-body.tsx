import { memo } from "react";
import { cn } from "@/lib/utils";
import type { BoardElement } from "@/lib/board-types";
import { GripVertical } from "lucide-react";
import { DocumentRenderer } from "./document-renderer";

interface DocumentTileBodyProps {
    elementId: string;
    content?: BoardElement["tileContent"];
    isSelected: boolean;
    tileTitle: string;
    isEditingTitle: boolean;
    onTitleChange: (value: string) => void;
    onStartTitleEdit: () => void;
    onFinishTitleEdit: () => void;
    onOpenDocumentEditor?: (elementId: string) => void;
}

export const DocumentTileBody = memo(function DocumentTileBody({
    elementId,
    content,
    isSelected,
    tileTitle,
    isEditingTitle,
    onTitleChange,
    onStartTitleEdit,
    onFinishTitleEdit,
    onOpenDocumentEditor,
}: DocumentTileBodyProps) {
    return (
        <div
            className="absolute inset-0 overflow-hidden rounded-lg pointer-events-auto cursor-pointer"
            onClick={() => onOpenDocumentEditor?.(elementId)}
        >
            <div
                data-tile-header="true"
                data-element-id={elementId}
                className={cn(
                    "absolute top-0 left-0 h-10 w-10 flex items-center justify-center",
                    isSelected ? "cursor-move" : "cursor-pointer",
                )}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
            />
            <button
                type="button"
                data-tile-header="true"
                data-element-id={elementId}
                className={cn(
                    "absolute top-2 left-2 z-10 h-7 w-7",
                    "flex items-center justify-center focus:outline-none",
                    isSelected ? "cursor-move" : "cursor-grab",
                )}
                onClick={(e) => e.stopPropagation()}
                aria-label="Drag document tile"
            >
                <GripVertical className="h-5 w-5 text-[#4a3a2a]" />
            </button>
            <DocumentRenderer documentContent={content?.documentContent} />
            <div
                className="absolute left-0 right-0 bottom-3 px-4"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    onStartTitleEdit();
                }}
            >
                {isEditingTitle ? (
                    <input
                        type="text"
                        value={tileTitle}
                        onChange={(e) => onTitleChange(e.target.value)}
                        onBlur={onFinishTitleEdit}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onFinishTitleEdit();
                            e.stopPropagation();
                        }}
                        className="w-full bg-transparent text-lg font-bold text-[#2f2418] outline-none placeholder:text-[#6b5a43]/60"
                        placeholder="Untitled"
                        autoFocus
                    />
                ) : (
                    <div className="text-lg font-bold text-[#2f2418] truncate">
                        {tileTitle}
                    </div>
                )}
            </div>
        </div>
    );
});
