"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBoardStore } from "@/stores/board-management-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/dates/format";
// import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function BoardSettingsPage() {
  const router = useRouter();
  const boardManagement = useBoardStore();
  const { boardId } = useParams<{ boardId: string }>();

  const currentBoard = boardManagement.boards.find((b) => b.id === boardId);
  const currentWorkstream = currentBoard
    ? boardManagement.workstreams.find(
        (w) => w.id === currentBoard.workstreamId,
      )
    : null;

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    tags: "",
    backgroundColor: "#ffffff",
    gridVisible: true,
    allowComments: true,
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (currentBoard) {
      setFormData({
        name: currentBoard.name,
        description: currentBoard.description || "",
        tags: currentBoard.tags.join(", "),
        backgroundColor: currentBoard.settings.backgroundColor,
        gridVisible: currentBoard.settings.gridVisible,
        allowComments: currentBoard.settings.allowComments,
      });
    }
  }, [currentBoard]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!currentBoard) return;

    setIsSaving(true);

    try {
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      boardManagement.updateBoard(boardId, {
        name: formData.name,
        description: formData.description,
        tags,
        settings: {
          ...currentBoard.settings,
          backgroundColor: formData.backgroundColor,
          gridVisible: formData.gridVisible,
          allowComments: formData.allowComments,
        },
      });

      setIsDirty(false);
    } catch (error) {
      console.error("Failed to save board settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBoard = () => {
    if (!currentBoard) return;

    boardManagement.deleteBoard(boardId);

    // Navigate back to workstream or dashboard
    if (currentWorkstream) {
      router.push(`/workstream/${currentWorkstream.id}`);
    } else {
      router.push("/");
    }
  };

  const handleDuplicateBoard = () => {
    if (!currentBoard) return;

    boardManagement.duplicateBoard(boardId);
    router.push("/"); // Navigate to dashboard to see the new board
  };

  if (!currentBoard) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Board not found</p>
          <Button onClick={() => router.push("/")} variant="outline">
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/board/${boardId}`)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Board
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex flex-row gap-2 items-baseline">
              <h1 className="font-semibold text-xl">Board Settings</h1>
              <p className="text-sm text-gray-600">{currentBoard.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </header>

      {/* Settings Content */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Update your board name and description
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Board Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="Enter board name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  handleInputChange("description", e.target.value)
                }
                placeholder="Enter board description"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => handleInputChange("tags", e.target.value)}
                placeholder="Enter tags separated by commas"
              />
              <p className="text-xs text-gray-500 mt-1">
                Separate tags with commas (e.g., design, planning, review)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how your board looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="backgroundColor">Background Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="backgroundColor"
                  type="color"
                  value={formData.backgroundColor}
                  onChange={(e) =>
                    handleInputChange("backgroundColor", e.target.value)
                  }
                  className="w-20 h-10"
                />
                <Input
                  value={formData.backgroundColor}
                  onChange={(e) =>
                    handleInputChange("backgroundColor", e.target.value)
                  }
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="gridVisible">Show Grid</Label>
                <p className="text-sm text-gray-600">
                  Display grid lines on the canvas
                </p>
              </div>
              <Switch
                id="gridVisible"
                checked={formData.gridVisible}
                onCheckedChange={(checked) =>
                  handleInputChange("gridVisible", checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Collaboration */}
        <Card>
          <CardHeader>
            <CardTitle>Collaboration</CardTitle>
            <CardDescription>
              Control how others can interact with your board
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="allowComments">Allow Comments</Label>
                <p className="text-sm text-gray-600">
                  Enable comments and annotations
                </p>
              </div>
              <Switch
                id="allowComments"
                checked={formData.allowComments}
                onCheckedChange={(checked) =>
                  handleInputChange("allowComments", checked)
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Board Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Board Actions</CardTitle>
            <CardDescription>
              Manage your board with these actions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h4 className="font-medium">Duplicate Board</h4>
                <p className="text-sm text-gray-600">
                  Create a copy of this board with all its content
                </p>
              </div>
              <Button onClick={handleDuplicateBoard} variant="outline">
                Duplicate
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
              <div>
                <h4 className="font-medium text-red-800">Delete Board</h4>
                <p className="text-sm text-red-600">
                  Permanently delete this board and all its content
                </p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the board &ldquo;{currentBoard.name}&rdquo; and all of its
                      content.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteBoard}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete Board
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Board Information */}
        <Card>
          <CardHeader>
            <CardTitle>Board Information</CardTitle>
            <CardDescription>Details about this board</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Created:</span>
              <span>{formatDate(currentBoard.createdAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Last Modified:</span>
              <span>{formatDate(currentBoard.updatedAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Tiles:</span>
              <span>{currentBoard.metadata.tileCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Connections:</span>
              <span>{currentBoard.metadata.connectionCount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Workstream:</span>
              <span>{currentWorkstream?.name || "Unknown"}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
