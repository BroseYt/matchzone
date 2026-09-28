# MatchZone Google Play Release

## Store Listing

App name: MatchZone

Short description:

Live scores, fixtures, tables, predictions and match viewing guides.

Full description:

MatchZone keeps football supporters close to the competitions they follow.

- Live and upcoming match cards
- Fixtures, results, standings, qualification places and relegation zones
- FIFA World Cup teams, flags and tournament fixtures
- Club, national team and player profiles
- Data-based match predictions when verified trend data is available
- Watch Hub links to official broadcasters and licensed media
- Match reminders and notification controls
- Favorites for clubs, players and competitions
- Moderated Fan Rooms with reports, blocking and community rules
- Light and dark appearance across the app

Football information is obtained from football-data.org, API-Football and
publicly available ESPN football endpoints. News links are sourced from BBC
Sport and Sky Sports feeds. Flags are delivered through FlagCDN.

## Required Console Answers

- App category: Sports
- Ads: No
- Paid app: No
- In-app purchases: No
- Gambling or real-money wagering: No
- News app: No
- Health app: No
- Government app: No
- User-generated content: Yes, Fan Room messages and polls
- Account creation: Yes, email and password
- Account deletion: Yes, in app and on the public deletion page
- App access: Core browsing does not require login. A user can create an email account to test Fan Rooms.
- Target audience: General audience, not designed for children under 13

## Public URLs

- Privacy: https://football-app-4c533.web.app/privacy.html
- Terms: https://football-app-4c533.web.app/terms.html
- Account deletion: https://football-app-4c533.web.app/delete-account.html
- Support: mailto:brosetechytb@gmail.com

## Release Checklist

- Build an Android App Bundle with the production EAS profile.
- Run `npm run release:check` before every store build.
- Feature graphic: `store-assets/feature-graphic-1024x500.png`.
- Install the signed build on at least two physical Android devices.
- Test account creation, login, password reset and account deletion.
- Test camera, system photo picker and notification permission behavior.
- Test Fan Room terms acceptance, posting, voting, reporting and blocking.
- Test light and dark modes after closing and reopening the app.
- Test every bottom tab and deep profile screen on slow and offline networks.
- Upload phone screenshots, app icon and a 1024 x 500 feature graphic.
- Complete Data Safety using `docs/DATA_SAFETY.md`.
- Complete the content-rating questionnaire and disclose user interaction.
- Start internal testing, then the required closed test if the account is a new personal account.
- Monitor Firebase `reports` and `feedback` collections during testing and after release.
