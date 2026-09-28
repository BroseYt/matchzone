import AsyncStorage from "@react-native-async-storage/async-storage";
import { footballFetch } from "./footballApi";

const BASE_URL =
  "https://api.football-data.org/v4";
const PLAYER_PROFILE_CACHE_KEY =
  "matchzone_verified_player_profiles_v1";
const PLAYER_PROFILE_CACHE_DURATION =
  1000 * 60 * 60 * 24 * 30;
const PLAYER_PROFILE_MISS_DURATION =
  1000 * 60 * 60 * 24;
const playerProfileMemory = new Map();
const playerProfilePending = new Map();
let storedPlayerProfilesPromise;

function normalizePlayerName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function playerProfileKey(playerId, playerName) {
  if (isExternalId(playerId)) return `id:${playerId}`;
  return `name:${normalizePlayerName(playerName)}`;
}

async function readStoredPlayerProfiles() {
  if (!storedPlayerProfilesPromise) {
    storedPlayerProfilesPromise = AsyncStorage.getItem(
      PLAYER_PROFILE_CACHE_KEY
    )
      .then((value) => (value ? JSON.parse(value) : {}))
      .catch(() => ({}));
  }

  return storedPlayerProfilesPromise;
}

function freshPlayerProfile(entry) {
  if (!entry) return false;
  const duration = entry.value
    ? PLAYER_PROFILE_CACHE_DURATION
    : PLAYER_PROFILE_MISS_DURATION;

  return Date.now() - Number(entry.updatedAt || 0) < duration;
}

async function savePlayerProfile(key, value) {
  const entry = { value, updatedAt: Date.now() };
  playerProfileMemory.set(key, entry);

  try {
    const stored = await readStoredPlayerProfiles();
    stored[key] = entry;

    const trimmed = Object.fromEntries(
      Object.entries(stored)
        .sort(
          ([, first], [, second]) =>
            Number(second.updatedAt || 0) -
            Number(first.updatedAt || 0)
        )
        .slice(0, 1500)
    );

    storedPlayerProfilesPromise = Promise.resolve(trimmed);
    await AsyncStorage.setItem(
      PLAYER_PROFILE_CACHE_KEY,
      JSON.stringify(trimmed)
    );
  } catch (error) {
    console.log("PLAYER PROFILE CACHE ERROR:", error);
  }
}

async function cachedPlayerProfile(key, loader) {
  const memoryEntry = playerProfileMemory.get(key);
  if (freshPlayerProfile(memoryEntry)) {
    return memoryEntry.value;
  }

  const stored = await readStoredPlayerProfiles();
  const storedEntry = stored[key];

  if (freshPlayerProfile(storedEntry)) {
    playerProfileMemory.set(key, storedEntry);
    return storedEntry.value;
  }

  if (playerProfilePending.has(key)) {
    return playerProfilePending.get(key);
  }

  const request = loader()
    .then(async (value) => {
      await savePlayerProfile(key, value || null);
      return value || null;
    })
    .finally(() => {
      playerProfilePending.delete(key);
    });

  playerProfilePending.set(key, request);
  return request;
}

function isExternalId(value) {
  return String(value || "").startsWith("ext-");
}

function espnId(value) {
  const match = String(value || "").match(
    /^espn-(EL|UCL)-(\d+)$/
  );
  return match ? { code: match[1], id: match[2] } : null;
}

function currentEuropeanSeason() {
  const now = new Date();
  return now.getMonth() >= 6
    ? now.getFullYear()
    : now.getFullYear() - 1;
}

export async function getTeamDetails(teamId) {
  try {
    const espnTeam = espnId(teamId);

    if (espnTeam) {
      const res = await footballFetch(
        `/extended/espn/teams/${espnTeam.code}/${espnTeam.id}`
      );
      return res.ok ? await res.json() : null;
    }

    if (isExternalId(teamId)) {
      const res = await footballFetch(
        `/extended/teams/${teamId}`
      );
      return res.ok ? await res.json() : null;
    }

    const res = await footballFetch(`${BASE_URL}/teams/${teamId}`);

    return await res.json();
  } catch (error) {
    console.log("TEAM DETAILS ERROR:", error);
    return null;
  }
}

