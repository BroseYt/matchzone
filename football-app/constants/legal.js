export const APP_NAME = "MatchZone";
export const SUPPORT_EMAIL = "brosetechytb@gmail.com";
export const LEGAL_EFFECTIVE_DATE = "June 8, 2026";
export const FAN_TERMS_VERSION = 1;

export const PRIVACY_URL =
  "https://football-app-4c533.web.app/privacy.html";
export const TERMS_URL =
  "https://football-app-4c533.web.app/terms.html";
export const ACCOUNT_DELETION_URL =
  "https://football-app-4c533.web.app/delete-account.html";

export const privacySections = [
  {
    title: "Information MatchZone handles",
    body:
      "MatchZone may process your email address, Firebase user ID, fan-room messages, match poll votes, reports, blocks, feedback, notification preferences and an Expo push token when you enable notifications. A profile picture selected in the app is stored only on your device and is not uploaded by MatchZone.",
  },
  {
    title: "Why the information is used",
    body:
      "This information is used to sign you in, provide account features, operate and moderate fan rooms, save feedback, deliver notifications you request, prevent abuse and maintain app security.",
  },
  {
    title: "Service providers",
    body:
      "MatchZone uses Google Firebase for authentication and database features, Expo for app build and notification delivery, football-data.org, API-Football and ESPN for football information, and BBC Sport and Sky Sports feeds for news links and related images. Official media and broadcaster services process information under their own privacy terms when you open their links.",
  },
  {
    title: "Device permissions",
    body:
      "Camera access is requested only when you choose to take a profile picture. The system photo picker is used when you choose an existing picture. Notification permission is requested only when you enable alerts.",
  },
  {
    title: "Retention and deletion",
    body:
      "Account information is retained while your account remains active. You can delete your account and associated MatchZone data from Profile > Delete Account. You can also request deletion using the public account-deletion page. Security or legal records may be retained only when required by law or necessary to prevent abuse.",
  },
  {
    title: "Your choices",
    body:
      "You can use core match browsing without an account, disable notifications, remove a local profile picture, report or block fan-room users, and delete your account. You may contact MatchZone about privacy or data requests at the support address below.",
  },
  {
    title: "Children",
    body:
      "MatchZone is a general-audience sports app and is not directed to children under 13. Fan rooms require a signed-in account and acceptance of the community rules.",
  },
  {
    title: "Contact",
    body: `Privacy and support inquiries: ${SUPPORT_EMAIL}`,
  },
];

export const termsSections = [
  {
    title: "Using MatchZone",
    body:
      "Use MatchZone only for lawful personal use. Match information can be delayed, incomplete or corrected by its source. Do not rely on MatchZone for betting, financial decisions or emergency information.",
  },
  {
    title: "Fan-room rules",
    body:
      "Do not post threats, harassment, hate speech, sexual content, spam, scams, private information, illegal content or content that infringes another person's rights. Do not impersonate others or attempt to evade moderation.",
  },
  {
    title: "Moderation",
    body:
      "Users can report messages and block users. MatchZone may review reports and remove content, restrict participation or terminate accounts when reasonably necessary to protect users or comply with law.",
  },
  {
    title: "Attribution",
    body:
      "Football information is obtained from football-data.org, API-Football and publicly available ESPN football endpoints. News links are sourced from BBC Sport and Sky Sports feeds. Country flags are provided through FlagCDN. Club, competition and media names and marks belong to their respective owners and are shown for identification and informational purposes.",
  },
  {
    title: "Accounts",
    body:
      "You are responsible for your account credentials and activity. You may delete your account from the Profile screen. Account misuse may result in suspension or deletion.",
  },
  {
    title: "Contact",
    body: `Questions about these terms: ${SUPPORT_EMAIL}`,
  },
];
