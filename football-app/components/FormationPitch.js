import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import PlayerJerseyImage from "./PlayerJerseyImage";

const FORMATION_LAYOUTS = {
  "4-3-3": [1, 4, 3, 3],
  "4-2-3-1": [1, 4, 2, 3, 1],
  "4-4-2": [1, 4, 4, 2],
  "3-5-2": [1, 3, 5, 2],
  "3-4-3": [1, 3, 4, 3],
  "5-3-2": [1, 5, 3, 2],
  "4-5-1": [1, 4, 5, 1],
};

function buildLines(players, formation) {
  const layout = FORMATION_LAYOUTS[formation] || [];

  let index = 0;

  return layout.map((count) => {
    const line =
      players.slice(index, index + count);

    index += count;

    return line;
  });
}

export default function FormationPitch({
  teamName,
  formation,
  players = [],
  theme,
}) {
  const styles = createStyles(theme);

  const startingPlayers =
    players.length > 0
      ? players.slice(0, 11)
      : [];

  const benchPlayers =
    players.length > 11
      ? players.slice(11)
      : [];

  const hasFormation = Boolean(FORMATION_LAYOUTS[formation]);
  const lines = hasFormation
    ? buildLines(startingPlayers, formation)
    : [];

  return (
    <View style={styles.wrapper}>
      <View style={styles.header}>
        <View>
          <Text style={styles.teamName}>
            {teamName || "Team Lineup"}
          </Text>

          <Text style={styles.formation}>
            {hasFormation
              ? `Formation | ${formation}`
              : "Starting lineup"}
          </Text>
        </View>

        <Ionicons
          name="football"
          size={24}
          color={theme.accent}
        />
      </View>

      <View style={styles.pitch}>
        <View style={styles.centerCircle} />
        <View style={styles.halfLine} />
        <View style={styles.boxTop} />
        <View style={styles.boxBottom} />

        {startingPlayers.length === 0 ? (
          <View style={styles.emptyPitch}>
            <Ionicons
              name="people-outline"
              size={42}
              color="white"
            />

            <Text style={styles.emptyText}>
              Lineup unavailable
            </Text>
          </View>
        ) : hasFormation ? (
          <View style={styles.linesContainer}>
            {lines
              .slice()
              .reverse()
              .map((line, lineIndex) => (
                <View
                  key={lineIndex}
                  style={styles.line}
                >
                  {line.map((player, index) => (
                    <View
                      key={
                        player.id ||
                        `${lineIndex}-${index}`
                      }
                      style={styles.playerNode}
                    >
                      <PlayerJerseyImage
                        playerId={player.id}
                        playerName={player.name}
                        teamName={teamName}
                        teamLogo={player.teamLogo}
                        uri={player.photo}
                        preferProvided={Boolean(player.photo)}
                        size={42}
                        style={styles.playerImage}
                        theme={theme}
                      />

                      <Text
                        style={styles.playerName}
                        numberOfLines={1}
                      >
                        {player.name}
                      </Text>

                      {player.position && (
                        <Text
                          style={styles.playerPos}
                        >
                          {player.position}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>
              ))}
          </View>
        ) : (
          <View style={styles.rosterGrid}>
            {startingPlayers.map((player, index) => (
              <View
                key={player.id || index}
                style={styles.rosterPlayer}
              >
                <PlayerJerseyImage
                  playerId={player.id}
                  playerName={player.name}
                  teamName={teamName}
                  teamLogo={player.teamLogo}
                  uri={player.photo}
                  preferProvided={Boolean(player.photo)}
                  size={42}
                  style={styles.playerImage}
                  theme={theme}
                />

                <Text style={styles.playerName} numberOfLines={1}>
                  {player.name}
                </Text>

                {player.position ? (
                  <Text style={styles.playerPos}>
                    {player.position}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </View>

      {benchPlayers.length > 0 && (
        <View style={styles.benchCard}>
          <Text style={styles.benchTitle}>
            Bench
          </Text>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {benchPlayers.map((player, index) => (
              <View
                key={player.id || index}
                style={styles.benchPlayer}
              >
                <PlayerJerseyImage
                  playerId={player.id}
                  playerName={player.name}
                  teamName={teamName}
                  teamLogo={player.teamLogo}
                  uri={player.photo}
                  preferProvided={Boolean(player.photo)}
                  size={42}
                  style={styles.benchImage}
                  theme={theme}
                />

                <Text
                  style={styles.benchName}
                  numberOfLines={1}
                >
                  {player.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    wrapper: {
      backgroundColor: theme.card,
      borderRadius: 26,
      padding: 16,
      marginBottom: 22,
      borderWidth: 1,
      borderColor: theme.border,
    },

    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },

    teamName: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "bold",
    },

    formation: {
      color: theme.subText,
      marginTop: 4,
      fontSize: 12,
    },

    pitch: {
      height: 520,
      backgroundColor: "#0B6E3D",
      borderRadius: 28,
      overflow: "hidden",
      position: "relative",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.35)",
      paddingVertical: 20,
    },

    halfLine: {
      position: "absolute",
      left: 0,
      right: 0,
      top: "50%",
      height: 1,
      backgroundColor: "rgba(255,255,255,0.35)",
    },

    centerCircle: {
      position: "absolute",
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
      top: "50%",
      left: "50%",
      marginLeft: -60,
      marginTop: -60,
    },

    boxTop: {
      position: "absolute",
      width: 150,
      height: 70,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
      top: 0,
      left: "50%",
      marginLeft: -75,
      borderTopWidth: 0,
      borderBottomLeftRadius: 14,
      borderBottomRightRadius: 14,
    },

    boxBottom: {
      position: "absolute",
      width: 150,
      height: 70,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.35)",
      bottom: 0,
      left: "50%",
      marginLeft: -75,
      borderBottomWidth: 0,
      borderTopLeftRadius: 14,
      borderTopRightRadius: 14,
    },

    linesContainer: {
      flex: 1,
      justifyContent: "space-between",
      paddingVertical: 18,
      zIndex: 5,
    },

    rosterGrid: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
      alignContent: "center",
      justifyContent: "center",
      gap: 14,
      paddingHorizontal: 14,
      zIndex: 5,
    },

    rosterPlayer: {
      alignItems: "center",
      width: "27%",
    },

    line: {
      flexDirection: "row",
      justifyContent: "space-around",
      alignItems: "center",
      paddingHorizontal: 8,
    },

    playerNode: {
      alignItems: "center",
      width: 58,
    },

    playerImage: {
      width: 42,
      height: 42,
      borderRadius: 21,
      borderWidth: 2,
      borderColor: theme.card,
      backgroundColor: theme.accent,
    },

    playerName: {
      color: "#FFFFFF",
      fontWeight: "bold",
      fontSize: 10,
      marginTop: 5,
      textAlign: "center",
      width: 70,
    },

    playerPos: {
      color: "rgba(255,255,255,0.75)",
      fontSize: 9,
      marginTop: 2,
    },

    emptyPitch: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 5,
    },

    emptyText: {
      color: "white",
      fontWeight: "bold",
      marginTop: 12,
    },

    benchCard: {
      backgroundColor: theme.cardAlt,
      borderRadius: 20,
      padding: 14,
      marginTop: 16,
    },

    benchTitle: {
      color: theme.text,
      fontWeight: "bold",
      marginBottom: 12,
    },

    benchPlayer: {
      width: 80,
      alignItems: "center",
      marginRight: 12,
    },

    benchImage: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.card,
      marginBottom: 6,
    },

    benchName: {
      color: theme.text,
      fontSize: 11,
      textAlign: "center",
      width: 76,
    },
  });
}
