import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import AnimatedGlowCard from "../../components/AnimatedGlowCard";
import CompetitionLogo from "../../components/CompetitionLogo";
import TeamBadge from "../../components/TeamBadge";
import { useAppTheme } from "../../context/ThemeContext";
import {
  getWatchOptions,
  WATCH_REGIONS,
  WATCH_REGION_KEY,
} from "../../constants/watchHub";
import {
  getWatchHubMatches,
  isLiveMatch,
} from "../../services/watchHub";

const FILTERS = [
  { key: "all", label: "Next 7 days" },
  { key: "live", label: "Live now" },
  { key: "today", label: "Today" },
];
const WATCH_MATCH_CACHE_KEY = "matchzone_watch_matches_v1";

const HUB_FEATURES = [
  {
    icon: "tv-outline",
    title: "Viewing options",
    text: "Channels and apps for your country",
  },
  {
    icon: "pulse-outline",
    title: "Match tracker",
    text: "Score and status updates",
  },
  {
    icon: "chatbubbles-outline",
    title: "Fan rooms",
    text: "Signed-in chat and live polls",
  },
];

function teamName(team) {
  return team?.shortName || team?.name || "TBC";
}

function statusLabel(match) {
  if (match.status === "PAUSED") return "HALF TIME";
  if (isLiveMatch(match)) return "LIVE";
  if (match.status === "FINISHED") return "FULL TIME";
  return new Date(match.utcDate).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WatchHubScreen() {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [region, setRegion] = useState("US");
  const [regionModal, setRegionModal] = useState(false);

  const loadRegion = useCallback(async () => {
    const saved = await AsyncStorage.getItem(WATCH_REGION_KEY);

    if (saved && WATCH_REGIONS.some((item) => item.code === saved)) {
      setRegion(saved);
    }
  }, []);

  const loadMatches = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError("");
      const cached = await AsyncStorage.getItem(WATCH_MATCH_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : null;

      if (Array.isArray(parsed?.matches) && parsed.matches.length) {
        setMatches(parsed.matches);
        setLoading(false);
      }

      const latest = await getWatchHubMatches();
      setMatches((current) =>
        latest.length || !current.length ? latest : current
      );

      if (latest.length) {
        await AsyncStorage.setItem(
          WATCH_MATCH_CACHE_KEY,
          JSON.stringify({
            matches: latest,
            updatedAt: Date.now(),
          })
        );
      }
    } catch (loadError) {
      console.log("WATCH HUB ERROR:", loadError);
      setError("Verified match data could not be loaded right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRegion();
    loadMatches();

    const interval = setInterval(() => loadMatches(false), 60000);
    return () => clearInterval(interval);
  }, [loadMatches, loadRegion]);

  async function selectRegion(code) {
    setRegion(code);
    setRegionModal(false);
    await AsyncStorage.setItem(WATCH_REGION_KEY, code);
  }

  function openWatchRoom(match) {
    router.push({
      pathname: "/watch/[id]",
      params: {
        id: match.id,
        region,
      },
    });
  }

  const displayedMatches = matches.filter((match) => {
    if (filter === "live") return isLiveMatch(match);

    if (filter === "today") {
      return (
        new Date(match.utcDate).toDateString() ===
        new Date().toDateString()
      );
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Watch Hub</Text>
        {loading ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : null}

        <Pressable
          style={styles.regionButton}
          onPress={() => setRegionModal(true)}
        >
          <Ionicons name="location-outline" size={17} color={theme.accent} />
          <Text style={styles.regionButtonText}>{region}</Text>
          <Ionicons name="chevron-down" size={15} color={theme.subText} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadMatches(false);
            }}
            tintColor={theme.accent}
          />
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.featureStrip}
        >
          {HUB_FEATURES.map((feature) => (
            <View key={feature.title} style={styles.featureCard}>
              <Ionicons
                name={feature.icon}
                size={22}
                color={theme.accent}
              />
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureText}>{feature.text}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.sectionRow}>
          <View>
            <Text style={styles.sectionTitle}>Match rooms</Text>
            <Text style={styles.sectionSub}>
              Live and upcoming fixtures from supported competitions
            </Text>
          </View>
          <Pressable onPress={() => router.push("/notifications")}>
            <Ionicons
              name="notifications-outline"
              size={23}
              color={theme.text}
            />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          {FILTERS.map((item) => (
            <Pressable
              key={item.key}
              style={[
                styles.filterButton,
                filter === item.key && styles.activeFilter,
              ]}
              onPress={() => setFilter(item.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item.key && styles.activeFilterText,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {error && displayedMatches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="cloud-offline-outline"
              size={42}
              color={theme.danger}
            />
            <Text style={styles.emptyTitle}>Hub unavailable</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable
              style={styles.retryButton}
              onPress={() => loadMatches()}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : displayedMatches.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="calendar-outline"
              size={46}
              color={theme.border}
            />
            <Text style={styles.emptyTitle}>No matches in this view</Text>
            <Text style={styles.emptyText}>
              Try the next seven days filter. Watch rooms open before kickoff.
            </Text>
          </View>
        ) : (
          displayedMatches.map((match, index) => {
            const live = isLiveMatch(match);
            const viewing = getWatchOptions(
              match.competition?.code,
              region
            );

            return (
              <AnimatedGlowCard
                key={match.id}
                style={styles.matchCard}
                glowColor={live ? theme.danger : theme.accent}
                delay={index * 45}
                onPress={() => openWatchRoom(match)}
              >
                <View style={styles.matchTop}>
                  <View style={styles.competitionRow}>
                    <CompetitionLogo
                      code={match.competition?.code}
                      uri={match.competition?.emblem}
                      size={28}
                      theme={theme}
                    />
                    <Text style={styles.competitionName} numberOfLines={1}>
                      {match.competition?.name}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      live && styles.liveStatusPill,
                    ]}
                  >
                    {live ? <View style={styles.liveDot} /> : null}
                    <Text
                      style={[
                        styles.statusText,
                        live && styles.liveStatusText,
                      ]}
                    >
                      {statusLabel(match)}
                    </Text>
                  </View>
                </View>

                <View style={styles.teamsRow}>
                  <View style={styles.teamBox}>
                    <TeamBadge
                      team={match.homeTeam}
                      competitionCode={match.competition?.code}
                      size={48}
                      theme={theme}
                    />
                    <Text style={styles.teamName} numberOfLines={2}>
                      {teamName(match.homeTeam)}
                    </Text>
                  </View>

                  <View style={styles.scoreBox}>
                    <Text style={styles.score}>
                      {live || match.status === "FINISHED"
                        ? `${match.score?.fullTime?.home ?? 0} - ${
                            match.score?.fullTime?.away ?? 0
                          }`
                        : "VS"}
                    </Text>
                    <Text style={styles.stage}>
                      {match.group?.replaceAll("_", " ") ||
                        match.stage?.replaceAll("_", " ") ||
                        "Fixture"}
                    </Text>
                  </View>

                  <View style={styles.teamBox}>
                    <TeamBadge
                      team={match.awayTeam}
                      competitionCode={match.competition?.code}
                      size={48}
                      theme={theme}
                    />
                    <Text style={styles.teamName} numberOfLines={2}>
                      {teamName(match.awayTeam)}
                    </Text>
                  </View>
                </View>

                <View style={styles.roomFooter}>
                  <View style={styles.availability}>
                    <Ionicons
                      name="shield-checkmark-outline"
                      size={17}
                      color={theme.accent}
                    />
                    <Text style={styles.availabilityText}>
                      {viewing.options.length
                        ? `${viewing.options.length} viewing options`
                        : "Viewing guide available"}
                    </Text>
                  </View>

                  <View style={styles.enterRoom}>
                    <Text style={styles.enterRoomText}>Enter room</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={theme.accent}
                    />
                  </View>
                </View>
              </AnimatedGlowCard>
            );
          })
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={regionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setRegionModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setRegionModal(false)}
        >
          <Pressable style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Your viewing region</Text>
            <Text style={styles.modalSub}>
              This changes broadcaster guidance only. It does not bypass
              location restrictions.
            </Text>

            {WATCH_REGIONS.map((item) => (
              <Pressable
                key={item.code}
                style={styles.regionRow}
                onPress={() => selectRegion(item.code)}
              >
                <View>
                  <Text style={styles.regionName}>{item.name}</Text>
                  <Text style={styles.regionCode}>{item.code}</Text>
                </View>
                <Ionicons
                  name={
                    region === item.code
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={22}
                  color={
                    region === item.code ? theme.accent : theme.subText
                  }
                />
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 55,
      paddingHorizontal: 14,
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
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    title: {
      color: theme.text,
      fontSize: 31,
      fontWeight: "900",
    },
    regionButton: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    regionButtonText: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 12,
      marginHorizontal: 6,
    },
    featureStrip: {
      paddingBottom: 20,
    },
    featureCard: {
      width: 158,
      backgroundColor: theme.cardAlt,
      borderRadius: 18,
      padding: 14,
      marginRight: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    featureTitle: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 13,
      marginTop: 9,
    },
    featureText: {
      color: theme.subText,
      fontSize: 10,
      lineHeight: 15,
      marginTop: 4,
    },
    sectionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 13,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "900",
    },
    sectionSub: {
      color: theme.subText,
      fontSize: 11,
      marginTop: 4,
    },
    filters: {
      paddingBottom: 16,
    },
    filterButton: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 17,
      paddingHorizontal: 16,
      paddingVertical: 9,
      marginRight: 9,
    },
    activeFilter: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    filterText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 12,
    },
    activeFilterText: {
      color: theme.onAccent,
      fontWeight: "900",
    },
    matchCard: {
      backgroundColor: theme.card,
      borderRadius: 23,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    matchTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 18,
    },
    competitionRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      marginRight: 10,
    },
    competitionName: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 12,
      marginLeft: 9,
      flex: 1,
    },
    statusPill: {
      backgroundColor: theme.cardAlt,
      borderRadius: 13,
      paddingHorizontal: 9,
      paddingVertical: 6,
    },
    liveStatusPill: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,59,48,0.12)",
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.danger,
      marginRight: 5,
    },
    statusText: {
      color: theme.subText,
      fontSize: 9,
      fontWeight: "800",
    },
    liveStatusText: {
      color: theme.danger,
    },
    teamsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    teamBox: {
      width: "35%",
      alignItems: "center",
    },
    teamName: {
      color: theme.text,
      textAlign: "center",
      fontSize: 12,
      fontWeight: "700",
      marginTop: 8,
    },
    scoreBox: {
      flex: 1,
      alignItems: "center",
    },
    score: {
      color: theme.text,
      fontSize: 23,
      fontWeight: "900",
    },
    stage: {
      color: theme.subText,
      fontSize: 9,
      textAlign: "center",
      marginTop: 4,
      textTransform: "capitalize",
    },
    roomFooter: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderTopWidth: 1,
      borderTopColor: theme.border,
      marginTop: 16,
      paddingTop: 12,
    },
    availability: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      marginRight: 10,
    },
    availabilityText: {
      color: theme.subText,
      fontSize: 10,
      marginLeft: 6,
    },
    enterRoom: {
      flexDirection: "row",
      alignItems: "center",
    },
    enterRoomText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "800",
      marginRight: 2,
    },
    emptyCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 23,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 34,
      marginBottom: 18,
    },
    emptyTitle: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 17,
      marginTop: 13,
    },
    emptyText: {
      color: theme.subText,
      textAlign: "center",
      lineHeight: 19,
      fontSize: 12,
      marginTop: 7,
    },
    retryButton: {
      backgroundColor: theme.accent,
      borderRadius: 15,
      paddingHorizontal: 18,
      paddingVertical: 9,
      marginTop: 15,
    },
    retryText: {
      color: theme.onAccent,
      fontWeight: "900",
    },
    bottomSpace: {
      height: 110,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      justifyContent: "flex-end",
    },
    modalCard: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: 22,
      maxHeight: "86%",
    },
    modalHandle: {
      width: 44,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: "center",
      marginBottom: 18,
    },
    modalTitle: {
      color: theme.text,
      fontSize: 22,
      fontWeight: "900",
    },
    modalSub: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 17,
      marginTop: 6,
      marginBottom: 13,
    },
    regionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    regionName: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 14,
    },
    regionCode: {
      color: theme.subText,
      fontSize: 10,
      marginTop: 3,
    },
  });
}
