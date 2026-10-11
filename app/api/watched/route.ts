import { NextResponse, type NextRequest } from "next/server";
import { setWatched } from "@/lib/store";

export async function POST(request: NextRequest) {
  const { ids, watched } = (await request.json()) as { ids?: string[]; watched?: boolean };
  if (!Array.isArray(ids)) return NextResponse.json({ error: "ids must be an array" }, { status: 400 });
  await setWatched(ids.map(String), watched !== false);
  return NextResponse.json({ ok: true });
}
