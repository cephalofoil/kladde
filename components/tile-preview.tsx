"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RichTextRenderer } from "./content-renderers/rich-text-renderer";
import { CodeRenderer } from "./content-renderers/code-renderer";
import { MermaidRenderer } from "./content-renderers/mermaid-renderer";
import { DocumentRenderer } from "./content-renderers/document-renderer";
import { BookmarkRenderer } from "./content-renderers/bookmark-renderer";
import {
  Type,
  Code,
  FileText,
  ImageIcon,
  Square,
  GitBranch,
  FileCheck,
  Bookmark,
} from "lucide-react";
import type { TileData } from "@/types/canvas";

interface TilePreviewProps {
  type: TileData["type"];
  title: string;
  description: string;
  icon: React.ReactNode;
  sampleContent: Record<string, unknown>;
}

const tileTypes: TilePreviewProps[] = [
  {
    type: "text",
    title: "Text Tile",
    description: "Rich text content with formatting",
    icon: <Type className="h-4 w-4" />,
    sampleContent: {
      text: "This is a sample text tile with **bold** and *italic* formatting. You can create rich text content with various styles and formatting options.",
      style: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
      },
    },
  },
  {
    type: "code",
    title: "Code Tile",
    description: "Syntax-highlighted code blocks",
    icon: <Code className="h-4 w-4" />,
    sampleContent: {
      code: `function helloWorld() {
  console.log("Hello, World!");
  return "Success!";
}

// This is a sample code tile
const result = helloWorld();`,
      language: "javascript",
      style: {
        textColor: "#000000",
        backgroundColor: "#f8f9fa",
      },
    },
  },
  {
    type: "note",
    title: "Note Tile",
    description: "Simple note-taking with markdown",
    icon: <FileText className="h-4 w-4" />,
    sampleContent: {
      text: "# Meeting Notes\n\n## Agenda\n- Project updates\n- Timeline review\n- Next steps\n\n## Action Items\n- [ ] Review documentation\n- [ ] Schedule follow-up\n- [ ] Update stakeholders",
      style: {
        textColor: "#000000",
        backgroundColor: "#fff3cd",
      },
    },
  },
  {
    type: "mermaid",
    title: "Mermaid Diagram",
    description: "Visual diagrams and flowcharts",
    icon: <GitBranch className="h-4 w-4" />,
    sampleContent: {
      chart: "",
      style: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
      },
    },
  },
  {
    type: "bookmark",
    title: "Bookmark Tile",
    description: "Save links to websites and dashboards",
    icon: <Bookmark className="h-4 w-4" />,
    sampleContent: {
      url: "https://github.com",
      title: "GitHub Repository",
      description: "Where the world builds software",
      siteName: "GitHub",
      favicon: "🐙",
      style: {
        textColor: "#000000",
        backgroundColor: "#ffffff",
      },
    },
  },
  {
    type: "image",
    title: "Image Tile",
    description: "Image display and management",
    icon: <ImageIcon className="h-4 w-4" />,
    sampleContent: {
      src: "/placeholder.jpg",
      alt: "Sample Image",
      caption: "This is a sample image tile",
      style: {
        backgroundColor: "#ffffff",
      },
    },
  },
  {
    type: "shape",
    title: "Shape Tile",
    description: "Geometric shapes and graphics",
    icon: <Square className="h-4 w-4" />,
    sampleContent: {
      shape: "rectangle",
      dimensions: { width: 200, height: 100 },
      style: {
        backgroundColor: "#6366f1",
        borderColor: "#4338ca",
        textColor: "#ffffff",
      },
    },
  },
  {
    type: "document",
    title: "Document Tile",
    description: "Structured documents with tasks and metadata",
    icon: <FileCheck className="h-4 w-4" />,
    sampleContent: {
      title: "Project Planning Document",
      description: "Comprehensive project planning with tasks and deadlines",
      status: "in-progress",
      dueDate: "2024-03-15",
      assignees: ["John Doe", "Jane Smith"],
      tags: ["project", "planning", "priority"],
      attachments: [
        { name: "requirements.pdf", size: "2.5 MB", type: "pdf" },
        { name: "wireframes.figma", size: "1.8 MB", type: "figma" },
      ],
      subtasks: [
        { id: "1", text: "Define project scope", completed: true },
        { id: "2", text: "Create timeline", completed: false, isBlocker: true },
        { id: "3", text: "Assign resources", completed: false },
      ],
      comments: [
        {
          id: "1",
          author: "John",
          text: "Updated timeline based on feedback",
          timestamp: "2024-01-15T10:30:00Z",
        },
      ],
      style: {
        backgroundColor: "#f8f9fa",
        borderColor: "#dee2e6",
        textColor: "#212529",
      },
    },
  },
];

