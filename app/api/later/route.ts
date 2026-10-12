import { NextResponse, type NextRequest } from "next/server";
import { addLater, removeLater, reorderLater } from "@/lib/store";
import type { Video } from "@/lib/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as
    | { action: "add"; shelf: string; videos: Video[] }
    | { action: "remove" | "reorder"; shelf: string; ids: string[] };
  const shelf = String(body.shelf ?? "");
  if (!shelf || shelf.includes("|")) return NextResponse.json({ error: "Missing shelf" }, { status: 400 });
  if (body.action === "add" && Array.isArray(body.videos)) await addLater(shelf, body.videos);
  else if (body.action === "remove" && Array.isArray(body.ids)) await removeLater(shelf, body.ids.map(String));
  else if (body.action === "reorder" && Array.isArray(body.ids)) await reorderLater(shelf, body.ids.map(String));
  else return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  return NextResponse.json({ ok: true });
}
