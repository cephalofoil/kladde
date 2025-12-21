"use client";

import { useState, useEffect, useMemo, type ComponentType } from "react";
import { useBoardStore } from "@/stores/board-management-store";
import { useEventListener } from "@/hooks/useEventListener";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  X,
  Settings,
  Type,
  Layers,
  Bug,
  Zap,
  FileText,
  Image as ImageIcon,
  Trash2,
  Database,
  Download,
  Upload,
  Wifi,
  HardDrive,
  List,
} from "lucide-react";
import FontTest from "./font-test";
import { TilePreview } from "./tile-preview";
import { DocEmptyIcon, DocLinesIcon } from "@/components/icons";
import { PROMPT_TEMPLATES } from "./prompt-writer";
// Template management removed for local-first version
// import { TemplateManagement } from "./admin/template-management";

interface AdminDevPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminDevPanel({ isOpen, onClose }: AdminDevPanelProps) {
  const [activeTab, setActiveTab] = useState("fonts");
  const boardManagement = useBoardStore();

  const [localStorageStats, setLocalStorageStats] = useState({
    size: "0 B",
    count: 0,
  });
  const [online, setOnline] = useState(true);
  const [navigatorInfo, setNavigatorInfo] = useState("");

  const environment = process.env.NODE_ENV ?? "development";
  const architecture = "Multi-Board";

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window !== "undefined") {
      const entries = Object.entries(localStorage);
      const total = entries.reduce(
        (sum, [k, v]) => sum + k.length + (v?.length ?? 0),
        0,
      );
      const format = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      };
      setLocalStorageStats({ size: format(total), count: entries.length });
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setNavigatorInfo(navigator.userAgent);
    }
    if (typeof window !== "undefined") {
      setOnline(navigator.onLine);
    }
  }, []);

  const updateOnline = () => setOnline(navigator.onLine);
  useEventListener(
    "online",
    updateOnline,
    typeof window !== "undefined" ? window : null,
  );
  useEventListener(
    "offline",
    updateOnline,
    typeof window !== "undefined" ? window : null,
  );

  const systemInfoItems = [
    { label: "Environment", value: environment },
    { label: "Architecture", value: architecture },
    { label: "Store Status", value: boardManagement.status },
    { label: "Boards", value: boardManagement.boards.length },
    { label: "Workstreams", value: boardManagement.workstreams.length },
  ];

  const templateGroups = useMemo(() => Object.entries(PROMPT_TEMPLATES), []);

  const templateMeta: Record<
    string,
    { title: string; icon: ComponentType<{ className?: string }> }
  > = {
    text: { title: "Text Block Templates", icon: Type },
    code: { title: "Code Block Templates", icon: Layers },
    mermaid: { title: "Mermaid Diagram Templates", icon: Zap },
    note: { title: "Note Block Templates", icon: Bug },
  };

  // Generate test data by dispatching event to canvas workspace
  const handleGenerateTestData = () => {
    if (
      window.confirm("Generate test data? This will replace all current tiles.")
    ) {
      window.dispatchEvent(new CustomEvent("generate-test-data-requested"));
    }
  };

  // Clear all data
  const handleClearAllData = () => {
    if (
      window.confirm(
        "Clear all data? This will delete all tiles and connections.",
      )
    ) {
      window.dispatchEvent(new CustomEvent("clear-all-data-requested"));
    }
  };

  // Export current board data
  const handleExportBoard = () => {
    if (!boardManagement.currentBoardId) {
      alert("No active board to export");
      return;
    }

    const boardData = boardManagement.loadBoardData(
      boardManagement.currentBoardId,
    );
    const board = boardManagement.boards.find(
      (b) => b.id === boardManagement.currentBoardId,
    );

    const exportData = {
      board,
      data: boardData,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `board-${board?.name || boardManagement.currentBoardId}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBoard = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            window.dispatchEvent(
              new CustomEvent("import-board-data-requested", { detail: data }),
            );
          } catch (err) {
            console.error(err);
            alert("Invalid JSON file");
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const quickActions = [
    {
      id: "generate",
      title: "Test Data",
      icon: FileText,
      button: {
        text: "Generate Test Data",
        icon: Zap,
        variant: "default" as const,
        onClick: handleGenerateTestData,
      },
      description: "Creates sample tiles with various content types",
    },
    {
      id: "export",
      title: "Export Board",
      icon: Download,
      button: {
        text: "Export Current Board",
        icon: Download,
        variant: "outline" as const,
        onClick: handleExportBoard,
        disabled: !boardManagement.currentBoardId,
      },
      description: "Download board data as JSON file",
    },
    {
      id: "clear",
      title: "Clear Data",
      icon: Trash2,
      button: {
        text: "Clear All Data",
        icon: Trash2,
        variant: "destructive" as const,
        onClick: handleClearAllData,
      },
      description: "Removes all tiles and connections from current board",
    },
    {
      id: "import",
      title: "Import Data",
      icon: Upload,
      button: {
        text: "Import Board Data",
        icon: Upload,
        variant: "outline" as const,
        onClick: handleImportBoard,
      },
      description: "Import board data from JSON file",
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-4 bg-background rounded-lg shadow-2xl border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Admin Development Panel</h1>
              <p className="text-sm text-muted-foreground">
                Development tools and component playground
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex h-[calc(100%-80px)]">
          {/* Sidebar */}
          <div className="w-64 border-r bg-muted/30 p-4">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">
                  Development Tools
                </h3>
                <div className="space-y-1">
                  <Button
                    variant={activeTab === "fonts" ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab("fonts")}
                  >
                    <Type className="h-4 w-4 mr-2" />
                    Font Testing
                  </Button>
                  <Button
                    variant={activeTab === "icons" ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab("icons")}
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Icon Testing
                  </Button>
                  <Button
                    variant={activeTab === "components" ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab("components")}
                  >
                    <Layers className="h-4 w-4 mr-2" />
                    Tile Renderers
                  </Button>
                  <Button
                    variant={activeTab === "debug" ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab("debug")}
                  >
                    <Bug className="h-4 w-4 mr-2" />
                    Debug Tools
                  </Button>
                  <Button
                    variant={activeTab === "actions" ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab("actions")}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Actions
                  </Button>
                  <Button
                    variant={activeTab === "templates" ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => setActiveTab("templates")}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    AI Templates
                  </Button>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold text-sm mb-2">System Info</h3>
                <div className="space-y-2 text-xs">
                  {systemInfoItems.map((item) => (
                    <div key={item.label} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {item.label}:
                      </span>
                      <Badge variant="outline">{item.value}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 p-6 overflow-auto">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full"
            >
              {/* Font Testing Tab */}
              <TabsContent value="fonts" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    Font Testing & Typography
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Test and preview all available fonts, weights, and
                    typography styles
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Type className="h-5 w-5" />
                      Font Playground
                    </CardTitle>
                    <CardDescription>
                      Interactive font testing with Switzer (default) and Outfit
                      fonts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FontTest />
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Icon Testing Tab */}
              <TabsContent value="icons" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    Custom Icon Testing
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    Test and preview your custom icons with different sizes,
                    colors, and styles
                  </p>
                </div>

                {/* Icon Showcase */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5" />
                      Icon Showcase
                    </CardTitle>
                    <CardDescription>
                      Your custom document icons with various configurations
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Basic Icons */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">
                          Basic Icons
                        </h3>
                        <div className="flex items-center gap-6">
                          <div className="flex flex-col items-center gap-2">
                            <DocEmptyIcon size={32} />
                            <span className="text-sm text-muted-foreground">
                              DocEmptyIcon
                            </span>
                          </div>
                          <div className="flex flex-col items-center gap-2">
                            <DocLinesIcon size={32} />
                            <span className="text-sm text-muted-foreground">
                              DocLinesIcon
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Different Sizes */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">
                          Different Sizes
                        </h3>
                        <div className="flex items-center gap-4">
                          <DocEmptyIcon size={16} />
                          <DocEmptyIcon size={24} />
                          <DocEmptyIcon size={32} />
                          <DocEmptyIcon size={48} />
                          <DocEmptyIcon size={64} />
                        </div>
                      </div>

                      {/* Different Colors */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">
                          Different Colors
                        </h3>
                        <div className="flex items-center gap-4">
                          <DocLinesIcon size={32} color="blue" />
                          <DocLinesIcon size={32} color="green" />
                          <DocLinesIcon size={32} color="red" />
                          <DocLinesIcon size={32} color="purple" />
                          <DocLinesIcon size={32} color="orange" />
                        </div>
                      </div>

                      {/* With Tailwind Classes */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">
                          With Tailwind Classes
                        </h3>
                        <div className="flex items-center gap-4">
                          <DocEmptyIcon
                            size={32}
                            className="text-blue-500 hover:text-blue-700 transition-colors"
                          />
                          <DocEmptyIcon
                            size={32}
                            className="text-green-500 hover:text-green-700 transition-colors"
                          />
                          <DocEmptyIcon
                            size={32}
                            className="text-red-500 hover:text-red-700 transition-colors"
                          />
                          <DocEmptyIcon
                            size={32}
                            className="text-purple-500 hover:text-purple-700 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Interactive Demo */}
                      <div>
                        <h3 className="text-lg font-semibold mb-3">
                          Interactive Demo
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-3 mb-2">
                              <DocEmptyIcon
                                size={24}
                                className="text-blue-500"
                              />
                              <span className="font-medium">
                                Empty Document
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Click to see hover effects and transitions
                            </p>
                          </div>
                          <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                            <div className="flex items-center gap-3 mb-2">
                              <DocLinesIcon
                                size={24}
                                className="text-green-500"
                              />
                              <span className="font-medium">
                                Document with Lines
                              </span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Click to see hover effects and transitions
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Components Tab */}
              <TabsContent value="components" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Tile Renderers</h2>
                  <p className="text-muted-foreground mb-6">
                    Preview and test all tile content renderers
                  </p>
                </div>
                <TilePreview />
              </TabsContent>

              {/* Debug Tab */}
              <TabsContent value="debug" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Debug Tools</h2>
                  <p className="text-muted-foreground mb-6">
                    Development debugging and inspection tools
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Bug className="h-5 w-5" />
                        System Status
                      </CardTitle>
                      <CardDescription>
                        Current state of the application architecture
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { label: "Architecture", value: architecture },
                          {
                            label: "Store Status",
                            value: boardManagement.status,
                          },
                          {
                            label: "Current Board",
                            value: boardManagement.currentBoardId || "None",
                          },
                        ].map((item) => (
                          <div
                            key={item.label}
                            className="flex justify-between"
                          >
                            <span>{item.label}:</span>
                            <Badge variant="outline">{item.value}</Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Database className="h-5 w-5" />
                        Data Overview
                      </CardTitle>
                      <CardDescription>
                        Overview of workstreams, boards, and board data
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Workstreams:</span>
                          <Badge variant="outline">
                            {boardManagement.workstreams.length}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Boards:</span>
                          <Badge variant="outline">
                            {boardManagement.boards.length}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Board Data Keys:</span>
                          <Badge variant="outline">
                            {Object.keys(boardManagement.boardData).length}
                          </Badge>
                        </div>
                        {boardManagement.currentBoardId && (
                          <>
                            <Separator />
                            <div>
                              <span className="text-sm font-medium">
                                Current Board Data:
                              </span>
                              <div className="mt-2 text-xs space-y-1">
                                {(() => {
                                  const currentData =
                                    boardManagement.loadBoardData(
                                      boardManagement.currentBoardId,
                                    );
                                  return (
                                    <>
                                      <div className="flex justify-between">
                                        <span>Tiles:</span>
                                        <Badge variant="outline">
                                          {currentData?.tiles?.length || 0}
                                        </Badge>
                                      </div>
                                      <div className="flex justify-between">
                                        <span>Connections:</span>
                                        <Badge variant="outline">
                                          {currentData?.connections?.length ||
                                            0}
                                        </Badge>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <List className="h-5 w-5" />
                        Workstreams
                      </CardTitle>
                      <CardDescription>Boards per workstream</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {boardManagement.workstreams.length ? (
                        <div className="space-y-2 text-sm">
                          {boardManagement.workstreams.map((ws) => {
                            const boards = boardManagement.getWorkstreamBoards(
                              ws.id,
                            );
                            return (
                              <div key={ws.id} className="flex justify-between">
                                <span>{ws.name}</span>
                                <Badge variant="outline">{boards.length}</Badge>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          No workstreams
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <HardDrive className="h-5 w-5" />
                        Storage
                      </CardTitle>
                      <CardDescription>localStorage usage</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Entries:</span>
                          <Badge variant="outline">
                            {localStorageStats.count}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Size:</span>
                          <Badge variant="outline">
                            {localStorageStats.size}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Wifi className="h-5 w-5" />
                        Network
                      </CardTitle>
                      <CardDescription>
                        Connection status and user agent
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between mb-2">
                        <span>Status:</span>
                        <Badge variant={online ? "default" : "destructive"}>
                          {online ? "Online" : "Offline"}
                        </Badge>
                      </div>
                      <div className="text-xs break-words">{navigatorInfo}</div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Debug Console</CardTitle>
                    <CardDescription>
                      Real-time debugging information and logs
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted p-4 rounded-lg font-mono text-sm space-y-1">
                      {[
                        `Environment: ${environment}`,
                        `Store status: ${boardManagement.status}`,
                        `Boards: ${boardManagement.boards.length}`,
                        `Online: ${online}`,
                      ].map((log, idx) => (
                        <div key={idx}>{log}</div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Actions Tab */}
              <TabsContent value="actions" className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-2">Quick Actions</h2>
                  <p className="text-muted-foreground mb-6">
                    Development actions for testing and data management
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {quickActions.map((action) => {
                    const Icon = action.icon;
                    const ButtonIcon = action.button.icon;
                    return (
                      <Card key={action.id}>
                        <CardHeader>
                          <CardTitle className="text-base flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {action.title}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <Button
                            onClick={action.button.onClick}
                            variant={action.button.variant}
                            className="w-full flex items-center gap-2"
                            disabled={action.button.disabled}
                          >
                            <ButtonIcon className="h-4 w-4" />
                            {action.button.text}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            {action.description}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>

              {/* AI Templates Tab - Removed for local-first version */}
              {/* <TabsContent value="templates" className="space-y-6">
                <TemplateManagement />
              </TabsContent> */}
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
