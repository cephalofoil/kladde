"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useBoardStore } from "@/stores/board-management-store";
import { generateId } from "@/lib/board-utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  FileText,
  Code,
  Workflow,
  Users,
  Target,
  Lightbulb,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BOARD_DATA_VERSION } from "@/types/version";

// Template definitions
const boardTemplates = [
  {
    id: "blank",
    name: "Blank Board",
    description: "Start with a clean canvas",
    icon: FileText,
    category: "basic",
    tags: ["basic", "general"],
    color: "#64748b",
    tiles: [],
    connections: [],
  },
  {
    id: "project-planning",
    name: "Project Planning",
    description: "Plan and track project milestones",
    icon: Target,
    category: "project",
    tags: ["planning", "project", "timeline"],
    color: "#3b82f6",
    tiles: [
      {
        id: "template-1",
        type: "text" as const,
        x: 100,
        y: 100,
        width: 300,
        height: 120,
        rotation: 0,
        title: "Project Overview",
        content: {
          text: "Describe your project goals, scope, and key stakeholders here.",
        },
      },
      {
        id: "template-2",
        type: "note" as const,
        x: 450,
        y: 100,
        width: 250,
        height: 150,
        rotation: 0,
        title: "Key Milestones",
        content: {
          text: "• Phase 1: Research\n• Phase 2: Design\n• Phase 3: Development\n• Phase 4: Testing\n• Phase 5: Launch",
        },
      },
      {
        id: "template-3",
        type: "text" as const,
        x: 100,
        y: 300,
        width: 300,
        height: 100,
        rotation: 0,
        title: "Resources Needed",
        content: {
          text: "List the team members, tools, and budget requirements.",
        },
      },
    ],
    connections: [],
  },
  {
    id: "decision-record",
    name: "Decision Record",
    description: "Document important decisions and their context",
    icon: Users,
    category: "documentation",
    tags: ["decision", "documentation", "adr"],
    color: "#059669",
    tiles: [
      {
        id: "template-1",
        type: "text" as const,
        x: 100,
        y: 100,
        width: 400,
        height: 80,
        rotation: 0,
        title: "Decision Title",
        content: { text: "Brief, descriptive title of the decision" },
      },
      {
        id: "template-2",
        type: "note" as const,
        x: 100,
        y: 220,
        width: 350,
        height: 120,
        rotation: 0,
        title: "Context",
        content: {
          text: "What is the issue that we're seeing that is motivating this decision or change?",
        },
      },
      {
        id: "template-3",
        type: "note" as const,
        x: 100,
        y: 380,
        width: 350,
        height: 120,
        rotation: 0,
        title: "Decision",
        content: {
          text: "What is the change that we're proposing or have agreed to implement?",
        },
      },
      {
        id: "template-4",
        type: "note" as const,
        x: 500,
        y: 220,
        width: 300,
        height: 200,
        rotation: 0,
        title: "Consequences",
        content: {
          text: "What becomes easier or more difficult to do and any risks introduced by this change?",
        },
      },
    ],
    connections: [],
  },
  {
    id: "system-design",
    name: "System Design",
    description: "Plan software architecture and system components",
    icon: Code,
    category: "technical",
    tags: ["architecture", "system", "design", "technical"],
    color: "#dc2626",
    tiles: [
      {
        id: "template-1",
        type: "text" as const,
        x: 100,
        y: 100,
        width: 300,
        height: 100,
        rotation: 0,
        title: "System Overview",
        content: {
          text: "High-level description of the system and its purpose",
        },
      },
      {
        id: "template-2",
        type: "mermaid" as const,
        x: 450,
        y: 100,
        width: 400,
        height: 300,
        rotation: 0,
        title: "Architecture Diagram",
        content: {
          chart:
            "graph TD\n    A[Client] --> B[API Gateway]\n    B --> C[Service 1]\n    B --> D[Service 2]\n    C --> E[Database]\n    D --> E",
        },
      },
      {
        id: "template-3",
        type: "code" as const,
        x: 100,
        y: 250,
        width: 300,
        height: 200,
        rotation: 0,
        title: "API Interface",
        content: {
          code: '// Example API endpoint\nPOST /api/users\n{\n  "name": "string",\n  "email": "string"\n}\n\nResponse:\n{\n  "id": "uuid",\n  "created": "timestamp"\n}',
          language: "javascript",
        },
      },
    ],
    connections: [],
  },
  {
    id: "brainstorming",
    name: "Brainstorming Session",
    description: "Capture ideas and explore creative solutions",
    icon: Lightbulb,
    category: "creative",
    tags: ["brainstorming", "ideas", "creative", "innovation"],
    color: "#7c3aed",
    tiles: [
      {
        id: "template-1",
        type: "text" as const,
        x: 300,
        y: 50,
        width: 300,
        height: 80,
        rotation: 0,
        title: "Challenge Statement",
        content: {
          text: "Clearly define the problem or opportunity we're addressing",
        },
      },
      {
        id: "template-2",
        type: "note" as const,
        x: 100,
        y: 200,
        width: 200,
        height: 150,
        rotation: 0,
        title: "Ideas",
        content: { text: "💡 Idea 1\n💡 Idea 2\n💡 Idea 3\n💡 Idea 4" },
      },
      {
        id: "template-3",
        type: "note" as const,
        x: 350,
        y: 200,
        width: 200,
        height: 150,
        rotation: 0,
        title: "Questions",
        content: {
          text: "❓ What if...?\n❓ How might we...?\n❓ Why not...?\n❓ What about...?",
        },
      },
      {
        id: "template-4",
        type: "note" as const,
        x: 600,
        y: 200,
        width: 200,
        height: 150,
        rotation: 0,
        title: "Next Steps",
        content: {
          text: "□ Research option A\n□ Prototype idea B\n□ Get feedback on C\n□ Schedule follow-up",
        },
      },
    ],
    connections: [],
  },
  {
    id: "workflow-mapping",
    name: "Workflow Mapping",
    description: "Map out processes and workflows",
    icon: Workflow,
    category: "process",
    tags: ["workflow", "process", "mapping", "flowchart"],
    color: "#ea580c",
    tiles: [
      {
        id: "template-1",
        type: "text" as const,
        x: 100,
        y: 100,
        width: 250,
        height: 80,
        rotation: 0,
        title: "Start",
        content: { text: "Process begins here" },
      },
      {
        id: "template-2",
        type: "text" as const,
        x: 400,
        y: 100,
        width: 250,
        height: 80,
        rotation: 0,
        title: "Step 1",
        content: { text: "First action or decision point" },
      },
      {
        id: "template-3",
        type: "text" as const,
        x: 700,
        y: 100,
        width: 250,
        height: 80,
        rotation: 0,
        title: "Step 2",
        content: { text: "Second action or decision point" },
      },
      {
        id: "template-4",
        type: "text" as const,
        x: 400,
        y: 250,
        width: 250,
        height: 80,
        rotation: 0,
        title: "End",
        content: { text: "Process completes here" },
      },
    ],
    connections: [
      {
        id: "conn-1",
        fromTileId: "template-1",
        toTileId: "template-2",
        fromSide: "right" as const,
        toSide: "left" as const,
      },
      {
        id: "conn-2",
        fromTileId: "template-2",
        toTileId: "template-3",
        fromSide: "right" as const,
        toSide: "left" as const,
      },
      {
        id: "conn-3",
        fromTileId: "template-3",
        toTileId: "template-4",
        fromSide: "bottom" as const,
        toSide: "top" as const,
      },
    ],
  },
];

