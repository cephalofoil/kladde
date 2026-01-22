"use client";

import dynamic from "next/dynamic";
import type { EditorRef } from "./lexical/lexical-editor";

// Dynamic import to avoid SSR issues with Lexical
const LexicalEditor = dynamic(
    () =>
        import("./lexical/lexical-editor").then((mod) => ({
            default: mod.LexicalEditor,
        })),
    {
        ssr: false,
        loading: () => (
            <div className="w-full h-full min-h-[200px] flex items-center justify-center border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900">
                <div className="text-gray-500 dark:text-gray-400">
                    Loading editor...
                </div>
            </div>
        ),
    },
);

interface RichTextRendererProps {
    content: string;
    onChange?: (content: string) => void;
    onFinish?: () => void;
    readOnly?: boolean;
    autoFocus?: boolean;
    showFloatingToolbar?: boolean;
    toolbarVariant?: "floating" | "inline";
    toolbarVisible?: boolean;
    className?: string;
    contentClassName?: string;
    contentStyle?: React.CSSProperties;
    editorRef?: React.Ref<EditorRef>;
    onFocus?: () => void;
    onBlur?: () => void;
}

export function RichTextRenderer({
    content,
    onChange,
    onFinish,
    readOnly = false,
    autoFocus = false,
    showFloatingToolbar = false,
    toolbarVariant = "floating",
    toolbarVisible = true,
    className,
    contentClassName,
    contentStyle,
    editorRef,
    onFocus,
    onBlur,
}: RichTextRendererProps) {
    return (
        <div className="w-full h-full">
            <LexicalEditor
                ref={editorRef}
                content={content}
                onChange={onChange}
                onFinish={onFinish}
                readOnly={readOnly}
                autoFocus={autoFocus && !readOnly}
                showBorder={false}
                showFloatingToolbar={showFloatingToolbar}
                toolbarVariant={toolbarVariant}
                toolbarVisible={toolbarVisible}
                className={className}
                contentClassName={contentClassName}
                contentStyle={contentStyle}
                onFocus={onFocus}
                onBlur={onBlur}
            />
        </div>
    );
}
