import { Redis } from "@upstash/redis";

let client: Redis | null = null;

// Vercel's Upstash integration exposes KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*.
// Created lazily so builds don't need the env vars.
export function db(): Redis {
  client ??= new Redis({
    url: process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "",
    token: process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  });
  return client;
}

export const K = {
  channels: "mt:channels", // hash channelId -> Channel
  groups: "mt:groups", // JSON Group[]
  videos: "mt:videos", // hash channelId -> Video[]
  watched: "mt:watched", // set of videoIds
  later: "mt:later", // hash "shelf|videoId" -> LaterItem
  lastRefresh: "mt:lastRefresh", // epoch ms
  youtube: "mt:youtube", // JSON YoutubeAccount (see store.ts): the linked Google account's refresh token
};
