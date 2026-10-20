import { NextResponse, type NextRequest } from "next/server";
import { consentUrl, googleConfigured, STATE_COOKIE } from "@/lib/google";

// Start the Google sign-in. A random state goes along in a short-lived cookie, so the callback can tell the
// answer belongs to a sign-in started here.
export async function GET(request: NextRequest) {
  const { origin } = request.nextUrl;
  if (!googleConfigured()) return NextResponse.redirect(new URL("/channels?youtube=unconfigured", origin));
  const state = crypto.randomUUID();
  const res = NextResponse.redirect(consentUrl(origin, state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/youtube/callback",
    maxAge: 600,
  });
  return res;
}
