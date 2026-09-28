const PROVIDER_BASE = "https://api.football-data.org/v4";
const API_SPORTS_BASE = "https://v3.football.api-sports.io";
const ESPN_SITE_BASE =
  "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_STANDINGS_BASE =
  "https://site.api.espn.com/apis/v2/sports/soccer";
const ALLOWED_PATH =
  /^\/(matches|competitions|teams|persons|areas|scorers|trends)(\/|$)/;
const MATCH_DETAIL_PATH = /^\/matches\/\d+$/;
const EXTENDED_CODES = {
  EL: {
    name: "UEFA Europa League",
    ids: [3],
    area: "Europe",
    emblem: "https://media.api-sports.io/football/leagues/3.png",
  },
  UCL: {
    name: "UEFA Conference League",
    ids: [848],
    area: "Europe",
    emblem: "https://media.api-sports.io/football/leagues/848.png",
  },
  FR: {
    name: "International & Club Friendlies",
    ids: [10, 667],
    area: "World",
    emblem: "https://media.api-sports.io/football/leagues/10.png",
  },
};
const COMPETITION_ALIASES = {
  UECL: "UCL",
};
const ARCHIVE_SEASON = 2025;
const ESPN_COMPETITIONS = {
  EL: "uefa.europa",
  UCL: "uefa.europa.conf",
};
const ESPN_PRIMARY_COMPETITIONS = {
  PL: "eng.1",
  ELC: "eng.2",
  PD: "esp.1",
  BL1: "ger.1",
  SA: "ita.1",
  FL1: "fra.1",
  DED: "ned.1",
  PPL: "por.1",
  CL: "uefa.champions",
  EC: "uefa.euro",
  WC: "fifa.world",
  BSA: "bra.1",
};
const ARCHIVE_DATES = {
  EL: [
    "2025-09-24",
    "2025-09-25",
    "2025-10-02",
    "2025-10-23",
    "2025-11-06",
    "2025-11-27",
    "2025-12-11",
    "2026-01-22",
    "2026-01-29",
    "2026-02-19",
    "2026-02-26",
    "2026-03-12",
    "2026-03-18",
    "2026-03-19",
    "2026-04-08",
    "2026-04-09",
    "2026-04-16",
    "2026-04-30",
    "2026-05-07",
    "2026-05-20",
  ],
  UCL: [
    "2025-10-02",
    "2025-10-23",
    "2025-11-06",
    "2025-11-27",
    "2025-12-11",
    "2025-12-18",
    "2026-02-19",
    "2026-02-26",
    "2026-03-12",
    "2026-03-19",
    "2026-04-09",
    "2026-04-16",
    "2026-04-30",
    "2026-05-07",
    "2026-05-27",
  ],
};
const NEWS_FEEDS = {
  bbc: "https://feeds.bbci.co.uk/sport/football/rss.xml",
  sky: "https://www.skysports.com/rss/11095",
};
const NEWS_HOSTS = new Set([
  "www.bbc.com",
  "www.bbc.co.uk",
  "bbc.com",
  "bbc.co.uk",
  "www.skysports.com",
  "skysports.com",
]);

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonResponse(value, status = 200, ttl = 0) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
      "Cache-Control":
        status === 200 && ttl > 0
          ? `public, max-age=${ttl}`
          : "no-store",
    },
  });
}

function htmlMetaContent(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const forward = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  const reverse = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    "i"
  );

  return html.match(forward)?.[1] || html.match(reverse)?.[1] || null;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function handleNews(incoming) {
  if (incoming.pathname === "/news/feed") {
    const source = incoming.searchParams.get("source");
    const feedUrl = NEWS_FEEDS[source];

    if (!feedUrl) {
      return jsonResponse({ error: "Unsupported news source" }, 400);
    }

    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "MatchZone/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      cf: {
        cacheEverything: true,
        cacheTtl: 600,
      },
    });

    if (!response.ok) {
      return jsonResponse({ error: "News feed unavailable" }, 502);
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders(),
        "Content-Type": "application/rss+xml; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  }

  if (incoming.pathname === "/news/image") {
    let articleUrl;

    try {
      articleUrl = new URL(incoming.searchParams.get("url"));
    } catch {
      return jsonResponse({ error: "Invalid article URL" }, 400);
    }

    if (
      articleUrl.protocol !== "https:" ||
      !NEWS_HOSTS.has(articleUrl.hostname)
    ) {
      return jsonResponse({ error: "Unsupported article host" }, 400);
    }

    const response = await fetch(articleUrl, {
      headers: {
        "User-Agent": "MatchZone/1.0",
        Accept: "text/html",
      },
      cf: {
        cacheEverything: true,
        cacheTtl: 3600,
      },
    });

    if (!response.ok) {
      return jsonResponse({ image: null }, 200, 600);
    }

    const html = await response.text();
    const image =
      htmlMetaContent(html, "og:image") ||
      htmlMetaContent(html, "twitter:image") ||
      htmlMetaContent(html, "twitter:image:src");

    return jsonResponse(
      { image: image ? decodeHtml(image) : null },
      200,
      3600
    );
  }

  return null;
}

async function requestJson(request) {
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (contentLength > 20000) {
    const error = new Error("Request is too large");
    error.status = 413;
    throw error;
  }

  try {
    return await request.json();
  } catch {
    const error = new Error("Invalid JSON request");
    error.status = 400;
    throw error;
  }
}

function validExpoToken(token) {
  return /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/.test(
    String(token || "")
  );
}

async function tokenHash(token) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);

  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function safeAlertSettings(value) {
  return {
    goals: value?.goals !== false,
    fullTime: value?.fullTime !== false,
  };
}

function scoreNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function subscriptionScore(match) {
  return {
    home: scoreNumber(match?.score?.fullTime?.home),
    away: scoreNumber(match?.score?.fullTime?.away),
    status: match?.status || null,
  };
}

function matchAlertKey(matchId, hash) {
  return `sub:${encodeURIComponent(matchId)}:${hash}`;
}

async function handleAlerts(request, incoming, env) {
  if (!env.ALERTS) {
    return jsonResponse({ error: "Match alerts are not configured" }, 503);
  }

  if (incoming.pathname === "/alerts/devices") {
    const body = await requestJson(request);

    if (!validExpoToken(body.token)) {
      return jsonResponse({ error: "Invalid Expo push token" }, 400);
    }

    const hash = await tokenHash(body.token);

    if (request.method === "DELETE") {
      await env.ALERTS.delete(`device:${hash}`);

      const subscriptions = await env.ALERTS.list({ prefix: "sub:" });
      await Promise.all(
        subscriptions.keys
          .filter((key) => key.name.endsWith(`:${hash}`))
          .map((key) => env.ALERTS.delete(key.name))
      );

      return jsonResponse({ registered: false });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    await env.ALERTS.put(
      `device:${hash}`,
      JSON.stringify({
        token: body.token,
        settings: safeAlertSettings(body.settings),
        updatedAt: new Date().toISOString(),
      })
    );

    return jsonResponse({ registered: true });
  }

  const route = incoming.pathname.match(/^\/alerts\/matches\/([^/]+)$/);

  if (!route) return null;

  const matchId = decodeURIComponent(route[1]);
  const body =
    request.method === "GET"
      ? { token: incoming.searchParams.get("token") }
      : await requestJson(request);

  if (!validExpoToken(body.token)) {
    return jsonResponse({ error: "Invalid Expo push token" }, 400);
  }

  const hash = await tokenHash(body.token);
  const key = matchAlertKey(matchId, hash);

  if (request.method === "GET") {
    return jsonResponse({ subscribed: Boolean(await env.ALERTS.get(key)) });
  }

  if (request.method === "DELETE") {
    await env.ALERTS.delete(key);
    return jsonResponse({ subscribed: false });
  }

  if (request.method !== "POST" || !body.match) {
    return jsonResponse({ error: "Match details are required" }, 400);
  }

  const kickoff = Date.parse(body.match.utcDate);
  const expiresAt = Number.isFinite(kickoff)
    ? kickoff + 6 * 60 * 60 * 1000
    : Date.now() + 24 * 60 * 60 * 1000;
  const subscription = {
    token: body.token,
    matchId,
    providerMatchId: body.match.providerMatchId || null,
    homeTeam: body.match.homeTeam?.name || "Home",
    awayTeam: body.match.awayTeam?.name || "Away",
    utcDate: body.match.utcDate || null,
    settings: safeAlertSettings(body.settings),
    expiresAt,
  };

  await Promise.all([
    env.ALERTS.put(key, JSON.stringify(subscription), {
      expirationTtl: Math.max(
        3600,
        Math.ceil((expiresAt - Date.now()) / 1000)
      ),
    }),
    env.ALERTS.put(
      `device:${hash}`,
      JSON.stringify({
        token: body.token,
        settings: safeAlertSettings(body.settings),
        updatedAt: new Date().toISOString(),
      })
    ),
  ]);

  const scoreKey = `score:${matchId}`;
  if (body.syncScore || !(await env.ALERTS.get(scoreKey))) {
    await env.ALERTS.put(
      scoreKey,
      JSON.stringify(subscriptionScore(body.match)),
      { expirationTtl: 21600 }
    );
  }

  return jsonResponse({ subscribed: true });
}

async function sendExpoPush(messages) {
  if (!messages.length) return;

  for (let index = 0; index < messages.length; index += 100) {
    const response = await fetch(
      "https://exp.host/--/api/v2/push/send",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages.slice(index, index + 100)),
      }
    );

    if (!response.ok) {
      throw new Error(`Expo push failed with ${response.status}`);
    }
  }
}