export function TilePreview() {
  const renderTileContent = (
    type: TileData["type"],
    content: Record<string, unknown>,
  ) => {
    try {
      switch (type) {
        case "text":
          return (
            <RichTextRenderer
              content={String(content.text || "Sample text content")}
              readOnly
            />
          );
        case "code":
          return (
            <CodeRenderer
              code={String(content.code || "// Sample code")}
              language={String(content.language || "javascript")}
              readOnly
            />
          );
        case "note":
          return (
            <RichTextRenderer
              content={String(content.text || "# Sample note")}
              readOnly
            />
          );
        case "mermaid":
          return (
            <MermaidRenderer
              chart={String(content.chart || "")}
              width={300}
              height={200}
            />
          );
        case "bookmark":
          return (
            <BookmarkRenderer
              url={String(content.url || "https://github.com")}
              title={String(content.title || "GitHub Repository")}
              description={String(content.description || "Where the world builds software")}
              favicon={String(content.favicon || "🐙")}
              siteName={String(content.siteName || "GitHub")}
            />
          );
        case "image":
          return (
            <div className="text-center p-4">
              <div className="w-32 h-24 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {String(content.caption || "Sample image")}
              </p>
            </div>
          );
        case "shape":
          return (
            <div className="flex items-center justify-center h-24">
              <div
                className="w-20 h-16 rounded"
                style={{
                  backgroundColor:
                    ((content.style as Record<string, unknown>)
                      ?.backgroundColor as string) || "#6366f1",
                  border: `2px solid ${((content.style as Record<string, unknown>)?.borderColor as string) || "#4338ca"}`,
                  color:
                    ((content.style as Record<string, unknown>)
                      ?.textColor as string) || "#ffffff",
                }}
              >
                <div className="flex items-center justify-center h-full text-xs font-bold">
                  SHAPE
                </div>
              </div>
            </div>
          );
        case "document":
          return (
            <DocumentRenderer
              content={{
                title: String(content.title || "Sample Document"),
                description: String(
                  content.description || "Sample document content",
                ),
                status:
                  (content.status as
                    | "draft"
                    | "in-progress"
                    | "review"
                    | "completed") || "draft",
                dueDate: String(content.dueDate || ""),
                assignees: (content.assignees as string[]) || [],
                tags: (content.tags as string[]) || [],
                attachments:
                  (content.attachments as {
                    name: string;
                    size: string;
                    type: string;
                  }[]) || [],
                subtasks:
                  (content.subtasks as {
                    id: string;
                    text: string;
                    completed: boolean;
                    isBlocker?: boolean;
                  }[]) || [],
                comments:
                  (content.comments as {
                    id: string;
                    author: string;
                    text: string;
                    timestamp: string;
                  }[]) || [],
              }}
              onUpdate={() => {}}
            />
          );
        default:
          return (
            <div className="p-4 text-muted-foreground">
              Preview not available
            </div>
          );
      }
    } catch (error) {
      console.error(`Error rendering ${type} tile:`, error);
      return (
        <div className="p-4 text-red-600 text-sm">
          <div className="font-medium">⚠️ Render Error</div>
          <div className="text-xs mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Tile Renderers & Components</h2>
        <p className="text-muted-foreground mb-6">
          Test and preview all available tile types and their renderers
        </p>
      </div>

      {/* Summary Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-primary">
                {tileTypes.length}
              </div>
              <div className="text-sm text-muted-foreground">Tile Types</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {tileTypes.filter((t) => t.type.includes("mermaid")).length}
              </div>
              <div className="text-sm text-muted-foreground">Diagram Types</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {
                  tileTypes.filter(
                    (t) => t.type === "text" || t.type === "note",
                  ).length
                }
              </div>
              <div className="text-sm text-muted-foreground">Text Types</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {tileTypes.filter((t) => t.type === "code").length}
              </div>
              <div className="text-sm text-muted-foreground">Code Types</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tileTypes.map((tile) => (
          <Card key={tile.type} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">{tile.icon}</div>
                <div>
                  <CardTitle className="text-lg">{tile.title}</CardTitle>
                  <CardDescription>{tile.description}</CardDescription>
                </div>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {tile.type}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  Renderer
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="border rounded-lg p-3 bg-background h-48 overflow-hidden">
                {renderTileContent(tile.type, tile.sampleContent)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Tile Type Reference
          </CardTitle>
          <CardDescription>
            All available tile types and their usage in the canvas system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {tileTypes.map((tile) => (
              <div
                key={tile.type}
                className="flex items-center gap-3 p-3 bg-muted rounded-lg"
              >
                <div className="p-2 bg-primary/10 rounded-lg">{tile.icon}</div>
                <div>
                  <div className="font-medium">{tile.title}</div>
                  <div className="text-muted-foreground text-xs">
                    {tile.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
