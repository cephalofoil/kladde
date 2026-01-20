"use client";

export type MermaidThemeName = "default" | "neutral" | "dark";

export const MERMAID_THEME: MermaidThemeName = "default";

export const MERMAID_THEME_VARIABLES = {
  primaryColor: "#ECECFF",
  primaryTextColor: "#323D47",
  primaryBorderColor: "#9370DB",
  lineColor: "#3F3F46",
  secondaryColor: "#E1F5FE",
  tertiaryColor: "#FFFFFF",
  noteBkgColor: "#FFF4DD",
  noteTextColor: "#3F3F46",
} as const;

export function getMermaidConfig(options?: { forExport?: boolean }) {
  const forExport = options?.forExport ?? false;
  return {
    startOnLoad: false,
    theme: MERMAID_THEME,
    themeVariables: MERMAID_THEME_VARIABLES,
    securityLevel: "loose",
    htmlLabels: !forExport,
    flowchart: {
      htmlLabels: !forExport,
    },
    sequence: {
      htmlLabels: !forExport,
    },
  };
}
