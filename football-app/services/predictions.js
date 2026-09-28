import { footballFetch } from "./footballApi";
import { getExtendedMatches } from "./extendedCompetitions";

const BASE_URL =
  "https://api.football-data.org/v4";

const COMPETITIONS = [
  "WC",
  "CL",
  "BL1",
  "DED",
  "BSA",
  "PD",
  "FL1",
  "ELC",
  "PPL",
  "EC",
  "SA",
  "PL",
  "EL",
  "UCL",
  "FR",
];

const TREND_WINDOW = 8;
const FORECAST_DAYS = 7;

const trendCache = new Map();

function formatDate(date) {
  return date.toISOString().split("T")[0];
}

async function safeFetchJson(url) {
  try {
    const response = await footballFetch(url);

    if (!response.ok) {
      console.log("PREDICTION DATA ERROR:", response.status, url);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.log("PREDICTION FETCH ERROR:", error);
    return null;
  }
}

export async function getUpcomingMatches() {
  const today = new Date();
  const future = new Date(today);

  future.setDate(today.getDate() + FORECAST_DAYS);

  const dateFrom = formatDate(today);
  const dateTo = formatDate(future);
  const [data, extendedMatches] = await Promise.all([
    safeFetchJson(
      `${BASE_URL}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
    ),
    getExtendedMatches(dateFrom, dateTo),
  ]);

  if (!data && !extendedMatches.length) {
    throw new Error("Upcoming match data is unavailable.");
  }

  return [...(data?.matches || []), ...extendedMatches]
    .filter(
      (match) =>
        COMPETITIONS.includes(match.competition?.code) &&
        match.status !== "FINISHED" &&
        match.status !== "CANCELLED" &&
        match.status !== "POSTPONED" &&
        match.homeTeam?.id &&
        match.awayTeam?.id
    )
    .sort(
      (a, b) =>
        new Date(a.utcDate).getTime() -
        new Date(b.utcDate).getTime()
    );
}

async function getTrendsForDate(date, competitionCodes) {
  const competitions = [...new Set(competitionCodes)]
    .filter(Boolean)
    .sort()
    .join(",");

  const cacheKey = `${date}:${competitions}:${TREND_WINDOW}`;

  if (trendCache.has(cacheKey)) {
    return trendCache.get(cacheKey);
  }

  const data = await safeFetchJson(
    `${BASE_URL}/trends/?date=${date}&competitions=${competitions}&window=${TREND_WINDOW}&consider_side=true`
  );

  const trends = data?.trends || [];

  trendCache.set(cacheKey, trends);

  return trends;
}

export async function getPredictionData(matches) {
  const groupedByDate = matches.reduce((groups, match) => {
    const date = String(match.utcDate).split("T")[0];

    if (!groups[date]) {
      groups[date] = [];
    }

    groups[date].push(match);
    return groups;
  }, {});

  const trendByMatchId = new Map();

  for (const [date, dateMatches] of Object.entries(groupedByDate)) {
    const trends = await getTrendsForDate(
      date,
      dateMatches.map((match) => match.competition?.code)
    );

    trends.forEach((item) => {
      trendByMatchId.set(String(item.id), item);
    });
  }

  return matches.map((match) => ({
    match,
    trend: trendByMatchId.get(String(match.id)) || null,
  }));
}

export function getPredictionSourceDetails() {
  return {
    provider: "football-data.org",
    window: TREND_WINDOW,
    forecastDays: FORECAST_DAYS,
    venueSpecific: true,
  };
}
