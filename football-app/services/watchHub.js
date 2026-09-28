import { footballFetch } from "./footballApi";
import { getExtendedMatches } from "./extendedCompetitions";
import { competitions } from "../constants/competitions";

const BASE_URL = "https://api.football-data.org/v4";
const HUB_DAYS = 6;

const ALLOWED_COMPETITIONS = competitions.map(
  (competition) => competition.code
);

function dateOnly(date) {
  return date.toISOString().split("T")[0];
}

async function fetchJson(url) {
  const response = await footballFetch(url);

  if (!response.ok) {
    throw new Error(`Match provider returned ${response.status}.`);
  }

  return response.json();
}

export async function getWatchHubMatches() {
  const today = new Date();
  const future = new Date(today);
  future.setDate(today.getDate() + HUB_DAYS);

  const dateFrom = dateOnly(today);
  const dateTo = dateOnly(future);
  const [data, extendedMatches] = await Promise.all([
    fetchJson(
      `${BASE_URL}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
    ),
    getExtendedMatches(dateFrom, dateTo),
  ]);

  return [...(data.matches || []), ...extendedMatches]
    .filter(
      (match) =>
        ALLOWED_COMPETITIONS.includes(match.competition?.code) &&
        !["CANCELLED", "POSTPONED"].includes(match.status)
    )
    .sort(
      (a, b) =>
        new Date(a.utcDate).getTime() -
        new Date(b.utcDate).getTime()
    );
}

export async function getWatchMatch(matchId) {
  if (String(matchId || "").startsWith("ext-")) {
    return fetchJson(`/extended/matches/${matchId}`);
  }

  return fetchJson(`/enriched/matches/${matchId}`);
}

export function isLiveMatch(match) {
  return ["IN_PLAY", "PAUSED"].includes(match?.status);
}

export function getMatchCompanion(match) {
  const homeName =
    match.homeTeam?.shortName || match.homeTeam?.name || "Home";
  const awayName =
    match.awayTeam?.shortName || match.awayTeam?.name || "Away";
  const homeScore = match.score?.fullTime?.home;
  const awayScore = match.score?.fullTime?.away;
  const live = isLiveMatch(match);
  const facts = [];

  if (live && homeScore != null && awayScore != null) {
    if (homeScore === awayScore) {
      facts.push(`The match is level at ${homeScore}-${awayScore}.`);
    } else {
      const leader = homeScore > awayScore ? homeName : awayName;
      facts.push(`${leader} currently lead ${homeScore}-${awayScore}.`);
    }
  } else if (match.status === "FINISHED") {
    facts.push(
      `The verified final score is ${homeName} ${homeScore ?? "-"}-${
        awayScore ?? "-"
      } ${awayName}.`
    );
  } else {
    facts.push(
      `Kickoff is ${new Date(match.utcDate).toLocaleString()}.`
    );
  }

  if (match.group) {
    facts.push(
      `This is a ${match.group.replaceAll("_", " ")} fixture.`
    );
  } else if (match.stage) {
    facts.push(
      `Competition stage: ${match.stage.replaceAll("_", " ")}.`
    );
  }

  if (match.venue) {
    facts.push(`Venue: ${match.venue}.`);
  }

  return {
    facts,
    tacticalStatus:
      "Tactical claims are withheld because the current provider does not supply verified possession, shots, event coordinates or live formations.",
    updatedAt: match.lastUpdated || null,
  };
}
