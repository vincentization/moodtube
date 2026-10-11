import { K, db } from "./redis";
import type { AppState, Channel, Group, LaterItem, Video } from "./types";
import { fetchDurations, fetchFeed, mapLimit } from "./youtube";

const SHORT_MAX_SECONDS = 60;

export async function getState(): Promise<AppState> {
  const [channels, groups, videos, watched, later, lastRefresh] = await Promise.all([
    db().hgetall<Record<string, Channel>>(K.channels),
    db().get<Group[]>(K.groups),
    db().hgetall<Record<string, Video[]>>(K.videos),
    db().smembers(K.watched),
    db().hgetall<Record<string, LaterItem>>(K.later),
    db().get<number>(K.lastRefresh),
  ]);
  return {
    channels: Object.values(channels ?? {}).sort((a, b) => a.title.localeCompare(b.title)),
    groups: groups ?? [],
    videos: Object.values(videos ?? {})
      .flat()
      .sort((a, b) => b.published.localeCompare(a.published)),
    watched,
    later: Object.values(later ?? {}).sort((a, b) => a.addedAt - b.addedAt),
    lastRefresh: lastRefresh ?? null,
  };
}

// Upstash's free tier caps request size, so large hash writes go out in chunks.
async function hsetChunked(key: string, entries: [string, unknown][], size = 25) {
  for (let i = 0; i < entries.length; i += size) {
    await db().hset(key, Object.fromEntries(entries.slice(i, i + size)));
  }
}

export async function importChannels(channels: Channel[]): Promise<number> {
  const existing = (await db().hgetall<Record<string, Channel>>(K.channels)) ?? {};
  const fresh = channels.filter((c) => !existing[c.id]);
  await hsetChunked(K.channels, fresh.map((c) => [c.id, c]), 200);
  return fresh.length;
}

export async function removeChannel(id: string) {
  const groups = (await db().get<Group[]>(K.groups)) ?? [];
  await Promise.all([
    db().hdel(K.channels, id),
    db().hdel(K.videos, id),
    db().set(
      K.groups,
      groups.map((g) => ({ ...g, channelIds: g.channelIds.filter((c) => c !== id) })),
    ),
  ]);
}

export async function refreshAll(): Promise<{ channels: number; failed: string[]; newDurations: number }> {
  const [channelMap, prevVideos] = await Promise.all([
    db().hgetall<Record<string, Channel>>(K.channels),
    db().hgetall<Record<string, Video[]>>(K.videos),
  ]);
  const channels = Object.values(channelMap ?? {});
  const prev = prevVideos ?? {};

  const results = await mapLimit(channels, 10, async (ch) => {
    try {
      return { ch, feed: await fetchFeed(ch.id) };
    } catch {
      return { ch, feed: null };
    }
  });

  // Durations never change, so only ask the API about videos we haven't seen.
  const known = new Map<string, number>();
  for (const list of Object.values(prev)) {
    for (const v of list) if (v.duration != null && v.duration > 0) known.set(v.id, v.duration);
  }
  const missing = results.flatMap((r) => r.feed?.entries.map((e) => e.id) ?? []).filter((id) => !known.has(id));
  const fetched = await fetchDurations([...new Set(missing)]);

  const updates: [string, Video[]][] = [];
  const renamed: [string, Channel][] = [];
  const failed: string[] = [];
  for (const { ch, feed } of results) {
    if (!feed) {
      failed.push(ch.title);
      continue;
    }
    const channelTitle = feed.channelTitle || ch.title;
    if (channelTitle !== ch.title) renamed.push([ch.id, { ...ch, title: channelTitle }]);
    updates.push([
      ch.id,
      feed.entries.map((e) => {
        const duration = known.get(e.id) ?? fetched.get(e.id) ?? null;
        return {
          id: e.id,
          channelId: ch.id,
          channelTitle,
          title: e.title,
          published: e.published,
          duration,
          isShort: e.isShortLink || (duration != null && duration > 0 && duration <= SHORT_MAX_SECONDS),
        };
      }),
    ]);
  }

  await hsetChunked(K.videos, updates);
  if (renamed.length) await hsetChunked(K.channels, renamed, 200);
  await db().set(K.lastRefresh, Date.now());
  return { channels: channels.length, failed, newDurations: fetched.size };
}

export async function saveGroups(groups: Group[]) {
  await db().set(K.groups, groups);
}

export async function setWatched(ids: string[], watched: boolean) {
  if (ids.length === 0) return;
  if (watched) {
    // Watching something also clears it from Watch later.
    await Promise.all([db().sadd(K.watched, ids[0], ...ids.slice(1)), db().hdel(K.later, ...ids)]);
  } else {
    await db().srem(K.watched, ...ids);
  }
}

export async function addLater(videos: Video[]) {
  if (videos.length === 0) return;
  const now = Date.now();
  await db().hset(
    K.later,
    Object.fromEntries(videos.map((v, i) => [v.id, { ...v, addedAt: now + i }])),
  );
}

export async function removeLater(ids: string[]) {
  if (ids.length) await db().hdel(K.later, ...ids);
}
