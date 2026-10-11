# Moodtube

A personal, password-protected YouTube subscription feed. Next.js on Vercel, Upstash Redis for storage.

## Setup

1. Push this repo to GitHub and import it in Vercel.
2. In the Vercel project: **Storage → Upstash (Redis) → Connect**. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
3. Add environment variables:
   - `APP_PASSWORD` — the password for the app
   - `YOUTUBE_API_KEY` — a YouTube Data API v3 key (Google Cloud Console → enable "YouTube Data API v3" → Credentials → API key)
4. Redeploy, log in, open **Channels**, and import `subscriptions.csv` from Google Takeout
   (takeout.google.com → YouTube and YouTube Music → subscriptions).

## Local development

```bash
npm install
vercel env pull .env.local   # or copy .env.example to .env.local and fill it in
npm run dev
```

## How it works

- **Refresh** fetches each channel's RSS feed (latest 15 videos) server-side. It runs on page load when the cache is older than 30 minutes, or when you click Refresh.
- Durations come from `videos.list`, 50 IDs per call (1 quota unit each), and only for videos not seen before.
- Shorts are detected from the feed's `/shorts/` links, plus anything 60 seconds or shorter.
- The Watch now queue lives in your browser (localStorage). Watch later, watched state, groups and cached videos live in Redis.
