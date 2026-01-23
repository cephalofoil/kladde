"use client";

import {
  vscDarkPlus,
  oneDark,
  dracula,
  atomDark,
  materialDark,
  coldarkDark,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  github,
  vs,
} from "react-syntax-highlighter/dist/esm/styles/hljs";

export type CodeThemeName =
  | "vscode-dark"
  | "one-dark"
  | "dracula"
  | "atom-dark"
  | "material-dark"
  | "coldark-dark"
  | "github-light"
  | "vs-light";

export interface CodeThemeDefinition {
  name: CodeThemeName;
  label: string;
  style: Record<string, React.CSSProperties>;
  isDark: boolean;
  previewColors: {
    background: string;
    keyword: string;
    string: string;
    comment: string;
  };
}

export const CODE_THEMES: CodeThemeDefinition[] = [
  {
    name: "vscode-dark",
    label: "VS Code Dark+",
    style: vscDarkPlus,
    isDark: true,
    previewColors: {
      background: "#1e1e1e",
      keyword: "#569cd6",
      string: "#ce9178",
      comment: "#6a9955",
    },
  },
  {
    name: "one-dark",
    label: "One Dark",
    style: oneDark,
    isDark: true,
    previewColors: {
      background: "#282c34",
      keyword: "#c678dd",
      string: "#98c379",
      comment: "#5c6370",
    },
  },
  {
    name: "dracula",
    label: "Dracula",
    style: dracula,
    isDark: true,
    previewColors: {
      background: "#282a36",
      keyword: "#ff79c6",
      string: "#f1fa8c",
      comment: "#6272a4",
    },
  },
  {
    name: "atom-dark",
    label: "Atom Dark",
    style: atomDark,
    isDark: true,
    previewColors: {
      background: "#1d1f21",
      keyword: "#b294bb",
      string: "#b5bd68",
      comment: "#969896",
    },
  },
  {
    name: "material-dark",
    label: "Material Dark",
    style: materialDark,
    isDark: true,
    previewColors: {
      background: "#263238",
      keyword: "#c792ea",
      string: "#c3e88d",
      comment: "#546e7a",
    },
  },
  {
    name: "coldark-dark",
    label: "Coldark Dark",
    style: coldarkDark,
    isDark: true,
    previewColors: {
      background: "#111b27",
      keyword: "#e6d37a",
      string: "#91d076",
      comment: "#8da1b9",
    },
  },
  {
    name: "github-light",
    label: "GitHub Light",
    style: github as Record<string, React.CSSProperties>,
    isDark: false,
    previewColors: {
      background: "#ffffff",
      keyword: "#d73a49",
      string: "#032f62",
      comment: "#6a737d",
    },
  },
  {
    name: "vs-light",
    label: "VS Light",
    style: vs as Record<string, React.CSSProperties>,
    isDark: false,
    previewColors: {
      background: "#ffffff",
      keyword: "#0000ff",
      string: "#a31515",
      comment: "#008000",
    },
  },
];

export function getThemeByName(name: string): CodeThemeDefinition {
  return CODE_THEMES.find((t) => t.name === name) || CODE_THEMES[0];
}

export function getThemeStyle(name: string): Record<string, React.CSSProperties> {
  return getThemeByName(name).style;
}
