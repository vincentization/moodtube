# Moodtube

A personal, password-protected YouTube subscription feed. Next.js on Vercel, Upstash Redis for storage.

## Setup

1. Push this repo to GitHub and import it in Vercel.
2. In the Vercel project: **Storage → Upstash (Redis) → Connect**. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Add environment variables:
   - `APP_PASSWORD` — the password for the app
   - `YOUTUBE_API_KEY` — a YouTube Data API v3 key (Google Cloud Console → enable "YouTube Data API v3" → Credentials → API key)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — for syncing your subscriptions (below)
4. Redeploy, log in, open **Channels** and press **Connect YouTube**.

### Subscription sync (Google sign-in)

The channel list follows your YouTube subscriptions: sign in with Google once, and every refresh adds channels
you've subscribed to and removes ones you've left (with their videos and group memberships). It only asks for
read-only YouTube access, and costs 1 quota unit per 50 subscriptions.

1. Google Cloud Console, in the project with your API key → **APIs & Services → OAuth consent screen**:
   user type **External**, fill in the app name and your email, add the scope
   `https://www.googleapis.com/auth/youtube.readonly`. Under **Branding**, set the privacy policy link to
   `https://your-app.vercel.app/privacy` (a public page, outside the password) and add your Vercel domain
   under **Authorized domains**.
2. **Publish the app** (publishing status "In production"). You don't need to submit it for verification;
   Google just shows a "Google hasn't verified this app" warning at sign-in, which you click through once
   (Advanced → Go to …). Left in "Testing", the sign-in expires every 7 days.
3. **Credentials → Create credentials → OAuth client ID**, type **Web application**. Under
   **Authorized redirect URIs** add `/api/youtube/callback` on every origin the app runs on, e.g.
   `https://your-app.vercel.app/api/youtube/callback` and `http://localhost:3000/api/youtube/callback`.
4. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from the new client and redeploy.

Without Google sign-in you can still import `subscriptions.csv` from Google Takeout by hand
(takeout.google.com → YouTube and YouTube Music → subscriptions).

## Local development

```bash
npm install
vercel env pull .env.local   # or copy .env.example to .env.local and fill it in
npm run dev
```

## How it works

- **Refresh** first syncs your subscriptions (when YouTube is connected), then fetches each channel's RSS feed (latest 15 videos) server-side. It runs on page load when the cache is older than 30 minutes, or when you click Refresh.
- Durations come from `videos.list`, 50 IDs per call (1 quota unit each), and only for videos not seen before.
- Shorts are detected from the feed's `/shorts/` links, plus anything 60 seconds or shorter.
- The Watch now queue lives in your browser (localStorage). Watch later, watched state, groups and cached videos live in Redis.
