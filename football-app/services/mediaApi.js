import AsyncStorage from "@react-native-async-storage/async-storage";

const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php";
const CACHE_KEY = "matchzone_player_media_v3";
const CACHE_DURATION = 1000 * 60 * 60 * 24 * 30;
const memoryCache = new Map();
let storedCachePromise;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function cacheId(playerName, teamName) {
  return `${normalize(playerName)}|${normalize(teamName)}`;
}

async function readStoredCache() {
  if (!storedCachePromise) {
    storedCachePromise = AsyncStorage.getItem(CACHE_KEY)
      .then((value) => (value ? JSON.parse(value) : {}))
      .catch(() => ({}));
  }

  return storedCachePromise;
}

async function saveToCache(key, value) {
  memoryCache.set(key, value);

  try {
    const stored = await readStoredCache();
    stored[key] = value;
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(stored));
  } catch (error) {
    console.log("PLAYER MEDIA CACHE ERROR:", error);
  }
}

function teamTokens(teamName) {
  return normalize(teamName)
    .split(" ")
    .filter(
      (word) =>
        word.length > 2 &&
        !["club", "football", "team"].includes(word)
    );
}

function pageScore(page, playerName, teamName) {
  const title = normalize(page?.title);
  const extract = normalize(page?.extract);
  const player = normalize(playerName);
  let score = 0;

  if (title === player) score += 8;
  if (title.includes(player) || player.includes(title)) score += 4;
  if (extract.includes("football")) score += 3;
  if (extract.includes("player")) score += 1;

  teamTokens(teamName).forEach((token) => {
    if (extract.includes(token)) score += 1;
  });

  if (
    title.includes("disambiguation") ||
    title.startsWith("list of")
  ) {
    score -= 10;
  }

  return score;
}

function compactDescription(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= 460) return text;
  return `${text.slice(0, 457).trim()}...`;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchImageMetadata(filename) {
  if (!filename) return null;

  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    titles: `File:${filename}`,
    prop: "imageinfo",
    iiprop: "url|extmetadata",
    iiurlwidth: "900",
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params}`, {
    headers: {
      "Api-User-Agent":
        "MatchZone/1.0 (https://football-app-4c533.web.app/)",
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const page = Object.values(data?.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];

  if (!info) return null;

  const metadata = info.extmetadata || {};
  const artist = stripHtml(metadata.Artist?.value);
  const license = stripHtml(
    metadata.LicenseShortName?.value
  );

  return {
    imageUrl: info.thumburl || info.url || null,
    sourceUrl: info.descriptionurl || null,
    licenseUrl: metadata.LicenseUrl?.value || null,
    attribution: [artist, license]
      .filter(Boolean)
      .join(" | "),
  };
}

async function fetchPlayerMedia(playerName, teamName) {
  const query = [playerName, "footballer", teamName]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    origin: "*",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "5",
    prop: "pageimages|extracts|info",
    piprop: "thumbnail|original",
    pithumbsize: "900",
    exintro: "1",
    explaintext: "1",
    inprop: "url",
  });
  const response = await fetch(`${WIKIPEDIA_API}?${params}`, {
    headers: {
      "Api-User-Agent":
        "MatchZone/1.0 (https://football-app-4c533.web.app/)",
    },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const pages = Object.values(data?.query?.pages || {})
    .filter((page) => page?.thumbnail?.source)
    .sort(
      (a, b) =>
        pageScore(b, playerName, teamName) -
        pageScore(a, playerName, teamName)
    );
  const page = pages[0];

  if (!page || pageScore(page, playerName, teamName) < 4) {
    return null;
  }

  const extract = normalize(page.extract);
  const verifiedTeam = teamTokens(teamName).some((token) =>
    extract.includes(token)
  );
  const imageMetadata = await fetchImageMetadata(
    page.pageimage
  );

  return {
    jerseyPhoto:
      imageMetadata?.imageUrl ||
      page.thumbnail?.source ||
      page.original?.source ||
      null,
    description: compactDescription(page.extract),
    sourceUrl:
      imageMetadata?.sourceUrl || page.fullurl || null,
    licenseUrl: imageMetadata?.licenseUrl || null,
    attribution:
      imageMetadata?.attribution ||
      "Wikipedia / Wikimedia Commons",
    currentTeamVerified: verifiedTeam,
    updatedAt: Date.now(),
  };
}

export async function getTeamMedia() {
  return null;
}

export async function getPlayerMedia(playerName, teamName = "") {
  if (!playerName) return null;

  const key = cacheId(playerName, teamName);
  const inMemory = memoryCache.get(key);

  if (
    inMemory &&
    Date.now() - Number(inMemory.updatedAt || 0) < CACHE_DURATION
  ) {
    return inMemory.value;
  }

  const stored = await readStoredCache();
  const cached = stored[key];

  if (
    cached &&
    Date.now() - Number(cached.updatedAt || 0) < CACHE_DURATION
  ) {
    memoryCache.set(key, cached);
    return cached.value;
  }

  try {
    const value = await fetchPlayerMedia(playerName, teamName);
    await saveToCache(key, {
      value,
      updatedAt: Date.now(),
    });
    return value;
  } catch (error) {
    console.log("PLAYER MEDIA ERROR:", error);
    return null;
  }
}
