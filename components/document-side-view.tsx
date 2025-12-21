"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  User,
  Tag,
  Download,
  Plus,
  X,
  Share2,
  Edit3,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface DocumentContent {
  title: string;
  description: string;
  status: "draft" | "in-progress" | "review" | "completed";
  dueDate?: string;
  assignees: string[];
  tags: string[];
  attachments: Array<{
    name: string;
    size: string;
    type: string;
  }>;
  subtasks: Array<{
    id: string;
    text: string;
    completed: boolean;
    isBlocker?: boolean;
  }>;
  comments: Array<{
    id: string;
    author: string;
    text: string;
    timestamp: string;
  }>;
}

interface DocumentSideViewProps {
  isOpen: boolean;
  content: DocumentContent;
  onClose: () => void;
  onUpdate: (updates: Partial<DocumentContent>) => void;
}

/**
 * Right-side sliding panel for viewing and editing a document/project.
 *
 * Renders document metadata (title, status, due date, assignees, tags),
 * description, attachments, and a three-tab area for subtasks, comments,
 * and activities. Supports inline title editing with validation (minimum
 * 2 characters), content updates via `onUpdate`, and a timed close animation
 * before calling `onClose`.
 *
 * Notes:
 * - Clicking the backdrop triggers a close animation and calls `onClose`
 *   after ~300ms.
 * - Title edits are validated and only propagated via `onUpdate` when the
 *   trimmed title differs from the original; failures revert the local edit.
 * - Subtask toggles call `onUpdate` with the updated `subtasks` array.
 *
 * @returns A React element for the side panel when `isOpen` and `content`
 * are provided; otherwise `null`.
 */
