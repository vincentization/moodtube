import { NextResponse, type NextRequest } from "next/server";
import { saveGroups } from "@/lib/store";
import { GROUP_COLORS } from "@/lib/groups";
import type { Group } from "@/lib/types";

export async function PUT(request: NextRequest) {
  const { groups } = (await request.json()) as { groups?: Group[] };
  if (!Array.isArray(groups)) return NextResponse.json({ error: "groups must be an array" }, { status: 400 });
  const clean: Group[] = groups.map((g) => ({
    id: String(g.id),
    name: String(g.name ?? "").slice(0, 80) || "Untitled",
    channelIds: Array.isArray(g.channelIds) ? [...new Set(g.channelIds.map(String))] : [],
    rules: {
      keyword: g.rules?.keyword?.trim() || undefined,
      minMinutes: g.rules?.minMinutes && g.rules.minMinutes > 0 ? Number(g.rules.minMinutes) : undefined,
      noShorts: !!g.rules?.noShorts || undefined,
    },
    color: GROUP_COLORS.includes(String(g.color)) ? String(g.color) : undefined,
  }));
  await saveGroups(clean);
  return NextResponse.json({ ok: true });
}