function footballDataAlertMatch(match) {
  return {
    id: String(match.id),
    status: match.status,
    home: scoreNumber(
      match.score?.fullTime?.home ?? match.score?.regularTime?.home
    ),
    away: scoreNumber(
      match.score?.fullTime?.away ?? match.score?.regularTime?.away
    ),
    homeTeam: match.homeTeam?.name || "Home",
    awayTeam: match.awayTeam?.name || "Away",
  };
}

function apiSportsAlertMatch(item) {
  return {
    id: externalId(item.fixture?.id),
    status: statusFromApiSports(item.fixture?.status),
    home: scoreNumber(item.goals?.home),
    away: scoreNumber(item.goals?.away),
    homeTeam: item.teams?.home?.name || "Home",
    awayTeam: item.teams?.away?.name || "Away",
  };
}

function alertWindowIsActive(subscription, now) {
  const kickoff = Date.parse(subscription.utcDate);

  if (!Number.isFinite(kickoff)) return true;
  return now >= kickoff - 30 * 60 * 1000 && now <= kickoff + 4 * 60 * 60 * 1000;
}

async function processGoalAlerts(env) {
  if (!env.ALERTS) return;

  const listed = await env.ALERTS.list({ prefix: "sub:" });
  const subscriptions = (
    await Promise.all(
      listed.keys.map(async (key) => {
        const value = await env.ALERTS.get(key.name, "json");
        return value ? { ...value, key: key.name } : null;
      })
    )
  ).filter(Boolean);
  const now = Date.now();
  const active = subscriptions.filter(
    (subscription) =>
      subscription.expiresAt > now &&
      alertWindowIsActive(subscription, now)
  );

  if (!active.length) return;

  const needsPrimary = active.some(
    (subscription) => !String(subscription.matchId).startsWith("ext-")
  );
  const needsExtended = active.some((subscription) =>
    String(subscription.matchId).startsWith("ext-")
  );
  const liveMatches = [];

  if (needsPrimary && env.FOOTBALL_DATA_TOKEN) {
    const response = await fetch(`${PROVIDER_BASE}/matches?status=LIVE`, {
      headers: {
        "X-Auth-Token": env.FOOTBALL_DATA_TOKEN,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      liveMatches.push(
        ...(data.matches || []).map(footballDataAlertMatch)
      );
    }
  }

  if (needsExtended && env.API_FOOTBALL_KEY) {
    const rows = await apiSportsFetch("/fixtures?live=all", env, 30);
    liveMatches.push(...rows.map(apiSportsAlertMatch));
  }

  const byId = new Map(liveMatches.map((match) => [match.id, match]));
  const grouped = new Map();

  active.forEach((subscription) => {
    const entries = grouped.get(subscription.matchId) || [];
    entries.push(subscription);
    grouped.set(subscription.matchId, entries);
  });

  for (const [matchId, matchSubscriptions] of grouped) {
    const current = byId.get(matchId);
    if (!current) continue;

    const scoreKey = `score:${matchId}`;
    const previous =
      (await env.ALERTS.get(scoreKey, "json")) || {
        home: current.home,
        away: current.away,
        status: current.status,
      };
    const goalScored =
      current.home > scoreNumber(previous.home) ||
      current.away > scoreNumber(previous.away);
    const justFinished =
      current.status === "FINISHED" && previous.status !== "FINISHED";
    const messages = [];

    matchSubscriptions.forEach((subscription) => {
      if (goalScored && subscription.settings?.goals !== false) {
        messages.push({
          to: subscription.token,
          title: "GOAL",
          body: `${current.homeTeam} ${current.home}-${current.away} ${current.awayTeam}`,
          sound: "default",
          priority: "high",
          channelId: "goals",
          data: { matchId },
        });
      } else if (
        justFinished &&
        subscription.settings?.fullTime !== false
      ) {
        messages.push({
          to: subscription.token,
          title: "Full time",
          body: `${current.homeTeam} ${current.home}-${current.away} ${current.awayTeam}`,
          sound: "default",
          priority: "high",
          channelId: "default",
          data: { matchId },
        });
      }
    });

    await Promise.all([
      sendExpoPush(messages),
      env.ALERTS.put(
        scoreKey,
        JSON.stringify({
          home: current.home,
          away: current.away,
          status: current.status,
        }),
        { expirationTtl: 21600 }
      ),
    ]);
  }
}

function cacheTtl(pathname) {
  if (MATCH_DETAIL_PATH.test(pathname)) return 30;
  if (pathname.includes("/matches")) return 60;
  if (pathname.includes("/standings")) return 60;
  if (pathname.includes("/scorers")) return 300;
  if (pathname.includes("/trends")) return 300;
  if (pathname.includes("/teams")) return 86400;
  if (pathname.includes("/persons")) return 86400;
  return 900;
}

function apiSportsCacheTtl(pathname) {
  if (/\/matches\/ext-\d+$/.test(pathname)) return 30;
  if (pathname.endsWith("/live")) return 30;
  if (pathname.endsWith("/matches")) return 60;
  if (pathname.endsWith("/standings")) return 600;
  if (pathname.endsWith("/teams")) return 86400;
  if (pathname.endsWith("/squad")) return 86400;
  return 900;
}

function externalId(value) {
  return `ext-${value}`;
}

function numericExternalId(value) {
  const match = String(value || "").match(/^ext-(\d+)$/);
  return match ? Number(match[1]) : null;
}

function competitionCodeForLeague(leagueId) {
  const id = Number(leagueId);

  return (
    Object.entries(EXTENDED_CODES).find(([, item]) =>
      item.ids.includes(id)
    )?.[0] || "FR"
  );
}

function normalizeCompetitionCode(code) {
  const value = String(code || "").toUpperCase();
  return COMPETITION_ALIASES[value] || value;
}

function seasonObject(season, code) {
  const year = Number(season);

  if (!Number.isFinite(year)) return null;

  return {
    id: `${code}-${year}`,
    startDate:
      code === "FR" ? `${year}-01-01` : `${year}-07-01`,
    endDate:
      code === "FR"
        ? `${year}-12-31`
        : `${year + 1}-06-30`,
    currentMatchday: null,
  };
}

function statusFromApiSports(status) {
  const short = status?.short;

  if (["1H", "2H", "ET", "BT", "P", "LIVE"].includes(short)) {
    return "IN_PLAY";
  }
  if (short === "HT") return "PAUSED";
  if (["FT", "AET", "PEN"].includes(short)) return "FINISHED";
  if (["PST", "TBD"].includes(short)) return "POSTPONED";
  if (short === "CANC") return "CANCELLED";
  if (["ABD", "SUSP", "INT"].includes(short)) return "SUSPENDED";
  return short === "NS" ? "TIMED" : "SCHEDULED";
}

function stageFromRound(round) {
  return String(round || "FRIENDLY")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeTeam(team, country = "") {
  if (!team) return null;

  return {
    id: externalId(team.id),
    name: team.name,
    shortName: team.name,
    tla: null,
    crest: team.logo || null,
    national: Boolean(team.national),
    area: {
      name: country || "World",
      code: null,
    },
  };
}

function normalizeFixture(item, forcedCode) {
  const fixture = item.fixture || {};
  const league = item.league || {};
  const code = forcedCode || competitionCodeForLeague(league.id);
  const meta = EXTENDED_CODES[code] || EXTENDED_CODES.FR;

  return {
    id: externalId(fixture.id),
    providerMatchId: fixture.id,
    utcDate: fixture.date,
    status: statusFromApiSports(fixture.status),
    minute: fixture.status?.elapsed ?? null,
    statusDetail: fixture.status?.long || null,
    matchday: null,
    stage: stageFromRound(league.round),
    group: null,
    lastUpdated: fixture.timestamp
      ? new Date(fixture.timestamp * 1000).toISOString()
      : fixture.date,
    venue: fixture.venue?.name || null,
    area: {
      name: league.country || meta.area,
      code: null,
      flag: league.flag || null,
    },
    competition: {
      id: `ext-${league.id}`,
      name:
        code === "FR"
          ? league.name || meta.name
          : meta.name,
      code,
      type: "CUP",
      emblem: league.logo || meta.emblem,
    },
    season: seasonObject(league.season, code),
    homeTeam: normalizeTeam(
      item.teams?.home,
      league.country || meta.area
    ),
    awayTeam: normalizeTeam(
      item.teams?.away,
      league.country || meta.area
    ),
    score: {
      winner:
        item.teams?.home?.winner === true
          ? "HOME_TEAM"
          : item.teams?.away?.winner === true
          ? "AWAY_TEAM"
          : item.teams?.home?.winner === false &&
            item.teams?.away?.winner === false
          ? "DRAW"
          : null,
      fullTime: {
        home: item.score?.fulltime?.home ?? item.goals?.home ?? null,
        away: item.score?.fulltime?.away ?? item.goals?.away ?? null,
      },
      halfTime: {
        home: item.score?.halftime?.home ?? null,
        away: item.score?.halftime?.away ?? null,
      },
      extraTime: {
        home: item.score?.extratime?.home ?? null,
        away: item.score?.extratime?.away ?? null,
      },
      penalties: {
        home: item.score?.penalty?.home ?? null,
        away: item.score?.penalty?.away ?? null,
      },
    },
    referees: fixture.referee
      ? [{ id: null, name: fixture.referee, type: "REFEREE" }]
      : [],
  };
}

async function espnJson(url, ttl = 86400) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "MatchZone/1.0",
    },
    cf: {
      cacheEverything: true,
      cacheTtl: ttl,
    },
  });

  if (!response.ok) {
    const error = new Error(`ESPN data request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function espnTeam(team, code) {
  if (!team) return null;

  return {
    id: `espn-${code}-${team.id}`,
    name: team.displayName || team.name,
    shortName:
      team.shortDisplayName || team.abbreviation || team.displayName,
    tla: team.abbreviation || null,
    crest:
      team.logo ||
      team.logos?.find((logo) => logo.rel?.includes("default"))?.href ||
      team.logos?.[0]?.href ||
      null,
    area: {
      name: team.location || "Europe",
      code: null,
    },
  };
}

function espnStatus(status) {
  if (status?.type?.completed) return "FINISHED";
  if (status?.type?.state === "in") return "IN_PLAY";
  if (status?.type?.name === "STATUS_HALFTIME") return "PAUSED";
  if (status?.type?.name === "STATUS_POSTPONED") return "POSTPONED";
  if (status?.type?.name === "STATUS_CANCELED") return "CANCELLED";
  return "TIMED";
}

function espnArchiveStage(code, utcDate) {
  const date = String(utcDate || "").slice(0, 10);
  const leagueStageEnd = code === "EL" ? "2026-01-29" : "2025-12-18";

  if (date <= leagueStageEnd) return "LEAGUE_STAGE";
  if (date <= "2026-02-26") return "KNOCKOUT_ROUND_PLAYOFFS";
  if (date <= "2026-03-19") return "ROUND_OF_16";
  if (date <= "2026-04-16") return "QUARTER_FINALS";
  if (date <= "2026-05-07") return "SEMI_FINALS";
  return "FINAL";
}

function normalizeEspnEvent(event, code) {
  const competition = event.competitions?.[0] || {};
  const homeEntry = competition.competitors?.find(
    (entry) => entry.homeAway === "home"
  );
  const awayEntry = competition.competitors?.find(
    (entry) => entry.homeAway === "away"
  );
  const homeScore = Number(homeEntry?.score);
  const awayScore = Number(awayEntry?.score);
  const meta = EXTENDED_CODES[code];

  return {
    id: `espn-${code}-${event.id}`,
    providerMatchId: event.id,
    utcDate: event.date || competition.date,
    status: espnStatus(event.status || competition.status),
    minute: null,
    statusDetail:
      event.status?.type?.detail || competition.status?.type?.detail || null,
    matchday: null,
    stage: espnArchiveStage(code, event.date || competition.date),
    group: null,
    lastUpdated: new Date().toISOString(),
    venue:
      competition.venue?.fullName ||
      competition.venue?.address?.city ||
      null,
    area: { name: "Europe", code: null, flag: null },
    competition: competitionPayload(code),
    season: seasonObject(ARCHIVE_SEASON, code),
    homeTeam: espnTeam(homeEntry?.team, code),
    awayTeam: espnTeam(awayEntry?.team, code),
    score: {
      winner:
        homeEntry?.winner === true
          ? "HOME_TEAM"
          : awayEntry?.winner === true
          ? "AWAY_TEAM"
          : Number.isFinite(homeScore) &&
            Number.isFinite(awayScore) &&
            homeScore === awayScore
          ? "DRAW"
          : null,
      fullTime: {
        home: Number.isFinite(homeScore) ? homeScore : null,
        away: Number.isFinite(awayScore) ? awayScore : null,
      },
      halfTime: { home: null, away: null },
      extraTime: { home: null, away: null },
      penalties: { home: null, away: null },
    },
    referees: [],
    source: "ESPN",
    sourceLeague: meta.name,
  };
}

function espnStatMap(stats) {
  return Object.fromEntries(
    (stats || [])
      .filter((stat) => stat?.name)
      .map((stat) => [
        String(stat.name)
          .replace(/([a-z])([A-Z])/g, "$1_$2")
          .toLowerCase(),
        stat.displayValue ?? stat.value ?? null,
      ])
  );
}

function normalizeEspnStandings(data, code, teamLogos) {
  const entries = data.children?.[0]?.standings?.entries || [];

  return entries.length
    ? [
        {
          stage: "LEAGUE_STAGE",
          type: "TOTAL",
          group: null,
          competition: competitionPayload(code),
          area: { name: "Europe", code: null },
          table: entries.map((entry, index) => {
            const stats = Object.fromEntries(
              (entry.stats || []).map((stat) => [stat.name, stat.value])
            );
            const team = espnTeam(
              {
                ...entry.team,
                logo:
                  entry.team?.logo ||
                  teamLogos.get(String(entry.team?.id)),
              },
              code
            );

            return {
              position: Number(stats.rank) || index + 1,
              team,
              playedGames: Number(stats.gamesPlayed) || 0,
              won: Number(stats.wins) || 0,
              draw: Number(stats.ties) || 0,
              lost: Number(stats.losses) || 0,
              points: Number(stats.points) || 0,
              goalsFor: Number(stats.pointsFor) || 0,
              goalsAgainst: Number(stats.pointsAgainst) || 0,
              goalDifference: Number(stats.pointDifferential) || 0,
            };
          }),
        },
      ]
    : [];
}

async function espnArchivedCompetition(code) {
  const slug = ESPN_COMPETITIONS[code];
  const [scoreboard, standingsData] = await Promise.all([
    espnJson(
      `${ESPN_SITE_BASE}/${slug}/scoreboard?dates=20250801-20260601&limit=1000`,
      31536000
    ),
    espnJson(
      `${ESPN_STANDINGS_BASE}/${slug}/standings?season=${ARCHIVE_SEASON}`,
      31536000
    ),
  ]);
  const matches = (scoreboard.events || [])
    .map((event) => normalizeEspnEvent(event, code))
    .sort(
      (left, right) =>
        new Date(left.utcDate).getTime() - new Date(right.utcDate).getTime()
    );
  const teamLogos = new Map();

  (scoreboard.events || []).forEach((event) => {
    (event.competitions?.[0]?.competitors || []).forEach((entry) => {
      if (entry.team?.id && entry.team?.logo) {
        teamLogos.set(String(entry.team.id), entry.team.logo);
      }
    });
  });

  return {
    competition: competitionPayload(code),
    season: seasonObject(ARCHIVE_SEASON, code),
    matches,
    teams: teamsFromFixtures(code, matches),
    standings: normalizeEspnStandings(
      standingsData,
      code,
      teamLogos
    ),
    completedDates: (ARCHIVE_DATES[code] || []).length,
    totalDates: (ARCHIVE_DATES[code] || []).length,
    complete: true,
    source: "ESPN",
  };
}

function espnRosterPlayer(entry) {
  const athlete = entry.athlete || {};

  return {
    id: null,
    name: athlete.displayName || athlete.fullName || "Player",
    position:
      entry.position?.abbreviation ||
      entry.position?.displayName ||
      null,
    shirtNumber: entry.jersey || null,
    grid: null,
    photo: athlete.headshot?.href || null,
    rating: null,
    substitute: !entry.starter,
    stats: espnStatMap(entry.stats?.value || entry.stats),
  };
}

async function espnMatchDetails(code, eventId) {
  const slug = ESPN_COMPETITIONS[code];
  const data = await espnJson(
    `${ESPN_SITE_BASE}/${slug}/summary?event=${eventId}`,
    31536000
  );
  const competition = data.header?.competitions?.[0];

  if (!competition) {
    const error = new Error("Archived match not found");
    error.status = 404;
    throw error;
  }

  const match = normalizeEspnEvent(
    {
      id: eventId,
      date: competition.date,
      status: competition.status,
      competitions: [competition],
    },
    code
  );
  const rosters = new Map(
    (data.rosters || []).map((roster) => [
      String(roster.team?.id),
      roster,
    ])
  );
  const teamStats = new Map(
    (data.boxscore?.teams || []).map((entry) => [
      String(entry.team?.id),
      espnStatMap(entry.statistics),
    ])
  );

  [match.homeTeam, match.awayTeam].forEach((team) => {
    const teamId = String(team?.id || "").split("-").at(-1);
    const roster = rosters.get(teamId);
    const players = (roster?.roster || []).map(espnRosterPlayer);

    if (!team) return;
    team.formation = roster?.formation || null;
    team.lineup = players.filter((player) => !player.substitute);
    team.bench = players.filter((player) => player.substitute);
    team.statistics = teamStats.get(teamId) || {};
  });

  const scoringEvents = (data.keyEvents || []).filter(
    (event) => event.scoringPlay
  );
  match.goals = scoringEvents.map((event) => ({
    minute: Number.parseInt(event.clock?.displayValue, 10) || null,
    injuryTime: null,
    type: event.type?.text || "Goal",
    scorer: {
      id: null,
      name:
        event.participants?.[0]?.athlete?.displayName ||
        event.shortText ||
        "Goal",
    },
    assist: null,
    team: event.team
      ? espnTeam(event.team, code)
      : null,
    score: null,
  }));
  match.bookings = (data.keyEvents || [])
    .filter((event) =>
      /card/i.test(event.type?.text || event.type?.type || "")
    )
    .map((event) => ({
      minute: Number.parseInt(event.clock?.displayValue, 10) || null,
      card: event.type?.text || "Card",
      player: {
        id: null,
        name:
          event.participants?.[0]?.athlete?.displayName ||
          event.shortText ||
          "Player",
      },
      team: event.team ? espnTeam(event.team, code) : null,
    }));
  match.substitutions = (data.keyEvents || [])
    .filter((event) =>
      /substitution/i.test(event.type?.text || event.type?.type || "")
    )
    .map((event) => ({
      minute: Number.parseInt(event.clock?.displayValue, 10) || null,
      team: event.team ? espnTeam(event.team, code) : null,
      playerIn: {
        id: null,
        name:
          event.participants?.[0]?.athlete?.displayName ||
          event.shortText ||
          "Player",
      },
      playerOut: event.participants?.[1]?.athlete
        ? {
            id: null,
            name: event.participants[1].athlete.displayName,
          }
        : null,
    }));
  match.varDecisions = [];
  match.venue =
    data.gameInfo?.venue?.fullName ||
    competition.venue?.fullName ||
    match.venue;
  match.attendance = data.gameInfo?.attendance || null;
  match.referees = (data.gameInfo?.officials || []).map((official) => ({
    id: null,
    name: official.displayName || official.fullName,
    type: official.position?.displayName || "Official",
  }));

  return match;
}

function matchingEspnEvent(match, events) {
  const kickoff = new Date(match.utcDate).getTime();

  return (
    (events || [])
      .map((event) => {
        const competition = event.competitions?.[0] || {};
        const home = competition.competitors?.find(
          (entry) => entry.homeAway === "home"
        );
        const away = competition.competitors?.find(
          (entry) => entry.homeAway === "away"
        );
        const eventKickoff = new Date(
          event.date || competition.date
        ).getTime();
        const homeScore = teamNameSimilarity(
          match.homeTeam?.name,
          home?.team?.displayName || home?.team?.name
        );
        const awayScore = teamNameSimilarity(
          match.awayTeam?.name,
          away?.team?.displayName || away?.team?.name
        );

        return {
          event,
          confidence: homeScore + awayScore,
          timeDifference: Math.abs(eventKickoff - kickoff),
          sidesMatch: homeScore >= 0.5 && awayScore >= 0.5,
        };
      })
      .filter(
        (candidate) =>
          candidate.sidesMatch &&
          candidate.timeDifference <= 12 * 60 * 60 * 1000
      )
      .sort(
        (left, right) =>
          right.confidence - left.confidence ||
          left.timeDifference - right.timeDifference
      )[0]?.event || null
  );
}

function espnSupplementPlayer(entry) {
  const player = espnRosterPlayer(entry);
  const rating = Number(
    player.stats?.rating ||
      player.stats?.average_rating ||
      player.stats?.total_rating
  );

  return {
    ...player,
    rating: Number.isFinite(rating) ? rating : null,
  };
}

function mergeMatchSupplement(match, supplement) {
  if (!supplement) return match;

  ["homeTeam", "awayTeam"].forEach((side) => {
    const current = match[side];
    const extra = supplement[side];

    if (!current || !extra) return;
    if (!(current.lineup || []).length && extra.lineup?.length) {
      current.lineup = extra.lineup;
    }
    if (!(current.bench || []).length && extra.bench?.length) {
      current.bench = extra.bench;
    }
    if (!current.formation && extra.formation) {
      current.formation = extra.formation;
    }
    if (
      !Object.keys(current.statistics || {}).length &&
      Object.keys(extra.statistics || {}).length
    ) {
      current.statistics = extra.statistics;
    }
  });

  for (const field of [
    "goals",
    "bookings",
    "substitutions",
    "varDecisions",
  ]) {
    if (!(match[field] || []).length && supplement[field]?.length) {
      match[field] = supplement[field];
    }
  }

  if (!match.venue && supplement.venue) match.venue = supplement.venue;
  if (!match.attendance && supplement.attendance) {
    match.attendance = supplement.attendance;
  }
  if (!(match.referees || []).length && supplement.referees?.length) {
    match.referees = supplement.referees;
  }

  return match;
}

async function espnPrimarySupplement(match) {
  const code = match.competition?.code;
  const slug = ESPN_PRIMARY_COMPETITIONS[code];

  if (!slug) return null;

  const date = String(match.utcDate || "").slice(0, 10);
  if (!isoDate(date)) return null;

  const dateParam = date.replaceAll("-", "");
  const live = ["IN_PLAY", "PAUSED"].includes(match.status);
  const ttl = live ? 10 : match.status === "FINISHED" ? 86400 : 60;
  const scoreboard = await espnJson(
    `${ESPN_SITE_BASE}/${slug}/scoreboard?dates=${dateParam}&limit=100`,
    ttl
  );
  const event = matchingEspnEvent(match, scoreboard.events);

  if (!event?.id) return null;

  const data = await espnJson(
    `${ESPN_SITE_BASE}/${slug}/summary?event=${event.id}`,
    ttl
  );
  const competition = data.header?.competitions?.[0];
  const homeEntry = competition?.competitors?.find(
    (entry) => entry.homeAway === "home"
  );
  const awayEntry = competition?.competitors?.find(
    (entry) => entry.homeAway === "away"
  );

  if (!competition || !homeEntry || !awayEntry) return null;

  const rosters = new Map(
    (data.rosters || []).map((roster) => [
      String(roster.team?.id),
      roster,
    ])
  );
  const teamStats = new Map(
    (data.boxscore?.teams || []).map((entry) => [
      String(entry.team?.id),
      espnStatMap(entry.statistics),
    ])
  );
  const homeId = String(homeEntry.team?.id);
  const awayId = String(awayEntry.team?.id);
  const teamForEvent = (team) => {
    const id = String(team?.id || "");
    if (id === homeId) return match.homeTeam;
    if (id === awayId) return match.awayTeam;
    return null;
  };
  const sidePayload = (entry) => {
    const teamId = String(entry.team?.id);
    const roster = rosters.get(teamId);
    const players = (roster?.roster || []).map(espnSupplementPlayer);

    return {
      formation: roster?.formation || null,
      lineup: players.filter((player) => !player.substitute),
      bench: players.filter((player) => player.substitute),
      statistics: teamStats.get(teamId) || {},
    };
  };
  const eventMinute = (entry) =>
    Number.parseInt(entry.clock?.displayValue, 10) || null;
  const keyEvents = data.keyEvents || [];

  return {
    homeTeam: sidePayload(homeEntry),
    awayTeam: sidePayload(awayEntry),
    goals: keyEvents
      .filter((entry) => entry.scoringPlay)
      .map((entry) => ({
        minute: eventMinute(entry),
        injuryTime: null,
        type: entry.type?.text || "Goal",
        scorer: {
          id: null,
          name:
            entry.participants?.[0]?.athlete?.displayName ||
            entry.shortText ||
            "Goal",
        },
        assist: null,
        team: teamForEvent(entry.team),
      })),
    bookings: keyEvents
      .filter((entry) =>
        /card/i.test(entry.type?.text || entry.type?.type || "")
      )
      .map((entry) => ({
        minute: eventMinute(entry),
        injuryTime: null,
        card: entry.type?.text || "Card",
        player: {
          id: null,
          name:
            entry.participants?.[0]?.athlete?.displayName ||
            entry.shortText ||
            "Player",
        },
        team: teamForEvent(entry.team),
      })),
    substitutions: keyEvents
      .filter((entry) =>
        /substitution/i.test(
          entry.type?.text || entry.type?.type || ""
        )
      )
      .map((entry) => ({
        minute: eventMinute(entry),
        injuryTime: null,
        team: teamForEvent(entry.team),
        playerIn: {
          id: null,
          name:
            entry.participants?.[0]?.athlete?.displayName ||
            entry.shortText ||
            "Player",
        },
        playerOut: entry.participants?.[1]?.athlete
          ? {
              id: null,
              name: entry.participants[1].athlete.displayName,
            }
          : null,
      })),
    varDecisions: [],
    venue:
      data.gameInfo?.venue?.fullName ||
      competition.venue?.fullName ||
      null,
    attendance: data.gameInfo?.attendance || null,
    referees: (data.gameInfo?.officials || []).map((official) => ({
      id: null,
      name: official.displayName || official.fullName,
      type: official.position?.displayName || "Official",
    })),
  };
}

async function espnTeamDetails(code, teamId) {
  const slug = ESPN_COMPETITIONS[code];
  const data = await espnJson(
    `${ESPN_SITE_BASE}/${slug}/teams/${teamId}`,
    86400
  );
  const team = data.team;

  if (!team) {
    const error = new Error("Team not found");
    error.status = 404;
    throw error;
  }

  return {
    ...espnTeam(team, code),
    founded: null,
    clubColors: team.color || null,
    venue: team.venue?.fullName || null,
    address: team.location || null,
    website: team.links?.find((link) => link.rel?.includes("clubhouse"))
      ?.href,
    runningCompetitions: [competitionPayload(code)],
    squad: [],
  };
}

function normalizeLineupPlayer(entry) {
  const player = entry?.player || {};
  const playerId = Number(player.id);

  return {
    id: externalId(player.id),
    name: player.name,
    position: player.pos || null,
    shirtNumber: player.number ?? null,
    grid: player.grid || null,
    photo: Number.isFinite(playerId)
      ? `https://media.api-sports.io/football/players/${playerId}.png`
      : null,
  };
}

