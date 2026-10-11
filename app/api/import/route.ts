import { NextResponse, type NextRequest } from "next/server";
import { importChannels } from "@/lib/store";
import type { Channel } from "@/lib/types";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows.filter((r) => r.some((f) => f.trim()));
}

const CHANNEL_ID = /^UC[\w-]{22}$/;

export async function POST(request: NextRequest) {
  const { csv } = (await request.json()) as { csv?: string };
  const rows = parseCsv((csv ?? "").replace(/^﻿/, ""));
  // Takeout's header is "Channel Id,Channel Url,Channel Title" (localized in some languages),
  // so fall back to column positions and validate IDs instead of trusting the header.
  const header = rows[0]?.map((h) => h.toLowerCase()) ?? [];
  const idCol = Math.max(0, header.findIndex((h) => h.includes("id")));
  const titleIdx = header.findIndex((h) => h.includes("title"));
  const titleCol = titleIdx >= 0 ? titleIdx : 2;

  const channels: Channel[] = [];
  for (const row of rows) {
    const id = row[idCol]?.trim();
    if (id && CHANNEL_ID.test(id)) channels.push({ id, title: row[titleCol]?.trim() || id });
  }
  if (channels.length === 0) {
    return NextResponse.json({ error: "No channel IDs found in that file." }, { status: 400 });
  }
  const added = await importChannels(channels);
  return NextResponse.json({ found: channels.length, added });
}
