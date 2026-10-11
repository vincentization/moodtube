export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <form action="/api/login" method="post" className="login-card">
        <h1>Moodtube</h1>
        <label htmlFor="password" className="muted">
          Password
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required />
        {error && <p className="error">That password didn&apos;t match.</p>}
        <button type="submit" className="btn primary">
          Enter
        </button>
      </form>
    </main>
  );
}