function normalizePlayerMatchStats(entry) {
  const stats = entry?.statistics?.[0] || {};
  const player = entry?.player || {};
  const rating = Number(stats.games?.rating);

  return {
    id: externalId(player.id),
    name: player.name,
    photo: player.photo || null,
    rating: Number.isFinite(rating) ? rating : null,
    minutes: stats.games?.minutes ?? null,
    shirtNumber: stats.games?.number ?? null,
    position: stats.games?.position || null,
    captain: Boolean(stats.games?.captain),
    substitute: Boolean(stats.games?.substitute),
    offsides: stats.offsides ?? null,
    shots: stats.shots || null,
    goals: stats.goals || null,
    passes: stats.passes || null,
    tackles: stats.tackles || null,
    duels: stats.duels || null,
    dribbles: stats.dribbles || null,
    fouls: stats.fouls || null,
    cards: stats.cards || null,
    penalty: stats.penalty || null,
  };
}

function normalizeStatistics(entries) {
  return Object.fromEntries(
    (entries || [])
      .filter((entry) => entry?.type)
      .map((entry) => [
        String(entry.type)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_|_$/g, ""),
        entry.value,
      ])
  );
}

function attachFixtureDetails(match, item) {
  const homeNumericId = numericExternalId(match.homeTeam?.id);
  const awayNumericId = numericExternalId(match.awayTeam?.id);
  const lineups = new Map(
    (item.lineups || []).map((lineup) => [
      Number(lineup.team?.id),
      lineup,
    ])
  );
  const statistics = new Map(
    (item.statistics || []).map((entry) => [
      Number(entry.team?.id),
      entry.statistics,
    ])
  );
  const playerStatistics = new Map();

  (item.players || []).forEach((teamEntry) => {
    (teamEntry.players || []).forEach((entry) => {
      const normalized = normalizePlayerMatchStats(entry);
      playerStatistics.set(normalized.id, normalized);
    });
  });
  match.playerStatisticsAvailable = playerStatistics.size > 0;

  [
    [match.homeTeam, homeNumericId],
    [match.awayTeam, awayNumericId],
  ].forEach(([team, id]) => {
    const lineup = lineups.get(id);
    team.formation = lineup?.formation || null;
    team.lineup = (lineup?.startXI || []).map(
      (entry) => {
        const player = normalizeLineupPlayer(entry);
        return {
          ...player,
          ...(playerStatistics.get(player.id) || {}),
          grid: player.grid,
        };
      }
    );
    team.bench = (lineup?.substitutes || []).map(
      (entry) => {
        const player = normalizeLineupPlayer(entry);
        return {
          ...player,
          ...(playerStatistics.get(player.id) || {}),
          grid: player.grid,
        };
      }
    );
    team.statistics = normalizeStatistics(statistics.get(id));
    team.coach = lineup?.coach
      ? {
          id: externalId(lineup.coach.id),
          name: lineup.coach.name,
          nationality: null,
        }
      : null;
  });

  const events = item.events || [];

  match.goals = events
    .filter((event) => event.type === "Goal")
    .map((event) => ({
      minute: event.time?.elapsed ?? null,
      injuryTime: event.time?.extra ?? null,
      type: event.detail || "REGULAR",
      team: normalizeTeam(event.team),
      scorer: event.player
        ? {
            id: externalId(event.player.id),
            name: event.player.name,
          }
        : null,
      assist: event.assist
        ? {
            id: externalId(event.assist.id),
            name: event.assist.name,
          }
        : null,
    }));

  match.bookings = events
    .filter((event) => event.type === "Card")
    .map((event) => ({
      minute: event.time?.elapsed ?? null,
      injuryTime: event.time?.extra ?? null,
      card: event.detail || "CARD",
      team: normalizeTeam(event.team),
      player: event.player
        ? {
            id: externalId(event.player.id),
            name: event.player.name,
          }
        : null,
    }));

  match.substitutions = events
    .filter((event) => event.type === "subst")
    .map((event) => ({
      minute: event.time?.elapsed ?? null,
      injuryTime: event.time?.extra ?? null,
      team: normalizeTeam(event.team),
      playerOut: event.player
        ? {
            id: externalId(event.player.id),
            name: event.player.name,
          }
        : null,
      playerIn: event.assist
        ? {
            id: externalId(event.assist.id),
            name: event.assist.name,
          }
        : null,
    }));

  match.varDecisions = events
    .filter((event) => event.type === "Var")
    .map((event) => ({
      minute: event.time?.elapsed ?? null,
      injuryTime: event.time?.extra ?? null,
      detail: event.detail || "VAR",
      team: normalizeTeam(event.team),
      player: event.player
        ? {
            id: externalId(event.player.id),
            name: event.player.name,
          }
        : null,
    }));

  return match;
}

