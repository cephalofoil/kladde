import type { NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  ctx: RouteContext<"/api/boards/[id]">,
) {
  try {
    const { id } = await ctx.params;
    console.log("Processing PATCH for board:", id);

    try {
      await req.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const version = Date.now().toString();
    return Response.json({ version });
  } catch (error) {
    console.error("PATCH /api/boards/[id] failed:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
