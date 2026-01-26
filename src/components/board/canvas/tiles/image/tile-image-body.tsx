import { memo } from "react";
import Image from "next/image";
import type { BoardElement } from "@/lib/board-types";
import { cn } from "@/lib/utils";

interface ImageTileBodyProps {
    content?: BoardElement["tileContent"];
    emptyText: string;
    textClassName?: string;
}

export const ImageTileBody = memo(function ImageTileBody({
    content,
    emptyText,
    textClassName,
}: ImageTileBodyProps) {
    return (
        <div className="absolute left-0 right-0 bottom-0 top-12 flex items-center justify-center overflow-hidden pointer-events-none rounded-b-lg relative">
            {content?.imageSrc ? (
                <Image
                    src={content.imageSrc}
                    alt={content.imageAlt || "Image"}
                    fill
                    sizes="(max-width: 768px) 100vw, 400px"
                    className="object-contain"
                />
            ) : (
                <div className={cn("text-sm text-center", textClassName)}>
                    {emptyText}
                </div>
            )}
        </div>
    );
});
