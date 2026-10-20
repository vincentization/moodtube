// Google sign-in, used only to read your own YouTube subscriptions (the read-only YouTube scope).
// The sign-in hands back a refresh token, kept in Redis, which buys a short-lived access token for each sync.
// Needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET from an OAuth client of type "Web application" whose
// authorized redirect URIs include <origin>/api/youtube/callback for every origin the app runs on.

import type { Channel } from "./types";

const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";
export const STATE_COOKIE = "mt_oauth_state";

// Google says the refresh token is no longer valid: it was revoked, or (while the OAuth app is in testing) it expired.
export class RevokedError extends Error {}

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const redirectUri = (origin: string) => `${origin}/api/youtube/callback`;

// Offline access with a forced consent screen, so Google always issues a refresh token, even on a reconnect.
export function consentUrl(origin: string, state: string) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

type TokenResponse = { access_token: string; refresh_token?: string; error?: string; error_description?: string };

async function token(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...params,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as TokenResponse;
  if (data.error === "invalid_grant") throw new RevokedError(data.error_description ?? "invalid_grant");
  if (!res.ok || !data.access_token) throw new Error(`Google token ${res.status}: ${data.error_description ?? data.error ?? "no access token"}`);
  return data;
}

export const exchangeCode = (code: string, origin: string) =>
  token({ grant_type: "authorization_code", code, redirect_uri: redirectUri(origin) });

export const accessToken = async (refreshToken: string) =>
  (await token({ grant_type: "refresh_token", refresh_token: refreshToken })).access_token;

export async function revoke(refreshToken: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => {});
}

async function youtube<T>(path: string, params: Record<string, string>, access: string): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams(params)}`, {
    headers: { authorization: `Bearer ${access}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`${path} failed`, res.status, body);
    throw new Error(`YouTube ${res.status}`);
  }
  return (await res.json()) as T;
}

// The signed-in account's own channel name, to show which account is linked. 1 quota unit.
export async function fetchAccountName(access: string): Promise<string | null> {
  const data = await youtube<{ items?: { snippet: { title: string } }[] }>(
    "channels",
    { part: "snippet", mine: "true", fields: "items(snippet/title)" },
    access,
  );
  return data.items?.[0]?.snippet.title ?? null;
}

// Every channel the account subscribes to: subscriptions.list, 1 quota unit per page of 50.
// Throws rather than returning a partial list, since the caller removes whatever is missing.
export async function fetchSubscriptions(access: string): Promise<Channel[]> {
  type Page = { nextPageToken?: string; items?: { snippet: { title: string; resourceId: { channelId: string } } }[] };
  const out: Channel[] = [];
  let pageToken: string | undefined;
  do {
    const params: Record<string, string> = {
      part: "snippet",
      mine: "true",
      maxResults: "50",
      fields: "nextPageToken,items(snippet(title,resourceId/channelId))",
    };
    if (pageToken) params.pageToken = pageToken;
    const page = await youtube<Page>("subscriptions", params, access);
    for (const item of page.items ?? []) out.push({ id: item.snippet.resourceId.channelId, title: item.snippet.title });
    pageToken = page.nextPageToken;
  } while (pageToken);
  return out;
}
