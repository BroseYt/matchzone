import AsyncStorage from "@react-native-async-storage/async-storage";
import { footballFetch } from "./footballApi";
import { getCompetitionTeams } from "./matches";

import {
  competitions,
  isExtendedCompetition,
} from "../constants/competitions";
import {
  findWorldCupTeam,
  getFlagUrl,
  worldCup2026Teams,
} from "../constants/worldCup2026";

const BASE_URL = "https://api.football-data.org/v4";
const SEARCH_CACHE_KEY =
  "matchzone_search_index_cache_v4";
const CACHE_DURATION = 1000 * 60 * 60 * 24 * 7;
const NATIONAL_TEAM_COMPETITIONS = new Set([
  "WC",
  "EC",
]);

export const leaguesList = competitions.map(
  (competition) => ({
    type: "league",
    id: competition.code,
    name: competition.name,
    logo: competition.logo,
    competitionCode: competition.code,
  })
);

function delay(milliseconds) {
  return new Promise((resolve) =>
    setTimeout(resolve, milliseconds)
  );
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getRetryDelay(response, body) {
  const retryAfter = Number(
    response.headers.get("retry-after")
  );

  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 65000);
  }

  const message = String(body?.message || body?.error || "");
  const seconds = Number(message.match(/(\d+)\s*second/i)?.[1]);

  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 65000);
  }

  return 60000;
}

async function safeFetchJson(url) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await footballFetch(url);
      const text = await response.text();
      let body = null;

      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = null;
      }

      if (response.ok) return body;

      if (response.status === 429 && attempt === 0) {
        await delay(getRetryDelay(response, body));
        continue;
      }

      return null;
    } catch (error) {
      console.log("SEARCH FETCH ERROR:", error);
      return null;
    }
  }

  return null;
}

function addSearchText(item) {
  const aliases = Array.isArray(item.aliases)
    ? item.aliases.join(" ")
    : item.aliases || "";

  return {
    ...item,
    searchText: normalizeText(
      `${item.name} ${item.fullName || ""} ${aliases} ${
        item.team || ""
      } ${item.country || ""} ${item.position || ""} ${
        item.competitionName || ""
      } ${item.competitionCode || ""} ${item.id || ""}`
    ),
  };
}

function baseCountries() {
  return worldCup2026Teams.map((country) => ({
    type: "country",
    id: `country-${country.code}`,
    name: country.name,
    aliases: country.aliases || [],
    countryCode: country.code,
    logo: getFlagUrl(country.code),
    teamId: null,
    competitionCode: "WC",
    competitionName: "FIFA World Cup",
    group: country.group,
  }));
}

function createBaseIndex() {
  return [...leaguesList, ...baseCountries()].map(
    addSearchText
  );
}

function itemKey(item) {
  return `${item.type}:${String(item.id)}`;
}

function mergeItems(existingItems, additions) {
  const map = new Map(
    existingItems.map((item) => [itemKey(item), item])
  );

  additions.forEach((item) => {
    const key = itemKey(item);
    map.set(
      key,
      addSearchText({
        ...(map.get(key) || {}),
        ...item,
      })
    );
  });

  return [...map.values()];
}

function findCountryItem(items, team) {
  const worldCupCountry = findWorldCupTeam(team);

  if (worldCupCountry) {
    return items.find(
      (item) =>
        item.type === "country" &&
        item.countryCode === worldCupCountry.code
    );
  }

  const candidates = [
    team?.name,
    team?.shortName,
    team?.area?.name,
  ]
    .map(normalizeText)
    .filter(Boolean);

  return items.find(
    (item) =>
      item.type === "country" &&
      candidates.includes(normalizeText(item.name))
  );
}

function indexCompetition(items, league, data) {
  const additions = [];
  const competitionName =
    data?.competition?.name || league.name;
  const areaName = data?.competition?.area?.name || "";
  const areaCode = data?.competition?.area?.code || "";
  const nationalTeams =
    NATIONAL_TEAM_COMPETITIONS.has(league.id);

  if (areaName && !nationalTeams) {
    const existingArea = items.find(
      (item) =>
        item.type === "country" &&
        normalizeText(item.name) === normalizeText(areaName)
    );

    additions.push({
      type: "country",
      id: existingArea?.id || `area-${areaCode || areaName}`,
      name: areaName,
      aliases: existingArea?.aliases || [],
      countryCode: existingArea?.countryCode || null,
      logo: existingArea?.logo || null,
      teamId: existingArea?.teamId || null,
      competitionCode:
        existingArea?.teamId
          ? existingArea.competitionCode
          : league.id,
      competitionName:
        existingArea?.teamId
          ? existingArea.competitionName
          : competitionName,
    });
  }

  (data?.teams || []).forEach((team) => {
    const country = team.area?.name || areaName;
    const nationalTeam = nationalTeams || team.national;

    if (nationalTeam) {
      const existingCountry = findCountryItem(
        [...items, ...additions],
        team
      );
      const worldCupCountry = findWorldCupTeam(team);

      additions.push({
        type: "country",
        id:
          existingCountry?.id ||
          `country-team-${team.id}`,
        name:
          worldCupCountry?.name ||
          team.shortName ||
          team.name,
        fullName: team.name,
        aliases: [
          ...(existingCountry?.aliases || []),
          ...(worldCupCountry?.aliases || []),
          team.tla,
        ].filter(Boolean),
        countryCode:
          existingCountry?.countryCode ||
          worldCupCountry?.code ||
          null,
        logo:
          existingCountry?.logo ||
          team.crest ||
          null,
        teamId: team.id,
        competitionCode: league.id,
        competitionName,
      });
    } else {
      additions.push({
        type: "club",
        id: team.id,
        name: team.shortName || team.tla || team.name,
        fullName: team.name,
        aliases: [team.tla].filter(Boolean),
        logo: team.crest || null,
        country,
        competitionCode: league.id,
        competitionName,
      });
    }

    (team.squad || []).forEach((player) => {
      if (!player?.id) return;

      additions.push({
        type: "player",
        id: player.id,
        name: player.name,
        team: team.shortName || team.name,
        teamId: team.id,
        teamLogo: team.crest || null,
        country: player.nationality || "",
        position: player.position || "",
        competitionCode: league.id,
        competitionName,
      });
    });
  });

  return mergeItems(items, additions);
}

