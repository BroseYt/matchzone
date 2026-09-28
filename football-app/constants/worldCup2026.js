export const WORLD_CUP_SEASON = 2026;

export const worldCup2026Teams = [
  { name: "Mexico", code: "mx", group: "A" },
  { name: "South Africa", code: "za", group: "A" },
  {
    name: "Korea Republic",
    code: "kr",
    group: "A",
    aliases: ["South Korea"],
  },
  {
    name: "Czechia",
    code: "cz",
    group: "A",
    aliases: ["Czech Republic"],
  },
  { name: "Canada", code: "ca", group: "B" },
  {
    name: "Bosnia and Herzegovina",
    code: "ba",
    group: "B",
    aliases: ["Bosnia-Herzegovina"],
  },
  { name: "Qatar", code: "qa", group: "B" },
  { name: "Switzerland", code: "ch", group: "B" },
  { name: "Brazil", code: "br", group: "C" },
  { name: "Morocco", code: "ma", group: "C" },
  { name: "Haiti", code: "ht", group: "C" },
  { name: "Scotland", code: "gb-sct", group: "C" },
  {
    name: "United States",
    code: "us",
    group: "D",
    aliases: ["USA", "United States of America"],
  },
  { name: "Paraguay", code: "py", group: "D" },
  { name: "Australia", code: "au", group: "D" },
  {
    name: "Turkiye",
    code: "tr",
    group: "D",
    aliases: ["Turkey"],
  },
  { name: "Germany", code: "de", group: "E" },
  {
    name: "Curacao",
    code: "cw",
    group: "E",
  },
  {
    name: "Cote d'Ivoire",
    code: "ci",
    group: "E",
    aliases: ["Ivory Coast"],
  },
  { name: "Ecuador", code: "ec", group: "E" },
  { name: "Netherlands", code: "nl", group: "F" },
  { name: "Japan", code: "jp", group: "F" },
  { name: "Sweden", code: "se", group: "F" },
  { name: "Tunisia", code: "tn", group: "F" },
  { name: "Belgium", code: "be", group: "G" },
  { name: "Egypt", code: "eg", group: "G" },
  {
    name: "IR Iran",
    code: "ir",
    group: "G",
    aliases: ["Iran"],
  },
  { name: "New Zealand", code: "nz", group: "G" },
  { name: "Spain", code: "es", group: "H" },
  {
    name: "Cabo Verde",
    code: "cv",
    group: "H",
    aliases: ["Cape Verde"],
  },
  { name: "Saudi Arabia", code: "sa", group: "H" },
  { name: "Uruguay", code: "uy", group: "H" },
  { name: "France", code: "fr", group: "I" },
  { name: "Senegal", code: "sn", group: "I" },
  { name: "Iraq", code: "iq", group: "I" },
  { name: "Norway", code: "no", group: "I" },
  { name: "Argentina", code: "ar", group: "J" },
  { name: "Algeria", code: "dz", group: "J" },
  { name: "Austria", code: "at", group: "J" },
  { name: "Jordan", code: "jo", group: "J" },
  { name: "Portugal", code: "pt", group: "K" },
  {
    name: "Congo DR",
    code: "cd",
    group: "K",
    aliases: ["DR Congo", "Congo"],
  },
  { name: "Uzbekistan", code: "uz", group: "K" },
  { name: "Colombia", code: "co", group: "K" },
  { name: "England", code: "gb-eng", group: "L" },
  { name: "Croatia", code: "hr", group: "L" },
  { name: "Ghana", code: "gh", group: "L" },
  { name: "Panama", code: "pa", group: "L" },
];

export function getFlagUrl(code, width = 160) {
  return `https://flagcdn.com/w${width}/${code}.png`;
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function findWorldCupTeam(value) {
  const target = normalize(
    typeof value === "string"
      ? value
      : value?.shortName || value?.name || value?.tla
  );

  if (!target) return null;

  return (
    worldCup2026Teams.find((team) =>
      [team.name, ...(team.aliases || [])].some(
        (candidate) => normalize(candidate) === target
      )
    ) || null
  );
}

export function mergeWorldCupTeams(apiTeams = []) {
  return worldCup2026Teams.map((country) => {
    const apiTeam = apiTeams.find((team) => {
      const candidates = [
        team.name,
        team.shortName,
        team.tla,
      ];

      return candidates.some((candidate) => {
        const match = findWorldCupTeam(candidate);
        return match?.code === country.code;
      });
    });

    return {
      ...country,
      id: apiTeam?.id || null,
      apiTeam: apiTeam || null,
      flag: getFlagUrl(country.code),
    };
  });
}

export function buildWorldCupStandings(
  apiTeams = [],
  fixtures = []
) {
  const teams = mergeWorldCupTeams(apiTeams);

  return Array.from({ length: 12 }, (_, index) => {
    const group = String.fromCharCode(65 + index);
    const groupTeams = teams.filter(
      (team) => team.group === group
    );
    const rows = new Map(
      groupTeams.map((country, drawOrder) => [
        country.code,
        {
          team: country.apiTeam || {
            id: country.id,
            name: country.name,
            shortName: country.name,
            crest: country.flag,
            area: { name: country.name },
          },
          flag: country.flag,
          playedGames: 0,
          won: 0,
          draw: 0,
          lost: 0,
          points: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          drawOrder,
        },
      ])
    );

    fixtures
      .filter((match) => {
        if (!["FINISHED", "IN_PLAY", "PAUSED"].includes(match.status)) {
          return false;
        }

        const matchGroup = String(match.group || "")
          .replace(/^GROUP_/, "");

        if (matchGroup) return matchGroup === group;

        const home = findWorldCupTeam(match.homeTeam);
        const away = findWorldCupTeam(match.awayTeam);
        return home?.group === group && away?.group === group;
      })
      .forEach((match) => {
        const homeCountry = findWorldCupTeam(match.homeTeam);
        const awayCountry = findWorldCupTeam(match.awayTeam);
        const home = rows.get(homeCountry?.code);
        const away = rows.get(awayCountry?.code);
        const homeGoals = Number(match.score?.fullTime?.home);
        const awayGoals = Number(match.score?.fullTime?.away);

        if (
          !home ||
          !away ||
          !Number.isFinite(homeGoals) ||
          !Number.isFinite(awayGoals)
        ) {
          return;
        }

        home.playedGames += 1;
        away.playedGames += 1;
        home.goalsFor += homeGoals;
        home.goalsAgainst += awayGoals;
        away.goalsFor += awayGoals;
        away.goalsAgainst += homeGoals;

        if (homeGoals > awayGoals) {
          home.won += 1;
          home.points += 3;
          away.lost += 1;
        } else if (awayGoals > homeGoals) {
          away.won += 1;
          away.points += 3;
          home.lost += 1;
        } else {
          home.draw += 1;
          away.draw += 1;
          home.points += 1;
          away.points += 1;
        }
      });

    const table = [...rows.values()]
      .map((entry) => ({
        ...entry,
        team: {
          ...entry.team,
          crest: entry.team?.crest || entry.flag,
        },
        goalDifference:
          entry.goalsFor - entry.goalsAgainst,
      }))
      .sort(
        (left, right) =>
          right.points - left.points ||
          right.goalDifference - left.goalDifference ||
          right.goalsFor - left.goalsFor ||
          left.drawOrder - right.drawOrder
      )
      .map(({ drawOrder, ...entry }, position) => ({
        position: position + 1,
        ...entry,
      }));

    return {
      stage: "GROUP_STAGE",
      type: "TOTAL",
      group: `GROUP_${group}`,
      table,
    };
  });
}
