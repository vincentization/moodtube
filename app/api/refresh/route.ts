import { NextResponse } from "next/server";
import { refreshAll } from "@/lib/store";

export const maxDuration = 60;

export async function POST() {
  return NextResponse.json(await refreshAll());
}
