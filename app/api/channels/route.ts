import { NextResponse, type NextRequest } from "next/server";
import { removeChannel } from "@/lib/store";

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await removeChannel(id);
  return NextResponse.json({ ok: true });
}
