export type FeedEntry = {
  id: string;
  title: string;
  published: string;
  isShortLink: boolean;
};

export type Feed = { channelTitle: string | null; entries: FeedEntry[] };

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1].trim()) : null;
}

// The feed is small and predictable, so a few regexes beat pulling in an XML parser.
export function parseFeed(xml: string): Feed {
  const [head, ...entryChunks] = xml.split("<entry>");
  const entries: FeedEntry[] = [];
  for (const chunk of entryChunks) {
    const id = tag(chunk, "yt:videoId");
    if (!id) continue;
    const link = chunk.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/)?.[1] ?? "";
    entries.push({
      id,
      title: tag(chunk, "title") ?? "(untitled)",
      published: tag(chunk, "published") ?? new Date(0).toISOString(),
      isShortLink: link.includes("/shorts/"),
    });
  }
  return { channelTitle: tag(head, "title"), entries };
}

export async function fetchFeed(channelId: string): Promise<Feed> {
  const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  return parseFeed(await res.text());
}

export function parseIsoDuration(iso: string): number {
  const m = iso.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
  if (!m) return 0;
  const [, d, h, min, s] = m.map((x) => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

// videos.list costs 1 quota unit per call of up to 50 IDs.
export async function fetchDurations(ids: string[]): Promise<Map<string, number>> {
  const key = process.env.YOUTUBE_API_KEY;
  const out = new Map<string, number>();
  if (!key || ids.length === 0) return out;
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const url =
      "https://www.googleapis.com/youtube/v3/videos?part=contentDetails" +
      `&fields=items(id,contentDetails/duration)&id=${batch.join(",")}&key=${key}`;
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        console.error("videos.list failed", res.status, await res.text());
        continue;
      }
      const data = (await res.json()) as { items?: { id: string; contentDetails: { duration: string } }[] };
      for (const item of data.items ?? []) out.set(item.id, parseIsoDuration(item.contentDetails.duration));
    } catch (err) {
      console.error("videos.list error", err);
    }
  }
  return out;
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export type Comment = {
  id: string;
  author: string;
  avatar: string;
  text: string;
  likes: number;
  replies: number;
  published: string;
};

export type CommentPage = { comments: Comment[]; next: string | null; disabled: boolean };

type ThreadItem = {
  id: string;
  snippet: {
    totalReplyCount: number;
    topLevelComment: {
      snippet: {
        authorDisplayName: string;
        authorProfileImageUrl: string;
        textOriginal: string;
        likeCount: number;
        publishedAt: string;
      };
    };
  };
};

// commentThreads.list costs 1 quota unit per page of up to 100 threads.
export async function fetchComments(videoId: string, pageToken?: string): Promise<CommentPage> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY is not set");
  const params = new URLSearchParams({
    part: "snippet",
    videoId,
    order: "relevance",
    maxResults: "25",
    textFormat: "plainText",
    key,
  });
  if (pageToken) params.set("pageToken", pageToken);
  const res = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?${params}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text();
    if (res.status === 403 && body.includes("commentsDisabled")) return { comments: [], next: null, disabled: true };
    console.error("commentThreads.list failed", res.status, body);
    throw new Error(`YouTube ${res.status}`);
  }
  const data = (await res.json()) as { items?: ThreadItem[]; nextPageToken?: string };
  return {
    comments: (data.items ?? []).map((t) => {
      const s = t.snippet.topLevelComment.snippet;
      return {
        id: t.id,
        author: s.authorDisplayName,
        avatar: s.authorProfileImageUrl,
        text: s.textOriginal,
        likes: s.likeCount,
        replies: t.snippet.totalReplyCount,
        published: s.publishedAt,
      };
    }),
    next: data.nextPageToken ?? null,
    disabled: false,
  };
}
