export const WATCH_REGION_KEY = "matchzone_watch_region";

export const WATCH_REGIONS = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "MX", name: "Mexico" },
  { code: "GB", name: "United Kingdom" },
  { code: "GH", name: "Ghana" },
  { code: "NG", name: "Nigeria" },
  { code: "ZA", name: "South Africa" },
  { code: "IS", name: "Iceland" },
  { code: "OTHER", name: "Other region" },
];

const FIFA_WORLD_CUP_URL =
  "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026";
const FOX_WORLD_CUP_URL =
  "https://www.foxsports.com/soccer/fifa-world-cup";
const PEACOCK_WORLD_CUP_URL =
  "https://www.peacocktv.com/sports/soccer";
const UEFA_CHAMPIONS_LEAGUE_GUIDE =
  "https://www.uefa.com/uefachampionsleague/news/0253-0d82037aaedd-f371c464f919-1000--where-to-watch-the-uefa-champions-league-tv-broadcast-partne/";
const UEFA_EUROPA_LEAGUE_URL =
  "https://www.uefa.com/uefaeuropaleague/";
const UEFA_CONFERENCE_LEAGUE_URL =
  "https://www.uefa.com/uefaconferenceleague/";
const FIFA_MATCH_CENTRE_URL =
  "https://www.fifa.com/en/match-centre";

const COMPETITION_GUIDES = {
  WC: FIFA_WORLD_CUP_URL,
  CL: UEFA_CHAMPIONS_LEAGUE_GUIDE,
  EL: UEFA_EUROPA_LEAGUE_URL,
  UCL: UEFA_CONFERENCE_LEAGUE_URL,
  FR: FIFA_MATCH_CENTRE_URL,
  PL: "https://www.premierleague.com/broadcast-schedules",
  BL1: "https://www.bundesliga.com/en/bundesliga/info/broadcasters",
  PD: "https://www.laliga.com/en-US/where-to-watch-laliga-easports",
  SA: "https://www.legaseriea.it/en/media/serie-a",
  FL1: "https://ligue1.com/",
  DED: "https://eredivisie.eu/",
  BSA: "https://www.cbf.com.br/futebol-brasileiro",
  PPL: "https://www.ligaportugal.pt/",
  ELC: "https://www.efl.com/how-to-watch/",
  EC: "https://www.uefa.com/euro2024/",
};

const WORLD_CUP_OPTIONS = {
  US: [
    {
      name: "FOX Sports",
      detail: "English-language coverage on FOX, FS1 and FOX platforms.",
      url: FOX_WORLD_CUP_URL,
      language: "English",
      type: "TV / Stream",
    },
    {
      name: "Peacock / Telemundo",
      detail: "Spanish-language coverage of all 104 matches.",
      url: PEACOCK_WORLD_CUP_URL,
      language: "Spanish",
      type: "TV / Stream",
    },
  ],
};

const CHAMPIONS_LEAGUE_OPTIONS = {
  US: ["Paramount+", "TUDN", "DAZN"],
  CA: ["DAZN"],
  MX: ["Max", "FOX"],
  GB: ["HBO Max", "Amazon Prime", "BBC highlights"],
  GH: ["SuperSport", "New World TV", "Canal+"],
  NG: ["SuperSport"],
  ZA: ["SuperSport"],
  IS: ["Syn", "Viaplay"],
};

function broadcasterOption(name, guideUrl) {
  return {
    name,
    detail: "Open the provider guide for current match availability.",
    url: guideUrl,
    language: "Varies",
    type: "TV / Stream",
  };
}

export function getWatchOptions(competitionCode, regionCode) {
  if (competitionCode === "WC") {
    const options = WORLD_CUP_OPTIONS[regionCode] || [];

    return {
      options,
      guideUrl: FIFA_WORLD_CUP_URL,
      sourceLabel:
        regionCode === "US"
          ? "Broadcaster pages"
          : "FIFA competition guide",
      verifiedAt: "2026-06-07",
    };
  }

  if (competitionCode === "CL") {
    const names = CHAMPIONS_LEAGUE_OPTIONS[regionCode] || [];

    return {
      options: names.map((name) =>
        broadcasterOption(name, UEFA_CHAMPIONS_LEAGUE_GUIDE)
      ),
      guideUrl: UEFA_CHAMPIONS_LEAGUE_GUIDE,
      sourceLabel: "UEFA viewing guide",
      verifiedAt: "2026-05-29",
    };
  }

  if (competitionCode === "EL") {
    return {
      options: [],
      guideUrl: UEFA_EUROPA_LEAGUE_URL,
      sourceLabel: "UEFA Europa League",
      verifiedAt: "2026-06-08",
    };
  }

  if (competitionCode === "UCL") {
    return {
      options: [],
      guideUrl: UEFA_CONFERENCE_LEAGUE_URL,
      sourceLabel: "UEFA Conference League",
      verifiedAt: "2026-06-08",
    };
  }

  if (competitionCode === "FR") {
    return {
      options: [],
      guideUrl: FIFA_MATCH_CENTRE_URL,
      sourceLabel: "FIFA match centre",
      verifiedAt: "2026-06-08",
    };
  }

  return {
    options: [],
    guideUrl:
      COMPETITION_GUIDES[competitionCode] ||
      "https://www.football-data.org/",
    sourceLabel: "Competition viewing guide",
    verifiedAt: "2026-06-07",
  };
}

export function getOfficialMediaLinks(competitionCode, regionCode) {
  if (competitionCode === "WC" && regionCode === "US") {
    return {
      audio: [],
      highlights: [
        {
          name: "FOX Sports World Cup clips",
          url: FOX_WORLD_CUP_URL,
        },
        {
          name: "FIFA official match centre",
          url: FIFA_WORLD_CUP_URL,
        },
      ],
    };
  }

  if (competitionCode === "CL") {
    return {
      audio: [],
      highlights: [
        {
          name: "UEFA official Champions League coverage",
          url: "https://www.uefa.com/uefachampionsleague/video/",
        },
      ],
    };
  }

  if (competitionCode === "EL") {
    return {
      audio: [],
      highlights: [
        {
          name: "UEFA Europa League coverage",
          url: "https://www.uefa.com/uefaeuropaleague/video/",
        },
      ],
    };
  }

  if (competitionCode === "UCL") {
    return {
      audio: [],
      highlights: [
        {
          name: "UEFA Conference League coverage",
          url: "https://www.uefa.com/uefaconferenceleague/video/",
        },
      ],
    };
  }

  return {
    audio: [],
    highlights: [],
  };
}

export function getRegionName(regionCode) {
  return (
    WATCH_REGIONS.find((region) => region.code === regionCode)?.name ||
    "Other region"
  );
}
