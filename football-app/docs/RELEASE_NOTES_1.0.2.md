# MatchZone 1.0.2

- Made bottom tabs render immediately while data refreshes in the background.
- Added local cache hydration for Home, Watch Hub and Predictions.
- Reduced repeated live polling across tabs to protect Cloudflare and provider quotas.
- Kept focused match-detail refresh active for live match tracking.
- Fixed FIFA World Cup table refresh so group tables update from match results every minute.
- Grouped live-match statistics into Attacking, Passing, Defensive, Discipline and Match Facts.
- Expanded prediction coverage by using all supported upcoming fixtures and allowing limited real-data samples.
- Increased backend cache windows for high-frequency live/date/match routes.
