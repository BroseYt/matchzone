# Google Play Data Safety Working Sheet

This sheet describes the current MatchZone code. Recheck it whenever a service or feature changes.

## Data Collected

### Personal info

- Email address
- Purpose: account management, authentication, support and abuse prevention
- Required only when the user creates an account
- Shared with Google Firebase as the authentication service

### User IDs

- Firebase user ID
- Purpose: account management, Fan Room ownership, reports, blocking and deletion
- Shared with Google Firebase

Football information requests are processed by the MatchZone proxy, which
retrieves public match information from football-data.org, API-Football and
ESPN. MatchZone does not send the signed-in user's Firebase identity to those
football providers.

### User-generated content

- Fan Room messages
- Match poll votes
- Feedback and abuse reports
- Purpose: app functionality, moderation, support and abuse prevention
- Shared with Google Firebase

### App functionality data

- Expo push token when the user enables notifications
- Notification preferences stored locally on the device
- Purpose: app functionality
- The token is processed by Expo and is not currently stored in MatchZone's database

## Data Not Collected By MatchZone

- Precise or approximate location
- Contacts
- Financial information
- Health information
- Browsing history
- SMS or call data
- Audio recordings
- Device photo library

The selected profile picture is copied into private app storage on the device. MatchZone does not upload it. Camera and system-picker access are initiated by the user.

## Security And User Controls

- Data is encrypted in transit by HTTPS/Firebase.
- Users can request deletion inside the app.
- Public deletion URL:
  https://football-app-4c533.web.app/delete-account.html
- Privacy URL:
  https://football-app-4c533.web.app/privacy.html
- Fan Room users can report messages and block users.
- Firestore rules restrict writes to authenticated owners, enforce message
  size and accepted terms, and prevent clients from supplying display names for
  Fan Room messages.

## Play Console Notes

- Declare that the app collects data.
- Declare that data is encrypted in transit.
- Declare that users can request deletion.
- Do not claim the app independently verifies Firebase or Expo deletion beyond the implemented process.
- Do not declare photos as collected while profile pictures remain device-only.
