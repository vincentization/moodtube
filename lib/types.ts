export type Channel = { id: string; title: string };

export type Rules = {
  keyword?: string; // comma-separated, any match
  minMinutes?: number;
  noShorts?: boolean;
};

export type Group = { id: string; name: string; channelIds: string[]; rules: Rules; color?: string };

export type Video = {
  id: string;
  channelId: string;
  channelTitle: string;
  title: string;
  published: string; // ISO date
  duration: number | null; // seconds, null = unknown, 0 = live/upcoming
  isShort: boolean;
};

// A shelf is the group the video was saved from ("all" when no group was selected).
export type LaterItem = Video & { addedAt: number; shelf: string };

export const ALL_SHELF = "all";

// The linked YouTube account whose subscriptions the channel list mirrors.
export type YoutubeLink = {
  configured: boolean; // GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are set
  connected: boolean;
  account: string | null;
  lastSync: number | null;
  error: string | null; // why the last sync failed, until one succeeds
};

export type AppState = {
  channels: Channel[];
  groups: Group[];
  videos: Video[];
  watched: string[];
  later: LaterItem[];
  lastRefresh: number | null;
  youtube: YoutubeLink;
};
