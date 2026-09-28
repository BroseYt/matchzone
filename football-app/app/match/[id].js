import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { router, useLocalSearchParams } from "expo-router";

import { Ionicons } from "@expo/vector-icons";
import MatchLineupPitch from "../../components/MatchLineupPitch";
import TeamBadge from "../../components/TeamBadge";
import { useAppTheme } from "../../context/ThemeContext";
import {
  getMatchAlertStatus,
  getStoredNotificationPreferences,
  sendLocalGoalNotification,
  subscribeToMatchAlerts,
  unsubscribeFromMatchAlerts,
} from "../../services/notifications";
import { getMatchDetails } from "../../services/stats";

const TABS = [
  "overview",
  "score",
  "stats",
  "timeline",
  "lineups",
  "info",
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function teamName(team) {
  return team?.shortName || team?.name || "TBC";
}

function scoreValue(value) {
  return value ?? "-";
}

function statusLabel(status) {
  return String(status || "").replaceAll("_", " ");
}

function minuteLabel(event) {
  const minute = event?.minute ?? event?.matchMinute;
  const extra = event?.injuryTime ?? event?.stoppageTime;

  if (minute == null) return "";
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}

function playerName(value) {
  return (
    value?.player?.name ||
    value?.scorer?.name ||
    value?.playerOut?.name ||
    value?.playerIn?.name ||
    value?.name ||
    value?.playerName ||
    "Player"
  );
}

function normalizeLineupPlayer(entry, teamLogo) {
  const player = entry?.player || entry || {};

  return {
    id: player.id || entry?.id,
    name: player.name || entry?.name || "Player",
    position: entry?.position || player.position || "",
    shirtNumber: entry?.shirtNumber || player.shirtNumber || null,
    grid: entry?.grid || player.grid || null,
    photo: entry?.photo || player.photo || null,
    rating: entry?.rating ?? player.rating ?? null,
    minutes: entry?.minutes ?? player.minutes ?? null,
    captain: Boolean(entry?.captain ?? player.captain),
    substitute: Boolean(entry?.substitute ?? player.substitute),
    shots: entry?.shots || player.shots || null,
    goals: entry?.goals || player.goals || null,
    passes: entry?.passes || player.passes || null,
    tackles: entry?.tackles || player.tackles || null,
    duels: entry?.duels || player.duels || null,
    dribbles: entry?.dribbles || player.dribbles || null,
    fouls: entry?.fouls || player.fouls || null,
    cards: entry?.cards || player.cards || null,
    teamLogo,
  };
}

function teamPlayers(team) {
  const logo = team?.crest;

  return [
    ...asArray(team?.lineup).map((entry) =>
      normalizeLineupPlayer(entry, logo)
    ),
    ...asArray(team?.bench).map((entry) =>
      normalizeLineupPlayer(entry, logo)
    ),
  ];
}

function eventSide(event, match) {
  const teamId =
    event?.team?.id ||
    event?.player?.currentTeam?.id ||
    event?.scorer?.currentTeam?.id;

  if (teamId === match.homeTeam?.id) return "home";
  if (teamId === match.awayTeam?.id) return "away";
  return "";
}

function normalizeEvents(match) {
  const goals = asArray(match.goals).map((event) => ({
    id: `goal-${event.minute}-${playerName(event)}`,
    icon: "football",
    type: "Goal",
    title: playerName(event.scorer ? event.scorer : event),
    subtitle: [
      event.type && event.type !== "REGULAR"
        ? statusLabel(event.type)
        : null,
      event.assist?.name ? `Assist: ${event.assist.name}` : null,
      event.score
        ? `${scoreValue(event.score.home)}-${scoreValue(
            event.score.away
          )}`
        : null,
    ]
      .filter(Boolean)
      .join(" | "),
    minute: event.minute ?? 0,
    minuteText: minuteLabel(event),
    side: eventSide(event, match),
  }));

  const bookings = asArray(match.bookings).map((event) => ({
    id: `booking-${event.minute}-${playerName(event)}`,
    icon: "albums-outline",
    type: statusLabel(event.card || "Card"),
    title: playerName(event),
    subtitle: event.team?.name || "",
    minute: event.minute ?? 0,
    minuteText: minuteLabel(event),
    side: eventSide(event, match),
  }));

  const subs = asArray(match.substitutions).map((event) => ({
    id: `sub-${event.minute}-${playerName(event.playerIn)}`,
    icon: "swap-horizontal",
    type: "Substitution",
    title: event.playerIn?.name || "Player on",
    subtitle: event.playerOut?.name
      ? `For ${event.playerOut.name}`
      : event.team?.name || "",
    minute: event.minute ?? 0,
    minuteText: minuteLabel(event),
    side: eventSide(event, match),
  }));

  const varDecisions = asArray(match.varDecisions).map((event) => ({
    id: `var-${event.minute}-${playerName(event)}`,
    icon: "videocam-outline",
    type: "VAR",
    title: statusLabel(event.detail || "Decision"),
    subtitle: event.player?.name || event.team?.name || "",
    minute: event.minute ?? 0,
    minuteText: minuteLabel(event),
    side: eventSide(event, match),
  }));

  return [...goals, ...bookings, ...subs, ...varDecisions].sort(
    (a, b) => a.minute - b.minute
  );
}

function statisticRows(match) {
  const home = match.homeTeam?.statistics || {};
  const away = match.awayTeam?.statistics || {};
  const keys = [
    ...new Set([...Object.keys(home), ...Object.keys(away)]),
  ].filter((key) => home[key] != null || away[key] != null);

  if (keys.length) {
    return keys.map((key) => ({
      key,
      label: key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase()),
      category: statCategory(key),
      home: home[key],
      away: away[key],
      derived: false,
    }));
  }

  const countBySide = (items, side, predicate = () => true) =>
    asArray(items).filter(
      (event) =>
        eventSide(event, match) === side && predicate(event)
    ).length;
  const rows = [];
  const isPlayed = ["IN_PLAY", "PAUSED", "FINISHED"].includes(
    match.status
  );

  if (isPlayed) {
    rows.push({
      key: "verified-goals",
      label: "Goals",
      category: "Attacking",
      home: Number(match.score?.fullTime?.home ?? 0),
      away: Number(match.score?.fullTime?.away ?? 0),
      derived: true,
    });
  }

  if (asArray(match.bookings).length) {
    rows.push(
      {
        key: "verified-yellow-cards",
        label: "Yellow Cards",
        category: "Discipline",
        home: countBySide(
          match.bookings,
          "home",
          (event) =>
            !String(event?.card || "")
              .toLowerCase()
              .includes("red")
        ),
        away: countBySide(
          match.bookings,
          "away",
          (event) =>
            !String(event?.card || "")
              .toLowerCase()
              .includes("red")
        ),
        derived: true,
      },
      {
        key: "verified-red-cards",
        label: "Red Cards",
        category: "Discipline",
        home: countBySide(
          match.bookings,
          "home",
          (event) =>
            String(event?.card || "")
              .toLowerCase()
              .includes("red")
        ),
        away: countBySide(
          match.bookings,
          "away",
          (event) =>
            String(event?.card || "")
              .toLowerCase()
              .includes("red")
        ),
        derived: true,
      }
    );
  }

  if (asArray(match.substitutions).length) {
    rows.push({
      key: "verified-substitutions",
      label: "Substitutions",
      category: "Match Facts",
      home: countBySide(match.substitutions, "home"),
      away: countBySide(match.substitutions, "away"),
      derived: true,
    });
  }

  if (
    asArray(match.homeTeam?.lineup).length ||
    asArray(match.awayTeam?.lineup).length
  ) {
    rows.push({
      key: "verified-starting-xi",
      label: "Starting XI",
      category: "Match Facts",
      home: asArray(match.homeTeam?.lineup).length,
      away: asArray(match.awayTeam?.lineup).length,
      derived: true,
    });
  }

  return rows;
}

