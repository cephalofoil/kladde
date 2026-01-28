"use client";

import { isFileOpenPickerSupported } from "@/lib/filesystem-storage";
import { getLanguageFromFilename } from "./code-language-selector";

export interface ImportedCodeFile {
    code: string;
    language: string;
    fileName: string;
}

const CODE_FILE_EXTENSIONS = [
    "js",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "jsx",
    "py",
    "java",
    "cpp",
    "cxx",
    "c",
    "cs",
    "go",
    "rs",
    "rb",
    "php",
    "html",
    "css",
    "json",
    "yaml",
    "yml",
    "md",
    "markdown",
    "sql",
    "sh",
    "ps1",
    "dockerfile",
    "xml",
    "graphql",
    "gql",
    "swift",
    "kt",
    "scala",
    "txt",
];

const CODE_FILE_ACCEPT = CODE_FILE_EXTENSIONS.map((ext) => `.${ext}`);

async function requestCodeFile(): Promise<File | null> {
    if (isFileOpenPickerSupported()) {
        try {
            const [handle] = await window.showOpenFilePicker!({
                multiple: false,
                types: [
                    {
                        description: "Code files",
                        accept: {
                            "text/plain": CODE_FILE_ACCEPT,
                        },
                    },
                ],
            });

            return (await handle?.getFile()) || null;
        } catch (error) {
            if ((error as Error).name === "AbortError") {
                return null;
            }
            throw error;
        }
    }

    return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = CODE_FILE_ACCEPT.join(",");

        input.onchange = () => {
            const file = input.files?.[0] || null;
            resolve(file);
        };

        input.click();
    });
}

export async function importCodeFile(
    fallbackLanguage = "javascript",
): Promise<ImportedCodeFile | null> {
    const file = await requestCodeFile();
    if (!file) return null;

    const code = await file.text();
    const language = getLanguageFromFilename(file.name) || fallbackLanguage;

    return {
        code,
        language,
        fileName: file.name,
    };
}
