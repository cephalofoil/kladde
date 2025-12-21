import { BoardDashboard } from "@/components/dashboard/board-dashboard";

// Force dynamic rendering to avoid SSR issues with document usage
export const dynamic = "force-dynamic";

export default function HomePage() {
  return <BoardDashboard />;
}
