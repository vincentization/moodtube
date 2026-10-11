export const AUTH_COOKIE = "mt_auth";

// The cookie holds a hash of the password, so changing APP_PASSWORD logs everyone out.
export async function authToken(): Promise<string> {
  const password = process.env.APP_PASSWORD ?? "";
  const data = new TextEncoder().encode(`moodtube:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
