const MAX_GOALS = 8;
const MIN_SAMPLE = 1;

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function factorial(value) {
  let result = 1;

  for (let i = 2; i <= value; i++) {
    result *= i;
  }

  return result;
}

function poissonProbability(goals, expectedGoals) {
  return (
    (Math.exp(-expectedGoals) *
      Math.pow(expectedGoals, goals)) /
    factorial(goals)
  );
}

function getSampleSize(teamTrend) {
  const matchIds = Array.isArray(teamTrend?.match_ids)
    ? teamTrend.match_ids.length
    : 0;
  const formLength = String(teamTrend?.form || "").length;

  return Math.max(matchIds, formLength);
}

function buildScoreMatrix(homeExpectedGoals, awayExpectedGoals) {
  const scores = [];
  let includedProbability = 0;

  for (let home = 0; home <= MAX_GOALS; home++) {
    for (let away = 0; away <= MAX_GOALS; away++) {
      const probability =
        poissonProbability(home, homeExpectedGoals) *
        poissonProbability(away, awayExpectedGoals);

      includedProbability += probability;
      scores.push({
        home,
        away,
        probability,
      });
    }
  }

  return scores.map((score) => ({
    ...score,
    probability:
      includedProbability > 0
        ? score.probability / includedProbability
        : 0,
  }));
}

function sumProbability(scores, predicate) {
  return scores
    .filter(predicate)
    .reduce((total, score) => total + score.probability, 0);
}

function toPercent(value) {
  return Math.round(value * 100);
}

function getOutcomePercentages(probabilities) {
  const exact = probabilities.map((value) => value * 100);
  const percentages = exact.map(Math.floor);
  let remainder =
    100 - percentages.reduce((total, value) => total + value, 0);

  const remainderOrder = exact
    .map((value, index) => ({
      index,
      fraction: value - percentages[index],
    }))
    .sort((a, b) => b.fraction - a.fraction);

  for (let index = 0; index < remainder; index++) {
    percentages[remainderOrder[index].index] += 1;
  }

  return percentages;
}

function buildTeamEvidence(teamTrend) {
  return {
    sampleSize: getSampleSize(teamTrend),
    windowStart: teamTrend.window_start_date || null,
    windowEnd: teamTrend.window_end_date || null,
    competitions: String(teamTrend.competitions || "")
      .split(",")
      .filter(Boolean),
    averageGoalsFor: numberOrNull(teamTrend.avg_goals_scored),
    averageGoalsAgainst: numberOrNull(
      teamTrend.avg_goals_conceded
    ),
    averagePoints: numberOrNull(teamTrend.avg_points),
    winRate: toPercent(numberOrNull(teamTrend.pct_wins) || 0),
    drawRate: toPercent(numberOrNull(teamTrend.pct_draws) || 0),
    lossRate: toPercent(numberOrNull(teamTrend.pct_losses) || 0),
    bttsRate: toPercent(numberOrNull(teamTrend.pct_bts) || 0),
    over25Rate: toPercent(numberOrNull(teamTrend.pct_o_25) || 0),
    form: String(teamTrend.form || ""),
  };
}

function unavailable(reason, homeEvidence, awayEvidence) {
  return {
    available: false,
    reason,
    homeEvidence,
    awayEvidence,
  };
}

