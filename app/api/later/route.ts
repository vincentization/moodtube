import { NextResponse, type NextRequest } from "next/server";
import { addLater, removeLater, reorderLater } from "@/lib/store";
import type { Video } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as
    | { action: "add"; videos: Video[] }
    | { action: "remove" | "reorder"; ids: string[] };
  if (body.action === "add" && Array.isArray(body.videos)) await addLater(body.videos);
  else if (body.action === "remove" && Array.isArray(body.ids)) await removeLater(body.ids.map(String));
  else if (body.action === "reorder" && Array.isArray(body.ids)) await reorderLater(body.ids.map(String));
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
