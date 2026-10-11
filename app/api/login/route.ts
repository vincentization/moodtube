import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken, safeEqual } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected || !safeEqual(password, expected)) {
    return NextResponse.redirect(new URL("/login?error=1", request.url), 303);
  }
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  res.cookies.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}