export function buildDataPrediction(match, trendRecord) {
  const homeTrend = trendRecord?.trend?.home;
  const awayTrend = trendRecord?.trend?.away;
  const homeEvidence = buildTeamEvidence(homeTrend || {});
  const awayEvidence = buildTeamEvidence(awayTrend || {});

  if (!homeTrend || !awayTrend) {
    return unavailable(
      "The data provider has not returned form data for both teams.",
      homeEvidence,
      awayEvidence
    );
  }

  if (
    homeEvidence.sampleSize < MIN_SAMPLE ||
    awayEvidence.sampleSize < MIN_SAMPLE
  ) {
    return unavailable(
      `At least ${MIN_SAMPLE} completed venue-specific matches are required for each team.`,
      homeEvidence,
      awayEvidence
    );
  }

  const homeGoalsFor = numberOrNull(homeTrend.avg_goals_scored);
  const homeGoalsAgainst = numberOrNull(
    homeTrend.avg_goals_conceded
  );
  const awayGoalsFor = numberOrNull(awayTrend.avg_goals_scored);
  const awayGoalsAgainst = numberOrNull(
    awayTrend.avg_goals_conceded
  );

  if (
    homeGoalsFor === null ||
    homeGoalsAgainst === null ||
    awayGoalsFor === null ||
    awayGoalsAgainst === null
  ) {
    return unavailable(
      "The provider's completed-match sample is missing goal averages.",
      homeEvidence,
      awayEvidence
    );
  }

  const homeExpectedGoals = clamp(
    Math.sqrt(
      Math.max(homeGoalsFor, 0.05) *
        Math.max(awayGoalsAgainst, 0.05)
    ),
    0.15,
    4
  );

  const awayExpectedGoals = clamp(
    Math.sqrt(
      Math.max(awayGoalsFor, 0.05) *
        Math.max(homeGoalsAgainst, 0.05)
    ),
    0.15,
    4
  );

  const scores = buildScoreMatrix(
    homeExpectedGoals,
    awayExpectedGoals
  );

  const homeProbability = sumProbability(
    scores,
    (score) => score.home > score.away
  );
  const drawProbability = sumProbability(
    scores,
    (score) => score.home === score.away
  );
  const awayProbability = sumProbability(
    scores,
    (score) => score.home < score.away
  );
  const over25Probability = sumProbability(
    scores,
    (score) => score.home + score.away >= 3
  );
  const bttsProbability = sumProbability(
    scores,
    (score) => score.home > 0 && score.away > 0
  );

  const mostLikelyScore = [...scores].sort(
    (a, b) => b.probability - a.probability
  )[0];

  const outcomes = [
    {
      key: "home",
      label: `${match.homeTeam?.shortName || match.homeTeam?.name} win`,
      probability: homeProbability,
    },
    {
      key: "draw",
      label: "Draw",
      probability: drawProbability,
    },
    {
      key: "away",
      label: `${match.awayTeam?.shortName || match.awayTeam?.name} win`,
      probability: awayProbability,
    },
  ].sort((a, b) => b.probability - a.probability);
  const [homePercent, drawPercent, awayPercent] =
    getOutcomePercentages([
      homeProbability,
      drawProbability,
      awayProbability,
    ]);

  const minimumSample = Math.min(
    homeEvidence.sampleSize,
    awayEvidence.sampleSize
  );
  const dataQuality =
    minimumSample >= 8
      ? "Strong"
      : minimumSample >= 5
      ? "Moderate"
      : "Limited";

  return {
    available: true,
    model: "Venue-form Poisson",
    outcome: outcomes[0],
    homePercent,
    drawPercent,
    awayPercent,
    mostLikelyScore: `${mostLikelyScore.home}-${mostLikelyScore.away}`,
    scoreProbability: toPercent(mostLikelyScore.probability),
    expectedHomeGoals: Number(homeExpectedGoals.toFixed(2)),
    expectedAwayGoals: Number(awayExpectedGoals.toFixed(2)),
    expectedTotalGoals: Number(
      (homeExpectedGoals + awayExpectedGoals).toFixed(2)
    ),
    over25Percent: toPercent(over25Probability),
    bttsPercent: toPercent(bttsProbability),
    dataQuality,
    homeEvidence,
    awayEvidence,
    sourceUpdatedAt: trendRecord.lastUpdated || null,
  };
}

export function getMatchTags(match) {
  const tags = [];

  if (
    match.stage &&
    !["REGULAR_SEASON", "GROUP_STAGE"].includes(match.stage)
  ) {
    tags.push("Knockout");
  }

  if (match.group) {
    tags.push(
      match.group
        .replace("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase())
    );
  }

  if (match.matchday) {
    tags.push(`Matchday ${match.matchday}`);
  }

  return tags;
}
