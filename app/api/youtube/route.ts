import { NextResponse } from "next/server";
import { refreshAll, unlinkYoutube } from "@/lib/store";

export const maxDuration = 60;

// Sync now: the subscription sync runs as part of a full refresh, so new channels arrive with their videos.
export async function POST() {
  const r = await refreshAll();
  if (!r.subscriptions) return NextResponse.json({ error: "No YouTube account is connected." }, { status: 400 });
  if ("error" in r.subscriptions) return NextResponse.json({ error: r.subscriptions.error }, { status: 502 });
  return NextResponse.json(r.subscriptions);
}

// Disconnect: revoke Moodtube's access at Google and forget the token. The channels stay.
export async function DELETE() {
  await unlinkYoutube();
  return NextResponse.json({ ok: true });
}
