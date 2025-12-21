"use client";

import { useRouter, usePathname } from "next/navigation";
import { useBoardStore } from "@/stores/board-management-store";
import { Button } from "@/components/ui/button";
// import { Separator } from "@/components/ui/separator";
import { Home, ChevronRight, Settings, Folder, FileText } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  color?: string;
}

export function BreadcrumbNav() {
  const router = useRouter();
  const pathname = usePathname();
  const boardManagement = useBoardStore();

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always start with Dashboard
    breadcrumbs.push({
      label: "Dashboard",
      href: "/",
      icon: Home,
    });

    // Parse the current path
    const pathSegments = pathname.split("/").filter((segment) => segment);

    if (pathSegments[0] === "workstream" && pathSegments[1]) {
      // Workstream page
      const workstreamId = pathSegments[1];
      const workstream = boardManagement.workstreams.find(
        (w) => w.id === workstreamId,
      );

      if (workstream) {
        breadcrumbs.push({
          label: workstream.name,
          href: `/workstream/${workstreamId}`,
          icon: Folder,
          color: workstream.color,
        });
      }
    } else if (pathSegments[0] === "board" && pathSegments[1]) {
      // Board page or board settings
      const boardId = pathSegments[1];
      const board = boardManagement.boards.find((b) => b.id === boardId);
      const workstream = board
        ? boardManagement.workstreams.find((w) => w.id === board.workstreamId)
        : null;

      if (workstream) {
        breadcrumbs.push({
          label: workstream.name,
          href: `/workstream/${workstream.id}`,
          icon: Folder,
          color: workstream.color,
        });
      }

      if (board) {
        breadcrumbs.push({
          label: board.name,
          href: `/board/${boardId}`,
          icon: FileText,
        });

        // Check if we're on settings page
        if (pathSegments[2] === "settings") {
          breadcrumbs.push({
            label: "Settings",
            icon: Settings,
          });
        }
      }
    } else if (pathSegments[0] === "templates") {
      // Templates page
      breadcrumbs.push({
        label: "Templates",
        href: "/templates",
      });
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs on dashboard
  }

  return (
    <nav className="flex items-center gap-2 text-sm text-gray-600">
      {breadcrumbs.map((breadcrumb, index) => {
        const isLast = index === breadcrumbs.length - 1;
        const IconComponent = breadcrumb.icon;

        return (
          <div key={index} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-3 w-3 text-gray-400" />}

            {breadcrumb.href && !isLast ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  router.push(
                    breadcrumb.href! as Parameters<typeof router.push>[0],
                  )
                }
                className="flex items-center gap-2 h-8 px-2 text-gray-600 hover:text-gray-900"
              >
                {IconComponent && (
                  <IconComponent
                    className="h-3 w-3"
                    style={
                      breadcrumb.color ? { color: breadcrumb.color } : undefined
                    }
                  />
                )}
                {breadcrumb.label}
              </Button>
            ) : (
              <div
                className={`flex items-center gap-2 px-2 py-1 ${isLast ? "text-gray-900 font-medium" : "text-gray-600"}`}
              >
                {IconComponent && (
                  <IconComponent
                    className="h-3 w-3"
                    style={
                      breadcrumb.color ? { color: breadcrumb.color } : undefined
                    }
                  />
                )}
                {breadcrumb.label}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// Standalone breadcrumb component for use in headers
export function HeaderBreadcrumb() {
  return (
    <div className="flex items-center gap-4">
      <BreadcrumbNav />
    </div>
  );
}
