import { footballFetch } from "./footballApi";
import {
  isExtendedCompetition,
} from "../constants/competitions";

const BASE_URL =
  "https://api.football-data.org/v4";

function dateOnly(date) {
  return date.toISOString().split("T")[0];
}

function extendedWindow() {
  const today = new Date();
  const past = new Date(today);
  const future = new Date(today);

  past.setDate(today.getDate() - 1);
  future.setDate(today.getDate() + 5);

  return {
    dateFrom: dateOnly(past),
    dateTo: dateOnly(future),
  };
}

/* =========================================
   GET LEAGUE STANDINGS
========================================= */

export async function getLeagueTable(
  leagueCode,
  season
) {
  if (isExtendedCompetition(leagueCode)) {
    const standings = await getLeagueStandings(
      leagueCode,
      season
    );
    return standings?.[0]?.table || [];
  }

  try {
    const query = season
      ? `?season=${season}`
      : "";

    const response =
      await footballFetch(
        `${BASE_URL}/competitions/${leagueCode}/standings${query}`,
      );

    const data =
      await response.json();

    return (
      data.standings?.[0]
        ?.table || []
    );
  } catch (error) {
    console.log(
      "TABLE ERROR:",
      error
    );

    return [];
  }
}

export async function getLeagueStandings(
  leagueCode,
  season
) {
  try {
    if (isExtendedCompetition(leagueCode)) {
      if (["EL", "UCL"].includes(leagueCode)) {
        const response = await footballFetch(
          `/extended/competitions/${leagueCode}/archive?season=2025`
        );

        if (!response.ok) return [];
        const data = await response.json();
        return data.standings || [];
      }

      return [];
    }

    const query = season
      ? `?season=${season}`
      : "";

    const response = await footballFetch(
      `${BASE_URL}/competitions/${leagueCode}/standings${query}`,
    );

    if (!response.ok) return [];

    const data = await response.json();

    return data.standings || [];
  } catch (error) {
    console.log("STANDINGS ERROR:", error);
    return [];
  }
}

/* =========================================
   GET LEAGUE FIXTURES
========================================= */

export async function getLeagueFixtures(
  leagueCode,
  season
) {
  try {
    if (isExtendedCompetition(leagueCode)) {
      if (["EL", "UCL"].includes(leagueCode)) {
        const response = await footballFetch(
          `/extended/competitions/${leagueCode}/archive?season=2025`
        );

        if (!response.ok) return [];
        const data = await response.json();
        return data.matches || [];
      }

      const { dateFrom, dateTo } = extendedWindow();
      const response = await footballFetch(
        `/extended/competitions/${leagueCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
      );

      if (!response.ok) return [];
      const data = await response.json();
      return data.matches || [];
    }

    const query = season
      ? `?season=${season}`
      : "";

    const response =
      await footballFetch(
        `${BASE_URL}/competitions/${leagueCode}/matches${query}`,
      );

    const data =
      await response.json();

    return data.matches || [];
  } catch (error) {
    console.log(
      "FIXTURES ERROR:",
      error
    );

    return [];
  }
}

export async function getCompetitionTeams(
  leagueCode,
  season
) {
  try {
    if (isExtendedCompetition(leagueCode)) {
      if (["EL", "UCL"].includes(leagueCode)) {
        const response = await footballFetch(
          `/extended/competitions/${leagueCode}/archive?season=2025`
        );

        if (!response.ok) {
          return {
            teams: [],
            competition: null,
            season: null,
          };
        }

        const data = await response.json();

        return {
          teams: data.teams || [],
          competition: data.competition || null,
          season: data.season || null,
        };
      }

      const { dateFrom, dateTo } = extendedWindow();
      const response = await footballFetch(
        `/extended/competitions/${leagueCode}/teams?dateFrom=${dateFrom}&dateTo=${dateTo}`
      );

      if (!response.ok) {
        return {
          teams: [],
          competition: null,
          season: null,
        };
      }

      const data = await response.json();

      return {
        teams: data.teams || [],
        competition: data.competition || null,
        season: data.season || null,
      };
    }

    const query = season
      ? `?season=${season}`
      : "";

    const response = await footballFetch(
      `${BASE_URL}/competitions/${leagueCode}/teams${query}`,
    );

    if (!response.ok) {
      return {
        teams: [],
        competition: null,
        season: null,
      };
    }

    const data = await response.json();

    return {
      teams: data.teams || [],
      competition: data.competition || null,
      season: data.season || null,
    };
  } catch (error) {
    console.log("COMPETITION TEAMS ERROR:", error);

    return {
      teams: [],
      competition: null,
      season: null,
    };
  }
}
