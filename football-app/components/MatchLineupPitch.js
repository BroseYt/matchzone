import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import PlayerJerseyImage from "./PlayerJerseyImage";
import TeamBadge from "./TeamBadge";

const FALLBACK_LAYOUTS = {
  "4-3-3": [1, 4, 3, 3],
  "4-2-3-1": [1, 4, 2, 3, 1],
  "4-4-2": [1, 4, 4, 2],
  "3-5-2": [1, 3, 5, 2],
  "3-4-3": [1, 3, 4, 3],
  "5-3-2": [1, 5, 3, 2],
  "4-5-1": [1, 4, 5, 1],
};

function asNumber(value) {
  if (value == null || value === "") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function shortPlayerName(value) {
  const words = String(value || "Player")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length <= 1) return words[0] || "Player";

  const particle = words[words.length - 2];
  const previousParticle = words[words.length - 3];

  if (/^(de|del|di|dos|du|el|la|le|van|von)$/i.test(particle)) {
    if (
      /^(da|de|del|dos|van|von)$/i.test(previousParticle)
    ) {
      return `${previousParticle} ${particle} ${
        words[words.length - 1]
      }`;
    }

    return `${particle} ${words[words.length - 1]}`;
  }

  return words[words.length - 1];
}

function ratingColor(value) {
  const rating = asNumber(value);

  if (rating == null) return "#596273";
  if (rating >= 8) return "#18A957";
  if (rating >= 7) return "#23C76A";
  if (rating >= 6) return "#FF9638";
  return "#E95656";
}

function playerRating(player) {
  const rating = asNumber(player?.rating);
  return rating == null || rating <= 0 ? null : rating.toFixed(1);
}

function averageRating(players) {
  const ratings = players
    .map((player) => asNumber(player.rating))
    .filter((rating) => rating != null && rating > 0);

  if (!ratings.length) return null;

  return (
    ratings.reduce((total, rating) => total + rating, 0) /
    ratings.length
  ).toFixed(1);
}

function fallbackPositions(players, formation) {
  const layout =
    FALLBACK_LAYOUTS[formation] ||
    (players.length >= 11 ? FALLBACK_LAYOUTS["4-3-3"] : [players.length]);
  const positions = [];
  let playerIndex = 0;

  layout.forEach((count, rowIndex) => {
    for (let columnIndex = 0; columnIndex < count; columnIndex += 1) {
      const player = players[playerIndex];

      if (!player) return;

      positions.push({
        player,
        row: rowIndex + 1,
        column: columnIndex + 1,
        columns: count,
      });
      playerIndex += 1;
    }
  });

  return positions;
}

function playerPositions(players, formation) {
  const parsed = players.map((player) => {
    const match = String(player.grid || "").match(/^(\d+):(\d+)$/);

    return match
      ? {
          player,
          row: Number(match[1]),
          column: Number(match[2]),
          columns: null,
        }
      : null;
  });

  if (parsed.every(Boolean)) {
    const columnsByRow = new Map();

    parsed.forEach((position) => {
      columnsByRow.set(
        position.row,
        Math.max(
          columnsByRow.get(position.row) || 0,
          position.column
        )
      );
    });

    return parsed.map((position) => ({
      ...position,
      columns: columnsByRow.get(position.row),
    }));
  }

  return fallbackPositions(players, formation);
}

function playerIndicators(player) {
  const indicators = [];
  const goals = asNumber(player.goals?.total) || 0;
  const assists = asNumber(player.goals?.assists) || 0;

  if (goals > 0) {
    indicators.push({
      key: "goal",
      icon: "football",
      label: goals > 1 ? String(goals) : null,
      color: "#FFFFFF",
    });
  }
  if (assists > 0) {
    indicators.push({
      key: "assist",
      icon: "arrow-redo-outline",
      label: assists > 1 ? String(assists) : null,
      color: "#64D2FF",
    });
  }
  if ((asNumber(player.cards?.red) || 0) > 0) {
    indicators.push({
      key: "red",
      icon: "tablet-portrait",
      color: "#F04444",
    });
  } else if ((asNumber(player.cards?.yellow) || 0) > 0) {
    indicators.push({
      key: "yellow",
      icon: "tablet-portrait",
      color: "#FFD43B",
    });
  }
  if (player.captain) {
    indicators.push({
      key: "captain",
      label: "C",
      color: "#FFD43B",
    });
  }
  if (player.substitute && (asNumber(player.minutes) || 0) > 0) {
    indicators.push({
      key: "substitute",
      icon: "swap-horizontal",
      color: "#70D6A3",
    });
  }

  return indicators;
}

