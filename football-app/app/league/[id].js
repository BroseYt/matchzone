import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
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

import CompetitionLogo from "../../components/CompetitionLogo";
import TeamBadge from "../../components/TeamBadge";

import {
  getCompetitionTeams,
  getLeagueFixtures,
  getLeagueStandings,
} from "../../services/matches";

import {
  buildWorldCupStandings,
  WORLD_CUP_SEASON,
  mergeWorldCupTeams,
} from "../../constants/worldCup2026";

import {
  competitionHasStandings,
  getCompetition,
  getCompetitionSeason,
  isExtendedCompetition,
} from "../../constants/competitions";

import {
  getCompetitionLegend,
  getQualificationZone,
} from "../../constants/qualificationRules";

import {
  useAppTheme,
} from "../../context/ThemeContext";

const CLUBS_KEY = "favorite_clubs";

function TeamLogo({ uri, name, isWorldCup, style, theme }) {
  return (
    <TeamBadge
      uri={uri}
      name={name}
      competitionCode={isWorldCup ? "WC" : undefined}
      variant={isWorldCup ? "flag" : undefined}
      size={48}
      style={style}
      theme={theme}
    />
  );
}

function teamsFromFixtures(fixtures) {
  const teams = new Map();

  fixtures.forEach((match) => {
    [match.homeTeam, match.awayTeam].forEach((team) => {
      if (team?.id) teams.set(String(team.id), team);
    });
  });

  return [...teams.values()].sort((a, b) =>
    String(a.name || "").localeCompare(String(b.name || ""))
  );
}

