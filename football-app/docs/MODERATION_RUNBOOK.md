# Fan Room Moderation Runbook

## Daily Review

1. Open Firebase Console for `football-app-4c533`.
2. Open Firestore Database and review the `reports` collection.
3. Prioritize threats, child-safety issues, personal information and targeted harassment.
4. Review the referenced `watchRooms/{matchId}/messages/{messageId}` document.
5. Delete violating messages from Firestore.
6. Disable or delete abusive Firebase Authentication accounts when necessary.
7. Record the action outside the public database and update the report status using the Firebase Console.

## Response Targets

- Credible threats, child-safety content or exposed personal information: immediate review
- Hate, harassment, sexual content, scams and impersonation: within 24 hours
- Spam and lower-risk reports: within 72 hours

## Escalation

- Preserve only the minimum evidence required for safety or legal obligations.
- Contact emergency services when a credible and imminent threat requires it.
- Reply to support or deletion requests from `brosetechytb@gmail.com`.
- Never publish reporter identities or private account information.
