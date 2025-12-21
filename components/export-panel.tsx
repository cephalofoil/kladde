"use client";

import type React from "react";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FileJson, ImageIcon } from "lucide-react";
import type { TileData } from "@/types/canvas";
import { WorkspaceIO } from "./workspace-io";

interface ExportPanelProps {
  tiles: TileData[];
  canvasSize: { width: number; height: number };
}

export function ExportPanel({ tiles, canvasSize }: ExportPanelProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportJSON = () => {
    const exportData = {
      version: "1.0",
      tiles: tiles,
      canvasSize: canvasSize,
      exportedAt: new Date().toISOString(),
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-canvas-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportPNG = async () => {
    setIsExporting(true);
    try {
      // Mock export for prototype
      await new Promise((resolve) => setTimeout(resolve, 1000));
      alert("PNG export would work in full implementation!");
    } catch (error) {
      console.error("Export PNG failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="h-full p-4">
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Save & Export</span>
            <Badge variant="secondary">{tiles.length} tiles</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Workspace Import/Export */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Workspace</Label>
            <WorkspaceIO />
          </div>

          <Separator />

          {/* Legacy Export Options */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Legacy Export</Label>
            <div className="space-y-2">
              <Button
                onClick={handleExportJSON}
                variant="outline"
                size="sm"
                className="w-full bg-transparent"
              >
                <FileJson className="h-3 w-3 mr-2" />
                Export as JSON (Legacy)
              </Button>
              <Button
                onClick={handleExportPNG}
                variant="outline"
                size="sm"
                className="w-full bg-transparent"
                disabled={isExporting || tiles.length === 0}
              >
                <ImageIcon className="h-3 w-3 mr-2" />
                {isExporting ? "Exporting..." : "Export as PNG (Mock)"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
