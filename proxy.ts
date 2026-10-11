import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken, safeEqual } from "@/lib/auth";

export async function proxy(request: NextRequest) {
  const cookie = request.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (process.env.APP_PASSWORD && safeEqual(cookie, await authToken())) {
    return NextResponse.next();
  }
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!login|api/login|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
