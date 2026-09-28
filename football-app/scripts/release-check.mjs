import { constants as fsConstants } from "node:fs";
import { access, readFile } from "node:fs/promises";

const requiredFiles = [
  "app.json",
  "eas.json",
  "firebase.json",
  "firestore.rules",
  "firestore.indexes.json",
  "assets/images/icon.png",
  "assets/images/android-icon-foreground.png",
  "assets/images/splash-icon.png",
  "store-assets/feature-graphic-1024x500.png",
  "legal-site/privacy.html",
  "legal-site/terms.html",
  "legal-site/delete-account.html",
  "docs/DATA_SAFETY.md",
  "docs/MODERATION_RUNBOOK.md",
  "docs/PLAY_STORE_RELEASE.md",
];

const textFiles = [
  "app.json",
  "eas.json",
  "constants/legal.js",
  "legal-site/privacy.html",
  "legal-site/terms.html",
  "legal-site/delete-account.html",
  "docs/DATA_SAFETY.md",
  "docs/PLAY_STORE_RELEASE.md",
];

const failures = [];

for (const file of requiredFiles) {
  try {
    await access(file, fsConstants.R_OK);
  } catch {
    failures.push(`Missing required release file: ${file}`);
  }
}

const content = new Map();

for (const file of textFiles) {
  try {
    content.set(file, await readFile(file, "utf8"));
  } catch {
    // Missing files are reported above.
  }
}

const allText = [...content.values()].join("\n");
const requiredText = [
  "brosetechytb@gmail.com",
  "https://football-app-4c533.web.app/privacy.html",
  "https://football-app-4c533.web.app/delete-account.html",
  "API-Football",
  "ESPN",
];

for (const value of requiredText) {
  if (!allText.includes(value)) {
    failures.push(`Required release disclosure is missing: ${value}`);
  }
}

if (allText.includes("broseennin@gmail.com")) {
  failures.push("The retired support email is still present.");
}

const appConfig = JSON.parse(content.get("app.json") || "{}");
const android = appConfig.expo?.android || {};

if (appConfig.expo?.version !== "1.0.2") {
  failures.push("Release version must be 1.0.2.");
}

if (android.package !== "com.matchzone.app") {
  failures.push("Android package must remain com.matchzone.app.");
}

if (!android.permissions?.includes("POST_NOTIFICATIONS")) {
  failures.push("Android notification permission is missing.");
}

if (!android.permissions?.includes("CAMERA")) {
  failures.push("Android camera permission is missing.");
}

const easConfig = JSON.parse(content.get("eas.json") || "{}");
const production = easConfig.build?.production;

if (!production?.autoIncrement) {
  failures.push("Production Android build numbers must auto-increment.");
}

if (
  !production?.env?.EXPO_PUBLIC_FOOTBALL_API_PROXY_URL?.startsWith(
    "https://"
  )
) {
  failures.push("Production football API proxy URL must use HTTPS.");
}

try {
  const featureGraphic = await readFile(
    "store-assets/feature-graphic-1024x500.png"
  );
  const width = featureGraphic.readUInt32BE(16);
  const height = featureGraphic.readUInt32BE(20);

  if (width !== 1024 || height !== 500) {
    failures.push(
      `Feature graphic must be 1024x500, received ${width}x${height}.`
    );
  }
} catch {
  // Missing files are reported above.
}

if (failures.length) {
  console.error("Release check failed:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Release check passed.");