function statCategory(key) {
  const text = String(key || "").toLowerCase();

  if (
    text.includes("shot") ||
    text.includes("goal") ||
    text.includes("xg") ||
    text.includes("corner") ||
    text.includes("attack") ||
    text.includes("offside")
  ) {
    return "Attacking";
  }

  if (
    text.includes("pass") ||
    text.includes("possession") ||
    text.includes("cross") ||
    text.includes("long ball")
  ) {
    return "Passing";
  }

  if (
    text.includes("tackle") ||
    text.includes("duel") ||
    text.includes("save") ||
    text.includes("clearance") ||
    text.includes("interception") ||
    text.includes("block")
  ) {
    return "Defensive";
  }

  if (
    text.includes("card") ||
    text.includes("foul") ||
    text.includes("penalty")
  ) {
    return "Discipline";
  }

  return "Match Facts";
}

function groupedStats(rows) {
  const order = [
    "Attacking",
    "Passing",
    "Defensive",
    "Discipline",
    "Match Facts",
  ];
  const groups = new Map();

  rows.forEach((row) => {
    const category = row.category || "Match Facts";
    groups.set(category, [...(groups.get(category) || []), row]);
  });

  return order
    .filter((category) => groups.has(category))
    .map((category) => ({
      category,
      rows: groups.get(category),
    }));
}