export default function LeagueDetails() {
  const { id, name } = useLocalSearchParams();

  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const isWorldCup = id === "WC";
  const isExtended = isExtendedCompetition(id);
  const hasStandings = competitionHasStandings(id);
  const competitionMeta = getCompetition(id);

  const [activeTab, setActiveTab] = useState("teams");
  const [standings, setStandings] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [competitionTeams, setCompetitionTeams] = useState([]);
  const [competition, setCompetition] = useState(null);
  const [season, setSeason] = useState(null);
  const [favoriteClubs, setFavoriteClubs] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);

      const selectedSeason = isWorldCup
        ? WORLD_CUP_SEASON
        : isExtended
        ? getCompetitionSeason(id)
        : undefined;

      const [
        standingsData,
        fixtureData,
        teamsData,
      ] = await Promise.all([
        !hasStandings
          ? Promise.resolve([])
          : getLeagueStandings(id, selectedSeason),
        getLeagueFixtures(id, selectedSeason),
        isExtended
          ? Promise.resolve({
              teams: [],
              competition: null,
              season: null,
            })
          : getCompetitionTeams(id, selectedSeason),
      ]);

      setStandings((current) =>
        standingsData?.length || showLoader
          ? standingsData || []
          : current
      );
      setFixtures((current) =>
        fixtureData?.length || showLoader
          ? fixtureData || []
          : current
      );
      const latestTeams = isExtended
        ? teamsFromFixtures(fixtureData || [])
        : teamsData.teams || [];
      setCompetitionTeams((current) =>
        latestTeams.length || showLoader ? latestTeams : current
      );
      setCompetition(
        isExtended
          ? fixtureData?.[0]?.competition || {
              name: competitionMeta?.name,
              code: id,
              emblem: competitionMeta?.logo,
            }
          : teamsData.competition || null
      );
      setSeason(
        isExtended
          ? fixtureData?.[0]?.season || null
          : teamsData.season || null
      );
    } catch (error) {
      console.log("LEAGUE DETAILS ERROR:", error);
      if (showLoader) {
        setStandings([]);
        setFixtures([]);
        setCompetitionTeams([]);
      }
    } finally {
      setLoading(false);
    }
  }, [
    competitionMeta?.logo,
    competitionMeta?.name,
    hasStandings,
    id,
    isExtended,
    isWorldCup,
  ]);

  const loadFavoriteClubs = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(CLUBS_KEY);
      setFavoriteClubs(saved ? JSON.parse(saved) : []);
    } catch (error) {
      console.log("LOAD CLUB FAVORITES ERROR:", error);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadFavoriteClubs();
  }, [loadData, loadFavoriteClubs]);

  useEffect(() => {
    const hasLiveFixture = fixtures.some((match) =>
      ["IN_PLAY", "PAUSED"].includes(match.status)
    );
    const interval = setInterval(
      () => loadData(false),
      isWorldCup ? 60000 : hasLiveFixture ? 30000 : 300000
    );

    return () => clearInterval(interval);
  }, [fixtures, isWorldCup, loadData]);

  async function toggleClubFavorite(team, logo) {
    if (!team?.id) return;

    const club = {
      id: team.id,
      name: team.shortName || team.name,
      logo: logo || team.crest,
      competitionCode: isWorldCup ? "WC" : id,
    };

    const exists = favoriteClubs.some(
      (item) => String(item.id) === String(club.id)
    );

    const updated = exists
      ? favoriteClubs.filter(
          (item) => String(item.id) !== String(club.id)
        )
      : [...favoriteClubs, club];

    setFavoriteClubs(updated);

    await AsyncStorage.setItem(
      CLUBS_KEY,
      JSON.stringify(updated)
    );
  }

  function openTeam(team, logo) {
    if (!team?.id) return;

    router.push({
      pathname: "/team/[id]",
      params: {
        id: team.id,
        name: team.shortName || team.name,
        logo: logo || team.crest,
        competitionCode: isWorldCup ? "WC" : id,
      },
    });
  }

  const worldCupTeams = useMemo(
    () => mergeWorldCupTeams(competitionTeams),
    [competitionTeams]
  );

  const worldCupGroups = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const group = String.fromCharCode(65 + index);

        return {
          group,
          teams: worldCupTeams.filter(
            (team) => team.group === group
          ),
        };
      }),
    [worldCupTeams]
  );

  const sortedFixtures = useMemo(
    () =>
      [...fixtures].sort(
        (a, b) =>
          new Date(a.utcDate).getTime() -
          new Date(b.utcDate).getTime()
      ),
    [fixtures]
  );

  const upcomingFixtures = useMemo(
    () =>
      sortedFixtures.filter(
        (match) =>
          match.status !== "FINISHED" &&
          match.status !== "CANCELLED" &&
          match.status !== "POSTPONED"
      ),
    [sortedFixtures]
  );

  const completedFixtures = useMemo(
    () =>
      sortedFixtures
        .filter((match) => match.status === "FINISHED")
        .reverse(),
    [sortedFixtures]
  );

  const tabs = !hasStandings
    ? ["teams", "fixtures"]
    : ["teams", "fixtures", "table"];

  const displayStandings = useMemo(
    () => {
      if (isWorldCup) {
        return buildWorldCupStandings(
          competitionTeams,
          fixtures
        );
      }

      return standings.filter(
        (standing) =>
          standing.type === "TOTAL" || !standing.type
      );
    },
    [competitionTeams, fixtures, isWorldCup, standings]
  );

  const qualificationLegend = useMemo(
    () => getCompetitionLegend(id),
    [id]
  );

  const seasonLabel = isWorldCup
    ? "Canada, Mexico and USA 2026"
    : season?.startDate
    ? `${new Date(season.startDate).getFullYear()} / ${new Date(
        season.endDate
      ).getFullYear()}`
    : "Current Season";

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

        <View style={styles.seasonBadge}>
          {loading ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : (
            <Ionicons
              name="calendar-outline"
              size={16}
              color={theme.accent}
            />
          )}

          <Text style={styles.seasonBadgeText}>
            {isWorldCup ? "11 Jun - 19 Jul" : "Season"}
          </Text>
        </View>
      </View>

      <View style={styles.header}>
        <CompetitionLogo
          code={id}
          uri={competition?.emblem || competitionMeta?.logo}
          size={78}
          theme={theme}
        />

        <View style={styles.headerText}>
          <Text style={styles.name}>
            {name || competition?.name || "Competition"}
          </Text>

          <Text style={styles.country}>
            {seasonLabel}
          </Text>

          {isWorldCup && (
            <View style={styles.headerStats}>
              <Text style={styles.headerStat}>
                48 teams
              </Text>

              <Text style={styles.headerDot}>
                {"\u2022"}
              </Text>

              <Text style={styles.headerStat}>
                12 groups
              </Text>

              <Text style={styles.headerDot}>
                {"\u2022"}
              </Text>

              <Text style={styles.headerStat}>
                104 matches
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tabButton,
              activeTab === tab && styles.activeTabButton,
            ]}
          >
            <Ionicons
              name={
                tab === "teams"
                  ? "people"
                  : tab === "fixtures"
                  ? "calendar"
                  : "stats-chart"
              }
              size={20}
              color={
                activeTab === tab
                  ? theme.background
                  : theme.subText
              }
            />

            <Text
              style={
                activeTab === tab
                  ? styles.activeTab
                  : styles.tab
              }
            >
              {tab === "table"
                ? "Table"
                : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === "teams" && (
          <>
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionTitle}>
                {isWorldCup
                  ? "Qualified Countries"
                  : "Participating Teams"}
              </Text>

              <Text style={styles.sectionSubtitle}>
                {isWorldCup
                  ? "All 48 nations in the FIFA World Cup 2026 final draw."
                  : `${competitionTeams.length} teams in this competition.`}
              </Text>
            </View>

            {isWorldCup ? (
              worldCupGroups.map((group) => (
                <WorldCupGroup
                  key={group.group}
                  group={group}
                  favoriteClubs={favoriteClubs}
                  onTeamPress={openTeam}
                  onFavorite={toggleClubFavorite}
                  styles={styles}
                  theme={theme}
                />
              ))
            ) : competitionTeams.length ? (
              <TeamDirectory
                teams={competitionTeams}
                favoriteClubs={favoriteClubs}
                onTeamPress={openTeam}
                onFavorite={toggleClubFavorite}
                styles={styles}
                theme={theme}
              />
            ) : (
              <EmptyState
                icon="people-outline"
                title="Teams unavailable"
                text="The data provider has not returned the team list for this competition."
                styles={styles}
                theme={theme}
              />
            )}
          </>
        )}

        {activeTab === "table" && hasStandings && (
          <>
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionTitle}>
                {isWorldCup
                  ? "Group Tables"
                  : "League Table"}
              </Text>

              <Text style={styles.sectionSubtitle}>
                {displayStandings.length
                  ? isWorldCup
                    ? "Points and goal statistics update after every completed group match."
                    : "Updated from the latest competition results."
                  : "Standings will update when match results are available."}
              </Text>
            </View>

            {qualificationLegend.length > 0 && (
              <QualificationLegend
                items={qualificationLegend}
                styles={styles}
              />
            )}

            {displayStandings.length === 0 ? (
              <EmptyState
                icon="stats-chart-outline"
                title="Standings coming soon"
                text="The data provider has not returned a table for this competition."
                styles={styles}
                theme={theme}
              />
            ) : (
              displayStandings.map((standing, index) => (
                <StandingTable
                  key={`${standing.group || standing.stage}-${index}`}
                  standing={standing}
                  competitionCode={id}
                  favoriteClubs={favoriteClubs}
                  onTeamPress={openTeam}
                  onFavorite={toggleClubFavorite}
                  styles={styles}
                  theme={theme}
                />
              ))
            )}
          </>
        )}

        {activeTab === "fixtures" && (
          <>
            <View style={styles.sectionIntro}>
              <Text style={styles.sectionTitle}>
                Matches
              </Text>

              <Text style={styles.sectionSubtitle}>
                Upcoming fixtures first, followed by the latest results.
              </Text>
            </View>

            {upcomingFixtures.length > 0 && (
              <MatchSection
                title="Upcoming Matches"
                matches={upcomingFixtures}
                isWorldCup={isWorldCup}
                styles={styles}
                theme={theme}
              />
            )}

            {completedFixtures.length > 0 && (
              <MatchSection
                title="Latest Results"
                matches={completedFixtures}
                isWorldCup={isWorldCup}
                styles={styles}
                theme={theme}
              />
            )}

            {fixtures.length === 0 && (
              <EmptyState
                icon="calendar-outline"
                title="Fixtures unavailable"
                text={
                  isWorldCup
                    ? "The World Cup schedule will appear here as soon as the football data provider returns the 2026 fixtures."
                    : "No fixtures were returned for this competition."
                }
                styles={styles}
                theme={theme}
              />
            )}
          </>
        )}

        <View style={{ height: 70 }} />
      </ScrollView>
    </View>
  );
}

