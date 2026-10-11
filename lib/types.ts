export type Channel = { id: string; title: string };

export type Rules = {
  keyword?: string; // comma-separated, any match
  minMinutes?: number;
  noShorts?: boolean;
};

export type Group = { id: string; name: string; channelIds: string[]; rules: Rules };

export type Video = {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  published: string; // ISO date
  duration: number | null; // seconds, null = unknown, 0 = live/upcoming
  isShort: boolean;
};

export type LaterItem = Video & { addedAt: number };

export type AppState = {
  channels: Channel[];
  groups: Group[];
  videos: Video[];
  watched: string[];
  later: LaterItem[];
  lastRefresh: number | null;
};