function openPlayer(player, team) {
  if (!player?.id) return;

  router.push({
    pathname: "/player/[id]",
    params: {
      id: player.id,
      name: player.name,
      teamId: team?.id || "",
      teamName: team?.shortName || team?.name || "",
      teamLogo: team?.crest || "",
      teamArea: team?.area?.name || "",
      competitionCode: "",
      photo: player.photo || "",
    },
  });
}

function PlayerMarker({
  player,
  team,
  theme,
  compact = false,
  onSelect,
}) {
  const styles = createStyles(theme);
  const rating = playerRating(player);
  const indicators = playerIndicators(player);

  return (
    <Pressable
      style={compact ? styles.compactPlayer : styles.playerMarker}
      onPress={() => onSelect?.(player, team)}
    >
      <View style={styles.playerPhotoWrap}>
        <PlayerJerseyImage
          playerId={player.id}
          playerName={player.name}
          teamName={team?.name}
          teamLogo={team?.crest}
          uri={player.photo}
          preferProvided
          size={compact ? 48 : 58}
          style={compact ? styles.compactPhoto : styles.playerPhoto}
          contentFit="cover"
          theme={theme}
        />

        {rating ? (
          <View
            style={[
              styles.ratingBadge,
              { backgroundColor: ratingColor(rating) },
            ]}
          >
            <Text style={styles.ratingText}>{rating}</Text>
          </View>
        ) : null}

        {indicators.length ? (
          <View style={styles.indicators}>
            {indicators.slice(0, 2).map((indicator) => (
              <View
                key={indicator.key}
                style={styles.indicatorBadge}
              >
                {indicator.icon ? (
                  <Ionicons
                    name={indicator.icon}
                    size={11}
                    color={indicator.color}
                  />
                ) : (
                  <Text
                    style={[
                      styles.indicatorText,
                      { color: indicator.color },
                    ]}
                  >
                    {indicator.label}
                  </Text>
                )}
                {indicator.icon && indicator.label ? (
                  <Text style={styles.indicatorCount}>
                    {indicator.label}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Text
        style={compact ? styles.compactName : styles.playerName}
        numberOfLines={1}
      >
        {player.shirtNumber != null ? `${player.shirtNumber} ` : ""}
        {shortPlayerName(player.name)}
      </Text>

      {compact && player.minutes != null ? (
        <Text style={styles.minutes}>{player.minutes}&apos;</Text>
      ) : null}
    </Pressable>
  );
}

function TeamHeader({ team, players, theme, side }) {
  const styles = createStyles(theme);
  const average = averageRating(players);

  return (
    <View style={styles.teamHeader}>
      <View style={styles.headerIdentity}>
        <TeamBadge
          uri={team?.crest}
          name={team?.shortName || team?.name}
          size={32}
          theme={theme}
        />
        <View style={styles.teamCopy}>
          <Text style={styles.teamName} numberOfLines={1}>
            {team?.shortName || team?.name || "Team"}
          </Text>
          <Text style={styles.formation}>
            {team?.formation || "Starting XI"}
          </Text>
        </View>
      </View>

      <View style={styles.teamMeta}>
        {average ? (
          <View
            style={[
              styles.averageBadge,
              { backgroundColor: ratingColor(average) },
            ]}
          >
            <Text style={styles.averageText}>{average}</Text>
          </View>
        ) : null}
        <Text style={styles.sideLabel}>{side}</Text>
      </View>
    </View>
  );
}

function TeamHalf({ team, players, side, theme, onSelect }) {
  const styles = createStyles(theme);
  const positions = playerPositions(players, team?.formation);
  const maximumRow = Math.max(
    1,
    ...positions.map((position) => position.row)
  );

  return (
    <View style={styles.half}>
      {positions.map(({ player, row, column, columns }) => {
        const x = ((columns - column + 0.5) / columns) * 100;
        const logicalY =
          maximumRow === 1 ? 50 : ((row - 1) / (maximumRow - 1)) * 78 + 11;
        const y =
          side === "away"
            ? 100 - logicalY / 2
            : logicalY / 2;

        return (
          <View
            key={player.id || `${row}-${column}-${player.name}`}
            style={[
              styles.positionedPlayer,
              {
                left: `${x}%`,
                top: `${y}%`,
              },
            ]}
          >
            <PlayerMarker
              player={player}
              team={team}
              theme={theme}
              onSelect={onSelect}
            />
          </View>
        );
      })}
    </View>
  );
}

function Bench({ team, theme, onSelect }) {
  const styles = createStyles(theme);
  const players = team?.bench || [];

  if (!players.length) return null;

  return (
    <View style={styles.benchSection}>
      <View style={styles.benchHeading}>
        <Text style={styles.benchTitle}>
          {team?.shortName || team?.name} substitutes
        </Text>
        {team?.coach?.name ? (
          <Text style={styles.coach}>Coach: {team.coach.name}</Text>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.benchList}
      >
        {players.map((player, index) => (
          <PlayerMarker
            key={player.id || index}
            player={player}
            team={team}
            theme={theme}
            compact
            onSelect={onSelect}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default function MatchLineupPitch({
  homeTeam,
  awayTeam,
  theme,
}) {
  const styles = createStyles(theme);
  const [selected, setSelected] = useState(null);
  const homePlayers = homeTeam?.lineup || [];
  const awayPlayers = awayTeam?.lineup || [];

  return (
    <View style={styles.wrapper}>
      <TeamHeader
        team={homeTeam}
        players={homePlayers}
        theme={theme}
        side="HOME"
      />

      <View style={styles.pitch}>
        <View style={styles.centerLine} />
        <View style={styles.centerCircle} />
        <View style={styles.topBox} />
        <View style={styles.bottomBox} />
        <View style={styles.topGoal} />
        <View style={styles.bottomGoal} />

        <TeamHalf
          team={homeTeam}
          players={homePlayers}
          side="home"
          theme={theme}
          onSelect={(player, team) => setSelected({ player, team })}
        />
        <TeamHalf
          team={awayTeam}
          players={awayPlayers}
          side="away"
          theme={theme}
          onSelect={(player, team) => setSelected({ player, team })}
        />
      </View>

      <TeamHeader
        team={awayTeam}
        players={awayPlayers}
        theme={theme}
        side="AWAY"
      />

      <Bench
        team={homeTeam}
        theme={theme}
        onSelect={(player, team) => setSelected({ player, team })}
      />
      <Bench
        team={awayTeam}
        theme={theme}
        onSelect={(player, team) => setSelected({ player, team })}
      />

      <PlayerStatModal
        selected={selected}
        theme={theme}
        onClose={() => setSelected(null)}
      />
    </View>
  );
}

function statValue(value, suffix = "") {
  return value == null ? "-" : `${value}${suffix}`;
}

function passAccuracy(player) {
  const accurate = asNumber(player?.passes?.accuracy);
  const total = asNumber(player?.passes?.total);

  if (accurate == null) return "-";
  if (total && accurate <= total) {
    return `${Math.round((accurate / total) * 100)}%`;
  }

  return `${Math.round(accurate)}%`;
}

function PlayerStatModal({ selected, theme, onClose }) {
  const styles = createStyles(theme);
  const player = selected?.player;
  const team = selected?.team;

  return (
    <Modal
      visible={Boolean(selected)}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <PlayerJerseyImage
              playerId={player?.id}
              playerName={player?.name}
              teamName={team?.name}
              teamLogo={team?.crest}
              uri={player?.photo}
              preferProvided
              size={72}
              style={styles.modalPhoto}
              contentFit="cover"
              theme={theme}
            />

            <View style={styles.modalIdentity}>
              <Text style={styles.modalName}>{player?.name}</Text>
              <Text style={styles.modalTeam}>
                {player?.shirtNumber != null
                  ? `#${player.shirtNumber} | `
                  : ""}
                {team?.shortName || team?.name}
              </Text>
              <Text style={styles.modalPosition}>
                {player?.position || "Player"}
                {player?.captain ? " | Captain" : ""}
              </Text>
            </View>

            {playerRating(player) ? (
              <View
                style={[
                  styles.modalRating,
                  {
                    backgroundColor: ratingColor(player.rating),
                  },
                ]}
              >
                <Text style={styles.modalRatingValue}>
                  {playerRating(player)}
                </Text>
                <Text style={styles.modalRatingLabel}>RATING</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.modalStats}>
            <StatCell
              label="Minutes"
              value={statValue(player?.minutes, "'")}
              styles={styles}
            />
            <StatCell
              label="Goals"
              value={statValue(player?.goals?.total)}
              styles={styles}
            />
            <StatCell
              label="Assists"
              value={statValue(player?.goals?.assists)}
              styles={styles}
            />
            <StatCell
              label="Shots"
              value={statValue(player?.shots?.total)}
              styles={styles}
            />
            <StatCell
              label="Passes"
              value={statValue(player?.passes?.total)}
              styles={styles}
            />
            <StatCell
              label="Pass accuracy"
              value={passAccuracy(player)}
              styles={styles}
            />
            <StatCell
              label="Tackles"
              value={statValue(player?.tackles?.total)}
              styles={styles}
            />
            <StatCell
              label="Duels won"
              value={statValue(player?.duels?.won)}
              styles={styles}
            />
            <StatCell
              label="Dribbles"
              value={statValue(player?.dribbles?.success)}
              styles={styles}
            />
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={() => {
              onClose();
              openPlayer(player, team);
            }}
          >
            <Text style={styles.profileButtonText}>
              View player profile
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color="#111318"
            />
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function StatCell({ label, value, styles }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrapper: {
      overflow: "hidden",
      backgroundColor: "#17191D",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
    },
    teamHeader: {
      minHeight: 70,
      paddingHorizontal: 15,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: "#22252A",
    },
    headerIdentity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
    },
    teamCopy: {
      flex: 1,
      minWidth: 0,
      marginLeft: 10,
    },
    teamName: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 17,
    },
    formation: {
      color: "#BEC3CC",
      fontWeight: "700",
      marginTop: 2,
    },
    teamMeta: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 10,
    },
    averageBadge: {
      minWidth: 42,
      height: 28,
      paddingHorizontal: 8,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    averageText: {
      color: "#111318",
      fontWeight: "900",
      fontSize: 15,
    },
    sideLabel: {
      color: "#858D9A",
      fontSize: 10,
      fontWeight: "900",
      marginLeft: 8,
    },
    pitch: {
      height: 940,
      position: "relative",
      backgroundColor: "#17191D",
      overflow: "hidden",
    },
    half: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      height: "100%",
    },
    centerLine: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "50%",
      height: 2,
      backgroundColor: "#292C31",
    },
    centerCircle: {
      position: "absolute",
      left: "50%",
      top: "50%",
      width: 154,
      height: 154,
      marginLeft: -77,
      marginTop: -77,
      borderWidth: 3,
      borderColor: "#292C31",
      borderRadius: 77,
    },
    topBox: {
      position: "absolute",
      top: 0,
      left: "24%",
      width: "52%",
      height: 142,
      borderWidth: 3,
      borderTopWidth: 0,
      borderColor: "#292C31",
      borderBottomLeftRadius: 12,
      borderBottomRightRadius: 12,
    },
    bottomBox: {
      position: "absolute",
      bottom: 0,
      left: "24%",
      width: "52%",
      height: 142,
      borderWidth: 3,
      borderBottomWidth: 0,
      borderColor: "#292C31",
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
    },
    topGoal: {
      position: "absolute",
      top: 0,
      left: "38%",
      width: "24%",
      height: 50,
      borderWidth: 3,
      borderTopWidth: 0,
      borderColor: "#292C31",
    },
    bottomGoal: {
      position: "absolute",
      bottom: 0,
      left: "38%",
      width: "24%",
      height: 50,
      borderWidth: 3,
      borderBottomWidth: 0,
      borderColor: "#292C31",
    },
    positionedPlayer: {
      position: "absolute",
      width: 92,
      marginLeft: -46,
      height: 94,
      marginTop: -47,
      zIndex: 4,
    },
    playerMarker: {
      width: 92,
      alignItems: "center",
    },
    playerPhotoWrap: {
      position: "relative",
    },
    playerPhoto: {
      width: 58,
      height: 58,
      borderRadius: 29,
      borderWidth: 2,
      borderColor: "#343840",
      backgroundColor: "#343840",
    },
    ratingBadge: {
      position: "absolute",
      right: -12,
      top: -7,
      minWidth: 35,
      height: 24,
      paddingHorizontal: 5,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "#17191D",
    },
    ratingText: {
      color: "#111318",
      fontSize: 13,
      fontWeight: "900",
    },
    indicators: {
      position: "absolute",
      right: -10,
      bottom: -3,
      flexDirection: "row",
    },
    indicatorBadge: {
      minWidth: 20,
      height: 20,
      paddingHorizontal: 3,
      borderRadius: 10,
      backgroundColor: "#25282D",
      borderWidth: 1,
      borderColor: "#17191D",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      marginLeft: -3,
    },
    indicatorText: {
      fontSize: 10,
      fontWeight: "900",
    },
    indicatorCount: {
      color: "#FFFFFF",
      fontSize: 8,
      fontWeight: "900",
      marginLeft: 1,
    },
    playerName: {
      width: 98,
      marginTop: 5,
      color: "#F6F7F9",
      fontSize: 11,
      lineHeight: 14,
      fontWeight: "800",
      textAlign: "center",
    },
    benchSection: {
      borderTopWidth: 1,
      borderTopColor: "#30343B",
      paddingVertical: 14,
      backgroundColor: "#202328",
    },
    benchHeading: {
      paddingHorizontal: 15,
      marginBottom: 12,
    },
    benchTitle: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "900",
    },
    coach: {
      color: "#969EAA",
      fontSize: 11,
      marginTop: 3,
    },
    benchList: {
      paddingHorizontal: 14,
      gap: 15,
    },
    compactPlayer: {
      width: 76,
      alignItems: "center",
    },
    compactPhoto: {
      width: 48,
      height: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: "#343840",
      backgroundColor: "#343840",
    },
    compactName: {
      color: "#FFFFFF",
      width: 76,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "800",
      textAlign: "center",
      marginTop: 5,
    },
    minutes: {
      color: "#969EAA",
      fontSize: 9,
      marginTop: 2,
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.72)",
    },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: 28,
    },
    modalHandle: {
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      alignSelf: "center",
      marginBottom: 18,
    },
    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
    },
    modalPhoto: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: theme.cardAlt,
    },
    modalIdentity: {
      flex: 1,
      minWidth: 0,
      marginLeft: 13,
    },
    modalName: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
    },
    modalTeam: {
      color: theme.subText,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 4,
    },
    modalPosition: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 4,
    },
    modalRating: {
      width: 58,
      height: 58,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    modalRatingValue: {
      color: "#111318",
      fontSize: 20,
      fontWeight: "900",
    },
    modalRatingLabel: {
      color: "#111318",
      fontSize: 7,
      fontWeight: "900",
    },
    modalStats: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 22,
      marginHorizontal: -4,
    },
    statCell: {
      width: "33.333%",
      padding: 4,
      minHeight: 70,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.cardAlt,
    },
    statValue: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },
    statLabel: {
      color: theme.subText,
      fontSize: 9,
      fontWeight: "700",
      marginTop: 4,
      textTransform: "uppercase",
    },
    profileButton: {
      height: 50,
      borderRadius: 16,
      backgroundColor: theme.accent,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 18,
    },
    profileButtonText: {
      color: "#111318",
      fontSize: 14,
      fontWeight: "900",
      marginRight: 6,
    },
  });
}