export default function MatchDetails() {
  const { id } = useLocalSearchParams();
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertBusy, setAlertBusy] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({
    token: null,
    settings: null,
  });
  const previousScore = useRef(null);

  const loadMatch = useCallback(
    async (showLoader = true) => {
      try {
        if (showLoader) setLoading(true);

        const data = await getMatchDetails(id);

        if (data) setMatch(data);
      } catch (error) {
        console.log(error);
      } finally {
        setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  useEffect(() => {
    let active = true;

    async function loadAlertStatus() {
      try {
        const preferences =
          await getStoredNotificationPreferences();

        if (!active) return;
        setNotificationPreferences(preferences);

        if (preferences.token) {
          const subscribed = await getMatchAlertStatus(
            id,
            preferences.token
          );
          if (active) setAlertEnabled(subscribed);
        }
      } catch (error) {
        console.log("MATCH ALERT STATUS ERROR:", error);
      }
    }

    previousScore.current = null;
    loadAlertStatus();

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    const live =
      match?.status === "IN_PLAY" || match?.status === "PAUSED";
    const kickoff = new Date(match?.utcDate || 0).getTime();
    const distanceFromKickoff = Date.now() - kickoff;
    const aroundKickoff =
      Number.isFinite(kickoff) &&
      distanceFromKickoff >= -90 * 60 * 1000 &&
      distanceFromKickoff <= 3 * 60 * 60 * 1000;
    const detailsIncomplete =
      !asArray(match?.homeTeam?.lineup).length ||
      !asArray(match?.awayTeam?.lineup).length ||
      !Object.keys(match?.homeTeam?.statistics || {}).length ||
      !Object.keys(match?.awayTeam?.statistics || {}).length;

    if (!live && !(aroundKickoff && detailsIncomplete)) {
      return undefined;
    }

    const interval = setInterval(() => {
      loadMatch(false);
    }, live ? 10000 : 20000);

    return () => clearInterval(interval);
  }, [
    loadMatch,
    match?.awayTeam?.lineup,
    match?.awayTeam?.statistics,
    match?.homeTeam?.lineup,
    match?.homeTeam?.statistics,
    match?.status,
    match?.utcDate,
  ]);

  useEffect(() => {
    if (!match) return;

    const current = {
      home: Number(match.score?.fullTime?.home ?? 0),
      away: Number(match.score?.fullTime?.away ?? 0),
    };
    const previous = previousScore.current;
    const live =
      match.status === "IN_PLAY" || match.status === "PAUSED";

    previousScore.current = current;

    if (
      !previous ||
      !live ||
      !alertEnabled ||
      notificationPreferences.settings?.goals === false ||
      (current.home <= previous.home && current.away <= previous.away)
    ) {
      return;
    }

    sendLocalGoalNotification(match).catch((error) => {
      console.log("LOCAL GOAL ALERT ERROR:", error);
    });
    subscribeToMatchAlerts(
      match,
      notificationPreferences.token,
      notificationPreferences.settings,
      true
    ).catch((error) => {
      console.log("GOAL SCORE SYNC ERROR:", error);
    });
  }, [alertEnabled, match, notificationPreferences]);

  async function toggleMatchAlert() {
    if (alertBusy || !match) return;

    const { token, settings } = notificationPreferences;

    if (!token) {
      Alert.alert(
        "Enable notifications",
        "Turn on push notifications first, then return to follow this match.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open settings",
            onPress: () => router.push("/notifications"),
          },
        ]
      );
      return;
    }

    try {
      setAlertBusy(true);

      if (alertEnabled) {
        await unsubscribeFromMatchAlerts(match.id, token);
        setAlertEnabled(false);
      } else {
        await subscribeToMatchAlerts(match, token, settings);
        setAlertEnabled(true);
      }
    } catch (error) {
      Alert.alert(
        "Could not update alert",
        error.message || "Please try again."
      );
    } finally {
      setAlertBusy(false);
    }
  }

  async function refreshMatchDetails() {
    if (refreshing) return;

    try {
      setRefreshing(true);
      await loadMatch(false);
    } finally {
      setRefreshing(false);
    }
  }

  const events = useMemo(
    () => (match ? normalizeEvents(match) : []),
    [match]
  );
  const stats = useMemo(
    () => (match ? statisticRows(match) : []),
    [match]
  );
  const statsGroups = useMemo(() => groupedStats(stats), [stats]);

  if (loading || !match) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  const homeScore = match.score?.fullTime?.home ?? "-";
  const awayScore = match.score?.fullTime?.away ?? "-";
  const isLive =
    match.status === "IN_PLAY" || match.status === "PAUSED";
  const isFinished = match.status === "FINISHED";
  const isScheduled =
    match.status === "SCHEDULED" || match.status === "TIMED";
  const statusColor = isLive
    ? theme.danger
    : isFinished
    ? theme.success
    : theme.accent;
  const homePlayers = teamPlayers(match.homeTeam);
  const awayPlayers = teamPlayers(match.awayTeam);
  const liveStatus =
    isLive && match.minute != null
      ? `${match.minute}'`
      : statusLabel(match.status);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={28}
            color={theme.text}
          />
        </Pressable>

        <View style={styles.topActions}>
          {!isFinished ? (
            <Pressable
              style={[
                styles.alertButton,
                alertEnabled && styles.alertButtonActive,
              ]}
              onPress={toggleMatchAlert}
              disabled={alertBusy}
            >
              {alertBusy ? (
                <ActivityIndicator size="small" color={theme.accent} />
              ) : (
                <Ionicons
                  name={
                    alertEnabled
                      ? "notifications"
                      : "notifications-outline"
                  }
                  size={21}
                  color={
                    alertEnabled ? theme.onAccent : theme.text
                  }
                />
              )}
            </Pressable>
          ) : null}

          <View
            style={[
              styles.statusBadge,
              {
                borderColor: statusColor,
              },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: statusColor },
              ]}
            />

            <Text
              style={[
                styles.statusBadgeText,
                { color: statusColor },
              ]}
            >
              {liveStatus}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.league}>
          {match.competition?.name}
        </Text>

        <View style={styles.scoreCard}>
          <MatchTeam
            team={match.homeTeam}
            competitionCode={match.competition?.code}
            styles={styles}
            theme={theme}
          />

          <View style={styles.center}>
            <Text style={styles.score}>
              {homeScore} - {awayScore}
            </Text>

            <Text style={styles.kickoff}>
              {new Date(match.utcDate).toLocaleString()}
            </Text>
          </View>

          <MatchTeam
            team={match.awayTeam}
            competitionCode={match.competition?.code}
            styles={styles}
            theme={theme}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
        >
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={
                  activeTab === tab
                    ? styles.activeTab
                    : styles.tab
                }
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {activeTab === "overview" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Match Overview
            </Text>

            <View style={styles.card}>
              {renderInfo("Competition", match.competition?.name, styles)}
              {renderInfo("Area", match.area?.name || "-", styles)}
              {renderInfo("Status", statusLabel(match.status), styles)}
              {renderInfo(
                "Kickoff",
                new Date(match.utcDate).toLocaleString(),
                styles
              )}
              {renderInfo("Matchday", match.matchday || "-", styles)}
              {renderInfo("Stage", statusLabel(match.stage || "-"), styles)}
              {match.group
                ? renderInfo("Group", statusLabel(match.group), styles)
                : null}
            </View>

            <Text style={styles.sectionTitle}>
              Quick Summary
            </Text>

            <View style={styles.summaryCard}>
              <Ionicons
                name={
                  isLive
                    ? "radio"
                    : isFinished
                    ? "checkmark-circle"
                    : "calendar"
                }
                size={28}
                color={statusColor}
              />

              <View style={styles.summaryCopy}>
                <Text style={styles.summaryTitle}>
                  {isLive
                    ? "Match is live"
                    : isFinished
                    ? "Match finished"
                    : isScheduled
                    ? "Match scheduled"
                    : statusLabel(match.status)}
                </Text>

                <Text style={styles.summaryText}>
                  {isLive
                    ? `Live at ${liveStatus}. Score and match details refresh every 10 seconds while this screen is open.`
                    : isFinished
                    ? "Final score, events, lineups and statistics appear when the provider returns them."
                    : "Kickoff time and match details are available."}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {activeTab === "score" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Score Breakdown
            </Text>

            <View style={styles.card}>
              {renderScoreRow(
                "Full Time",
                match.score?.fullTime?.home,
                match.score?.fullTime?.away,
                styles
              )}
              {renderScoreRow(
                "Half Time",
                match.score?.halfTime?.home,
                match.score?.halfTime?.away,
                styles
              )}
              {renderScoreRow(
                "Regular Time",
                match.score?.regularTime?.home,
                match.score?.regularTime?.away,
                styles
              )}
              {renderScoreRow(
                "Extra Time",
                match.score?.extraTime?.home,
                match.score?.extraTime?.away,
                styles
              )}
              {renderScoreRow(
                "Penalties",
                match.score?.penalties?.home,
                match.score?.penalties?.away,
                styles
              )}
              {renderInfo(
                "Winner",
                formatWinner(match.score?.winner),
                styles
              )}
            </View>
          </View>
        ) : null}

        {activeTab === "stats" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text
                style={[
                  styles.sectionTitle,
                  styles.sectionHeadingTitle,
                ]}
              >
                {stats.some((row) => row.derived)
                  ? "Verified Match Facts"
                  : "Team Statistics"}
              </Text>
              <Pressable
                style={styles.refreshButton}
                onPress={refreshMatchDetails}
                disabled={refreshing}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={theme.accent}
                />
                <Text style={styles.refreshText}>
                  {refreshing ? "Checking" : "Refresh"}
                </Text>
              </Pressable>
            </View>

            {stats.length ? (
              <>
                {statsGroups.map((group) => (
                  <View key={group.category} style={styles.card}>
                    <Text style={styles.statGroupTitle}>
                      {group.category}
                    </Text>
                    {group.rows.map((row) => (
                      <View key={row.key} style={styles.statRow}>
                        <Text style={styles.statValue}>
                          {String(row.home)}
                        </Text>
                        <Text style={styles.statLabel}>
                          {row.label}
                        </Text>
                        <Text style={styles.statValue}>
                          {String(row.away)}
                        </Text>
                      </View>
                    ))}
                  </View>
                ))}
                {stats.some((row) => row.derived) ? (
                  <Text style={styles.dataNote}>
                    These are verified score, event, and lineup
                    facts. Detailed shots, possession, passing, and
                    ratings will appear automatically when published.
                  </Text>
                ) : null}
              </>
            ) : (
              <>
                <EmptyCard
                  icon="analytics-outline"
                  title="Waiting for match data"
                  text="No verified team statistics or match events have been published yet."
                  styles={styles}
                  theme={theme}
                />
              </>
            )}
          </View>
        ) : null}

        {activeTab === "timeline" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Match Timeline
            </Text>

            {events.length ? (
              <View style={styles.timelineCard}>
                {events.map((event) => (
                  <TimelineItem
                    key={event.id}
                    event={event}
                    styles={styles}
                    theme={theme}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.timelineCard}>
                <TimelineItem
                  event={{
                    icon: "calendar",
                    type: "Kickoff",
                    title: "Kickoff",
                    subtitle: new Date(match.utcDate).toLocaleString(),
                  }}
                  styles={styles}
                  theme={theme}
                />

                {isFinished ? (
                  <TimelineItem
                    event={{
                      icon: "flag",
                      type: "Full Time",
                      title: "Full Time",
                      subtitle: `${teamName(
                        match.homeTeam
                      )} ${homeScore} - ${awayScore} ${teamName(
                        match.awayTeam
                      )}`,
                    }}
                    styles={styles}
                    theme={theme}
                  />
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {activeTab === "lineups" ? (
          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <Text
                style={[
                  styles.sectionTitle,
                  styles.sectionHeadingTitle,
                ]}
              >
                Match Lineups
              </Text>
              <Pressable
                style={styles.refreshButton}
                onPress={refreshMatchDetails}
                disabled={refreshing}
              >
                <Ionicons
                  name="refresh"
                  size={16}
                  color={theme.accent}
                />
                <Text style={styles.refreshText}>
                  {refreshing ? "Checking" : "Refresh"}
                </Text>
              </Pressable>
            </View>

            {homePlayers.length || awayPlayers.length ? (
              <MatchLineupPitch
                homeTeam={{
                  ...match.homeTeam,
                  lineup: homePlayers.slice(
                    0,
                    match.homeTeam?.lineup?.length || 11
                  ),
                  bench: homePlayers.slice(
                    match.homeTeam?.lineup?.length || 11
                  ),
                }}
                awayTeam={{
                  ...match.awayTeam,
                  lineup: awayPlayers.slice(
                    0,
                    match.awayTeam?.lineup?.length || 11
                  ),
                  bench: awayPlayers.slice(
                    match.awayTeam?.lineup?.length || 11
                  ),
                }}
                theme={theme}
              />
            ) : (
              <EmptyCard
                icon="people-outline"
                title="Waiting for official lineups"
                text="The app is checking the fixture feed and dedicated lineup feed. Official starting elevens and benches will appear as soon as they are published."
                styles={styles}
                theme={theme}
              />
            )}
          </View>
        ) : null}

        {activeTab === "info" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Match Info</Text>

            <View style={styles.card}>
              {renderInfo(
                "Season",
                match.season?.startDate && match.season?.endDate
                  ? `${match.season.startDate} - ${match.season.endDate}`
                  : "-",
                styles
              )}

              {renderInfo(
                "Venue",
                match.venue || "Not available",
                styles
              )}

              {renderInfo(
                "Referee",
                match.referees?.[0]?.name || "Not available",
                styles
              )}

              {renderInfo(
                "Last Updated",
                match.lastUpdated
                  ? new Date(match.lastUpdated).toLocaleString()
                  : "-",
                styles
              )}
            </View>
          </View>
        ) : null}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

function MatchTeam({
  team,
  competitionCode,
  styles,
  theme,
}) {
  return (
    <Pressable
      style={styles.teamSide}
      onPress={() =>
        team?.id &&
        router.push({
          pathname: "/team/[id]",
          params: {
            id: team.id,
            name: teamName(team),
            logo: team.crest || "",
            competitionCode: competitionCode || "",
          },
        })
      }
    >
      <TeamBadge
        team={team}
        competitionCode={competitionCode}
        size={62}
        style={styles.logo}
        theme={theme}
      />

      <Text style={styles.teamName}>{teamName(team)}</Text>
    </Pressable>
  );
}

function TimelineItem({ event, styles, theme }) {
  const sideStyle =
    event.side === "home"
      ? styles.homeEvent
      : event.side === "away"
      ? styles.awayEvent
      : null;

  return (
    <View style={[styles.timelineItem, sideStyle]}>
      <View
        style={[
          styles.timelineIcon,
          { backgroundColor: theme.accent },
        ]}
      >
        <Ionicons
          name={event.icon}
          size={18}
          color="#FFFFFF"
        />
      </View>

      <View style={styles.timelineCopy}>
        <View style={styles.timelineTop}>
          <Text style={styles.timelineType}>{event.type}</Text>
          {event.minuteText ? (
            <Text style={styles.timelineMinute}>
              {event.minuteText}
            </Text>
          ) : null}
        </View>

        <Text style={styles.timelineTitle}>{event.title}</Text>

        {event.subtitle ? (
          <Text style={styles.timelineSub}>{event.subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
}

function EmptyCard({ icon, title, text, styles, theme }) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={42} color={theme.border} />

      <Text style={styles.emptyTitle}>{title}</Text>

      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function formatWinner(winner) {
  if (!winner) return "-";
  if (winner === "HOME_TEAM") return "Home Team";
  if (winner === "AWAY_TEAM") return "Away Team";
  if (winner === "DRAW") return "Draw";
  return statusLabel(winner);
}

function renderInfo(title, value, styles) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{title}</Text>

      <Text style={styles.infoValue}>{String(value || "-")}</Text>
    </View>
  );
}

function renderScoreRow(title, home, away, styles) {
  if (home == null && away == null) return null;

  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{title}</Text>

      <Text style={styles.infoValue}>
        {home ?? "-"} - {away ?? "-"}
      </Text>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 55,
    },
    loader: {
      flex: 1,
      backgroundColor: theme.background,
      justifyContent: "center",
      alignItems: "center",
    },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 18,
      marginBottom: 24,
    },
    backBtn: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    topActions: {
      flexDirection: "row",
      alignItems: "center",
    },
    alertButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 9,
    },
    alertButtonActive: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    statusBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
    },
    statusDot: {
      width: 10,
      height: 10,
      borderRadius: 10,
      marginRight: 8,
    },
    statusBadgeText: {
      fontWeight: "bold",
      fontSize: 12,
    },
    league: {
      color: theme.subText,
      textAlign: "center",
      marginBottom: 18,
    },
    scoreCard: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 28,
      marginHorizontal: 18,
      padding: 18,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 26,
    },
    teamSide: {
      alignItems: "center",
      width: 95,
    },
    logo: {
      width: 62,
      height: 62,
      resizeMode: "contain",
      marginBottom: 10,
    },
    teamName: {
      color: theme.text,
      fontWeight: "600",
      textAlign: "center",
      fontSize: 13,
    },
    center: {
      alignItems: "center",
      flex: 1,
    },
    score: {
      color: theme.text,
      fontSize: 36,
      fontWeight: "bold",
    },
    kickoff: {
      color: theme.subText,
      marginTop: 8,
      fontSize: 12,
      textAlign: "center",
    },
    tabs: {
      paddingHorizontal: 18,
      marginBottom: 24,
    },
    activeTab: {
      color: theme.accent,
      fontWeight: "bold",
      fontSize: 16,
      marginRight: 24,
    },
    tab: {
      color: theme.subText,
      fontSize: 16,
      marginRight: 24,
    },
    section: {
      paddingHorizontal: 18,
      marginBottom: 30,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 18,
    },
    sectionHeadingTitle: {
      flex: 1,
      marginBottom: 0,
      marginRight: 12,
    },
    sectionHeading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },
    refreshButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 34,
      paddingHorizontal: 11,
      borderRadius: 17,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    refreshText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "800",
    },
    dataNote: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 18,
      marginTop: -12,
      paddingHorizontal: 8,
    },
    card: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 24,
      padding: 20,
      marginBottom: 24,
    },
    summaryCard: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 24,
      padding: 20,
      flexDirection: "row",
      alignItems: "center",
    },
    summaryCopy: {
      marginLeft: 14,
      flex: 1,
    },
    summaryTitle: {
      color: theme.text,
      fontWeight: "bold",
      fontSize: 16,
    },
    summaryText: {
      color: theme.subText,
      marginTop: 6,
      lineHeight: 20,
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    infoLabel: {
      color: theme.subText,
      maxWidth: "45%",
    },
    infoValue: {
      color: theme.text,
      fontWeight: "600",
      maxWidth: "55%",
      textAlign: "right",
    },
    statRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    statGroupTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "900",
      marginBottom: 6,
    },
    statValue: {
      color: theme.text,
      fontWeight: "900",
      width: 65,
      textAlign: "center",
    },
    statLabel: {
      color: theme.subText,
      flex: 1,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "700",
    },
    timelineCard: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 24,
      padding: 16,
      marginBottom: 18,
    },
    timelineItem: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
      backgroundColor: theme.cardAlt,
      borderRadius: 18,
      padding: 12,
    },
    homeEvent: {
      marginRight: 32,
    },
    awayEvent: {
      marginLeft: 32,
    },
    timelineIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },
    timelineCopy: {
      flex: 1,
    },
    timelineTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 3,
    },
    timelineType: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    timelineMinute: {
      color: theme.gold,
      fontWeight: "900",
      fontSize: 12,
    },
    timelineTitle: {
      color: theme.text,
      fontWeight: "bold",
    },
    timelineSub: {
      color: theme.subText,
      marginTop: 4,
      lineHeight: 20,
      fontSize: 12,
    },
    emptyCard: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 24,
      padding: 24,
      alignItems: "center",
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "bold",
      marginTop: 16,
    },
    emptyText: {
      color: theme.subText,
      textAlign: "center",
      marginTop: 10,
      lineHeight: 22,
    },
    bottomSpace: {
      height: 70,
    },
  });
}
