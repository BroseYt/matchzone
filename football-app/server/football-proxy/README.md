# MatchZone Football Proxy

This free Cloudflare Worker keeps football provider credentials out of the Android bundle and repository.

## One-Time Setup

1. Sign in with `npx wrangler login`.
2. Create a free workers.dev subdomain in the Cloudflare dashboard.
3. Store the provider token:
   `npx wrangler secret put FOOTBALL_DATA_TOKEN`
4. Create a free API-Football account at
   `https://dashboard.api-football.com/` and store its key:
   `npx wrangler secret put API_FOOTBALL_KEY`
5. Deploy:
   `npx wrangler deploy`
6. Put the resulting URL in `EXPO_PUBLIC_FOOTBALL_API_PROXY_URL`.

football-data.org supplies the original competitions. API-Football supplies
Europa League, Conference League, international friendlies and club
friendlies through normalized read-only endpoints.
