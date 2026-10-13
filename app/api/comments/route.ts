import { NextResponse, type NextRequest } from "next/server";
import { fetchComments } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const v = request.nextUrl.searchParams.get("v") ?? "";
  const page = request.nextUrl.searchParams.get("page") ?? undefined;
  if (!/^[\w-]{11}$/.test(v)) return NextResponse.json({ error: "Bad video id" }, { status: 400 });
  try {
    return NextResponse.json(await fetchComments(v, page));
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
