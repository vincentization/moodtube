import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, fetchAccountName, STATE_COOKIE } from "@/lib/google";
import { linkYoutube, refreshAll } from "@/lib/store";

export const maxDuration = 60;

// Google sends the browser back here after the consent screen. Keep the refresh token, then sync the
// subscriptions and fetch their videos right away, so the Channels page comes back already filled in.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const back = (result: string) => {
    const res = NextResponse.redirect(new URL(`/channels?youtube=${result}`, origin));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/youtube/callback" });
    return res;
  };
  const code = searchParams.get("code");
  const state = request.cookies.get(STATE_COOKIE)?.value;
  if (searchParams.get("error") === "access_denied") return back("denied");
  if (!code || !state || state !== searchParams.get("state")) return back("failed");
  try {
    const tokens = await exchangeCode(code, origin);
    if (!tokens.refresh_token) return back("failed");
    await linkYoutube(tokens.refresh_token, await fetchAccountName(tokens.access_token).catch(() => null));
  } catch (err) {
    console.error("YouTube connect failed", err);
    return back("failed");
  }
  await refreshAll();
  return back("connected");
}
