import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const res = NextResponse.redirect(new URL("/login", request.url), 303);
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
