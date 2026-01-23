"use client";

import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { CodeThemeName } from "@/lib/code-themes";
import {
    atomone,
    dracula,
    material,
    vscodeDark,
    vscodeLight,
    githubLight,
    githubDark,
    tokyoNight,
} from "@uiw/codemirror-themes-all";

const fallbackTheme = EditorView.theme({});

export function getCodeMirrorTheme(theme: CodeThemeName): Extension {
    switch (theme) {
        case "vscode-dark":
            return vscodeDark || fallbackTheme;
        case "vs-light":
            return vscodeLight || fallbackTheme;
        case "github-light":
            return githubLight || fallbackTheme;
        case "one-dark":
            return atomone || fallbackTheme;
        case "dracula":
            return dracula || fallbackTheme;
        case "atom-dark":
            return atomone || fallbackTheme;
        case "material-dark":
            return material || fallbackTheme;
        case "coldark-dark":
            return tokyoNight || fallbackTheme;
        default:
            return githubDark || fallbackTheme;
    }
}
