"use client";

import { CommandPalette } from "@/components/navigation/command-palette";
import { DashboardHeader } from "./dashboard-header";
import { WorkstreamSidebar } from "./workstream-sidebar";
import { BoardGrid } from "./board-grid";
import { QuickActions } from "./quick-actions";
import { useBoardStoreLifecycle } from "@/stores/board-management-store";

export function BoardDashboard() {
  // Setup board store lifecycle events
  useBoardStoreLifecycle();
  return (
    <div className="h-screen flex bg-gray-50">
      {/* Sidebar */}
      <WorkstreamSidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <DashboardHeader />

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-6">
            {/* Quick Actions */}
            <QuickActions />

            {/* Board Grid */}
            <BoardGrid />
          </div>
        </div>
      </div>

      {/* Global Command Palette */}
      <CommandPalette />
    </div>
  );
}

export default BoardDashboard;