async function readCache() {
  try {
    const cached = await AsyncStorage.getItem(
      SEARCH_CACHE_KEY
    );

    if (!cached) return null;

    const parsed = JSON.parse(cached);
    if (!Array.isArray(parsed?.items)) return null;

    return {
      items: parsed.items.map(addSearchText),
      completedCodes: Array.isArray(parsed.completedCodes)
        ? parsed.completedCodes
        : [],
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch (error) {
    console.log("SEARCH CACHE READ ERROR:", error);
    return null;
  }
}

async function writeCache(items, completedCodes) {
  try {
    await AsyncStorage.setItem(
      SEARCH_CACHE_KEY,
      JSON.stringify({
        items: items.map(
          ({ searchText, ...item }) => item
        ),
        completedCodes,
        updatedAt: Date.now(),
      })
    );
  } catch (error) {
    console.log("SEARCH CACHE WRITE ERROR:", error);
  }
}

export async function buildSearchIndex(
  forceRefresh = false,
  onProgress
) {
  try {
    if (forceRefresh) {
      await clearSearchCache();
    }

    const cached = forceRefresh ? null : await readCache();
    const allCodes = leaguesList.map((league) => league.id);
    const cacheIsFresh =
      cached &&
      Date.now() - cached.updatedAt < CACHE_DURATION;
    const cacheIsComplete =
      cached &&
      allCodes.every((code) =>
        cached.completedCodes.includes(code)
      );

    if (cacheIsFresh && cacheIsComplete) {
      onProgress?.(cached.items, {
        complete: true,
        completed: allCodes.length,
        total: allCodes.length,
      });
      return cached.items;
    }

    let items = cached?.items?.length
      ? mergeItems(createBaseIndex(), cached.items)
      : createBaseIndex();
    let completedCodes = cacheIsFresh
      ? cached.completedCodes
      : [];

    onProgress?.(items, {
      complete: false,
      completed: completedCodes.length,
      total: allCodes.length,
    });

    for (const league of leaguesList) {
      if (completedCodes.includes(league.id)) continue;

      const data = isExtendedCompetition(league.id)
        ? await getCompetitionTeams(league.id)
        : await safeFetchJson(
            `${BASE_URL}/competitions/${league.id}/teams`
          );

      if (!data?.teams) continue;

      items = indexCompetition(items, league, data);
      completedCodes = [...completedCodes, league.id];

      await writeCache(items, completedCodes);
      onProgress?.(items, {
        complete: completedCodes.length === allCodes.length,
        completed: completedCodes.length,
        total: allCodes.length,
      });
    }

    return items;
  } catch (error) {
    console.log("SEARCH INDEX ERROR:", error);

    const cached = await readCache();
    return cached?.items || createBaseIndex();
  }
}

export async function clearSearchCache() {
  await AsyncStorage.removeItem(SEARCH_CACHE_KEY);
}

function resultScore(item, query) {
  const name = normalizeText(item.name);
  const fullName = normalizeText(item.fullName);
  const searchText = item.searchText || "";

  if (name === query || fullName === query) return 0;
  if (name.startsWith(query) || fullName.startsWith(query)) {
    return 1;
  }
  if (
    searchText
      .split(" ")
      .some((word) => word.startsWith(query))
  ) {
    return 2;
  }
  return 3;
}

export function searchItems(items, query) {
  const q = normalizeText(query);

  if (!q) {
    return items
      .filter((item) =>
        ["league", "country"].includes(item.type)
      )
      .slice(0, 60);
  }

  return items
    .filter((item) =>
      (item.searchText || "").includes(q)
    )
    .map((item) => ({
      item,
      score: resultScore(item, q),
    }))
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.item.name.localeCompare(b.item.name)
    )
    .slice(0, 150)
    .map(({ item }) => item);
}
