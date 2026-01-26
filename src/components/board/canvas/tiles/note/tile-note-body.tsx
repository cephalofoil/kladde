import { memo } from "react";
import type { BoardElement } from "@/lib/board-types";
import {
    NoteTileRenderer,
    type NoteColor,
    type NoteStyle,
} from "./note-tile-renderer";

interface NoteTileBodyProps {
    content?: BoardElement["tileContent"];
    isSelected: boolean;
    isEditing: boolean;
    onUpdate?: (updates: Partial<BoardElement>) => void;
    onDelete?: () => void;
    onRequestEdit: () => void;
}

export const NoteTileBody = memo(function NoteTileBody({
    content,
    isSelected,
    isEditing,
    onUpdate,
    onDelete,
    onRequestEdit,
}: NoteTileBodyProps) {
    const noteColor =
        (content?.noteColor as NoteColor) ||
        (content?.noteStyle === "torn" ? "natural-tan" : "butter");
    const noteStyle = (content?.noteStyle as NoteStyle) || "classic";

    return (
        <NoteTileRenderer
            content={content?.noteText || ""}
            color={noteColor}
            style={noteStyle}
            fontFamily={content?.noteFontFamily}
            textAlign={content?.noteTextAlign}
            onChange={(text) =>
                onUpdate?.({
                    tileContent: {
                        ...content,
                        noteText: text,
                    },
                })
            }
            onColorChange={(newColor) =>
                onUpdate?.({
                    tileContent: {
                        ...content,
                        noteColor: newColor,
                    },
                })
            }
            onDelete={onDelete}
            readOnly={false}
            isSelected={isSelected}
            isEditing={isEditing}
            onRequestEdit={onRequestEdit}
        />
    );
});