export function DocumentSideView({
  isOpen,
  content,
  onClose,
  onUpdate,
}: DocumentSideViewProps) {
  const [activeTab, setActiveTab] = useState<
    "subtasks" | "comments" | "activities"
  >("subtasks");
  const [isAnimating, setIsAnimating] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    if (isOpen) {
      // Start from right side
      setIsAnimating(true);
      // Animate in from right
      setTimeout(() => setIsAnimating(false), 50);
    } else {
      setIsAnimating(false);
    }
  }, [isOpen]);

  // Update editingTitle when content changes (but only if not currently editing)
  useEffect(() => {
    if (!isEditingTitle) {
      setEditingTitle(content.title || "");
    }
  }, [content.title, isEditingTitle]);

  const handleClose = () => {
    setIsAnimating(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleTitleEdit = () => {
    setIsEditingTitle(true);
    setEditingTitle(content.title || "");
  };

  const handleTitleSave = () => {
    const trimmedTitle = editingTitle.trim();
    console.log("Saving title:", {
      trimmedTitle,
      originalTitle: content.title,
      isDifferent: trimmedTitle !== content.title,
    });

    // Validate title length
    if (trimmedTitle.length < 2) {
      console.log("Title too short, resetting to original");
      setEditingTitle(content.title || "");
      setIsEditingTitle(false);
      return;
    }

    if (trimmedTitle !== content.title) {
      try {
        console.log("Calling onUpdate with:", { title: trimmedTitle });
        onUpdate({ title: trimmedTitle });
      } catch (error) {
        console.error("Error updating title:", error);
        // Reset to original title if update fails
        setEditingTitle(content.title || "");
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleTitleSave();
    } else if (e.key === "Escape") {
      setEditingTitle(content.title || "");
      setIsEditingTitle(false);
    }
    // Prevent backspace from bubbling up and causing navigation issues
    e.stopPropagation();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "in-progress":
        return "bg-blue-100 text-blue-800";
      case "review":
        return "bg-yellow-100 text-yellow-800";
      case "completed":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "draft":
        return "📝";
      case "in-progress":
        return "🔄";
      case "review":
        return "👀";
      case "completed":
        return "✅";
      default:
        return "📝";
    }
  };

  if (!isOpen || !content) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/20 flex items-start justify-end"
      onClick={handleClose}
    >
      <div
        className={`w-1/2 h-full bg-white shadow-2xl rounded-l-2xl overflow-hidden transform transition-transform duration-300 ease-in-out mt-4`}
        style={{
          transform: isAnimating ? "translateX(100%)" : "translateX(0%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="text-sm text-gray-500 mb-1">
                Craftboard Project /{" "}
                {content.status === "in-progress"
                  ? "On Progress"
                  : content.status}
              </div>
              {isEditingTitle ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                  placeholder="Untitled Document"
                  className="text-xl font-semibold text-gray-900 mb-2 bg-transparent border-none outline-none w-full cursor-text"
                  autoFocus
                />
              ) : (
                <h2
                  className="text-xl font-semibold text-gray-900 mb-2 cursor-text hover:bg-gray-50 px-1 py-1 rounded transition-colors"
                  onClick={handleTitleEdit}
                  title="Click to edit title"
                >
                  {content.title || "Untitled Document"}
                </h2>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <Share2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm">
                <Edit3 className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>Duplicate</DropdownMenuItem>
                  <DropdownMenuItem>Export</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">{getStatusIcon(content.status)}</span>
            <Badge className={getStatusColor(content.status)}>
              {content.status === "in-progress"
                ? "On Progress"
                : content.status}
            </Badge>
          </div>

          {/* Due Date */}
          {content.dueDate && (
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">{content.dueDate}</span>
            </div>
          )}

          {/* Assignees */}
          <div className="flex items-center gap-2 mb-3">
            <User className="h-4 w-4 text-gray-500" />
            <div className="flex items-center gap-2">
              {content.assignees.map((assignee, index) => (
                <div
                  key={index}
                  className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-medium"
                >
                  {assignee
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </div>
              ))}
              <Button variant="outline" size="sm">
                Invite
              </Button>
            </div>
          </div>

          {/* Tags */}
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-gray-500" />
            <div className="flex gap-1">
              {content.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="mb-4">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Description
            </Label>
            <Textarea
              value={content.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Add description..."
              className="min-h-[80px]"
            />
          </div>

          {/* Attachments */}
          <div className="mb-4">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">
              Attachments ({content.attachments.length})
            </Label>
            <div className="space-y-2">
              {content.attachments.map((attachment, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                      📎
                    </div>
                    <div>
                      <div className="text-sm font-medium">
                        {attachment.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {attachment.size}
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Attachment
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex">
            {[
              { id: "subtasks", label: "Subtasks" },
              { id: "comments", label: "Comments" },
              { id: "activities", label: "Activities" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() =>
                  setActiveTab(tab.id as "subtasks" | "comments" | "activities")
                }
                className={`flex-1 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "subtasks" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Our Design Process</h3>
                <Badge variant="secondary">
                  {content.subtasks.filter((s) => s.completed).length}/
                  {content.subtasks.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {content.subtasks.map((subtask) => (
                  <div key={subtask.id} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={subtask.completed}
                      onChange={(e) => {
                        const updatedSubtasks = content.subtasks.map((s) =>
                          s.id === subtask.id
                            ? { ...s, completed: e.target.checked }
                            : s,
                        );
                        onUpdate({ subtasks: updatedSubtasks });
                      }}
                      className="mt-1"
                    />
                    <div
                      className={`flex-1 ${subtask.completed ? "line-through text-gray-500" : ""}`}
                    >
                      {subtask.text}
                    </div>
                    {subtask.isBlocker && (
                      <Badge variant="destructive" className="text-xs">
                        Blocker
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "comments" && (
            <div>
              <h3 className="text-lg font-medium mb-4">Comments</h3>
              <div className="space-y-4">
                {content.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="border-l-2 border-gray-200 pl-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs font-medium">
                        {comment.author
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <span className="text-sm font-medium">
                        {comment.author}
                      </span>
                      <span className="text-xs text-gray-500">
                        {comment.timestamp}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "activities" && (
            <div>
              <h3 className="text-lg font-medium mb-4">Recent Activities</h3>
              <div className="space-y-3">
                <div className="text-sm text-gray-600">
                  No recent activities
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
