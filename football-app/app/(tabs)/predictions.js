import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import AnimatedGlowCard from "../../components/AnimatedGlowCard";
import TeamBadge from "../../components/TeamBadge";
import { useAppTheme } from "../../context/ThemeContext";
import {
  getPredictionData,
  getPredictionSourceDetails,
  getUpcomingMatches,
} from "../../services/predictions";
import {
  buildDataPrediction,
  getMatchTags,
} from "../../services/predictionEngine";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "week", label: "This Week" },
];

const SOURCE = getPredictionSourceDetails();
const PREDICTION_CACHE_KEY = "matchzone_predictions_cache_v1";

function teamName(team) {
  return team?.shortName || team?.name || "TBC";
}

function formatMatchTime(utcDate) {
  return new Date(utcDate).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(value) {
  return Number.isFinite(value) ? value.toFixed(2) : "Unavailable";
}

function formatDateRange(evidence) {
  if (!evidence?.windowStart || !evidence?.windowEnd) {
    return "Unavailable";
  }

  return `${evidence.windowStart} to ${evidence.windowEnd}`;
}

function ProbabilityRow({ prediction, styles }) {
  return (
    <View style={styles.probabilityBox}>
      {[
        ["Home", prediction.homePercent],
        ["Draw", prediction.drawPercent],
        ["Away", prediction.awayPercent],
      ].map(([label, value]) => (
        <View key={label} style={styles.probabilityColumn}>
          <Text style={styles.probabilityLabel}>{label}</Text>
          <Text style={styles.probabilityValue}>{value}%</Text>
        </View>
      ))}
    </View>
  );
}

function EvidenceCard({ title, evidence, styles }) {
  const competitions = evidence?.competitions?.length
    ? evidence.competitions.join(", ")
    : "Unavailable";

  return (
    <View style={styles.evidenceCard}>
      <Text style={styles.evidenceTitle}>{title}</Text>
      <Text style={styles.evidenceLine}>
        Completed matches: {evidence?.sampleSize || 0}
      </Text>
      <Text style={styles.evidenceLine}>
        Sample dates: {formatDateRange(evidence)}
      </Text>
      <Text style={styles.evidenceLine}>Competitions: {competitions}</Text>
      <View style={styles.statGrid}>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>
            {formatNumber(evidence?.averageGoalsFor)}
          </Text>
          <Text style={styles.statLabel}>Avg goals for</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>
            {formatNumber(evidence?.averageGoalsAgainst)}
          </Text>
          <Text style={styles.statLabel}>Avg goals against</Text>
        </View>
        <View style={styles.statCell}>
          <Text style={styles.statValue}>
            {formatNumber(evidence?.averagePoints)}
          </Text>
          <Text style={styles.statLabel}>Avg points</Text>
        </View>
      </View>
      <Text style={styles.evidenceLine}>
        W/D/L: {evidence?.winRate || 0}% / {evidence?.drawRate || 0}% /{" "}
        {evidence?.lossRate || 0}%
      </Text>
      <Text style={styles.evidenceLine}>
        Both teams scored: {evidence?.bttsRate || 0}% | Over 2.5:{" "}
        {evidence?.over25Rate || 0}%
      </Text>
      {evidence?.form ? (
        <Text style={styles.evidenceLine}>Form: {evidence.form}</Text>
      ) : null}
    </View>
  );
}

export default function PredictionsScreen() {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedMatch, setSelectedMatch] = useState(null);

  const loadPredictions = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const cached = await AsyncStorage.getItem(PREDICTION_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : null;

      if (Array.isArray(parsed?.matches) && parsed.matches.length) {
        setMatches(parsed.matches);
      }

      const upcoming = await getUpcomingMatches();
      const dataRows = await getPredictionData(upcoming);

      const nextMatches = dataRows.map(({ match, trend }) => ({
          match,
          prediction: buildDataPrediction(match, trend),
          tags: getMatchTags(match),
        }));

      setMatches(nextMatches);

      if (nextMatches.length) {
        await AsyncStorage.setItem(
          PREDICTION_CACHE_KEY,
          JSON.stringify({
            matches: nextMatches,
            updatedAt: Date.now(),
          })
        );
      }
    } catch (error) {
      console.log("PREDICTIONS ERROR:", error);
      setMatches((current) => current);
      setLoadError("Verified match data could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPredictions();
  }, [loadPredictions]);

  const displayedMatches = matches.filter(({ match }) => {
    const now = new Date();
    const matchDate = new Date(match.utcDate);

    if (filter === "today") {
      return matchDate.toDateString() === now.toDateString();
    }

    if (filter === "tomorrow") {
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      return matchDate.toDateString() === tomorrow.toDateString();
    }

    if (filter === "week") {
      const weekLater = new Date(now);
      weekLater.setDate(now.getDate() + 7);
      return matchDate >= now && matchDate <= weekLater;
    }

    return true;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>DATA MODEL</Text>
          <Text style={styles.title}>Forecasts</Text>
        </View>
        {loading ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : null}
        <View style={styles.dataBadge}>
          <Ionicons name="analytics-outline" size={18} color={theme.accent} />
          <Text style={styles.dataBadgeText}>REAL DATA</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filters}
        contentContainerStyle={styles.filterContent}
      >
        {FILTERS.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setFilter(item.key)}
            style={[styles.filterButton, filter === item.key && styles.activeFilter]}
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

      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>Upcoming Matches</Text>

        {loadError ? (
          <AnimatedGlowCard style={styles.noticeCard} glowColor={theme.danger}>
            <Ionicons name="cloud-offline-outline" size={28} color={theme.danger} />
            <Text style={styles.noticeTitle}>Data unavailable</Text>
            <Text style={styles.noticeText}>{loadError}</Text>
            <Pressable style={styles.retryButton} onPress={loadPredictions}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </AnimatedGlowCard>
        ) : displayedMatches.length === 0 ? (
          <AnimatedGlowCard style={styles.emptyCard} glowColor={theme.accent}>
            <Ionicons name="calendar-outline" size={54} color={theme.border} />
            <Text style={styles.emptyTitle}>No fixtures found</Text>
            <Text style={styles.emptyText}>
              No supported matches are available for this filter.
            </Text>
          </AnimatedGlowCard>
        ) : (
          displayedMatches.map((item, index) => {
            const { match, prediction, tags } = item;

            return (
              <AnimatedGlowCard
                key={match.id || index}
                style={styles.matchCard}
                glowColor={theme.accent}
                delay={index * 45}
                onPress={() => setSelectedMatch(item)}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.competition}>
                    {match.competition?.name || "Competition"}
                  </Text>
                  <Text style={styles.matchTime}>
                    {formatMatchTime(match.utcDate)}
                  </Text>
                </View>

                <View style={styles.teamsRow}>
                  <View style={styles.teamBox}>
                    <TeamBadge
                      team={match.homeTeam}
                      competitionCode={match.competition?.code}
                      size={58}
                      style={styles.logo}
                      theme={theme}
                    />
                    <Text style={styles.teamName}>{teamName(match.homeTeam)}</Text>
                  </View>
                  <Text style={styles.versus}>VS</Text>
                  <View style={styles.teamBox}>
                    <TeamBadge
                      team={match.awayTeam}
                      competitionCode={match.competition?.code}
                      size={58}
                      style={styles.logo}
                      theme={theme}
                    />
                    <Text style={styles.teamName}>{teamName(match.awayTeam)}</Text>
                  </View>
                </View>

                {prediction.available ? (
                  <>
                    <ProbabilityRow prediction={prediction} styles={styles} />
                    <View style={styles.forecastSummary}>
                      <View style={styles.summaryCopy}>
                        <Text style={styles.modelLean}>
                          Model lean: {prediction.outcome.label} (
                          {Math.round(prediction.outcome.probability * 100)}%)
                        </Text>
                        <Text style={styles.summaryLine}>
                          Most likely score: {prediction.mostLikelyScore} (
                          {prediction.scoreProbability}%)
                        </Text>
                        <Text style={styles.summaryLine}>
                          Expected goals: {prediction.expectedHomeGoals} -{" "}
                          {prediction.expectedAwayGoals}
                        </Text>
                        <Text style={styles.summaryLine}>
                          Over 2.5: {prediction.over25Percent}% | Both score:{" "}
                          {prediction.bttsPercent}%
                        </Text>
                      </View>
                      <View style={styles.qualityBadge}>
                        <Text style={styles.qualityValue}>
                          {prediction.dataQuality}
                        </Text>
                        <Text style={styles.qualityLabel}>Data</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.unavailableBox}>
                    <Ionicons
                      name="information-circle-outline"
                      size={22}
                      color={theme.subText}
                    />
                    <View style={styles.unavailableCopy}>
                      <Text style={styles.unavailableTitle}>
                        Prediction unavailable
                      </Text>
                      <Text style={styles.unavailableText}>
                        {prediction.reason}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <View style={styles.tagsRow}>
                    {tags.map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <View style={styles.detailsLink}>
                    <Text style={styles.detailsText}>View data</Text>
                    <Ionicons
                      name="chevron-forward"
                      size={15}
                      color={theme.accent}
                    />
                  </View>
                </View>
              </AnimatedGlowCard>
            );
          })
        )}

        <Text style={styles.disclaimer}>
          This statistical forecast uses historical match data and is not betting
          advice. Football remains unpredictable.
        </Text>
        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal
        visible={Boolean(selectedMatch)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedMatch(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Pressable
              style={styles.closeButton}
              onPress={() => setSelectedMatch(null)}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>

            {selectedMatch ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Data-backed match forecast</Text>
                <Text style={styles.modalMatch}>
                  {teamName(selectedMatch.match.homeTeam)} vs{" "}
                  {teamName(selectedMatch.match.awayTeam)}
                </Text>
                <Text style={styles.modalIntro}>
                  This is a probability estimate from real completed-match data,
                  not a known result or a guarantee.
                </Text>

                {selectedMatch.prediction.available ? (
                  <>
                    <ProbabilityRow
                      prediction={selectedMatch.prediction}
                      styles={styles}
                    />
                    <View style={styles.methodCard}>
                      <Text style={styles.methodTitle}>Model output</Text>
                      <Text style={styles.methodText}>
                        Lean: {selectedMatch.prediction.outcome.label} (
                        {Math.round(
                          selectedMatch.prediction.outcome.probability * 100
                        )}
                        %)
                      </Text>
                      <Text style={styles.methodText}>
                        Most likely score:{" "}
                        {selectedMatch.prediction.mostLikelyScore} (
                        {selectedMatch.prediction.scoreProbability}%)
                      </Text>
                      <Text style={styles.methodText}>
                        Expected goals:{" "}
                        {selectedMatch.prediction.expectedHomeGoals} home,{" "}
                        {selectedMatch.prediction.expectedAwayGoals} away
                      </Text>
                      <Text style={styles.methodText}>
                        Over 2.5 goals:{" "}
                        {selectedMatch.prediction.over25Percent}%
                      </Text>
                      <Text style={styles.methodText}>
                        Both teams to score:{" "}
                        {selectedMatch.prediction.bttsPercent}%
                      </Text>
                      <Text style={styles.methodText}>
                        Data quality: {selectedMatch.prediction.dataQuality}
                      </Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.unavailableBox}>
                    <Ionicons
                      name="information-circle-outline"
                      size={22}
                      color={theme.subText}
                    />
                    <View style={styles.unavailableCopy}>
                      <Text style={styles.unavailableTitle}>
                        Prediction unavailable
                      </Text>
                      <Text style={styles.unavailableText}>
                        {selectedMatch.prediction.reason}
                      </Text>
                    </View>
                  </View>
                )}

                <EvidenceCard
                  title={`${teamName(
                    selectedMatch.match.homeTeam
                  )} home-match sample`}
                  evidence={selectedMatch.prediction.homeEvidence}
                  styles={styles}
                />
                <EvidenceCard
                  title={`${teamName(
                    selectedMatch.match.awayTeam
                  )} away-match sample`}
                  evidence={selectedMatch.prediction.awayEvidence}
                  styles={styles}
                />

                <View style={styles.methodCard}>
                  <Text style={styles.methodTitle}>How it is calculated</Text>
                  <Text style={styles.methodText}>
                    The provider supplies up to {SOURCE.window} recent completed
                    home matches for the home team and away matches for the away
                    team. Their real scoring and conceding averages are combined
                    into expected goals, then an independent Poisson score model
                    calculates the displayed probabilities.
                  </Text>
                  <Text style={styles.sourceText}>
                    Source: {SOURCE.provider} | Venue-specific samples
                  </Text>
                </View>
                <View style={styles.modalBottomSpace} />
              </ScrollView>
            ) : null}
          </View>
        </View>
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
      marginBottom: 20,
    },
    eyebrow: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "800",
      letterSpacing: 1.2,
    },
    title: {
      color: theme.text,
      fontSize: 32,
      fontWeight: "800",
      marginTop: 3,
    },
    dataBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      paddingHorizontal: 13,
      paddingVertical: 9,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },
    dataBadgeText: {
      color: theme.accent,
      fontWeight: "800",
      fontSize: 11,
      marginLeft: 6,
    },
    filters: {
      flexGrow: 0,
      marginBottom: 17,
    },
    filterContent: {
      paddingRight: 4,
    },
    filterButton: {
      backgroundColor: theme.card,
      paddingHorizontal: 20,
      paddingVertical: 11,
      borderRadius: 18,
      marginRight: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    activeFilter: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },
    filterText: {
      color: theme.text,
      fontWeight: "600",
    },
    activeFilterText: {
      color: theme.onAccent,
      fontWeight: "800",
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "800",
      marginBottom: 18,
    },
    matchCard: {
      backgroundColor: theme.card,
      borderRadius: 25,
      padding: 17,
      marginBottom: 18,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 18,
    },
    competition: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 14,
      flex: 1,
      marginRight: 12,
    },
    matchTime: {
      color: theme.subText,
      fontSize: 11,
      maxWidth: 142,
      textAlign: "right",
    },
    teamsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    teamBox: {
      alignItems: "center",
      width: "40%",
    },
    logo: {
      width: 58,
      height: 58,
      resizeMode: "contain",
      marginBottom: 9,
    },
    teamName: {
      color: theme.text,
      fontWeight: "700",
      textAlign: "center",
      fontSize: 14,
    },
    versus: {
      color: theme.subText,
      fontWeight: "800",
      fontSize: 15,
    },
    probabilityBox: {
      flexDirection: "row",
      backgroundColor: theme.cardAlt,
      borderRadius: 18,
      paddingVertical: 15,
      marginBottom: 16,
    },
    probabilityColumn: {
      flex: 1,
      alignItems: "center",
    },
    probabilityLabel: {
      color: theme.subText,
      fontSize: 12,
      marginBottom: 5,
    },
    probabilityValue: {
      color: theme.accent,
      fontWeight: "800",
      fontSize: 21,
    },
    forecastSummary: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },
    summaryCopy: {
      flex: 1,
      paddingRight: 10,
    },
    modelLean: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 15,
      marginBottom: 6,
    },
    summaryLine: {
      color: theme.subText,
      fontSize: 12,
      lineHeight: 19,
    },
    qualityBadge: {
      minWidth: 68,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: theme.accent,
      paddingHorizontal: 8,
      paddingVertical: 10,
      alignItems: "center",
    },
    qualityValue: {
      color: theme.accent,
      fontWeight: "800",
      fontSize: 12,
    },
    qualityLabel: {
      color: theme.subText,
      fontSize: 10,
      marginTop: 2,
    },
    unavailableBox: {
      flexDirection: "row",
      backgroundColor: theme.cardAlt,
      borderRadius: 18,
      padding: 15,
      marginBottom: 15,
    },
    unavailableCopy: {
      flex: 1,
      marginLeft: 10,
    },
    unavailableTitle: {
      color: theme.text,
      fontWeight: "800",
      marginBottom: 4,
    },
    unavailableText: {
      color: theme.subText,
      lineHeight: 19,
      fontSize: 12,
    },
    cardFooter: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
    },
    tagsRow: {
      flex: 1,
      flexDirection: "row",
      flexWrap: "wrap",
    },
    tag: {
      backgroundColor: theme.cardAlt,
      borderRadius: 14,
      paddingHorizontal: 9,
      paddingVertical: 5,
      marginRight: 6,
      marginBottom: 4,
    },
    tagText: {
      color: theme.subText,
      fontSize: 10,
      fontWeight: "600",
    },
    detailsLink: {
      flexDirection: "row",
      alignItems: "center",
      marginLeft: 8,
    },
    detailsText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "700",
      marginRight: 2,
    },
    noticeCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 28,
      borderWidth: 1,
      borderColor: theme.border,
    },
    noticeTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "800",
      marginTop: 12,
    },
    noticeText: {
      color: theme.subText,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderRadius: 16,
      marginTop: 16,
    },
    retryText: {
      color: theme.onAccent,
      fontWeight: "800",
    },
    emptyCard: {
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 36,
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyTitle: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 18,
      marginTop: 15,
    },
    emptyText: {
      color: theme.subText,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 20,
    },
    disclaimer: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 17,
      textAlign: "center",
      marginTop: 6,
      paddingHorizontal: 18,
    },
    bottomSpace: {
      height: 120,
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
      maxHeight: "90%",
    },
    closeButton: {
      alignSelf: "flex-end",
      padding: 4,
      marginBottom: 4,
    },
    modalTitle: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "800",
      marginBottom: 7,
    },
    modalMatch: {
      color: theme.accent,
      fontWeight: "800",
      fontSize: 16,
      marginBottom: 10,
    },
    modalIntro: {
      color: theme.subText,
      lineHeight: 20,
      marginBottom: 18,
    },
    evidenceCard: {
      backgroundColor: theme.cardAlt,
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
    },
    evidenceTitle: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 15,
      marginBottom: 10,
    },
    evidenceLine: {
      color: theme.subText,
      lineHeight: 20,
      fontSize: 12,
      marginTop: 2,
    },
    statGrid: {
      flexDirection: "row",
      marginVertical: 11,
    },
    statCell: {
      flex: 1,
      alignItems: "center",
      paddingHorizontal: 3,
    },
    statValue: {
      color: theme.accent,
      fontWeight: "800",
      fontSize: 17,
    },
    statLabel: {
      color: theme.subText,
      fontSize: 9,
      textAlign: "center",
      marginTop: 3,
    },
    methodCard: {
      backgroundColor: theme.cardAlt,
      borderRadius: 20,
      padding: 16,
      marginBottom: 14,
    },
    methodTitle: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 15,
      marginBottom: 9,
    },
    methodText: {
      color: theme.subText,
      lineHeight: 21,
      fontSize: 13,
      marginBottom: 3,
    },
    sourceText: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 10,
    },
    modalBottomSpace: {
      height: 30,
    },
  });
}