async function fixtureWithPlayerStats(fixtureId, env, ttl) {
  const savedKey = `match-data:${fixtureId}`;
  const saved = env.ALERTS
    ? await env.ALERTS.get(savedKey, "json")
    : null;
  let fixtureRows = [];

  try {
    fixtureRows = await apiSportsFetch(
      `/fixtures?id=${fixtureId}`,
      env,
      ttl
    );
  } catch (error) {
    if (saved) return saved;
    throw error;
  }

  const item = fixtureRows[0];

  if (!item) return saved;

  const status = item.fixture?.status?.short;
  const live = [
    "1H",
    "HT",
    "2H",
    "ET",
    "BT",
    "P",
    "LIVE",
  ].includes(status);
  const finished = ["FT", "AET", "PEN"].includes(status);
  const now = Date.now();
  const kickoff = new Date(item.fixture?.date || 0).getTime();
  const nearKickoff =
    Number.isFinite(kickoff) &&
    now >= kickoff - 90 * 60 * 1000 &&
    now <= kickoff + 30 * 60 * 1000;
  const meta = {
    ...(saved?._matchzone || {}),
  };
  const currentScore = `${item.goals?.home ?? ""}:${
    item.goals?.away ?? ""
  }`;
  const savedScore = `${saved?.goals?.home ?? ""}:${
    saved?.goals?.away ?? ""
  }`;
  const scoreChanged = Boolean(saved && currentScore !== savedScore);

  for (const field of [
    "lineups",
    "statistics",
    "events",
    "players",
  ]) {
    if (!(item[field] || []).length && (saved?.[field] || []).length) {
      item[field] = saved[field];
    }

    if ((item[field] || []).length && !meta[field]) {
      meta[field] = now;
    }
  }

  const shouldRefresh = (field, interval, refreshExisting = false) => {
    const hasData = (item[field] || []).length > 0;
    const age = now - Number(meta[field] || 0);

    if (!hasData) return age >= interval;
    return refreshExisting && age >= interval;
  };
  const requests = [];

  if (
    (!finished || !(item.lineups || []).length) &&
    shouldRefresh(
      "lineups",
      live || nearKickoff ? 20000 : 60000
    )
  ) {
    requests.push(
      apiSportsFetch(
        `/fixtures/lineups?fixture=${fixtureId}`,
        env,
        finished ? 86400 : live || nearKickoff ? 15 : 30
      ).then((rows) => {
        item.lineups = rows;
        meta.lineups = Date.now();
      })
    );
  }

  if (
    (!finished || !(item.statistics || []).length) &&
    shouldRefresh("statistics", live ? 60000 : 120000, live)
  ) {
    requests.push(
      apiSportsFetch(
        `/fixtures/statistics?fixture=${fixtureId}`,
        env,
        finished ? 86400 : live ? 30 : 60
      ).then((rows) => {
        item.statistics = rows;
        meta.statistics = Date.now();
      })
    );
  }

  if (
    (!finished || !(item.events || []).length) &&
    (scoreChanged ||
      shouldRefresh("events", live ? 60000 : 120000, live))
  ) {
    requests.push(
      apiSportsFetch(
        `/fixtures/events?fixture=${fixtureId}`,
        env,
        finished ? 86400 : scoreChanged ? 5 : live ? 30 : 60
      ).then((rows) => {
        item.events = rows;
        meta.events = Date.now();
      })
    );
  }

  if (
    (!finished || !(item.players || []).length) &&
    shouldRefresh("players", live ? 60000 : 120000, live)
  ) {
    requests.push(
      apiSportsFetch(
        `/fixtures/players?fixture=${fixtureId}`,
        env,
        finished ? 86400 : live ? 60 : 120
      ).then((rows) => {
        item.players = rows;
        meta.players = Date.now();
      })
    );
  }

  await Promise.allSettled(requests);

  item._matchzone = meta;

  if (env.ALERTS) {
    await env.ALERTS.put(savedKey, JSON.stringify(item), {
      expirationTtl: 60 * 24 * 60 * 60,
    });
  }

  return item;
}