const categories = [
  { id: "all", name: "All Templates" },
  { id: "basic", name: "Basic" },
  { id: "project", name: "Project Management" },
  { id: "documentation", name: "Documentation" },
  { id: "technical", name: "Technical" },
  { id: "creative", name: "Creative" },
  { id: "process", name: "Process" },
];

export default function TemplatesPage() {
  const router = useRouter();
  const boardManagement = useBoardStore();
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredTemplates =
    selectedCategory === "all"
      ? boardTemplates
      : boardTemplates.filter(
          (template) => template.category === selectedCategory,
        );

  const handleUseTemplate = (
    template: (typeof boardTemplates)[0],
    workstreamId: string,
  ) => {
    // Create a new board with template data
    const newBoardId = boardManagement.createBoard({
      workstreamId,
      name: `${template.name} Board`,
      description: `Created from ${template.name} template`,
      tags: template.tags,
      metadata: {
        tileCount: 0,
        connectionCount: 0,
        canvasBounds: { width: 0, height: 0, minX: 0, minY: 0 },
      },
      settings: {
        isPublic: false,
        allowComments: true,
        backgroundColor: "#ffffff",
        gridVisible: true,
      },
    });
    if (newBoardId) {
      // Map old tile IDs to newly generated ones
      const idMap = new Map<string, string>();
      const tiles = template.tiles.map((tile) => {
        const newId = generateId();
        idMap.set(tile.id, newId);
        return { ...tile, id: newId };
      });

      // Remap connection endpoints to the new tile IDs
      const connections = template.connections.map((conn) => ({
        ...conn,
        id: generateId(),
        fromTileId: idMap.get(conn.fromTileId) ?? conn.fromTileId,
        toTileId: idMap.get(conn.toTileId) ?? conn.toTileId,
      }));

      boardManagement.saveBoardData(newBoardId, {
        tiles,
        connections,
        assets: {},
        version: BOARD_DATA_VERSION,
      });

      // Keep board metadata in sync for dashboard displays
      boardManagement.updateBoard(newBoardId, {
        updatedAt: new Date(),
        metadata: {
          tileCount: tiles.length,
          connectionCount: connections.length,
          canvasBounds: { width: 1000, height: 600, minX: 0, minY: 0 },
        },
      });

      // Navigate to the new board
      router.push(`/board/${newBoardId}`);
    }
  };

  const workstreams = boardManagement.workstreams;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            
            <h1 className="font-semibold text-xl">Board Templates</h1>
          </div>
        </div>
        <p className="text-gray-600 mt-2">
          Start with a pre-built template to get up and running quickly
        </p>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* Category Filter */}
        <div className="mb-6">
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => {
            const IconComponent = template.icon;

            return (
              <Card
                key={template.id}
                className="group hover:shadow-lg transition-shadow"
              >
                <CardHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${template.color}20` }}
                    >
                      <IconComponent
                        className="h-6 w-6"
                        style={{ color: template.color }}
                      />
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                    </div>
                  </div>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>

                <CardContent>
                  {/* Preview */}
                  <div className="aspect-video bg-gray-100 rounded-lg mb-4 p-4 overflow-hidden relative">
                    <div className="text-xs text-gray-500 mb-2">
                      {template.tiles.length} tiles,{" "}
                      {template.connections.length} connections
                    </div>

                    {/* Simple tile preview */}
                    <div className="grid grid-cols-3 gap-2 h-16">
                      {template.tiles.slice(0, 6).map((_, index) => (
                        <div
                          key={index}
                          className="bg-white border rounded-sm p-1"
                          style={{
                            borderColor: template.color,
                            borderWidth: "1px",
                          }}
                        >
                          <div className="w-full h-full bg-gray-50 rounded-xs"></div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {template.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  {/* Use Template Button */}
                  {workstreams.length > 0 ? (
                    <Select
                      onValueChange={(workstreamId) =>
                        handleUseTemplate(template, workstreamId)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Use in workstream..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workstreams.map((workstream) => (
                          <SelectItem key={workstream.id} value={workstream.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: workstream.color }}
                              />
                              {workstream.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-gray-600 mb-3">
                        Create a workstream first
                      </p>
                      <Button
                        onClick={() => router.push("/")}
                        variant="outline"
                        size="sm"
                      >
                        Go to Dashboard
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
