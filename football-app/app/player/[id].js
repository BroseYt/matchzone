import {
  ActivityIndicator,
  Linking,
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
  useState,
} from "react";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import CompetitionLogo from "../../components/CompetitionLogo";
import PlayerJerseyImage from "../../components/PlayerJerseyImage";
import TeamBadge from "../../components/TeamBadge";
import { getPlayerMedia } from "../../services/mediaApi";
import {
  getPlayerCompetitionStats,
  getPlayerDetails,
  getPlayerLookup,
  getPlayerMatchData,
} from "../../services/stats";
import { useAppTheme } from "../../context/ThemeContext";

const PLAYERS_KEY = "favorite_players";
const TABS = ["profile", "matches", "stats", "career"];
const DOMESTIC_COMPETITIONS = {
  Brazil: "BSA",
  England: "PL",
  France: "FL1",
  Germany: "BL1",
  Italy: "SA",
  Netherlands: "DED",
  Portugal: "PPL",
  Spain: "PD",
};

function calculateAge(birthDate) {
  if (!birthDate) return null;

  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();

  if (
    month < 0 ||
    (month === 0 && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }

  return age;
}

function formatDate(value) {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStat(value) {
  return Number.isFinite(value) ? String(value) : "--";
}

function formatHeight(value) {
  const centimeters = Number.parseInt(value, 10);

  if (!Number.isFinite(centimeters)) return "--";

  const totalInches = Math.round(centimeters / 2.54);
  return `${Math.floor(totalInches / 12)} ft ${totalInches % 12} in`;
}

function formatWeight(value) {
  const kilograms = Number.parseInt(value, 10);
  return Number.isFinite(kilograms) ? `${kilograms} kg` : "--";
}

function sumAvailable(rows, key) {
  const values = rows
    .map((row) => row[key])
    .filter(Number.isFinite);

  if (!values.length) return null;
  return values.reduce((total, value) => total + value, 0);
}

function teamName(team) {
  return team?.shortName || team?.name || "TBC";
}

export default function PlayerScreen() {
  const {
    id,
    name,
    teamId: routeTeamId,
    teamName: routeTeamName,
    teamLogo: routeTeamLogo,
    teamArea: routeTeamArea,
    competitionCode: routeCompetitionCode,
    photo: routePlayerPhoto,
  } = useLocalSearchParams();
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [player, setPlayer] = useState(null);
  const [playerMedia, setPlayerMedia] = useState(null);
  const [matchData, setMatchData] = useState({
    matches: [],
    aggregations: null,
    resultSet: null,
  });
  const [competitionStats, setCompetitionStats] = useState([]);
  const [favoritePlayers, setFavoritePlayers] = useState([]);
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const loadFavorites = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(PLAYERS_KEY);
      setFavoritePlayers(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.log("PLAYER FAVORITES ERROR:", error);
    }
  }, []);

  const loadPlayer = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError("");

      const [details, matchesResponse] = await Promise.all([
        getPlayerDetails(id),
        getPlayerMatchData(id),
      ]);

      const finalName = details?.name || name;
      const exactProfile = await getPlayerLookup(finalName);
      const mergedDetails = {
        ...(details || matchesResponse.person || {}),
        ...Object.fromEntries(
          Object.entries(exactProfile || {}).filter(
            ([, value]) => value != null && value !== ""
          )
        ),
        id: details?.id || id,
        name:
          details?.name ||
          name ||
          exactProfile?.name ||
          "Player",
        currentTeam: details?.currentTeam || null,
        photo:
          exactProfile?.photo ||
          details?.photo ||
          routePlayerPhoto ||
          null,
        lastUpdated:
          details?.lastUpdated || new Date().toISOString(),
      };
      const competitionCodes = [
        routeCompetitionCode,
        !routeCompetitionCode
          ? DOMESTIC_COMPETITIONS[
              mergedDetails?.currentTeam?.area?.name
            ]
          : null,
        ...(mergedDetails?.currentTeam?.runningCompetitions || []).map(
          (competition) => competition.code
        ),
        ...(matchesResponse.matches || []).map(
          (match) => match.competition?.code
        ),
      ];

      const [media, stats] = await Promise.all([
        getPlayerMedia(
          finalName,
          routeTeamName ||
            mergedDetails?.currentTeam?.name ||
            mergedDetails?.currentTeam?.shortName ||
            ""
        ),
        getPlayerCompetitionStats(
          id,
          competitionCodes,
          matchesResponse.matches
        ),
      ]);

      setPlayer(mergedDetails);
      setPlayerMedia(media);
      setMatchData(matchesResponse);
      setCompetitionStats(stats);
    } catch (error) {
      console.log("PLAYER ERROR:", error);
      setLoadError("Verified player data could not be loaded right now.");
    } finally {
      setLoading(false);
    }
  }, [
    id,
    name,
    routeCompetitionCode,
    routePlayerPhoto,
    routeTeamName,
  ]);

  useEffect(() => {
    loadPlayer();
  }, [loadPlayer]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const playerName = player?.name || name || "Player";
  const providerCurrentTeam = player?.currentTeam || null;
  const currentTeam = routeTeamName
    ? {
        id: routeTeamId || null,
        name: routeTeamName,
        shortName: routeTeamName,
        crest: routeTeamLogo || null,
        area: routeTeamArea
          ? { name: routeTeamArea }
          : providerCurrentTeam?.area || null,
        runningCompetitions:
          providerCurrentTeam?.name === routeTeamName
            ? providerCurrentTeam.runningCompetitions
            : [],
        contract: providerCurrentTeam?.contract || null,
      }
    : providerCurrentTeam;
  const currentTeamCompetition =
    routeCompetitionCode ||
    currentTeam?.runningCompetitions?.[0]?.code ||
    "";
  const playerPhoto =
    player?.photo ||
    routePlayerPhoto ||
    null;
  const isFavorite = favoritePlayers.some(
    (item) => String(item.id) === String(id)
  );

  const totals = useMemo(() => {
    const aggregates = matchData.aggregations;
    const resultCount = matchData.resultSet?.count;

    return {
      appearances:
        aggregates?.matchesOnPitch ??
        sumAvailable(competitionStats, "playedMatches") ??
        (Number.isFinite(resultCount) ? resultCount : null),
      starts: aggregates?.startingXI ?? null,
      minutes: aggregates?.minutesPlayed ?? null,
      goals:
        aggregates?.goals ??
        sumAvailable(competitionStats, "goals"),
      assists:
        aggregates?.assists ??
        sumAvailable(competitionStats, "assists"),
      penalties:
        aggregates?.penalties ??
        sumAvailable(competitionStats, "penalties"),
      yellowCards: aggregates?.yellowCards ?? null,
      yellowRedCards: aggregates?.yellowRedCards ?? null,
      redCards: aggregates?.redCards ?? null,
    };
  }, [
    competitionStats,
    matchData.aggregations,
    matchData.resultSet,
  ]);

  const goalInvolvements =
    Number.isFinite(totals.goals) &&
    Number.isFinite(totals.assists)
      ? totals.goals + totals.assists
      : null;

  const involvementsPerMatch =
    Number.isFinite(goalInvolvements) &&
    totals.appearances > 0
      ? (goalInvolvements / totals.appearances).toFixed(2)
      : null;

  async function toggleFavorite() {
    const savedPlayer = {
      id,
      name: playerName,
      team: currentTeam?.shortName || currentTeam?.name || "",
      teamId: currentTeam?.id || routeTeamId || "",
      teamLogo: currentTeam?.crest || routeTeamLogo || "",
      teamArea: currentTeam?.area?.name || routeTeamArea || "",
      competitionCode: currentTeamCompetition,
      photo: playerPhoto,
    };

    const updated = isFavorite
      ? favoritePlayers.filter(
          (item) => String(item.id) !== String(id)
        )
      : [...favoritePlayers, savedPlayer];

    setFavoritePlayers(updated);
    await AsyncStorage.setItem(
      PLAYERS_KEY,
      JSON.stringify(updated)
    );
  }

  function openCurrentTeam() {
    if (!currentTeam?.id) return;

    router.push({
      pathname: "/team/[id]",
      params: {
        id: currentTeam.id,
        name: currentTeam.shortName || currentTeam.name,
        logo: currentTeam.crest || "",
        competitionCode: currentTeamCompetition,
      },
    });
  }

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Loading player profile...</Text>
      </View>
    );
  }

  if (loadError && !player) {
    return (
      <View style={styles.loader}>
        <Ionicons
          name="cloud-offline-outline"
          size={48}
          color={theme.danger}
        />
        <Text style={styles.errorTitle}>Profile unavailable</Text>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable style={styles.retryButton} onPress={loadPlayer}>
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.circleButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={27} color={theme.text} />
        </Pressable>

        <View style={styles.profileActions}>
          <Pressable style={styles.actionIcon}>
            <Ionicons
              name="notifications-outline"
              size={21}
              color={theme.text}
            />
          </Pressable>
          <Pressable
            style={[
              styles.followButton,
              isFavorite && styles.followButtonActive,
            ]}
            onPress={toggleFavorite}
          >
            <Text
              style={[
                styles.followButtonText,
                isFavorite && styles.followButtonTextActive,
              ]}
            >
              {isFavorite ? "Following" : "Follow"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <PlayerJerseyImage
            playerId={id}
            playerName={playerName}
            teamName={
              currentTeam?.name ||
              currentTeam?.shortName ||
              routeTeamName ||
              ""
            }
            teamLogo={currentTeam?.crest || routeTeamLogo}
            uri={playerPhoto}
            preferProvided={Boolean(player?.photo)}
            size={82}
            style={styles.playerJersey}
            theme={theme}
            contentFit="cover"
          />
          <View style={styles.headerIdentity}>
            <Text style={styles.playerName}>{playerName}</Text>
            {currentTeam ? (
              <Pressable
                style={styles.headerTeam}
                onPress={openCurrentTeam}
              >
                <TeamBadge
                  team={currentTeam}
                  competitionCode={currentTeamCompetition}
                  size={28}
                  theme={theme}
                />
                <Text style={styles.headerTeamName}>
                  {currentTeam.shortName || currentTeam.name}
                </Text>
              </Pressable>
            ) : (
              <Text style={styles.playerMeta}>
                {player?.position || "Football player"}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.tabButton,
                activeTab === tab && styles.activeTabButton,
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab && styles.activeTabText,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "profile" ? (
          <OverviewTab
            player={player}
            playerMedia={playerMedia}
            currentTeam={currentTeam}
            competitionStats={competitionStats}
            playerName={playerName}
            onTeamPress={openCurrentTeam}
            styles={styles}
            theme={theme}
          />
        ) : null}

        {activeTab === "stats" ? (
          <StatsTab
            totals={totals}
            goalInvolvements={goalInvolvements}
            involvementsPerMatch={involvementsPerMatch}
            competitionStats={competitionStats}
            styles={styles}
            theme={theme}
          />
        ) : null}

        {activeTab === "matches" ? (
          <MatchesTab
            matches={matchData.matches}
            resultSet={matchData.resultSet}
            styles={styles}
            theme={theme}
          />
        ) : null}

        {activeTab === "career" ? (
          <CareerTab
            player={player}
            playerMedia={playerMedia}
            currentTeam={currentTeam}
            competitionStats={competitionStats}
            playerName={playerName}
            onTeamPress={openCurrentTeam}
            styles={styles}
            theme={theme}
          />
        ) : null}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

function OverviewTab({
  player,
  currentTeam,
  competitionStats,
  styles,
  theme,
}) {
  const age = calculateAge(player?.dateOfBirth);
  const facts = [
    {
      value: formatHeight(player?.height),
      label: "Height",
      detail: null,
    },
    {
      value: age ?? "--",
      label: "Age",
      detail: formatDate(player?.dateOfBirth),
    },
    {
      value: player?.nationality || "--",
      label: "Country",
      detail: null,
    },
    {
      value: player?.shirtNumber ?? "--",
      label: "Shirt",
      detail: null,
    },
    {
      value: player?.position || player?.section || "--",
      label: "Position",
      detail: null,
    },
    {
      value: formatWeight(player?.weight),
      label: "Weight",
      detail: null,
    },
  ];

  return (
    <>
      <View style={styles.factsCard}>
        {facts.map((fact) => (
          <View key={fact.label} style={styles.factCell}>
            <Text style={styles.factValue} numberOfLines={1}>
              {fact.value}
            </Text>
            {fact.detail ? (
              <Text style={styles.factDetail}>{fact.detail}</Text>
            ) : null}
            <Text style={styles.factLabel}>{fact.label}</Text>
          </View>
        ))}
      </View>

      {competitionStats.length ? (
        competitionStats.map((entry) => (
          <View
            key={entry.competition?.code || entry.competition?.id}
            style={styles.profileSeasonCard}
          >
            <View style={styles.profileSeasonHeader}>
              <CompetitionLogo
                code={entry.competition?.code}
                uri={entry.competition?.emblem}
                size={34}
                theme={theme}
              />
              <View style={styles.profileSeasonCopy}>
                <Text style={styles.profileSeasonTitle}>
                  {entry.competition?.name}
                </Text>
                <Text style={styles.profileSeasonSubtitle}>
                  {entry.season?.startDate
                    ? `${new Date(
                        entry.season.startDate
                      ).getFullYear()} / ${
                        new Date(
                          entry.season.endDate ||
                            entry.season.startDate
                        ).getFullYear()
                      }`
                    : currentTeam?.name || "Season record"}
                </Text>
              </View>
            </View>

            <View style={styles.profileSeasonStats}>
              <MiniStat
                label="Matches"
                value={formatStat(entry.playedMatches)}
                styles={styles}
              />
              <MiniStat
                label="Goals"
                value={formatStat(entry.goals)}
                styles={styles}
              />
              <MiniStat
                label="Assists"
                value={formatStat(entry.assists)}
                styles={styles}
              />
              <MiniStat
                label="Penalties"
                value={formatStat(entry.penalties)}
                styles={styles}
              />
            </View>
          </View>
        ))
      ) : (
        <EmptyCard
          icon="stats-chart-outline"
          title="Season totals pending"
          text="The profile and headshot are verified. Competition totals will appear when the provider publishes this player in its current-season tables."
          styles={styles}
          theme={theme}
        />
      )}
    </>
  );
}

function CareerTab({
  player,
  playerMedia,
  currentTeam,
  competitionStats,
  playerName,
  onTeamPress,
  styles,
  theme,
}) {
  const contract = currentTeam?.contract;

  return (
    <>
      {currentTeam ? (
        <Pressable style={styles.teamCard} onPress={onTeamPress}>
          <TeamBadge
            team={currentTeam}
            competitionCode={
              currentTeam.runningCompetitions?.[0]?.code
            }
            size={58}
            theme={theme}
          />
          <View style={styles.teamCopy}>
            <Text style={styles.cardEyebrow}>CURRENT TEAM</Text>
            <Text style={styles.teamName}>
              {currentTeam.name}
            </Text>
            <Text style={styles.teamArea}>
              {currentTeam.area?.name || "Club profile"}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.subText}
          />
        </Pressable>
      ) : null}

      <SectionCard
        title="Career Details"
        icon="person-outline"
        styles={styles}
        theme={theme}
      >
        <StatRow title="Full name" value={playerName} styles={styles} />
        <StatRow
          title="First name"
          value={player?.firstName || "Unavailable"}
          styles={styles}
        />
        <StatRow
          title="Last name"
          value={player?.lastName || "Unavailable"}
          styles={styles}
        />
        <StatRow
          title="Date of birth"
          value={formatDate(player?.dateOfBirth)}
          styles={styles}
        />
        <StatRow
          title="Nationality"
          value={
            player?.nationality ||
            playerMedia?.nationality ||
            "Unavailable"
          }
          styles={styles}
        />
        <StatRow
          title="Birth location"
          value={
            player?.birthPlace ||
            playerMedia?.birthLocation ||
            "Unavailable"
          }
          styles={styles}
        />
        <StatRow
          title="Height"
          value={formatHeight(player?.height)}
          styles={styles}
        />
        <StatRow
          title="Weight"
          value={formatWeight(player?.weight)}
          styles={styles}
        />
        <StatRow
          title="Position"
          value={player?.position || "Unavailable"}
          styles={styles}
        />
        <StatRow
          title="Squad section"
          value={player?.section || "Unavailable"}
          styles={styles}
        />
        <StatRow
          title="Shirt number"
          value={player?.shirtNumber ?? "Unavailable"}
          styles={styles}
          last
        />
      </SectionCard>

      {contract?.start || contract?.until ? (
        <SectionCard
          title="Contract"
          icon="document-text-outline"
          styles={styles}
          theme={theme}
        >
          <StatRow
            title="Start"
            value={contract.start || "Unavailable"}
            styles={styles}
          />
          <StatRow
            title="Until"
            value={contract.until || "Unavailable"}
            styles={styles}
            last
          />
        </SectionCard>
      ) : null}

      {competitionStats.length ? (
        <SectionCard
          title="Season Competitions"
          icon="trophy-outline"
          styles={styles}
          theme={theme}
        >
          <View style={styles.competitionChips}>
            {competitionStats.map((entry) => (
              <View
                key={
                  entry.competition?.id ||
                  entry.competition?.code
                }
                style={styles.competitionChip}
              >
                <CompetitionLogo
                  code={entry.competition?.code}
                  uri={entry.competition?.emblem}
                  size={28}
                  theme={theme}
                />
                <Text style={styles.competitionChipText}>
                  {entry.competition?.name}
                </Text>
              </View>
            ))}
          </View>
        </SectionCard>
      ) : null}

      {playerMedia?.description ? (
        <SectionCard
          title="Biography"
          icon="newspaper-outline"
          styles={styles}
          theme={theme}
        >
          <Text style={styles.bioText}>
            {playerMedia.description}
          </Text>
          {playerMedia.sourceUrl ? (
            <Pressable
              onPress={() =>
                Linking.openURL(playerMedia.sourceUrl)
              }
            >
              <Text style={styles.mediaSource}>
                {playerMedia.attribution}
              </Text>
            </Pressable>
          ) : null}
        </SectionCard>
      ) : null}

      <Text style={styles.updatedText}>
        Profile updated: {formatDate(player?.lastUpdated)}
      </Text>
    </>
  );
}

function StatsTab({
  totals,
  goalInvolvements,
  involvementsPerMatch,
  competitionStats,
  styles,
  theme,
}) {
  return (
    <>
      <SectionCard
        title="Season Summary"
        icon="stats-chart-outline"
        styles={styles}
        theme={theme}
      >
        <View style={styles.statGrid}>
          <GridStat
            label="Appearances"
            value={formatStat(totals.appearances)}
            styles={styles}
          />
          <GridStat
            label="Starts"
            value={formatStat(totals.starts)}
            styles={styles}
          />
          <GridStat
            label="Minutes"
            value={formatStat(totals.minutes)}
            styles={styles}
          />
          <GridStat
            label="Goals"
            value={formatStat(totals.goals)}
            styles={styles}
          />
          <GridStat
            label="Assists"
            value={formatStat(totals.assists)}
            styles={styles}
          />
          <GridStat
            label="Penalties"
            value={formatStat(totals.penalties)}
            styles={styles}
          />
          <GridStat
            label="Goal involvements"
            value={formatStat(goalInvolvements)}
            styles={styles}
          />
          <GridStat
            label="Involvements / match"
            value={involvementsPerMatch || "--"}
            styles={styles}
          />
        </View>
      </SectionCard>

      <SectionCard
        title="Discipline"
        icon="albums-outline"
        styles={styles}
        theme={theme}
      >
        <View style={styles.disciplineRow}>
          <DisciplineStat
            label="Yellow"
            value={formatStat(totals.yellowCards)}
            color={theme.warning}
            styles={styles}
          />
          <DisciplineStat
            label="Second yellow"
            value={formatStat(totals.yellowRedCards)}
            color={theme.gold}
            styles={styles}
          />
          <DisciplineStat
            label="Red"
            value={formatStat(totals.redCards)}
            color={theme.danger}
            styles={styles}
          />
        </View>
      </SectionCard>

      <Text style={styles.contentTitle}>By Competition</Text>

      {competitionStats.length ? (
        competitionStats.map((entry) => (
          <View
            key={entry.competition?.code || entry.competition?.id}
            style={styles.competitionStatCard}
          >
            <View style={styles.competitionStatHeader}>
              <CompetitionLogo
                code={entry.competition?.code}
                uri={entry.competition?.emblem}
                size={38}
                theme={theme}
              />
              <View style={styles.competitionStatCopy}>
                <Text style={styles.competitionStatName}>
                  {entry.competition?.name}
                </Text>
                <Text style={styles.competitionSeason}>
                  {entry.season?.startDate
                    ? `${formatDate(entry.season.startDate)} season`
                    : "Current season"}
                </Text>
              </View>
            </View>

            <View style={styles.competitionNumbers}>
              <MiniStat
                label="Matches"
                value={formatStat(entry.playedMatches)}
                styles={styles}
              />
              <MiniStat
                label="Goals"
                value={formatStat(entry.goals)}
                styles={styles}
              />
              <MiniStat
                label="Assists"
                value={formatStat(entry.assists)}
                styles={styles}
              />
              <MiniStat
                label="Pens"
                value={formatStat(entry.penalties)}
                styles={styles}
              />
            </View>
          </View>
        ))
      ) : (
        <EmptyCard
          icon="analytics-outline"
          title="Scorer totals unavailable"
          text="This player is not present in the scorer tables returned for the available competitions."
          styles={styles}
          theme={theme}
        />
      )}

      <View style={styles.dataNotice}>
        <Ionicons
          name="shield-checkmark-outline"
          size={24}
          color={theme.accent}
        />
        <View style={styles.dataNoticeCopy}>
          <Text style={styles.dataNoticeTitle}>
            Verified statistics only
          </Text>
          <Text style={styles.dataNoticeText}>
            Ratings, xG, xA, shot maps, touches, duels and detailed
            player traits are not supplied by the current licensed data
            plan, so MatchZone does not create placeholder values.
          </Text>
        </View>
      </View>
    </>
  );
}

function MatchesTab({
  matches,
  resultSet,
  styles,
  theme,
}) {
  return (
    <>
      <View style={styles.matchSummary}>
        <View>
          <Text style={styles.contentTitle}>Player Match Record</Text>
          <Text style={styles.matchSummaryText}>
            {Number.isFinite(resultSet?.count)
              ? `${resultSet.count} verified matches returned`
              : "Verified matches returned by the provider"}
          </Text>
        </View>
        <Ionicons
          name="calendar-outline"
          size={24}
          color={theme.accent}
        />
      </View>

      {matches.length ? (
        matches.map((match) => (
          <Pressable
            key={match.id}
            style={styles.matchCard}
            onPress={() =>
              router.push({
                pathname: "/match/[id]",
                params: { id: match.id },
              })
            }
          >
            <View style={styles.matchTop}>
              <View style={styles.matchCompetitionRow}>
                <CompetitionLogo
                  code={match.competition?.code}
                  uri={match.competition?.emblem}
                  size={26}
                  theme={theme}
                />
                <Text
                  style={styles.matchCompetition}
                  numberOfLines={1}
                >
                  {match.competition?.name || "Competition"}
                </Text>
              </View>
              <Text style={styles.matchDate}>
                {formatDate(match.utcDate)}
              </Text>
            </View>

            <View style={styles.matchTeams}>
              <MatchTeam
                team={match.homeTeam}
                competitionCode={match.competition?.code}
                styles={styles}
                theme={theme}
              />
              <View style={styles.matchCenter}>
                <Text style={styles.matchScore}>
                  {match.score?.fullTime?.home ?? "-"} -{" "}
                  {match.score?.fullTime?.away ?? "-"}
                </Text>
                <Text style={styles.matchStatus}>
                  {match.status?.replaceAll("_", " ")}
                </Text>
              </View>
              <MatchTeam
                team={match.awayTeam}
                competitionCode={match.competition?.code}
                styles={styles}
                theme={theme}
              />
            </View>
          </Pressable>
        ))
      ) : (
        <EmptyCard
          icon="calendar-outline"
          title="No player matches available"
          text="The provider has not returned a verified match record for this player."
          styles={styles}
          theme={theme}
        />
      )}
    </>
  );
}

function SectionCard({
  title,
  icon,
  children,
  styles,
  theme,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons name={icon} size={21} color={theme.accent} />
      </View>
      {children}
    </View>
  );
}

function GridStat({ label, value, styles }) {
  return (
    <View style={styles.gridStat}>
      <Text style={styles.gridValue}>{value}</Text>
      <Text style={styles.gridLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({ label, value, styles }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

function DisciplineStat({
  label,
  value,
  color,
  styles,
}) {
  return (
    <View style={styles.disciplineStat}>
      <View
        style={[
          styles.cardIndicator,
          { backgroundColor: color },
        ]}
      />
      <Text style={styles.disciplineValue}>{value}</Text>
      <Text style={styles.disciplineLabel}>{label}</Text>
    </View>
  );
}

function StatRow({
  title,
  value,
  styles,
  last = false,
}) {
  return (
    <View style={[styles.row, last && styles.lastRow]}>
      <Text style={styles.left}>{title}</Text>
      <Text style={styles.right}>{String(value)}</Text>
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
    <View style={styles.matchTeam}>
      <TeamBadge
        team={team}
        competitionCode={competitionCode}
        size={40}
        theme={theme}
      />
      <Text style={styles.matchTeamName} numberOfLines={2}>
        {teamName(team)}
      </Text>
    </View>
  );
}

function EmptyCard({
  icon,
  title,
  text,
  styles,
  theme,
}) {
  return (
    <View style={styles.emptyCard}>
      <Ionicons name={icon} size={42} color={theme.border} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
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
      paddingHorizontal: 30,
    },
    loadingText: {
      color: theme.subText,
      marginTop: 14,
    },
    errorTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "800",
      marginTop: 15,
    },
    errorText: {
      color: theme.subText,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 20,
    },
    retryButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: 22,
      paddingVertical: 11,
      borderRadius: 17,
      marginTop: 18,
    },
    retryText: {
      color: theme.onAccent,
      fontWeight: "800",
    },
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 18,
      marginBottom: 26,
      zIndex: 5,
    },
    circleButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },
    profileActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      padding: 4,
      borderRadius: 27,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    actionIcon: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 20,
    },
    followButton: {
      minHeight: 40,
      justifyContent: "center",
      paddingHorizontal: 17,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.text,
    },
    followButtonActive: {
      borderColor: theme.accent,
      backgroundColor: theme.cardAlt,
    },
    followButtonText: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "900",
    },
    followButtonTextActive: {
      color: theme.accent,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 22,
      marginBottom: 26,
    },
    playerJersey: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: theme.card,
      borderWidth: 2,
      borderColor: theme.accent,
      marginRight: 16,
    },
    headerIdentity: {
      flex: 1,
    },
    playerName: {
      color: theme.text,
      fontSize: 27,
      fontWeight: "900",
      letterSpacing: -0.7,
    },
    headerTeam: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 8,
      marginTop: 9,
    },
    headerTeamName: {
      color: theme.subText,
      fontSize: 15,
      fontWeight: "800",
    },
    playerMeta: {
      color: theme.subText,
      marginTop: 7,
      fontSize: 13,
    },
    tabs: {
      flexDirection: "row",
      paddingHorizontal: 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      marginBottom: 20,
    },
    tabButton: {
      flex: 1,
      paddingBottom: 13,
      alignItems: "center",
      borderBottomWidth: 3,
      borderBottomColor: "transparent",
    },
    activeTabButton: {
      borderBottomColor: theme.accent,
    },
    tabText: {
      color: theme.subText,
      fontWeight: "700",
      fontSize: 12,
    },
    activeTabText: {
      color: theme.text,
      fontWeight: "900",
    },
    factsCard: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: 18,
      marginBottom: 16,
      paddingVertical: 8,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    factCell: {
      width: "33.333%",
      minHeight: 82,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      paddingVertical: 9,
    },
    factValue: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "900",
      textAlign: "center",
    },
    factDetail: {
      color: theme.subText,
      fontSize: 10,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 3,
    },
    factLabel: {
      color: theme.subText,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
      marginTop: 5,
    },
    profileSeasonCard: {
      marginHorizontal: 18,
      marginBottom: 14,
      padding: 18,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },
    profileSeasonHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 18,
    },
    profileSeasonCopy: {
      flex: 1,
      marginLeft: 11,
    },
    profileSeasonTitle: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "900",
    },
    profileSeasonSubtitle: {
      color: theme.subText,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 3,
    },
    profileSeasonStats: {
      flexDirection: "row",
      justifyContent: "space-between",
      backgroundColor: theme.cardAlt,
      borderRadius: 16,
      paddingVertical: 12,
    },
    teamCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 22,
      marginHorizontal: 18,
      padding: 17,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    teamCopy: {
      flex: 1,
      marginLeft: 14,
    },
    cardEyebrow: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1.1,
    },
    teamName: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "800",
      marginTop: 3,
    },
    teamArea: {
      color: theme.subText,
      fontSize: 11,
      marginTop: 3,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 22,
      marginHorizontal: 18,
      padding: 18,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      paddingVertical: 13,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    lastRow: {
      borderBottomWidth: 0,
      paddingBottom: 2,
    },
    left: {
      color: theme.subText,
      maxWidth: "42%",
      fontSize: 12,
    },
    right: {
      color: theme.text,
      fontWeight: "700",
      maxWidth: "56%",
      textAlign: "right",
      fontSize: 12,
    },
    competitionChips: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    competitionChip: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.cardAlt,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 9,
      marginRight: 8,
      marginBottom: 8,
    },
    competitionChipText: {
      color: theme.text,
      fontSize: 11,
      fontWeight: "700",
      marginLeft: 7,
      maxWidth: 180,
    },
    bioText: {
      color: theme.subText,
      lineHeight: 22,
      fontSize: 13,
    },
    mediaSource: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 12,
    },
    updatedText: {
      color: theme.subText,
      textAlign: "center",
      fontSize: 10,
      marginBottom: 10,
    },
    statGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginHorizontal: -4,
    },
    gridStat: {
      width: "50%",
      paddingHorizontal: 4,
      marginBottom: 8,
    },
    gridValue: {
      color: theme.accent,
      fontSize: 21,
      fontWeight: "900",
      backgroundColor: theme.cardAlt,
      borderTopLeftRadius: 15,
      borderTopRightRadius: 15,
      paddingTop: 12,
      textAlign: "center",
    },
    gridLabel: {
      color: theme.subText,
      fontSize: 10,
      backgroundColor: theme.cardAlt,
      borderBottomLeftRadius: 15,
      borderBottomRightRadius: 15,
      paddingTop: 3,
      paddingBottom: 12,
      textAlign: "center",
    },
    disciplineRow: {
      flexDirection: "row",
    },
    disciplineStat: {
      flex: 1,
      alignItems: "center",
    },
    cardIndicator: {
      width: 18,
      height: 24,
      borderRadius: 3,
      marginBottom: 8,
    },
    disciplineValue: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
    },
    disciplineLabel: {
      color: theme.subText,
      fontSize: 9,
      textAlign: "center",
      marginTop: 3,
    },
    contentTitle: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "900",
      marginHorizontal: 18,
      marginBottom: 12,
    },
    competitionStatCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      marginHorizontal: 18,
      padding: 17,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 13,
    },
    competitionStatHeader: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 15,
    },
    competitionStatCopy: {
      marginLeft: 11,
      flex: 1,
    },
    competitionStatName: {
      color: theme.text,
      fontWeight: "800",
    },
    competitionSeason: {
      color: theme.subText,
      fontSize: 10,
      marginTop: 3,
    },
    competitionNumbers: {
      flexDirection: "row",
      backgroundColor: theme.cardAlt,
      borderRadius: 16,
      paddingVertical: 12,
    },
    miniStat: {
      flex: 1,
      alignItems: "center",
    },
    miniValue: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "900",
    },
    miniLabel: {
      color: theme.subText,
      fontSize: 9,
      marginTop: 3,
    },
    dataNotice: {
      flexDirection: "row",
      backgroundColor: theme.cardAlt,
      borderRadius: 20,
      marginHorizontal: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 4,
    },
    dataNoticeCopy: {
      flex: 1,
      marginLeft: 11,
    },
    dataNoticeTitle: {
      color: theme.text,
      fontWeight: "800",
      marginBottom: 5,
    },
    dataNoticeText: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 18,
    },
    matchSummary: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 5,
      paddingRight: 18,
    },
    matchSummaryText: {
      color: theme.subText,
      fontSize: 11,
      marginHorizontal: 18,
      marginTop: -7,
      marginBottom: 12,
    },
    matchCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      padding: 16,
      marginHorizontal: 18,
      marginBottom: 13,
      borderWidth: 1,
      borderColor: theme.border,
    },
    matchTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    matchCompetitionRow: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 10,
    },
    matchCompetition: {
      color: theme.subText,
      fontSize: 10,
      fontWeight: "700",
      marginLeft: 7,
      flex: 1,
    },
    matchDate: {
      color: theme.subText,
      fontSize: 10,
    },
    matchTeams: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    matchTeam: {
      width: 92,
      alignItems: "center",
    },
    matchTeamName: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 11,
      textAlign: "center",
      marginTop: 7,
    },
    matchCenter: {
      alignItems: "center",
      flex: 1,
    },
    matchScore: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
    },
    matchStatus: {
      color: theme.accent,
      fontSize: 9,
      fontWeight: "800",
      marginTop: 5,
    },
    emptyCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      marginHorizontal: 18,
      padding: 28,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "800",
      marginTop: 13,
      textAlign: "center",
    },
    emptyText: {
      color: theme.subText,
      textAlign: "center",
      marginTop: 7,
      lineHeight: 19,
      fontSize: 11,
    },
    bottomSpace: {
      height: 90,
    },
  });
}
