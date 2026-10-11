import { Strip, Wordmark } from "@/components/Header";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login-page">
      <div className="console login-console">
        <div className="hdr">
          <Wordmark />
          <Strip />
        </div>
        <form action="/api/login" method="post" className="login-form tray">
          <label className="tray-label" htmlFor="password">
            PASSWORD
          </label>
          <input id="password" className="input" name="password" type="password" autoComplete="current-password" autoFocus required />
          {error && <p className="err">That password didn&apos;t match.</p>}
          <button type="submit" className="tbtn play">
            <span className="glyph">▶</span>
            <span className="word">ENTER</span>
          </button>
        </form>
      </div>
    </main>
  );
}
