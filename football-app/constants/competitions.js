export const competitions = [
  {
    code: "WC",
    name: "FIFA World Cup",
    logo: null,
    accent: "#6D123F",
  },
  {
    code: "CL",
    name: "UEFA Champions League",
    logo: "https://crests.football-data.org/CL.png",
    accent: "#163D8C",
  },
  {
    code: "EL",
    name: "UEFA Europa League",
    logo: "https://media.api-sports.io/football/leagues/3.png",
    accent: "#F26A21",
    provider: "apiSports",
    providerIds: [3],
  },
  {
    code: "UCL",
    name: "UEFA Conference League",
    logo: "https://media.api-sports.io/football/leagues/848.png",
    accent: "#19A64A",
    provider: "apiSports",
    providerIds: [848],
  },
  {
    code: "FR",
    name: "International & Club Friendlies",
    logo: "https://media.api-sports.io/football/leagues/10.png",
    accent: "#29A7A1",
    provider: "apiSports",
    providerIds: [10, 667],
    hasStandings: false,
  },
  {
    code: "BL1",
    name: "Bundesliga",
    logo: "https://crests.football-data.org/BL1.png",
    accent: "#D20515",
  },
  {
    code: "DED",
    name: "Eredivisie",
    logo: "https://crests.football-data.org/ED.png",
    accent: "#FF5A1F",
  },
  {
    code: "BSA",
    name: "Campeonato Brasileiro Serie A",
    logo: "https://crests.football-data.org/bsa.png",
    accent: "#009739",
  },
  {
    code: "PD",
    name: "La Liga",
    logo: "https://crests.football-data.org/PD.png",
    accent: "#EE8707",
  },
  {
    code: "FL1",
    name: "Ligue 1",
    logo: "https://crests.football-data.org/FL1.png",
    accent: "#DBFF00",
  },
  {
    code: "ELC",
    name: "Championship",
    logo: "https://crests.football-data.org/ELC.png",
    accent: "#EE1C2E",
  },
  {
    code: "PPL",
    name: "Primeira Liga",
    logo: "https://crests.football-data.org/PPL.png",
    accent: "#F4C542",
  },
  {
    code: "EC",
    name: "European Championship",
    logo: "https://crests.football-data.org/ec.png",
    accent: "#1F5DA8",
  },
  {
    code: "SA",
    name: "Serie A",
    logo: "https://crests.football-data.org/SA.png",
    accent: "#0675E8",
  },
  {
    code: "PL",
    name: "Premier League",
    logo: "https://crests.football-data.org/PL.png",
    accent: "#3D195B",
  },
];

export function getCompetition(code) {
  return competitions.find((item) => item.code === code) || null;
}

export function isExtendedCompetition(code) {
  return getCompetition(code)?.provider === "apiSports";
}

export function competitionHasStandings(code) {
  return getCompetition(code)?.hasStandings !== false;
}

export function getCompetitionSeason(code, date = new Date()) {
  if (code === "FR") return date.getFullYear();

  return date.getMonth() >= 6
    ? date.getFullYear()
    : date.getFullYear() - 1;
}
