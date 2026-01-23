"use client";

import type { Extension } from "@codemirror/state";
import { StreamLanguage } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { yaml } from "@codemirror/lang-yaml";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { php } from "@codemirror/lang-php";
import { java } from "@codemirror/lang-java";
import { rust } from "@codemirror/lang-rust";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { ruby } from "@codemirror/legacy-modes/mode/ruby";
import { shell } from "@codemirror/legacy-modes/mode/shell";
import { powerShell } from "@codemirror/legacy-modes/mode/powershell";
import { dockerFile } from "@codemirror/legacy-modes/mode/dockerfile";
import { csharp, kotlin, scala } from "@codemirror/legacy-modes/mode/clike";
import { swift } from "@codemirror/legacy-modes/mode/swift";

export function getCodeMirrorLanguage(language: string): Extension | null {
    switch (language) {
        case "javascript":
            return javascript({ jsx: false, typescript: false });
        case "typescript":
            return javascript({ jsx: false, typescript: true });
        case "jsx":
            return javascript({ jsx: true, typescript: false });
        case "tsx":
            return javascript({ jsx: true, typescript: true });
        case "html":
            return html();
        case "css":
            return css();
        case "json":
            return json();
        case "yaml":
            return yaml();
        case "sql":
            return sql();
        case "xml":
            return xml();
        case "markdown":
            return markdown();
        case "python":
            return python();
        case "php":
            return php();
        case "java":
            return java();
        case "rust":
            return rust();
        case "cpp":
        case "c":
            return cpp();
        case "go":
            return go();
        case "ruby":
            return StreamLanguage.define(ruby);
        case "bash":
            return StreamLanguage.define(shell);
        case "powershell":
            return StreamLanguage.define(powerShell);
        case "dockerfile":
            return StreamLanguage.define(dockerFile);
        case "csharp":
            return StreamLanguage.define(csharp);
        case "kotlin":
            return StreamLanguage.define(kotlin);
        case "scala":
            return StreamLanguage.define(scala);
        case "swift":
            return StreamLanguage.define(swift);
        default:
            return null;
    }
}