export async function getTeamMatches(teamId) {
  try {
    if (espnId(teamId)) return [];

    if (isExternalId(teamId)) {
      const res = await footballFetch(
        `/extended/teams/${teamId}/matches`
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.matches || [];
    }

    const res = await footballFetch(
      `${BASE_URL}/teams/${teamId}/matches`
    );

    const data = await res.json();

    return data.matches || [];
  } catch (error) {
    console.log("TEAM MATCHES ERROR:", error);
    return [];
  }
}

export async function getPlayerDetails(playerId) {
  try {
    if (isExternalId(playerId)) {
      const res = await footballFetch(
        `/extended/players/${playerId}?season=${currentEuropeanSeason()}`
      );
      return res.ok ? await res.json() : null;
    }

    const res = await footballFetch(
      `${BASE_URL}/persons/${playerId}`
    );

    return await res.json();
  } catch (error) {
    console.log("PLAYER DETAILS ERROR:", error);
    return null;
  }
}

export async function getPlayerMatchData(
  playerId,
  limit = 50
) {
  try {
    if (isExternalId(playerId)) {
      return {
        matches: [],
        aggregations: null,
        resultSet: null,
        person: null,
      };
    }

    const res = await footballFetch(
      `${BASE_URL}/persons/${playerId}/matches?limit=${limit}`
    );

    if (!res.ok) {
      return {
        matches: [],
        aggregations: null,
        resultSet: null,
        person: null,
      };
    }

    const data = await res.json();

    return {
      matches: data.matches || [],
      aggregations:
        data.aggregations &&
        typeof data.aggregations === "object"
          ? data.aggregations
          : null,
      resultSet: data.resultSet || null,
      person: data.person || null,
    };
  } catch (error) {
    console.log("PLAYER MATCHES ERROR:", error);

    return {
      matches: [],
      aggregations: null,
      resultSet: null,
      person: null,
    };
  }
}

export async function getPlayerLookup(playerName) {
  if (!playerName) return null;
  const key = playerProfileKey(null, playerName);

  try {
    return await cachedPlayerProfile(key, async () => {
      const res = await footballFetch(
        `/extended/player-lookup?name=${encodeURIComponent(playerName)}`
      );

      if (res.ok) return res.json();
      if (res.status === 404) return null;

      throw new Error(
        `Player lookup temporarily unavailable (${res.status})`
      );
    });
  } catch (error) {
    console.log("PLAYER LOOKUP ERROR:", error);
    return null;
  }
}

export async function getVerifiedPlayerProfile(
  playerId,
  playerName
) {
  if (!playerId && !playerName) return null;

  if (!isExternalId(playerId)) {
    return getPlayerLookup(playerName);
  }

  const key = playerProfileKey(playerId, playerName);

  return cachedPlayerProfile(key, async () => {
    const profile = await getPlayerDetails(playerId);

    if (profile?.photo) {
      const nameKey = playerProfileKey(
        null,
        profile.name || playerName
      );
      await savePlayerProfile(nameKey, profile);
    }

    return profile;
  });
}

export async function getPlayerMatches(playerId) {
  const data = await getPlayerMatchData(playerId);
  return data.matches;
}

export async function getPlayerCompetitionStats(
  playerId,
  competitionCodes = [],
  matches = []
) {
  if (isExternalId(playerId)) return [];

  const codes = [
    ...new Set(competitionCodes.filter(Boolean)),
  ];

  const results = await Promise.all(
    codes.map(async (code) => {
      try {
        const res = await footballFetch(
          `${BASE_URL}/competitions/${code}/scorers?limit=500`
        );

        if (!res.ok) return null;

        const data = await res.json();
        const scorer = (data.scorers || []).find(
          (entry) =>
            String(entry.player?.id) ===
            String(playerId)
        );

        if (!scorer) return null;

        return {
          competition: data.competition || {
            code,
            name: code,
          },
          season: data.season || null,
          team: scorer.team || null,
          playedMatches: scorer.playedMatches ?? null,
          goals: scorer.goals ?? null,
          assists: scorer.assists ?? null,
          penalties: scorer.penalties ?? null,
        };
      } catch (error) {
        console.log(
          `PLAYER STATS ERROR (${code}):`,
          error
        );
        return null;
      }
    })
  );

  const byCode = new Map();

  results.filter(Boolean).forEach((entry) => {
    byCode.set(entry.competition?.code, entry);
  });

  const matchCounts = new Map();

  matches.forEach((match) => {
    const competition = match?.competition;
    const code = competition?.code;

    if (!code) return;

    const current = matchCounts.get(code) || {
      competition,
      season: match.season || null,
      count: 0,
    };
    current.count += 1;
    matchCounts.set(code, current);
  });

  matchCounts.forEach((record, code) => {
    if (byCode.has(code)) return;

    byCode.set(code, {
      competition: record.competition,
      season: record.season,
      team: null,
      playedMatches: record.count,
      goals: null,
      assists: null,
      penalties: null,
      matchRecordOnly: true,
    });
  });

  return [...byCode.values()].sort((a, b) =>
    String(a.competition?.name || "").localeCompare(
      String(b.competition?.name || "")
    )
  );
}

export async function getMatchDetails(matchId) {
  try {
    const espnMatch = espnId(matchId);

    if (espnMatch) {
      const res = await footballFetch(
        `/extended/espn/matches/${espnMatch.code}/${espnMatch.id}`
      );
      return res.ok ? await res.json() : null;
    }

    if (isExternalId(matchId)) {
      const res = await footballFetch(
        `/extended/matches/${matchId}`
      );
      return res.ok ? await res.json() : null;
    }

    const res = await footballFetch(
      `/enriched/matches/${matchId}`
    );

    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.log("MATCH DETAILS ERROR:", error);
    return null;
  }
}

export async function getCompetitionScorers(leagueCode) {
  try {
    const res = await footballFetch(
      `${BASE_URL}/competitions/${leagueCode}/scorers`
    );

    const data = await res.json();

    return data.scorers || [];
  } catch (error) {
    console.log("SCORERS ERROR:", error);
    return [];
  }
}

export function calculateClubStats(matches, teamId) {
  let played = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;

  matches.forEach((match) => {
    if (match.status !== "FINISHED") return;

    const isHome =
      match.homeTeam?.id === Number(teamId);

    const isAway =
      match.awayTeam?.id === Number(teamId);

    if (!isHome && !isAway) return;

    const homeGoals =
      match.score?.fullTime?.home ?? 0;

    const awayGoals =
      match.score?.fullTime?.away ?? 0;

    played++;

    if (isHome) {
      goalsFor += homeGoals;
      goalsAgainst += awayGoals;

      if (homeGoals > awayGoals) wins++;
      else if (homeGoals === awayGoals) draws++;
      else losses++;
    }

    if (isAway) {
      goalsFor += awayGoals;
      goalsAgainst += homeGoals;

      if (awayGoals > homeGoals) wins++;
      else if (awayGoals === homeGoals) draws++;
      else losses++;
    }
  });

  return {
    played,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    goalDifference:
      goalsFor - goalsAgainst,
  };
}
