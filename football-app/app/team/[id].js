import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  Linking,
} from "react-native";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  router,
  useLocalSearchParams,
} from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  calculateClubStats,
  getTeamDetails,
  getTeamMatches,
} from "../../services/stats";

import {
  getTeamMedia,
} from "../../services/mediaApi";

import {
  getTeamSquad,
} from "../../services/players";

import {
  useAppTheme,
} from "../../context/ThemeContext";
import TeamBadge from "../../components/TeamBadge";
import PlayerJerseyImage from "../../components/PlayerJerseyImage";
import {
  findWorldCupTeam,
  getFlagUrl,
} from "../../constants/worldCup2026";

const CLUBS_KEY = "favorite_clubs";

function TeamLogo({
  uri,
  name,
  competitionCode,
  style,
  theme,
}) {
  return (
    <TeamBadge
      uri={uri}
      name={name}
      competitionCode={competitionCode}
      size={130}
      style={style}
      theme={theme}
    />
  );
}

export default function TeamScreen() {
  const { id, name, logo, competitionCode } =
    useLocalSearchParams();

  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [team, setTeam] = useState(null);
  const [teamMedia, setTeamMedia] = useState(null);
  const [matches, setMatches] = useState([]);
  const [squad, setSquad] = useState([]);
  const [favoriteClubs, setFavoriteClubs] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);

  const loadTeamData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const [data, matchData, squadData] = await Promise.all([
        getTeamDetails(id),
        getTeamMatches(id),
        getTeamSquad(id),
      ]);

      const finalName = data?.name || name;
      const media = await getTeamMedia(finalName);

      if (data) setTeam(data);
      setMatches((current) =>
        matchData?.length || showLoader ? matchData || [] : current
      );
      const latestSquad = squadData || data?.squad || [];
      setSquad((current) =>
        latestSquad.length || showLoader ? latestSquad : current
      );
      setTeamMedia(media);
    } catch (error) {
      console.log("TEAM SCREEN ERROR:", error);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [id, name]);

  const loadFavorites = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(CLUBS_KEY);
      setFavoriteClubs(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.log("TEAM FAVORITES ERROR:", error);
    }
  }, []);

  useEffect(() => {
    loadTeamData();
    loadFavorites();
  }, [loadTeamData, loadFavorites]);

  useEffect(() => {
    const hasLiveMatch = matches.some((match) =>
      ["IN_PLAY", "PAUSED"].includes(match.status)
    );
    const interval = setInterval(
      () => loadTeamData(false),
      hasLiveMatch ? 10000 : 30000
    );

    return () => clearInterval(interval);
  }, [loadTeamData, matches]);

  async function toggleFavorite() {
    const club = {
      id,
      name: displayName,
      logo: displayCrest,
      competitionCode: competitionCode || "",
    };

    const exists = favoriteClubs.some(
      (item) => String(item.id) === String(id)
    );

    const updated = exists
      ? favoriteClubs.filter((item) => String(item.id) !== String(id))
      : [...favoriteClubs, club];

    setFavoriteClubs(updated);

    await AsyncStorage.setItem(CLUBS_KEY, JSON.stringify(updated));
  }

  function openWebsite() {
    if (team?.website) {
      Linking.openURL(team.website);
    }
  }

  const displayName =
    team?.shortName || team?.name || name || "Team";

  const fullName = team?.name || displayName;

  const crest =
    team?.crest ||
    teamMedia?.badge ||
    teamMedia?.logo ||
    logo ||
    null;
  const worldCupTeam =
    competitionCode === "WC"
      ? findWorldCupTeam(displayName)
      : null;
  const displayCrest = worldCupTeam
    ? getFlagUrl(worldCupTeam.code)
    : crest;

  const isFavorite = favoriteClubs.some(
    (item) => String(item.id) === String(id)
  );

  const finishedMatches = useMemo(
    () =>
      matches
        .filter((match) => match.status === "FINISHED")
        .sort(
          (a, b) =>
            new Date(b.utcDate).getTime() -
            new Date(a.utcDate).getTime()
        ),
    [matches]
  );

  const upcomingMatches = useMemo(
    () =>
      matches
        .filter((match) => match.status !== "FINISHED")
        .sort(
          (a, b) =>
            new Date(a.utcDate).getTime() -
            new Date(b.utcDate).getTime()
        ),
    [matches]
  );

  const stats = useMemo(
    () => calculateClubStats(matches, id),
    [matches, id]
  );

  const recentForm = finishedMatches.slice(0, 5).map((match) => {
    const isHome = String(match.homeTeam?.id) === String(id);
    const homeGoals = match.score?.fullTime?.home ?? 0;
    const awayGoals = match.score?.fullTime?.away ?? 0;

    if (homeGoals === awayGoals) return "D";

    const won = isHome
      ? homeGoals > awayGoals
      : awayGoals > homeGoals;

    return won ? "W" : "L";
  });

  const groupedSquad = useMemo(() => {
    const groups = {
      Goalkeeper: [],
      Defence: [],
      Midfield: [],
      Offence: [],
      Other: [],
    };

    squad.forEach((player) => {
      const position = player.position || "Other";

      if (position.includes("Goalkeeper")) {
        groups.Goalkeeper.push(player);
      } else if (
        position.includes("Back") ||
        position.includes("Defence")
      ) {
        groups.Defence.push(player);
      } else if (position.includes("Midfield")) {
        groups.Midfield.push(player);
      } else if (
        position.includes("Forward") ||
        position.includes("Offence") ||
        position.includes("Attacker")
      ) {
        groups.Offence.push(player);
      } else {
        groups.Other.push(player);
      }
    });

    return groups;
  }, [squad]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.accent} />

        <Text style={styles.loadingText}>
          Loading team...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.circleBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>

        <Pressable style={styles.circleBtn} onPress={toggleFavorite}>
          <Ionicons
            name={isFavorite ? "star" : "star-outline"}
            size={24}
            color={theme.gold}
          />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {(teamMedia?.banner || teamMedia?.fanart || teamMedia?.stadium) && (
          <Image
            source={{
              uri:
                teamMedia.banner ||
                teamMedia.fanart ||
                teamMedia.stadium,
            }}
            style={styles.heroImage}
          />
        )}

        <View style={styles.header}>
          <View style={styles.logoGlow} />

          <TeamLogo
            uri={displayCrest}
            name={displayName}
            competitionCode={competitionCode}
            style={styles.teamLogo}
            styles={styles}
            theme={theme}
          />

          <Text style={styles.teamName}>
            {displayName}
          </Text>

          <Text style={styles.teamSubtitle}>
            {team?.area?.name || "Football Club"}
          </Text>

          <View style={styles.badgeRow}>
            {team?.founded && (
              <InfoPill
                icon="calendar"
                text={`Founded ${team.founded}`}
                styles={styles}
                theme={theme}
              />
            )}

            {team?.tla && (
              <InfoPill
                icon="shield"
                text={team.tla}
                styles={styles}
                theme={theme}
              />
            )}
          </View>
        </View>

        <View style={styles.quickRow}>
          <QuickStat
            label="Played"
            value={stats.played}
            styles={styles}
          />

          <QuickStat
            label="Wins"
            value={stats.wins}
            styles={styles}
          />

          <QuickStat
            label="Goal Diff"
            value={stats.goalDifference}
            styles={styles}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabs}
        >
          {["overview", "matches", "squad", "stats"].map((tab) => (
            <Pressable key={tab} onPress={() => setActiveTab(tab)}>
              <Text
                style={
                  activeTab === tab ? styles.activeTab : styles.tab
                }
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {activeTab === "overview" && (
          <>
            <View style={styles.card}>
              <SectionHeader
                title="Club Details"
                icon="information-circle"
                styles={styles}
                theme={theme}
              />

              <StatRow title="Full Name" value={fullName} styles={styles} />
              <StatRow title="Country" value={team?.area?.name || "-"} styles={styles} />
              <StatRow title="Venue" value={team?.venue || "-"} styles={styles} />
              <StatRow title="Club Colors" value={team?.clubColors || "-"} styles={styles} />
              <StatRow title="Address" value={team?.address || "-"} styles={styles} />

              {team?.website && (
                <Pressable style={styles.websiteBtn} onPress={openWebsite}>
                  <Ionicons name="open-outline" size={18} color={theme.accent} />

                  <Text style={styles.websiteText}>
                    Visit official website
                  </Text>
                </Pressable>
              )}
            </View>

            <View style={styles.card}>
              <SectionHeader
                title="Recent Form"
                icon="pulse"
                styles={styles}
                theme={theme}
              />

              {recentForm.length === 0 ? (
                <EmptyState
                  text="Recent results will appear once this provider has finished matches for the team."
                  styles={styles}
                />
              ) : (
                <View style={styles.formRow}>
                  {recentForm.map((item, index) => (
                    <View
                      key={`${item}-${index}`}
                      style={[
                        styles.formBubble,
                        item === "W" && styles.formWin,
                        item === "D" && styles.formDraw,
                        item === "L" && styles.formLoss,
                      ]}
                    >
                      <Text style={styles.formText}>
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.card}>
              <SectionHeader
                title="Running Competitions"
                icon="trophy"
                styles={styles}
                theme={theme}
              />

              {team?.runningCompetitions?.length ? (
                team.runningCompetitions.map((competition) => (
                  <View key={competition.id || competition.code} style={styles.competitionRow}>
                    <Ionicons name="ellipse" size={8} color={theme.accent} />

                    <Text style={styles.competitionName}>
                      {competition.name}
                    </Text>
                  </View>
                ))
              ) : (
                <EmptyState
                  text="No active competitions were returned for this team."
                  styles={styles}
                />
              )}
            </View>
          </>
        )}

        {activeTab === "matches" && (
          <View style={styles.card}>
            <SectionHeader
              title="Fixtures and Results"
              icon="calendar"
              styles={styles}
              theme={theme}
            />

            {upcomingMatches.length > 0 && (
              <>
                <Text style={styles.groupTitle}>
                  Upcoming
                </Text>

                {upcomingMatches.slice(0, 8).map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    styles={styles}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {finishedMatches.length > 0 && (
              <>
                <Text style={styles.groupTitle}>
                  Latest Results
                </Text>

                {finishedMatches.slice(0, 10).map((match) => (
                  <MatchRow
                    key={match.id}
                    match={match}
                    styles={styles}
                    theme={theme}
                  />
                ))}
              </>
            )}

            {matches.length === 0 && (
              <EmptyState
                text="No fixtures or results are available for this team right now."
                styles={styles}
              />
            )}
          </View>
        )}

        {activeTab === "squad" && (
          <View style={styles.card}>
            <SectionHeader
              title="Squad"
              icon="people"
              styles={styles}
              theme={theme}
            />

            {squad.length === 0 ? (
              <EmptyState
                text="Squad data is not available for this team."
                styles={styles}
              />
            ) : (
              Object.entries(groupedSquad).map(([group, players]) =>
                players.length ? (
                  <View key={group}>
                    <Text style={styles.groupTitle}>
                      {group}
                    </Text>

                    {players.map((player) => (
                      <Pressable
                        key={player.id || player.name}
                        style={styles.playerRow}
                        onPress={() =>
                          player.id &&
                          router.push({
                            pathname: "/player/[id]",
                            params: {
                              id: player.id,
                              name: player.name,
                              teamId: id,
                              teamName: displayName,
                              teamLogo: displayCrest || "",
                              teamArea:
                                team?.area?.name || "",
                              competitionCode:
                                competitionCode || "",
                              photo: player.photo || "",
                            },
                          })
                        }
                      >
                        <PlayerJerseyImage
                          playerId={player.id}
                          playerName={player.name}
                          teamName={displayName}
                          teamLogo={displayCrest}
                          uri={player.photo}
                          preferProvided={Boolean(player.photo)}
                          size={42}
                          style={styles.playerAvatar}
                          theme={theme}
                        />

                        <View style={styles.playerInfo}>
                          <Text style={styles.playerName}>
                            {player.name}
                          </Text>

                          <Text style={styles.playerMeta}>
                            {player.position || "Player"}
                            {player.nationality
                              ? ` - ${player.nationality}`
                              : ""}
                          </Text>
                        </View>

                        <Ionicons
                          name="chevron-forward"
                          size={18}
                          color={theme.subText}
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : null
              )
            )}
          </View>
        )}

        {activeTab === "stats" && (
          <>
            <View style={styles.card}>
              <SectionHeader
                title="Season Snapshot"
                icon="stats-chart"
                styles={styles}
                theme={theme}
              />

              <View style={styles.statsGrid}>
                <BigStat label="Played" value={stats.played} styles={styles} />
                <BigStat label="Won" value={stats.wins} styles={styles} />
                <BigStat label="Drawn" value={stats.draws} styles={styles} />
                <BigStat label="Lost" value={stats.losses} styles={styles} />
                <BigStat label="Goals For" value={stats.goalsFor} styles={styles} />
                <BigStat label="Goals Against" value={stats.goalsAgainst} styles={styles} />
              </View>
            </View>

            <View style={styles.card}>
              <SectionHeader
                title="Provider Notes"
                icon="alert-circle"
                styles={styles}
                theme={theme}
              />

              <Text style={styles.emptyText}>
                These stats are calculated from the match history returned by the football data provider. More advanced Futmob-style numbers such as expected goals, possession trends, and player ratings need a richer stats source.
              </Text>
            </View>
          </>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function InfoPill({ icon, text, styles, theme }) {
  return (
    <View style={styles.infoPill}>
      <Ionicons name={icon} size={14} color={theme.accent} />

      <Text style={styles.infoPillText}>
        {text}
      </Text>
    </View>
  );
}

function SectionHeader({ title, icon, styles, theme }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      <Ionicons name={icon} size={20} color={theme.accent} />
    </View>
  );
}

function QuickStat({ label, value, styles }) {
  return (
    <View style={styles.quickStat}>
      <Text style={styles.quickValue}>
        {value}
      </Text>

      <Text style={styles.quickLabel}>
        {label}
      </Text>
    </View>
  );
}

function BigStat({ label, value, styles }) {
  return (
    <View style={styles.bigStat}>
      <Text style={styles.bigValue}>
        {value}
      </Text>

      <Text style={styles.bigLabel}>
        {label}
      </Text>
    </View>
  );
}

function StatRow({ title, value, styles }) {
  return (
    <View style={styles.row}>
      <Text style={styles.left}>
        {title}
      </Text>

      <Text style={styles.right}>
        {String(value || "-")}
      </Text>
    </View>
  );
}

function MatchRow({ match, styles, theme }) {
  const homeScore = match.score?.fullTime?.home;
  const awayScore = match.score?.fullTime?.away;
  const hasScore =
    homeScore !== null &&
    homeScore !== undefined &&
    awayScore !== null &&
    awayScore !== undefined;

  return (
    <Pressable
      style={styles.matchCard}
      onPress={() =>
        router.push({
          pathname: "/match/[id]",
          params: {
            id: match.id,
          },
        })
      }
    >
      <View style={styles.matchMetaRow}>
        <Text style={styles.matchCompetition} numberOfLines={1}>
          {match.competition?.name || "Match"}
        </Text>

        <Text style={styles.matchDate}>
          {new Date(match.utcDate).toLocaleDateString()} - {match.status}
        </Text>
      </View>

      <View style={styles.matchTeams}>
        <View style={styles.matchTeamSide}>
          <TeamBadge
            team={match.homeTeam}
            competitionCode={match.competition?.code}
            size={42}
            style={styles.matchLogo}
            theme={theme}
          />

          <Text style={styles.matchTeamName} numberOfLines={1}>
            {match.homeTeam?.shortName || match.homeTeam?.name}
          </Text>
        </View>

        <Text style={styles.matchScore}>
          {hasScore ? `${homeScore} - ${awayScore}` : "VS"}
        </Text>

        <View style={styles.matchTeamSide}>
          <TeamBadge
            team={match.awayTeam}
            competitionCode={match.competition?.code}
            size={42}
            style={styles.matchLogo}
            theme={theme}
          />

          <Text style={styles.matchTeamName} numberOfLines={1}>
            {match.awayTeam?.shortName || match.awayTeam?.name}
          </Text>
        </View>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color={theme.subText}
        style={styles.matchChevron}
      />
    </Pressable>
  );
}

function EmptyState({ text, styles }) {
  return (
    <Text style={styles.emptyText}>
      {text}
    </Text>
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

    loadingText: {
      color: theme.subText,
      marginTop: 14,
    },

    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 18,
      marginBottom: 14,
      zIndex: 5,
    },

    circleBtn: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },

    heroImage: {
      width: "100%",
      height: 170,
      resizeMode: "cover",
      opacity: 0.42,
      marginTop: -14,
      marginBottom: -70,
    },

    header: {
      alignItems: "center",
      paddingHorizontal: 18,
      marginBottom: 22,
    },

    logoGlow: {
      position: "absolute",
      width: 172,
      height: 172,
      borderRadius: 86,
      top: -12,
      backgroundColor: "rgba(0,217,255,0.12)",
    },

    teamLogo: {
      width: 130,
      height: 130,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 18,
    },

    logoFallback: {
      overflow: "hidden",
      justifyContent: "center",
      alignItems: "center",
    },

    fallbackImage: {
      width: "100%",
      height: "100%",
    },

    teamName: {
      color: theme.text,
      fontSize: 30,
      fontWeight: "bold",
      textAlign: "center",
    },

    teamSubtitle: {
      color: theme.subText,
      marginTop: 8,
      fontWeight: "600",
    },

    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      marginTop: 14,
    },

    infoPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 30,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.border,
      marginHorizontal: 5,
      marginTop: 8,
    },

    infoPillText: {
      color: theme.text,
      fontSize: 12,
      fontWeight: "700",
      marginLeft: 6,
    },

    quickRow: {
      flexDirection: "row",
      paddingHorizontal: 12,
      marginBottom: 20,
    },

    quickStat: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 20,
      padding: 16,
      marginHorizontal: 6,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },

    quickValue: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "bold",
    },

    quickLabel: {
      color: theme.subText,
      marginTop: 5,
      fontSize: 12,
      fontWeight: "600",
    },

    tabs: {
      paddingHorizontal: 18,
      marginBottom: 18,
    },

    activeTab: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "bold",
      marginRight: 24,
    },

    tab: {
      color: theme.subText,
      fontSize: 17,
      marginRight: 24,
      fontWeight: "600",
    },

    card: {
      backgroundColor: theme.card,
      borderRadius: 24,
      marginHorizontal: 18,
      padding: 20,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },

    sectionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },

    sectionTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "bold",
    },

    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      paddingVertical: 15,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    left: {
      color: theme.subText,
      maxWidth: "38%",
    },

    right: {
      color: theme.text,
      fontWeight: "600",
      maxWidth: "58%",
      textAlign: "right",
    },

    websiteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.cardAlt,
      paddingVertical: 14,
      borderRadius: 16,
      marginTop: 18,
    },

    websiteText: {
      color: theme.accent,
      fontWeight: "bold",
      marginLeft: 8,
    },

    formRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    formBubble: {
      width: 42,
      height: 42,
      borderRadius: 21,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 10,
    },

    formWin: {
      backgroundColor: "#22C55E",
    },

    formDraw: {
      backgroundColor: "#F59E0B",
    },

    formLoss: {
      backgroundColor: theme.danger,
    },

    formText: {
      color: "white",
      fontWeight: "bold",
    },

    competitionRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 10,
    },

    competitionName: {
      color: theme.text,
      marginLeft: 10,
      fontWeight: "600",
    },

    groupTitle: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: "bold",
      marginTop: 8,
      marginBottom: 12,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },

    matchCard: {
      backgroundColor: theme.cardAlt,
      borderRadius: 18,
      padding: 16,
      marginBottom: 12,
    },

    matchMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 12,
    },

    matchCompetition: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "bold",
      flex: 1,
      marginRight: 10,
    },

    matchDate: {
      color: theme.subText,
      fontSize: 12,
      fontWeight: "600",
    },

    matchTeams: {
      flexDirection: "row",
      alignItems: "center",
    },

    matchTeamSide: {
      flex: 1,
      alignItems: "center",
    },

    matchLogo: {
      width: 34,
      height: 34,
      marginBottom: 8,
    },

    matchTeamName: {
      color: theme.text,
      fontWeight: "700",
      textAlign: "center",
      fontSize: 12,
    },

    matchScore: {
      color: theme.gold,
      fontSize: 18,
      fontWeight: "bold",
      marginHorizontal: 12,
      minWidth: 54,
      textAlign: "center",
    },

    matchChevron: {
      position: "absolute",
      right: 10,
      top: 14,
    },

    playerRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardAlt,
      borderRadius: 16,
      padding: 14,
      marginBottom: 10,
    },

    playerAvatar: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },

    playerInfo: {
      flex: 1,
    },

    playerName: {
      color: theme.text,
      fontWeight: "bold",
    },

    playerMeta: {
      color: theme.subText,
      marginTop: 4,
      fontSize: 12,
    },

    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: -6,
    },

    bigStat: {
      width: "50%",
      padding: 6,
    },

    bigValue: {
      backgroundColor: theme.cardAlt,
      color: theme.text,
      fontSize: 26,
      fontWeight: "bold",
      textAlign: "center",
      paddingTop: 18,
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
    },

    bigLabel: {
      backgroundColor: theme.cardAlt,
      color: theme.subText,
      textAlign: "center",
      paddingBottom: 18,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
      fontSize: 12,
      fontWeight: "700",
    },

    emptyText: {
      color: theme.subText,
      lineHeight: 22,
    },
  });
}
