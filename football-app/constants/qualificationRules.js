export const qualificationZones = {
  championsLeague: {
    label: "Champions League",
    shortLabel: "UCL",
    color: "#2563EB",
  },
  championsLeagueQualifying: {
    label: "Champions League qualifying",
    shortLabel: "UCL Q",
    color: "#60A5FA",
  },
  europaLeague: {
    label: "Europa League",
    shortLabel: "UEL",
    color: "#F97316",
  },
  conferenceLeague: {
    label: "Conference League",
    shortLabel: "UECL",
    color: "#22C55E",
  },
  europeanPlayoff: {
    label: "European play-offs",
    shortLabel: "Europe PO",
    color: "#A855F7",
  },
  promotion: {
    label: "Automatic promotion",
    shortLabel: "Promotion",
    color: "#14B8A6",
  },
  promotionPlayoff: {
    label: "Promotion play-offs",
    shortLabel: "Play-offs",
    color: "#8B5CF6",
  },
  libertadores: {
    label: "Copa Libertadores",
    shortLabel: "Libertadores",
    color: "#2563EB",
  },
  libertadoresQualifying: {
    label: "Libertadores qualifying",
    shortLabel: "Libertadores Q",
    color: "#60A5FA",
  },
  sudamericana: {
    label: "Copa Sudamericana",
    shortLabel: "Sudamericana",
    color: "#22C55E",
  },
  relegationPlayoff: {
    label: "Relegation play-off",
    shortLabel: "Relegation PO",
    color: "#F59E0B",
  },
  relegation: {
    label: "Relegation",
    shortLabel: "Relegation",
    color: "#EF4444",
  },
  roundOf16: {
    label: "Round of 16",
    shortLabel: "R16",
    color: "#22C55E",
  },
  knockoutPlayoff: {
    label: "Knockout phase play-offs",
    shortLabel: "Play-off",
    color: "#F59E0B",
  },
  worldCupAdvance: {
    label: "World Cup knockout stage",
    shortLabel: "Advances",
    color: "#22C55E",
  },
  worldCupThird: {
    label: "Possible best third-place qualification",
    shortLabel: "Best 3rd route",
    color: "#F59E0B",
  },
};

const rules = {
  EL: [
    { from: 1, to: 8, zone: "roundOf16" },
    { from: 9, to: 24, zone: "knockoutPlayoff" },
  ],
  UCL: [
    { from: 1, to: 8, zone: "roundOf16" },
    { from: 9, to: 24, zone: "knockoutPlayoff" },
  ],
  WC: [
    { from: 1, to: 2, zone: "worldCupAdvance" },
    { from: 3, to: 3, zone: "worldCupThird" },
  ],
  PL: [
    { from: 1, to: 5, zone: "championsLeague" },
    { from: 6, to: 7, zone: "europaLeague" },
    { from: 8, to: 8, zone: "conferenceLeague" },
    { fromBottom: 3, zone: "relegation" },
  ],
  BL1: [
    { from: 1, to: 4, zone: "championsLeague" },
    { from: 5, to: 6, zone: "europaLeague" },
    { from: 7, to: 7, zone: "conferenceLeague" },
    { fromBottom: 3, toBottom: 3, zone: "relegationPlayoff" },
    { fromBottom: 2, zone: "relegation" },
  ],
  PD: [
    { from: 1, to: 4, zone: "championsLeague" },
    { from: 5, to: 5, zone: "europaLeague" },
    { from: 6, to: 6, zone: "conferenceLeague" },
    { fromBottom: 3, zone: "relegation" },
  ],
  SA: [
    { from: 1, to: 4, zone: "championsLeague" },
    { from: 5, to: 6, zone: "europaLeague" },
    { from: 7, to: 7, zone: "conferenceLeague" },
    { fromBottom: 3, zone: "relegation" },
  ],
  FL1: [
    { from: 1, to: 3, zone: "championsLeague" },
    { from: 4, to: 4, zone: "championsLeagueQualifying" },
    { from: 5, to: 6, zone: "europaLeague" },
    { from: 7, to: 7, zone: "conferenceLeague" },
    { fromBottom: 3, toBottom: 3, zone: "relegationPlayoff" },
    { fromBottom: 2, zone: "relegation" },
  ],
  DED: [
    { from: 1, to: 2, zone: "championsLeague" },
    { from: 3, to: 3, zone: "championsLeagueQualifying" },
    { from: 4, to: 4, zone: "europaLeague" },
    { from: 5, to: 8, zone: "europeanPlayoff" },
    { fromBottom: 3, toBottom: 3, zone: "relegationPlayoff" },
    { fromBottom: 2, zone: "relegation" },
  ],
  PPL: [
    { from: 1, to: 1, zone: "championsLeague" },
    { from: 2, to: 2, zone: "championsLeagueQualifying" },
    { from: 3, to: 3, zone: "europaLeague" },
    { from: 4, to: 4, zone: "conferenceLeague" },
    { fromBottom: 3, toBottom: 3, zone: "relegationPlayoff" },
    { fromBottom: 2, zone: "relegation" },
  ],
  ELC: [
    { from: 1, to: 2, zone: "promotion" },
    { from: 3, to: 6, zone: "promotionPlayoff" },
    { fromBottom: 3, zone: "relegation" },
  ],
  BSA: [
    { from: 1, to: 4, zone: "libertadores" },
    { from: 5, to: 6, zone: "libertadoresQualifying" },
    { from: 7, to: 12, zone: "sudamericana" },
    { fromBottom: 4, zone: "relegation" },
  ],
};

function matchesRule(rule, position, teamCount) {
  if (rule.fromBottom) {
    const firstPosition =
      teamCount - rule.fromBottom + 1;
    const lastPosition = rule.toBottom
      ? teamCount - rule.toBottom + 1
      : teamCount;

    return (
      position >= Math.min(firstPosition, lastPosition) &&
      position <= Math.max(firstPosition, lastPosition)
    );
  }

  return position >= rule.from && position <= rule.to;
}

export function getQualificationZone(
  competitionCode,
  position,
  teamCount
) {
  const rule = (rules[competitionCode] || []).find(
    (item) => matchesRule(item, position, teamCount)
  );

  return rule
    ? {
        id: rule.zone,
        ...qualificationZones[rule.zone],
      }
    : null;
}

export function getCompetitionLegend(competitionCode) {
  const seen = new Set();

  return (rules[competitionCode] || [])
    .map((rule) => rule.zone)
    .filter((zone) => {
      if (seen.has(zone)) return false;
      seen.add(zone);
      return true;
    })
    .map((zone) => ({
      id: zone,
      ...qualificationZones[zone],
    }));
}