async function apiSportsFetch(path, env, ttl) {
  if (!env.API_FOOTBALL_KEY) {
    const error = new Error("API-Football is not configured");
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${API_SPORTS_BASE}${path}`, {
    headers: {
      "x-apisports-key": env.API_FOOTBALL_KEY,
      Accept: "application/json",
    },
    cf: {
      cacheEverything: true,
      cacheTtl: ttl,
    },
  });
  const data = await response.json();

  if (!response.ok || Object.keys(data.errors || {}).length > 0) {
    const error = new Error(
      JSON.stringify(data.errors || data.message || "API error")
    );
    error.status = response.ok ? 502 : response.status || 502;
    throw error;
  }

  return data.response || [];
}

function comparableName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(fc|cf|afc|sc|club|football|calcio)\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function teamNameSimilarity(left, right) {
  const a = comparableName(left);
  const b = comparableName(right);

  if (!a || !b) return 0;
  if (a === b) return 1;
  if (
    Math.min(a.length, b.length) >= 5 &&
    (a.includes(b) || b.includes(a))
  ) {
    return 0.9;
  }

  const aTokens = new Set(a.split(" "));
  const bTokens = new Set(b.split(" "));
  const shared = [...aTokens].filter((token) =>
    bTokens.has(token)
  ).length;

  return shared / Math.max(aTokens.size, bTokens.size);
}

function matchingFixture(match, rows) {
  const kickoff = new Date(match.utcDate).getTime();

  return (
    rows
      .map((item) => {
        const itemKickoff = new Date(item.fixture?.date).getTime();
        const homeScore = teamNameSimilarity(
          match.homeTeam?.name,
          item.teams?.home?.name
        );
        const awayScore = teamNameSimilarity(
          match.awayTeam?.name,
          item.teams?.away?.name
        );
        const timeDifference = Math.abs(itemKickoff - kickoff);

        return {
          item,
          confidence: homeScore + awayScore,
          timeDifference,
          sidesMatch: homeScore >= 0.5 && awayScore >= 0.5,
        };
      })
      .filter(
        (candidate) =>
          candidate.sidesMatch &&
          candidate.timeDifference <= 12 * 60 * 60 * 1000
      )
      .sort(
        (a, b) =>
          b.confidence - a.confidence ||
          a.timeDifference - b.timeDifference
      )[0]?.item || null
  );
}

async function footballDataMatch(matchId, env) {
  const response = await fetch(
    `${PROVIDER_BASE}/matches/${matchId}`,
    {
      headers: {
        "X-Auth-Token": env.FOOTBALL_DATA_TOKEN,
        Accept: "application/json",
        "X-Unfold-Lineups": "true",
        "X-Unfold-Bookings": "true",
        "X-Unfold-Subs": "true",
        "X-Unfold-Goals": "true",
      },
      cf: {
        cacheEverything: true,
        cacheTtl: 10,
      },
    }
  );

  if (!response.ok) {
    const error = new Error("Original match provider request failed");
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function enrichedMatch(matchId, env) {
  const original = await footballDataMatch(matchId, env);
  const date = String(original.utcDate || "").slice(0, 10);

  if (!isoDate(date)) return original;

  let rows = [];

  try {
    rows = await cachedDateFixtures(
      date,
      env,
      fixtureDateTtl(date)
    );
  } catch {
    rows = [];
  }

  const item = matchingFixture(original, rows);

  let result = original;

  if (item) {
    const detailedItem =
      (await fixtureWithPlayerStats(
        item.fixture?.id,
        env,
        10
      ).catch(() => null)) || item;
    const enriched = attachFixtureDetails(
      normalizeFixture(detailedItem),
      detailedItem
    );

    result = {
      ...enriched,
      id: original.id,
      area: original.area || enriched.area,
      competition: original.competition || enriched.competition,
      season: original.season || enriched.season,
      matchday: original.matchday ?? enriched.matchday,
      stage: original.stage || enriched.stage,
      group: original.group || enriched.group,
    };
  }

  const needsSupplement =
    !(result.homeTeam?.lineup || []).length ||
    !(result.awayTeam?.lineup || []).length ||
    !Object.keys(result.homeTeam?.statistics || {}).length ||
    !Object.keys(result.awayTeam?.statistics || {}).length;

  if (needsSupplement) {
    const supplement = await espnPrimarySupplement(original).catch(
      () => null
    );
    mergeMatchSupplement(result, supplement);
  }

  return result;
}

function isoDate(value) {
  const text = String(value || "");
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function datesBetween(dateFrom, dateTo, maximumDays = 7) {
  const startText = isoDate(dateFrom);
  const endText = isoDate(dateTo);

  if (!startText || !endText) return [];

  const start = new Date(`${startText}T00:00:00Z`);
  const end = new Date(`${endText}T00:00:00Z`);

  if (start > end) return [];

  const requestedDays =
    Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  if (requestedDays > maximumDays) return [];

  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end && dates.length < maximumDays) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function fixtureDateTtl(date) {
  const today = new Date().toISOString().slice(0, 10);

  if (date < today) return 86400;
  if (date === today) return 60;
  return 21600;
}

async function cachedDateFixtures(
  date,
  env,
  maxAge = fixtureDateTtl(date)
) {
  const cache = globalThis.caches?.default;
  const cacheKey = new Request(
    `https://matchzone-cache.invalid/api-football/fixtures/${date}`
  );
  let saved = null;

  if (cache) {
    const cachedResponse = await cache.match(cacheKey);
    saved = cachedResponse
      ? await cachedResponse.json()
      : null;

    if (
      Array.isArray(saved?.rows) &&
      Date.now() - Number(saved.fetchedAt || 0) <
        maxAge * 1000
    ) {
      return saved.rows;
    }
  }

  try {
    const rows = await apiSportsFetch(
      `/fixtures?date=${date}`,
      env,
      fixtureDateTtl(date)
    );

    if (cache) {
      await cache.put(
        cacheKey,
        new Response(
          JSON.stringify({
            fetchedAt: Date.now(),
            rows,
          }),
          {
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": `public, max-age=${Math.max(
                86400,
                maxAge
              )}`,
            },
          }
        )
      );
    }

    return rows;
  } catch (error) {
    if (Array.isArray(saved?.rows)) return saved.rows;
    throw error;
  }
}

function archiveStandings(code, matches) {
  const meta = EXTENDED_CODES[code];
  const teams = new Map();

  matches
    .filter(
      (match) =>
        match.status === "FINISHED" &&
        String(match.stage || "").startsWith("LEAGUE_STAGE")
    )
    .forEach((match) => {
      const home = match.homeTeam;
      const away = match.awayTeam;
      const homeGoals = Number(match.score?.fullTime?.home);
      const awayGoals = Number(match.score?.fullTime?.away);

      if (
        !home?.id ||
        !away?.id ||
        !Number.isFinite(homeGoals) ||
        !Number.isFinite(awayGoals)
      ) {
        return;
      }

      [home, away].forEach((team) => {
        if (!teams.has(team.id)) {
          teams.set(team.id, {
            team,
            playedGames: 0,
            won: 0,
            draw: 0,
            lost: 0,
            points: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
          });
        }
      });

      const homeRow = teams.get(home.id);
      const awayRow = teams.get(away.id);
      homeRow.playedGames += 1;
      awayRow.playedGames += 1;
      homeRow.goalsFor += homeGoals;
      homeRow.goalsAgainst += awayGoals;
      awayRow.goalsFor += awayGoals;
      awayRow.goalsAgainst += homeGoals;

      if (homeGoals > awayGoals) {
        homeRow.won += 1;
        homeRow.points += 3;
        awayRow.lost += 1;
      } else if (awayGoals > homeGoals) {
        awayRow.won += 1;
        awayRow.points += 3;
        homeRow.lost += 1;
      } else {
        homeRow.draw += 1;
        awayRow.draw += 1;
        homeRow.points += 1;
        awayRow.points += 1;
      }
    });

  const table = [...teams.values()]
    .map((entry) => ({
      ...entry,
      goalDifference: entry.goalsFor - entry.goalsAgainst,
    }))
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.goalDifference - left.goalDifference ||
        right.goalsFor - left.goalsFor ||
        left.team.name.localeCompare(right.team.name)
    )
    .map((entry, index) => ({
      position: index + 1,
      ...entry,
    }));

  return table.length
    ? [
        {
          stage: "LEAGUE_STAGE",
          type: "TOTAL",
          group: null,
          table,
          competition: competitionPayload(code),
          area: { name: meta.area, code: null },
        },
      ]
    : [];
}

async function archivedCompetition(code, env) {
  const meta = EXTENDED_CODES[code];
  const dates = ARCHIVE_DATES[code] || [];
  const rows = [];
  let completedDates = 0;

  try {
    return await espnArchivedCompetition(code);
  } catch {
    // Keep the configured provider as a fallback if ESPN is unavailable.
  }

  try {
    for (const leagueId of meta.ids) {
      rows.push(
        ...(await apiSportsFetch(
          `/fixtures?league=${leagueId}&season=${ARCHIVE_SEASON}`,
          env,
          31536000
        ))
      );
    }

    const matches = normalizeFixtures(rows, code);

    return {
      competition: competitionPayload(code),
      season: seasonObject(ARCHIVE_SEASON, code),
      matches,
      teams: teamsFromFixtures(code, matches),
      standings: archiveStandings(code, matches),
      completedDates: dates.length,
      totalDates: dates.length,
      complete: true,
      source: "season",
    };
  } catch {
    rows.length = 0;
  }

  for (const date of dates) {
    try {
      const fixtures = await cachedDateFixtures(
        date,
        env,
        31536000
      );
      completedDates += 1;
      rows.push(
        ...fixtures.filter((item) =>
          meta.ids.includes(Number(item.league?.id))
        )
      );
    } catch {
      break;
    }
  }

  const matches = normalizeFixtures(rows, code);

  return {
    competition: competitionPayload(code),
    season: seasonObject(ARCHIVE_SEASON, code),
    matches,
    teams: teamsFromFixtures(code, matches),
    standings: archiveStandings(code, matches),
    completedDates,
    totalDates: dates.length,
    complete: completedDates === dates.length,
    source: "dates",
  };
}

function isExtendedLeague(item) {
  const leagueId = Number(item?.league?.id);

  return Object.values(EXTENDED_CODES).some((meta) =>
    meta.ids.includes(leagueId)
  );
}

async function dateFixtures(dateFrom, dateTo, env) {
  const dates = datesBetween(dateFrom, dateTo);

  if (!dates.length) {
    const error = new Error(
      "Use a valid dateFrom/dateTo range of no more than 7 days"
    );
    error.status = 400;
    throw error;
  }

  const rows = [];
  const today = new Date().toISOString().slice(0, 10);
  const orderedDates = [...dates].sort((left, right) => {
    if (left === today) return -1;
    if (right === today) return 1;
    return left.localeCompare(right);
  });
  let completedRequests = 0;
  let providerError = null;

  // Sequential requests avoid short bursts against the free API plan.
  for (const date of orderedDates) {
    try {
      const fixtures = await cachedDateFixtures(date, env);
      completedRequests += 1;
      rows.push(...fixtures);
    } catch (error) {
      providerError = error;
      break;
    }
  }

  if (completedRequests === 0 && providerError) {
    throw providerError;
  }

  return rows.filter(isExtendedLeague);
}

function normalizeFixtures(rows, forcedCode) {
  return rows
    .map((item) => normalizeFixture(item, forcedCode))
    .sort(
      (a, b) =>
        new Date(a.utcDate).getTime() -
        new Date(b.utcDate).getTime()
    );
}

async function competitionFixtures(code, dateFrom, dateTo, env) {
  const meta = EXTENDED_CODES[code];
  const rows = await dateFixtures(dateFrom, dateTo, env);

  return normalizeFixtures(
    rows.filter((item) =>
      meta.ids.includes(Number(item.league?.id))
    ),
    code
  );
}

function teamsFromFixtures(code, fixtures) {
  const meta = EXTENDED_CODES[code];
  const map = new Map();

  fixtures.forEach((match) => {
    [match.homeTeam, match.awayTeam].forEach((team) => {
      if (team?.id) map.set(team.id, team);
    });
  });

  return [...map.values()]
    .map((team) => ({
      ...team,
      area: team.area || { name: meta.area, code: null },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function competitionPayload(code) {
  const meta = EXTENDED_CODES[code];

  return {
    id: `ext-${meta.ids[0]}`,
    name: meta.name,
    code,
    type: "CUP",
    emblem: meta.emblem,
    area: { name: meta.area, code: null },
  };
}

async function liveFixtures(env) {
  let rows = [];

  try {
    rows = await apiSportsFetch("/fixtures?live=all", env, 30);
  } catch {
    const today = new Date().toISOString().slice(0, 10);
    rows = await cachedDateFixtures(today, env, 60);
  }

  return normalizeFixtures(
    rows.filter(
      (item) =>
        isExtendedLeague(item) &&
        ["IN_PLAY", "PAUSED"].includes(
          statusFromApiSports(item.fixture?.status)
        )
    )
  );
}

function currentSeasonObject(code) {
  const now = new Date();
  const year =
    code === "FR" || now.getUTCMonth() >= 6
      ? now.getUTCFullYear()
      : now.getUTCFullYear() - 1;

  return seasonObject(year, code);
}

async function competitionTeams(code, dateFrom, dateTo, env) {
  const matches = await competitionFixtures(
    code,
    dateFrom,
    dateTo,
    env
  );

  return teamsFromFixtures(code, matches);
}

async function handleExtended(incoming, env) {
  const ttl = apiSportsCacheTtl(incoming.pathname);
  if (incoming.pathname === "/extended/player-lookup") {
    const name = String(incoming.searchParams.get("name") || "").trim();

    if (name.length < 3) {
      return jsonResponse({ error: "Player name is required" }, 400);
    }

    const profileKey = `player-profile:${comparableName(name)}`;
    const savedProfile = env.ALERTS
      ? await env.ALERTS.get(profileKey, "json")
      : null;
    const target = comparableName(name);
    const savedProfileMatches =
      savedProfile && comparableName(savedProfile.name) === target;
    let rows = [];

    try {
      rows = await apiSportsFetch(
        `/players/profiles?search=${encodeURIComponent(name)}`,
        env,
        86400
      );
    } catch (error) {
      if (savedProfileMatches) {
        return jsonResponse(savedProfile, 200, 86400);
      }
      throw error;
    }

    const exactProfile = (candidates) =>
      candidates.find((row) => {
        const player = row.player || {};
        const fullName = [player.firstname, player.lastname]
          .filter(Boolean)
          .join(" ");

        return [player.name, fullName].some(
          (candidate) => comparableName(candidate) === target
        );
      });
    let entry = exactProfile(rows);

    if (!entry) {
      const surname = name.trim().split(/\s+/).at(-1);

      if (
        surname &&
        surname.length >= 4 &&
        comparableName(surname) !== target
      ) {
        try {
          const surnameRows = await apiSportsFetch(
            `/players/profiles?search=${encodeURIComponent(surname)}`,
            env,
            86400
          );
          entry = exactProfile(surnameRows);
        } catch (error) {
          if (savedProfileMatches) {
            return jsonResponse(savedProfile, 200, 86400);
          }
          throw error;
        }
      }
    }

    if (!entry?.player) {
      if (savedProfileMatches) {
        return jsonResponse(savedProfile, 200, 86400);
      }
      return jsonResponse({ error: "Player not found" }, 404);
    }

    const player = entry.player;
    const profile = {
      id: externalId(player.id),
      name: player.name,
      firstName: player.firstname,
      lastName: player.lastname,
      dateOfBirth: player.birth?.date || null,
      birthPlace: player.birth?.place || null,
      birthCountry: player.birth?.country || null,
      nationality: player.nationality || null,
      height: player.height || null,
      weight: player.weight || null,
      shirtNumber: player.number ?? null,
      position: player.position || null,
      photo: player.photo || null,
    };

    if (env.ALERTS) {
      await env.ALERTS.put(profileKey, JSON.stringify(profile), {
        expirationTtl: 365 * 24 * 60 * 60,
      });
    }

    return jsonResponse(profile, 200, 86400);
  }

  const espnMatch = incoming.pathname.match(
    /^\/extended\/espn\/matches\/(EL|UCL|UECL)\/(\d+)$/
  );
  const espnTeamPath = incoming.pathname.match(
    /^\/extended\/espn\/teams\/(EL|UCL|UECL)\/(\d+)$/
  );

  if (espnMatch) {
    return jsonResponse(
      await espnMatchDetails(
        normalizeCompetitionCode(espnMatch[1]),
        espnMatch[2]
      ),
      200,
      86400
    );
  }

  if (espnTeamPath) {
    return jsonResponse(
      await espnTeamDetails(
        normalizeCompetitionCode(espnTeamPath[1]),
        espnTeamPath[2]
      ),
      200,
      86400
    );
  }

  const archiveMatch = incoming.pathname.match(
    /^\/extended\/competitions\/(EL|UCL|UECL)\/archive$/
  );

  if (archiveMatch) {
    const payload = await archivedCompetition(
      normalizeCompetitionCode(archiveMatch[1]),
      env
    );

    return jsonResponse(payload, 200, 86400);
  }

  if (incoming.pathname === "/extended/live") {
    return jsonResponse(
      { matches: await liveFixtures(env) },
      200,
      ttl
    );
  }

  if (incoming.pathname === "/extended/matches") {
    const dateFrom = incoming.searchParams.get("dateFrom");
    const dateTo = incoming.searchParams.get("dateTo");
    const rows = await dateFixtures(dateFrom, dateTo, env);

    return jsonResponse(
      { matches: normalizeFixtures(rows) },
      200,
      ttl
    );
  }

  const competitionMatch = incoming.pathname.match(
    /^\/extended\/competitions\/([A-Z]+)\/(matches|teams|standings)$/
  );

  if (competitionMatch) {
    const [, rawCode, resource] = competitionMatch;
    const code = normalizeCompetitionCode(rawCode);
    const meta = EXTENDED_CODES[code];
    const dateFrom = incoming.searchParams.get("dateFrom");
    const dateTo = incoming.searchParams.get("dateTo");
    const season = incoming.searchParams.get("season");

    if (!meta) {
      return jsonResponse(
        { error: "Unsupported competition" },
        400
      );
    }

    if (resource === "matches") {
      if (["EL", "UCL"].includes(code) && season) {
        const archive = await archivedCompetition(code, env);

        return jsonResponse(
          { matches: archive.matches || [] },
          200,
          ttl
        );
      }

      return jsonResponse(
        {
          matches: await competitionFixtures(
            code,
            dateFrom,
            dateTo,
            env
          ),
        },
        200,
        ttl
      );
    }

    if (resource === "teams") {
      if (["EL", "UCL"].includes(code) && season) {
        const archive = await archivedCompetition(code, env);

        return jsonResponse(
          {
            teams: archive.teams || [],
            competition: archive.competition || competitionPayload(code),
            season: archive.season || seasonObject(season, code),
          },
          200,
          ttl
        );
      }

      return jsonResponse(
        {
          teams: await competitionTeams(
            code,
            dateFrom,
            dateTo,
            env
          ),
          competition: competitionPayload(code),
          season: currentSeasonObject(code),
        },
        200,
        ttl
      );
    }

    if (["EL", "UCL"].includes(code) && season) {
      const archive = await archivedCompetition(code, env);

      return jsonResponse(
        { standings: archive.standings || [] },
        200,
        ttl
      );
    }

    return jsonResponse(
      { standings: [] },
      200,
      ttl
    );
  }

  const matchDetails = incoming.pathname.match(
    /^\/extended\/matches\/(ext-\d+)$/
  );

  if (matchDetails) {
    const fixtureId = numericExternalId(matchDetails[1]);
    const item = await fixtureWithPlayerStats(
      fixtureId,
      env,
      ttl
    );

    if (!item) return jsonResponse({ error: "Match not found" }, 404);

    return jsonResponse(
      attachFixtureDetails(normalizeFixture(item), item),
      200,
      ttl
    );
  }

  const teamPath = incoming.pathname.match(
    /^\/extended\/teams\/(ext-\d+)(?:\/(matches|squad))?$/
  );

  if (teamPath) {
    const teamId = numericExternalId(teamPath[1]);
    const resource = teamPath[2];

    if (resource === "matches") {
      const rows = await apiSportsFetch(
        `/fixtures?team=${teamId}&last=50`,
        env,
        ttl
      );
      return jsonResponse(
        { matches: rows.map((item) => normalizeFixture(item)) },
        200,
        ttl
      );
    }

    if (resource === "squad") {
      const rows = await apiSportsFetch(
        `/players/squads?team=${teamId}`,
        env,
        ttl
      );
      const players = rows[0]?.players || [];
      return jsonResponse(
        {
          squad: players.map((player) => ({
            id: externalId(player.id),
            name: player.name,
            position: player.position,
            dateOfBirth: null,
            nationality: null,
            shirtNumber: player.number ?? null,
            photo: player.photo || null,
          })),
        },
        200,
        ttl
      );
    }

    const rows = await apiSportsFetch(
      `/teams?id=${teamId}`,
      env,
      ttl
    );
    const entry = rows[0];

    if (!entry) return jsonResponse({ error: "Team not found" }, 404);

    return jsonResponse(
      {
        ...normalizeTeam(entry.team, entry.team?.country),
        founded: entry.team?.founded || null,
        clubColors: null,
        venue: entry.venue?.name || null,
        address: entry.venue?.address || null,
        website: null,
        runningCompetitions: [],
        squad: [],
      },
      200,
      ttl
    );
  }

  const playerPath = incoming.pathname.match(
    /^\/extended\/players\/(ext-\d+)$/
  );

  if (playerPath) {
    const playerId = numericExternalId(playerPath[1]);
    const requestedSeason = Number(incoming.searchParams.get("season"));
    const season = Number.isFinite(requestedSeason)
      ? requestedSeason
      : new Date().getUTCFullYear();
    let profileEntry = null;
    let statisticsEntry = null;

    try {
      const profiles = await apiSportsFetch(
        `/players/profiles?player=${playerId}`,
        env,
        86400
      );
      profileEntry = profiles[0] || null;
    } catch {
      // Match and route data still provide a useful profile fallback.
    }

    try {
      const rows = await apiSportsFetch(
        `/players?id=${playerId}&season=${season}`,
        env,
        ttl
      );
      statisticsEntry = rows[0] || null;
    } catch {
      // Historical player statistics can be unavailable on free plans.
    }

    const entry = statisticsEntry || profileEntry;

    if (!entry) return jsonResponse({ error: "Player not found" }, 404);

    const player =
      profileEntry?.player || statisticsEntry?.player || entry.player || {};
    const current = statisticsEntry?.statistics?.[0] || {};

    return jsonResponse(
      {
        id: externalId(player.id),
        name: player.name,
        firstName: player.firstname,
        lastName: player.lastname,
        dateOfBirth: player.birth?.date || null,
        birthPlace: player.birth?.place || null,
        birthCountry: player.birth?.country || null,
        nationality: player.nationality || null,
        height: player.height || null,
        weight: player.weight || null,
        photo: player.photo || null,
        position: current.games?.position || player.position || null,
        section: current.games?.position || player.position || null,
        shirtNumber: current.games?.number ?? player.number ?? null,
        lastUpdated: new Date().toISOString(),
        currentTeam: normalizeTeam(
          current.team,
          current.league?.country
        ),
      },
      200,
      ttl
    );
  }

  return jsonResponse({ error: "Unsupported extended request" }, 400);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const incoming = new URL(request.url);

    if (incoming.pathname.startsWith("/alerts/")) {
      try {
        return (
          (await handleAlerts(request, incoming, env)) ||
          jsonResponse({ error: "Unsupported alert request" }, 404)
        );
      } catch (error) {
        return jsonResponse(
          { error: error.message || "Alert service unavailable" },
          error.status || 502
        );
      }
    }

    if (request.method !== "GET") {
      return new Response("Method not allowed", {
        status: 405,
        headers: corsHeaders(),
      });
    }

    if (incoming.pathname.startsWith("/news/")) {
      try {
        return (
          (await handleNews(incoming)) ||
          jsonResponse({ error: "Unsupported news request" }, 404)
        );
      } catch {
        return jsonResponse({ error: "News service unavailable" }, 502);
      }
    }

    const enrichedPath = incoming.pathname.match(
      /^\/enriched\/matches\/(\d+)$/
    );

    if (enrichedPath) {
      if (!env.FOOTBALL_DATA_TOKEN || !env.API_FOOTBALL_KEY) {
        return jsonResponse(
          { error: "Match providers are not configured" },
          503
        );
      }

      try {
        return jsonResponse(
          await enrichedMatch(Number(enrichedPath[1]), env),
          200,
          10
        );
      } catch (error) {
        return jsonResponse(
          { error: error.message },
          error.status || 502
        );
      }
    }

    if (incoming.pathname.startsWith("/extended/")) {
      try {
        return await handleExtended(incoming, env);
      } catch (error) {
        return jsonResponse(
          { error: error.message },
          error.status || 502
        );
      }
    }

    if (!env.FOOTBALL_DATA_TOKEN) {
      return new Response("Provider token is not configured", {
        status: 503,
      });
    }

    if (
      !ALLOWED_PATH.test(incoming.pathname) ||
      incoming.search.length > 500
    ) {
      return new Response("Unsupported football-data request", {
        status: 400,
        headers: corsHeaders(),
      });
    }

    const providerUrl = new URL(
      `${PROVIDER_BASE}${incoming.pathname}${incoming.search}`
    );

    const providerHeaders = {
      "X-Auth-Token": env.FOOTBALL_DATA_TOKEN,
      Accept: "application/json",
    };

    if (MATCH_DETAIL_PATH.test(incoming.pathname)) {
      providerHeaders["X-Unfold-Lineups"] = "true";
      providerHeaders["X-Unfold-Bookings"] = "true";
      providerHeaders["X-Unfold-Subs"] = "true";
      providerHeaders["X-Unfold-Goals"] = "true";
    }

    const response = await fetch(providerUrl, {
      headers: providerHeaders,
      cf: {
        cacheEverything: true,
        cacheTtl: cacheTtl(incoming.pathname),
      },
    });

    const headers = new Headers(response.headers);
    Object.entries(corsHeaders()).forEach(([key, value]) => {
      headers.set(key, value);
    });
    headers.set(
      "Cache-Control",
      response.ok
        ? `public, max-age=${cacheTtl(incoming.pathname)}`
        : "no-store"
    );

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(processGoalAlerts(env));
  },
};