function WorldCupGroup({
  group,
  favoriteClubs,
  onTeamPress,
  onFavorite,
  styles,
  theme,
}) {
  return (
    <View style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Text style={styles.groupTitle}>
          Group {group.group}
        </Text>

        <Text style={styles.groupCount}>
          4 teams
        </Text>
      </View>

      {group.teams.map((country) => {
        const isFavorite = favoriteClubs.some(
          (item) =>
            String(item.id) === String(country.id)
        );

        return (
          <Pressable
            key={country.code}
            style={styles.countryRow}
            onPress={() =>
              onTeamPress(country.apiTeam, country.flag)
            }
            disabled={!country.id}
          >
            <TeamLogo
              uri={country.flag}
              name={country.name}
              isWorldCup
              style={styles.countryFlag}
              styles={styles}
              theme={theme}
            />

            <Text style={styles.countryName}>
              {country.name}
            </Text>

            {country.id && (
              <>
                <Pressable
                  style={styles.favoriteBtn}
                  onPress={(event) => {
                    event.stopPropagation();
                    onFavorite(
                      country.apiTeam,
                      country.flag
                    );
                  }}
                >
                  <Ionicons
                    name={
                      isFavorite
                        ? "star"
                        : "star-outline"
                    }
                    size={20}
                    color={theme.gold}
                  />
                </Pressable>

                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={theme.subText}
                />
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function TeamDirectory({
  teams,
  favoriteClubs,
  onTeamPress,
  onFavorite,
  styles,
  theme,
}) {
  return (
    <View style={styles.teamDirectory}>
      {teams.map((team) => {
        const isFavorite = favoriteClubs.some(
          (item) =>
            String(item.id) === String(team.id)
        );

        return (
          <Pressable
            key={team.id}
            style={styles.directoryRow}
            onPress={() => onTeamPress(team)}
          >
            <TeamLogo
              uri={team.crest}
              name={team.shortName || team.name}
              style={styles.directoryLogo}
              styles={styles}
              theme={theme}
            />

            <View style={styles.directoryText}>
              <Text
                style={styles.directoryName}
                numberOfLines={1}
              >
                {team.shortName || team.name}
              </Text>

              <Text style={styles.directoryMeta}>
                {team.area?.name ||
                  team.tla ||
                  "Competition team"}
              </Text>
            </View>

            <Pressable
              style={styles.favoriteBtn}
              onPress={(event) => {
                event.stopPropagation();
                onFavorite(team);
              }}
            >
              <Ionicons
                name={
                  isFavorite
                    ? "star"
                    : "star-outline"
                }
                size={20}
                color={theme.gold}
              />
            </Pressable>

            <Ionicons
              name="chevron-forward"
              size={18}
              color={theme.subText}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

function QualificationLegend({
  items,
  styles,
}) {
  return (
    <View style={styles.legendCard}>
      <Text style={styles.legendTitle}>
        Qualification and relegation
      </Text>

      <View style={styles.legendItems}>
        {items.map((item) => (
          <View
            key={item.id}
            style={styles.legendItem}
          >
            <View
              style={[
                styles.legendDot,
                {
                  backgroundColor: item.color,
                },
              ]}
            />

            <Text style={styles.legendText}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StandingTable({
  standing,
  competitionCode,
  favoriteClubs,
  onTeamPress,
  onFavorite,
  styles,
  theme,
}) {
  const title = standing.group
    ? standing.group.replace("_", " ")
    : standing.stage?.replaceAll("_", " ") || "Standings";

  return (
    <View style={styles.tableCard}>
      <Text style={styles.tableTitle}>
        {title}
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tableContent}
      >
        <View style={styles.tableInner}>
          <View style={styles.tableHeader}>
            <Text style={styles.headerPos}>#</Text>
            <Text style={styles.headerTeam}>Team</Text>
            <Text style={styles.headerSmall}>PL</Text>
            <Text style={styles.headerSmall}>W</Text>
            <Text style={styles.headerSmall}>D</Text>
            <Text style={styles.headerSmall}>L</Text>
            <Text style={styles.headerSmall}>GD</Text>
            <Text style={styles.headerSmall}>PTS</Text>
            <View style={styles.starSpace} />
          </View>

          {(standing.table || []).map((entry) => {
            const flag = entry.team?.crest;
            const isFavorite = favoriteClubs.some(
              (item) =>
                String(item.id) === String(entry.team?.id)
            );
            const zone = getQualificationZone(
              competitionCode,
              entry.position,
              standing.table?.length || 0
            );

            return (
              <View
                key={entry.team?.id || entry.position}
                style={styles.teamRow}
              >
                <View
                  style={[
                    styles.positionBar,
                    zone && {
                      backgroundColor: zone.color,
                    },
                  ]}
                />

                <Text style={styles.pos}>
                  {entry.position}
                </Text>

                <Pressable
                  style={styles.teamInfo}
                  onPress={() =>
                    onTeamPress(entry.team, flag)
                  }
                >
                  <TeamLogo
                    uri={flag}
                    name={
                      entry.team?.shortName ||
                      entry.team?.name
                    }
                    style={styles.teamLogo}
                    styles={styles}
                    theme={theme}
                  />

                  <View style={styles.tableTeamText}>
                    <Text
                      style={styles.teamName}
                      numberOfLines={1}
                    >
                      {entry.team?.shortName ||
                        entry.team?.name}
                    </Text>

                    {zone && (
                      <Text
                        style={[
                          styles.zoneText,
                          {
                            color: zone.color,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {zone.shortLabel}
                      </Text>
                    )}
                  </View>
                </Pressable>

                <Text style={styles.stat}>
                  {entry.playedGames}
                </Text>
                <Text style={styles.stat}>
                  {entry.won}
                </Text>
                <Text style={styles.stat}>
                  {entry.draw}
                </Text>
                <Text style={styles.stat}>
                  {entry.lost}
                </Text>
                <Text style={styles.stat}>
                  {entry.goalDifference}
                </Text>
                <Text style={styles.points}>
                  {entry.points}
                </Text>

                <Pressable
                  onPress={() =>
                    onFavorite(entry.team, flag)
                  }
                  style={styles.starBtn}
                >
                  <Ionicons
                    name={
                      isFavorite
                        ? "star"
                        : "star-outline"
                    }
                    size={20}
                    color={theme.gold}
                  />
                </Pressable>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function MatchSection({
  title,
  matches,
  isWorldCup,
  styles,
  theme,
}) {
  return (
    <View style={styles.matchSection}>
      <Text style={styles.matchSectionTitle}>
        {title}
      </Text>

      {matches.map((match, index) => (
        <FixtureCard
          key={match.id || index}
          match={match}
          isWorldCup={isWorldCup}
          styles={styles}
          theme={theme}
        />
      ))}
    </View>
  );
}

function FixtureCard({
  match,
  isWorldCup,
  styles,
  theme,
}) {
  const homeName =
    match.homeTeam?.shortName ||
    match.homeTeam?.name ||
    "TBD";
  const awayName =
    match.awayTeam?.shortName ||
    match.awayTeam?.name ||
    "TBD";
  const isFinished = match.status === "FINISHED";
  const homeScore =
    match.score?.fullTime?.home ?? "-";
  const awayScore =
    match.score?.fullTime?.away ?? "-";

  return (
    <Pressable
      style={styles.fixtureCard}
      onPress={() =>
        router.push({
          pathname: "/match/[id]",
          params: {
            id: match.id,
          },
        })
      }
    >
      <View style={styles.fixtureMeta}>
        <View style={styles.stageBadge}>
          <Text style={styles.stageText}>
            {formatStage(match.stage)}
          </Text>
        </View>

        <Text style={styles.date}>
          {new Date(match.utcDate).toLocaleString([], {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      <View style={styles.fixtureTeams}>
        <View style={styles.fixtureTeamBox}>
          <TeamLogo
            uri={match.homeTeam?.crest}
            name={homeName}
            isWorldCup={isWorldCup}
            style={styles.fixtureLogo}
            styles={styles}
            theme={theme}
          />

          <Text
            style={styles.fixtureTeamName}
            numberOfLines={2}
          >
            {homeName}
          </Text>
        </View>

        <View style={styles.fixtureScoreBox}>
          <Text style={styles.score}>
            {isFinished
              ? `${homeScore} - ${awayScore}`
              : "VS"}
          </Text>

          <Text style={styles.status}>
            {formatStatus(match.status)}
          </Text>
        </View>

        <View style={styles.fixtureTeamBox}>
          <TeamLogo
            uri={match.awayTeam?.crest}
            name={awayName}
            isWorldCup={isWorldCup}
            style={styles.fixtureLogo}
            styles={styles}
            theme={theme}
          />

          <Text
            style={styles.fixtureTeamName}
            numberOfLines={2}
          >
            {awayName}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function EmptyState({
  icon,
  title,
  text,
  styles,
  theme,
}) {
  return (
    <View style={styles.emptyBox}>
      <Ionicons
        name={icon}
        size={44}
        color={theme.accent}
      />

      <Text style={styles.emptyTitle}>
        {title}
      </Text>

      <Text style={styles.emptyText}>
        {text}
      </Text>
    </View>
  );
}

function formatStage(stage) {
  if (!stage) return "Match";

  return stage
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatStatus(status) {
  const labels = {
    SCHEDULED: "Scheduled",
    TIMED: "Scheduled",
    IN_PLAY: "Live",
    PAUSED: "Half Time",
    FINISHED: "Full Time",
  };

  return labels[status] || status;
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 50,
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
      marginBottom: 20,
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

    seasonBadge: {
      height: 44,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      borderRadius: 22,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },

    seasonBadgeText: {
      color: theme.text,
      fontWeight: "700",
      marginLeft: 7,
      fontSize: 12,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      marginBottom: 24,
    },

    headerText: {
      marginLeft: 16,
      flex: 1,
    },

    name: {
      color: theme.text,
      fontSize: 27,
      fontWeight: "bold",
    },

    country: {
      color: theme.subText,
      marginTop: 5,
    },

    headerStats: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      marginTop: 10,
    },

    headerStat: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "800",
    },

    headerDot: {
      color: theme.subText,
      marginHorizontal: 6,
    },

    tabs: {
      flexDirection: "row",
      paddingHorizontal: 18,
      marginBottom: 14,
    },

    tabButton: {
      flex: 1,
      minHeight: 66,
      borderRadius: 20,
      marginHorizontal: 4,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
    },

    activeTabButton: {
      backgroundColor: theme.accent,
      borderColor: theme.accent,
    },

    activeTab: {
      color: theme.background,
      fontSize: 13,
      fontWeight: "bold",
      marginTop: 5,
    },

    tab: {
      color: theme.subText,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 5,
    },

    sectionIntro: {
      paddingHorizontal: 18,
      marginTop: 8,
      marginBottom: 18,
    },

    sectionTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "bold",
    },

    sectionSubtitle: {
      color: theme.subText,
      marginTop: 6,
      lineHeight: 20,
    },

    groupCard: {
      backgroundColor: theme.card,
      marginHorizontal: 18,
      marginBottom: 14,
      borderRadius: 22,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
    },

    groupHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    groupTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "bold",
    },

    groupCount: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "700",
    },

    countryRow: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 58,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    countryFlag: {
      width: 42,
      height: 28,
      borderRadius: 5,
      marginRight: 13,
    },

    flagImage: {
      borderRadius: 5,
    },

    countryName: {
      color: theme.text,
      fontWeight: "700",
      flex: 1,
    },

    favoriteBtn: {
      padding: 8,
    },

    teamDirectory: {
      backgroundColor: theme.card,
      marginHorizontal: 18,
      borderRadius: 22,
      paddingHorizontal: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },

    directoryRow: {
      minHeight: 72,
      flexDirection: "row",
      alignItems: "center",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    directoryLogo: {
      width: 44,
      height: 44,
      marginRight: 13,
    },

    directoryText: {
      flex: 1,
    },

    directoryName: {
      color: theme.text,
      fontWeight: "bold",
      fontSize: 15,
    },

    directoryMeta: {
      color: theme.subText,
      marginTop: 4,
      fontSize: 12,
    },

    legendCard: {
      backgroundColor: theme.card,
      marginHorizontal: 18,
      marginBottom: 16,
      padding: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
    },

    legendTitle: {
      color: theme.text,
      fontWeight: "bold",
      marginBottom: 12,
    },

    legendItems: {
      flexDirection: "row",
      flexWrap: "wrap",
    },

    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      marginRight: 16,
      marginBottom: 10,
    },

    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 7,
    },

    legendText: {
      color: theme.subText,
      fontSize: 11,
      fontWeight: "600",
    },

    tableCard: {
      backgroundColor: theme.card,
      marginHorizontal: 18,
      marginBottom: 16,
      borderRadius: 22,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },

    tableTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "bold",
      paddingHorizontal: 16,
      marginBottom: 14,
    },

    tableContent: {
      minWidth: 570,
    },

    tableInner: {
      width: 570,
    },

    tableHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingBottom: 9,
    },

    headerPos: {
      color: theme.subText,
      width: 30,
      fontWeight: "bold",
    },

    headerTeam: {
      color: theme.subText,
      flex: 1,
      fontWeight: "bold",
    },

    headerSmall: {
      color: theme.subText,
      width: 36,
      textAlign: "center",
      fontWeight: "bold",
      fontSize: 12,
    },

    starSpace: {
      width: 30,
    },

    teamRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },

    positionBar: {
      width: 3,
      height: 28,
      borderRadius: 3,
      marginRight: 9,
      backgroundColor: "transparent",
    },

    pos: {
      color: theme.text,
      width: 25,
      fontWeight: "bold",
    },

    teamInfo: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    teamLogo: {
      width: 30,
      height: 30,
      marginRight: 10,
    },

    logoFallback: {
      backgroundColor: theme.cardAlt,
      borderRadius: 7,
      justifyContent: "center",
      alignItems: "center",
    },

    teamName: {
      color: theme.text,
      fontWeight: "600",
      fontSize: 13,
      flex: 1,
    },

    tableTeamText: {
      flex: 1,
      paddingRight: 4,
    },

    zoneText: {
      fontSize: 9,
      fontWeight: "800",
      marginTop: 3,
    },

    stat: {
      color: theme.text,
      width: 36,
      textAlign: "center",
      fontSize: 12,
    },

    points: {
      color: theme.text,
      width: 36,
      textAlign: "center",
      fontWeight: "bold",
      fontSize: 12,
    },

    starBtn: {
      width: 30,
      alignItems: "flex-end",
    },

    matchSection: {
      marginBottom: 8,
    },

    matchSectionTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "bold",
      marginHorizontal: 18,
      marginBottom: 12,
    },

    fixtureCard: {
      backgroundColor: theme.card,
      marginHorizontal: 18,
      borderRadius: 20,
      padding: 17,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },

    fixtureMeta: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },

    stageBadge: {
      backgroundColor: theme.cardAlt,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 12,
    },

    stageText: {
      color: theme.accent,
      fontSize: 10,
      fontWeight: "800",
    },

    fixtureTeams: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    fixtureTeamBox: {
      width: 110,
      alignItems: "center",
    },

    fixtureLogo: {
      width: 48,
      height: 38,
      marginBottom: 9,
    },

    fixtureTeamName: {
      color: theme.text,
      fontWeight: "700",
      textAlign: "center",
      fontSize: 13,
    },

    fixtureScoreBox: {
      alignItems: "center",
      flex: 1,
    },

    score: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "bold",
    },

    status: {
      color: theme.accent,
      fontSize: 10,
      marginTop: 5,
      fontWeight: "800",
      textTransform: "uppercase",
    },

    date: {
      color: theme.subText,
      fontSize: 11,
    },

    emptyBox: {
      backgroundColor: theme.card,
      marginHorizontal: 18,
      borderRadius: 22,
      padding: 28,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },

    emptyTitle: {
      color: theme.text,
      fontWeight: "bold",
      fontSize: 18,
      marginTop: 14,
    },

    emptyText: {
      color: theme.subText,
      textAlign: "center",
      lineHeight: 22,
      marginTop: 9,
    },
  });
}
