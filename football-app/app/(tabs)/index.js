import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  ActivityIndicator,
  Linking,
  Image,
  FlatList,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { getFootballNews } from "../../services/news";
import {
  getExtendedLiveMatches,
  getExtendedMatches,
} from "../../services/extendedCompetitions";
import CompetitionLogo from "../../components/CompetitionLogo";
import AnimatedGlowCard from "../../components/AnimatedGlowCard";
import PlayerJerseyImage from "../../components/PlayerJerseyImage";
import TeamBadge from "../../components/TeamBadge";
import { competitions } from "../../constants/competitions";

import {
  buildSearchIndex,
  clearSearchCache,
  searchItems,
} from "../../services/appSearch";

import { useAppTheme } from "../../context/ThemeContext";
import { footballFetch } from "../../services/footballApi";

const SUPPORTED_COMPETITION_CODES = new Set(
  competitions.map((competition) => competition.code)
);
const LIVE_CARD_WIDTH = 286;
const HOME_MATCH_CACHE_KEY = "matchzone_home_matches_v2";

const NEWS_IMAGES = {
  transfer:
    "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=900",
  league:
    "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=900",
  champions:
    "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?w=900",
  default:
    "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=900",
};

function getNewsImage(item) {
  const text = `${item?.title || ""} ${item?.description || ""}`.toLowerCase();

  if (item?.image) return item.image;
  if (item?.thumbnail) return item.thumbnail;

  if (text.includes("transfer") || text.includes("signing")) {
    return NEWS_IMAGES.transfer;
  }

  if (text.includes("champions league") || text.includes("europe")) {
    return NEWS_IMAGES.champions;
  }

  if (
    text.includes("premier league") ||
    text.includes("la liga") ||
    text.includes("serie a") ||
    text.includes("bundesliga") ||
    text.includes("ligue 1")
  ) {
    return NEWS_IMAGES.league;
  }

  return NEWS_IMAGES.default;
}

export default function HomeScreen() {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [news, setNews] = useState([]);
  const [matches, setMatches] = useState([]);
  const [allSearchItems, setAllSearchItems] = useState([]);
  const [searchLoading, setSearchLoading] = useState(true);
  const [searchProgress, setSearchProgress] = useState({
    complete: false,
    loading: true,
    completed: 0,
    total: competitions.length,
  });
  const [loading, setLoading] = useState(false);

  const fetchJson = useCallback(async (url) => {
    try {
      const res = await footballFetch(url);

      if (!res.ok) return {};

      return await res.json();
    } catch (error) {
      console.log("FETCH ERROR:", error);
      return {};
    }
  }, []);

  const loadSearchData = useCallback(async (force = false) => {
    try {
      setSearchLoading(true);

      if (force) {
        await clearSearchCache();
      }

      const data = await buildSearchIndex(
        force,
        (partialItems, progress) => {
          setAllSearchItems(partialItems || []);
          setSearchProgress({
            ...progress,
            loading: !progress.complete,
          });
          setSearchLoading(false);
        }
      );
      setAllSearchItems(data || []);
      setSearchProgress((current) => ({
        ...current,
        loading: false,
      }));
    } catch (error) {
      console.log("SEARCH ERROR:", error);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const loadHomeData = useCallback(async () => {
    try {
      setLoading(true);

      const cached = await AsyncStorage.getItem(HOME_MATCH_CACHE_KEY);
      const parsed = cached ? JSON.parse(cached) : null;

      if (Array.isArray(parsed?.matches) && parsed.matches.length) {
        setMatches(parsed.matches);
        setLoading(false);
      }

      const today = new Date();
      const future = new Date();

      future.setDate(today.getDate() + 6);

      const dateFrom = today.toISOString().split("T")[0];
      const dateTo = future.toISOString().split("T")[0];

      const [data, extendedMatches] = await Promise.all([
        fetchJson(
          `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
        ),
        getExtendedMatches(dateFrom, dateTo),
      ]);
      const allMatches = [
        ...(data.matches || []),
        ...extendedMatches,
      ].filter((match) =>
        SUPPORTED_COMPETITION_CODES.has(match.competition?.code)
      );

      if (allMatches.length) {
        await AsyncStorage.setItem(
          HOME_MATCH_CACHE_KEY,
          JSON.stringify({
            matches: allMatches,
            updatedAt: Date.now(),
          })
        );
      }

      const sortedMatches = allMatches.sort(
        (a, b) =>
          new Date(a.utcDate).getTime() -
          new Date(b.utcDate).getTime()
      );

      const newsData = await getFootballNews();

      if (sortedMatches.length) {
        setMatches(sortedMatches);
      } else {
        setMatches((current) =>
          current.length
            ? current
            : Array.isArray(parsed?.matches)
            ? parsed.matches
            : []
        );
      }
      setNews(newsData || []);
    } catch (error) {
      console.log("HOME DATA ERROR:", error);
    } finally {
      setLoading(false);
    }
  }, [fetchJson]);

  const refreshCurrentMatches = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const [primary, extended, live] = await Promise.all([
      fetchJson(
        `https://api.football-data.org/v4/matches?dateFrom=${today}&dateTo=${today}`
      ),
      getExtendedMatches(today, today),
      getExtendedLiveMatches(),
    ]);
    const updates = [
      ...(primary.matches || []),
      ...extended,
      ...live,
    ].filter((match) =>
      SUPPORTED_COMPETITION_CODES.has(match.competition?.code)
    );

    setMatches((current) => {
      const byId = new Map(
        current.map((match) => [String(match.id), match])
      );

      updates.forEach((match) => {
        byId.set(String(match.id), match);
      });

      return [...byId.values()].sort(
        (a, b) =>
          new Date(a.utcDate).getTime() -
          new Date(b.utcDate).getTime()
      );
    });
  }, [fetchJson]);

  useEffect(() => {
    loadHomeData();
    loadSearchData();
  }, [loadHomeData, loadSearchData]);

  useEffect(() => {
    const interval = setInterval(refreshCurrentMatches, 60000);
    return () => clearInterval(interval);
  }, [refreshCurrentMatches]);

  const liveMatches = matches.filter(
    (match) =>
      SUPPORTED_COMPETITION_CODES.has(match.competition?.code) &&
      (match.status === "IN_PLAY" ||
        match.status === "PAUSED")
  );

  const upcomingMatches = matches.filter(
    (match) =>
      match.status === "SCHEDULED" ||
      match.status === "TIMED"
  );

  const featuredMatch = upcomingMatches[0];

  const filteredSearch = useMemo(() => {
    return searchItems(allSearchItems, search);
  }, [allSearchItems, search]);

  function handleSearchPress(item) {
    setSearchVisible(false);
    setSearch("");

    if (item.type === "league") {
      router.push(`/league/${item.id}`);
    }

    if (item.type === "club") {
      router.push({
        pathname: "/team/[id]",
        params: {
          id: item.id,
          name: item.name,
          logo: item.logo || "",
          competitionCode: item.competitionCode || "",
        },
      });
    }

    if (item.type === "player") {
      router.push({
        pathname: "/player/[id]",
        params: {
          id: item.id,
          name: item.name,
          teamId: item.teamId || "",
          teamName: item.team || "",
          teamLogo: item.teamLogo || "",
          teamArea: item.country || "",
          competitionCode: item.competitionCode || "",
          photo: item.photo || "",
        },
      });
    }

    if (item.type === "country") {
      if (item.teamId) {
        router.push({
          pathname: "/team/[id]",
          params: {
            id: item.teamId,
            name: item.name,
            logo: item.logo || "",
            competitionCode: item.competitionCode || "",
          },
        });
      } else if (item.competitionCode) {
        router.push({
          pathname: "/league/[id]",
          params: {
            id: item.competitionCode,
            name: item.competitionName || item.name,
          },
        });
      }
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.small}>MATCHZONE</Text>
          <Text style={styles.title}>Home</Text>
        </View>

        <View style={styles.headerIcons}>
          <Pressable
            style={styles.iconButton}
            onPress={() => setSearchVisible(true)}
          >
            <Ionicons
              name="search"
              size={24}
              color={theme.text}
            />
          </Pressable>

          <Pressable
            style={styles.iconButton}
            onPress={() => router.push("/profile")}
          >
            <Ionicons
              name="person"
              size={24}
              color={theme.text}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
          <Text style={styles.section}>Live Now</Text>
          {loading ? (
            <ActivityIndicator size="small" color={theme.accent} />
          ) : null}
          {liveMatches.length > 1 ? (
            <View style={styles.scrollHint}>
              <Text style={styles.scrollHintText}>Swipe for more</Text>
              <Ionicons
                name="arrow-forward"
                size={15}
                color={theme.subText}
              />
            </View>
          ) : null}
        </View>

        {liveMatches.length === 0 ? (
          <EmptyBox
            title="No live matches"
            subtitle="No selected competition is live right now."
            styles={styles}
            theme={theme}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.liveList}
            decelerationRate="fast"
            snapToInterval={LIVE_CARD_WIDTH + 12}
          >
            {liveMatches.map((match, index) => (
              <AnimatedGlowCard
                key={match.id}
                style={styles.liveCard}
                glowColor={theme.danger}
                delay={Math.min(index * 70, 350)}
                onPress={() =>
                  router.push({
                    pathname: "/match/[id]",
                    params: { id: match.id },
                  })
                }
              >
                <View style={styles.liveCardTop}>
                  <View style={styles.liveCompetition}>
                    <CompetitionLogo
                      code={match.competition?.code}
                      uri={match.competition?.emblem}
                      size={25}
                      theme={theme}
                    />
                    <Text
                      style={styles.liveCompetitionName}
                      numberOfLines={1}
                    >
                      {match.competition?.name}
                    </Text>
                  </View>

                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveBadgeText}>
                      {match.status === "PAUSED" ? "HT" : "LIVE"}
                    </Text>
                  </View>
                </View>

                <View style={styles.liveMatchRow}>
                  <LiveTeam
                    team={match.homeTeam}
                    competitionCode={match.competition?.code}
                    styles={styles}
                    theme={theme}
                  />

                  <Text style={styles.score}>
                    {match.score?.fullTime?.home ?? 0} -{" "}
                    {match.score?.fullTime?.away ?? 0}
                  </Text>

                  <LiveTeam
                    team={match.awayTeam}
                    competitionCode={match.competition?.code}
                    styles={styles}
                    theme={theme}
                  />
                </View>
              </AnimatedGlowCard>
            ))}
          </ScrollView>
        )}

        {featuredMatch && (
          <>
            <Text style={styles.section}>Featured Match</Text>

            <AnimatedGlowCard
              style={styles.featuredCard}
              glowColor={theme.accent}
              delay={90}
              onPress={() =>
                router.push({
                  pathname: "/match/[id]",
                  params: { id: featuredMatch.id },
                })
              }
            >
              <View style={styles.featuredTeams}>
                <TeamBlock
                  team={featuredMatch.homeTeam}
                  competitionCode={featuredMatch.competition?.code}
                  styles={styles}
                  theme={theme}
                />

                <Text style={styles.vs}>VS</Text>

                <TeamBlock
                  team={featuredMatch.awayTeam}
                  competitionCode={featuredMatch.competition?.code}
                  styles={styles}
                  theme={theme}
                />
              </View>
            </AnimatedGlowCard>
          </>
        )}

        <Text style={styles.section}>Upcoming Fixtures</Text>

        {upcomingMatches.length === 0 ? (
          <EmptyBox
            title="No upcoming fixtures"
            subtitle="No fixtures were returned from selected competitions."
            styles={styles}
            theme={theme}
          />
        ) : (
          upcomingMatches.slice(0, 10).map((match, index) => (
            <AnimatedGlowCard
              key={match.id}
              style={styles.fixtureCard}
              glowColor={theme.accent}
              delay={Math.min(index * 55, 330)}
              onPress={() =>
                router.push({
                  pathname: "/match/[id]",
                  params: {
                    id: match.id,
                  },
                })
              }
            >
              <View style={styles.fixtureLeagueRow}>
                <Text
                  style={styles.fixtureLeague}
                  numberOfLines={1}
                >
                  {match.competition?.name}
                </Text>

                <Text style={styles.fixtureTime}>
                  {new Date(match.utcDate).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>

              <View style={styles.fixtureTeams}>
                <FixtureTeam
                  team={match.homeTeam}
                  competitionCode={match.competition?.code}
                  styles={styles}
                  theme={theme}
                />

                <View style={styles.fixtureCenter}>
                  <Text style={styles.fixtureVs}>VS</Text>
                  <Text style={styles.fixtureDate}>
                    {new Date(match.utcDate).toLocaleDateString()}
                  </Text>
                </View>

                <FixtureTeam
                  team={match.awayTeam}
                  competitionCode={match.competition?.code}
                  styles={styles}
                  theme={theme}
                />
              </View>
            </AnimatedGlowCard>
          ))
        )}

        <Text style={styles.section}>Latest Football News</Text>

        {news.length === 0 ? (
          <EmptyBox
            title="No news available"
            subtitle="The RSS feed could not load."
            styles={styles}
            theme={theme}
          />
        ) : (
          news.slice(0, 10).map((item, index) => (
            <AnimatedGlowCard
              key={index}
              style={styles.newsCard}
              glowColor={theme.accent}
              delay={Math.min(index * 55, 330)}
              onPress={() =>
                item.link &&
                Linking.openURL(item.link)
              }
            >
              <Image
                source={{
                  uri: getNewsImage(item),
                }}
                style={styles.newsImage}
              />

              <View style={styles.newsContent}>
                <Text style={styles.newsSource}>
                  {item.source}
                </Text>

                <Text style={styles.newsTitle}>
                  {item.title}
                </Text>
              </View>
            </AnimatedGlowCard>
          ))
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal
        visible={searchVisible}
        animationType="slide"
      >
        <View style={styles.searchContainer}>
          <View style={styles.searchTop}>
            <TextInput
              placeholder="Search every player, club or country..."
              placeholderTextColor={theme.subText}
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />

            <Pressable
              onPress={() => setSearchVisible(false)}
            >
              <Ionicons
                name="close"
                size={30}
                color={theme.text}
              />
            </Pressable>
          </View>

          {searchLoading ? (
            <ActivityIndicator
              size="large"
              color={theme.accent}
              style={{
                marginTop: 40,
              }}
            />
          ) : (
            <>
              <View style={styles.searchStatus}>
                <Text style={styles.searchStatusText}>
                  {searchProgress.complete
                    ? `${allSearchItems.length.toLocaleString()} searchable profiles`
                    : searchProgress.loading
                    ? `Adding competition data ${searchProgress.completed}/${searchProgress.total}`
                    : `${searchProgress.completed}/${searchProgress.total} competition indexes available`}
                </Text>

                {searchProgress.loading ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.accent}
                  />
                ) : null}
              </View>

              <FlatList
                data={filteredSearch}
                keyboardShouldPersistTaps="handled"
                keyExtractor={(item, index) =>
                  `${item.type}-${item.id}-${index}`
                }
                renderItem={({ item, index }) => (
                  <AnimatedGlowCard
                    style={styles.searchCard}
                    glowColor={theme.accent}
                    delay={Math.min(index * 35, 210)}
                    onPress={() => handleSearchPress(item)}
                  >
                    {item.type === "league" ? (
                      <CompetitionLogo
                        code={item.id}
                        uri={item.logo}
                        size={44}
                        theme={theme}
                        style={styles.searchLogo}
                      />
                    ) : item.type === "club" ? (
                      <TeamBadge
                        uri={item.logo}
                        name={item.name}
                        competitionCode={item.competitionCode}
                        size={44}
                        style={styles.searchLogo}
                        theme={theme}
                      />
                    ) : item.type === "country" ? (
                      <TeamBadge
                        uri={item.logo}
                        name={item.name}
                        countryCode={item.countryCode}
                        competitionCode={item.competitionCode}
                        variant="flag"
                        size={44}
                        style={styles.searchFlag}
                        theme={theme}
                      />
                    ) : (
                      <PlayerJerseyImage
                        playerId={item.id}
                        playerName={item.name}
                        teamName={item.team}
                        teamLogo={item.teamLogo}
                        size={42}
                        style={styles.searchPlayer}
                        theme={theme}
                      />
                    )}

                    <View style={styles.searchCopy}>
                      <Text style={styles.searchName}>
                        {item.name}
                      </Text>

                      <Text
                        style={styles.searchType}
                        numberOfLines={1}
                      >
                        {getSearchSubtitle(item)}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={theme.subText}
                    />
                  </AnimatedGlowCard>
                )}
                ListEmptyComponent={() => (
                  <View style={styles.noSearchResults}>
                    <Ionicons
                      name="search-outline"
                      size={36}
                      color={theme.border}
                    />
                    <Text style={styles.noSearchTitle}>
                      No search results
                    </Text>
                    <Text style={styles.noSearchText}>
                      Try a full name, club, nationality or country.
                    </Text>
                  </View>
                )}
              />
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

function FixtureTeam({
  team,
  competitionCode,
  styles,
  theme,
}) {
  return (
    <View style={styles.fixtureTeamBox}>
      <TeamBadge
        team={team}
        competitionCode={competitionCode}
        size={42}
        style={styles.fixtureLogo}
        theme={theme}
      />

      <Text
        style={styles.fixtureTeamName}
        numberOfLines={2}
      >
        {team?.shortName || team?.name}
      </Text>
    </View>
  );
}

function getSearchSubtitle(item) {
  if (item.type === "player") {
    return [
      "Player",
      item.team,
      item.position,
      item.country,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (item.type === "club") {
    return [
      "Club",
      item.competitionName,
      item.country,
    ]
      .filter(Boolean)
      .join(" - ");
  }

  if (item.type === "country") {
    return [
      "Country",
      item.competitionName,
      item.group ? `Group ${item.group}` : "",
    ]
      .filter(Boolean)
      .join(" - ");
  }

  return `Competition - ${item.id}`;
}

function LiveTeam({
  team,
  competitionCode,
  styles,
  theme,
}) {
  return (
    <View style={styles.liveTeam}>
      <TeamBadge
        team={team}
        competitionCode={competitionCode}
        size={44}
        theme={theme}
      />
      <Text style={styles.liveTeams} numberOfLines={2}>
        {team?.shortName || team?.name || "TBC"}
      </Text>
    </View>
  );
}

function TeamBlock({
  team,
  competitionCode,
  styles,
  theme,
}) {
  return (
    <View style={styles.teamBox}>
      <TeamBadge
        team={team}
        competitionCode={competitionCode}
        size={52}
        style={styles.logo}
        theme={theme}
      />

      <Text style={styles.team}>
        {team?.shortName || team?.name}
      </Text>
    </View>
  );
}

function EmptyBox({ title, subtitle, styles, theme }) {
  return (
    <AnimatedGlowCard
      style={styles.emptyBox}
      glowColor={theme.accent}
      delay={70}
    >
      <Text style={styles.emptyTitle}>
        {title}
      </Text>

      <Text style={styles.emptySub}>
        {subtitle}
      </Text>
    </AnimatedGlowCard>
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
      marginBottom: 24,
    },

    small: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "bold",
    },

    title: {
      color: theme.text,
      fontSize: 30,
      fontWeight: "bold",
      marginTop: 4,
    },

    headerIcons: {
      flexDirection: "row",
    },

    iconButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
      marginLeft: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },

    section: {
      color: theme.text,
      fontSize: 20,
      fontWeight: "bold",
      marginBottom: 14,
      marginTop: 8,
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    scrollHint: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 8,
      marginBottom: 14,
    },

    scrollHintText: {
      color: theme.subText,
      fontSize: 11,
      fontWeight: "600",
      marginRight: 5,
    },

    liveList: {
      paddingRight: 14,
      paddingBottom: 20,
    },

    liveCard: {
      width: LIVE_CARD_WIDTH,
      backgroundColor: theme.card,
      borderRadius: 22,
      padding: 16,
      marginRight: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },

    liveCardTop: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 17,
    },

    liveCompetition: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 10,
    },

    liveCompetitionName: {
      color: theme.subText,
      fontSize: 11,
      fontWeight: "700",
      marginLeft: 8,
      flex: 1,
    },

    liveBadge: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 14,
      paddingHorizontal: 9,
      paddingVertical: 6,
      backgroundColor: theme.isDark
        ? "rgba(239,68,68,0.16)"
        : "rgba(220,38,38,0.10)",
    },

    liveDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: theme.danger,
      marginRight: 5,
    },

    liveBadgeText: {
      color: theme.danger,
      fontSize: 10,
      fontWeight: "900",
    },

    liveMatchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    liveTeam: {
      width: 84,
      alignItems: "center",
    },

    liveTeams: {
      color: theme.text,
      textAlign: "center",
      fontWeight: "700",
      fontSize: 12,
      marginTop: 8,
    },

    score: {
      color: theme.text,
      fontSize: 25,
      fontWeight: "900",
      textAlign: "center",
    },

    featuredCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 22,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 20,
    },

    featuredTeams: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    teamBox: {
      alignItems: "center",
      width: 110,
    },

    logo: {
      width: 52,
      height: 52,
      resizeMode: "contain",
      marginBottom: 10,
    },

    team: {
      color: theme.text,
      fontWeight: "600",
      textAlign: "center",
    },

    vs: {
      color: theme.gold,
      fontSize: 22,
      fontWeight: "bold",
    },

    fixtureCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      padding: 16,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },

    fixtureLeagueRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },

    fixtureLeague: {
      color: theme.subText,
      fontSize: 12,
      flex: 1,
      marginRight: 10,
    },

    fixtureTime: {
      color: theme.accent,
      fontWeight: "bold",
      fontSize: 12,
    },

    fixtureTeams: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },

    fixtureTeamBox: {
      width: 105,
      alignItems: "center",
    },

    fixtureLogo: {
      width: 48,
      height: 48,
      resizeMode: "contain",
      marginBottom: 8,
    },

    fixtureFallback: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.cardAlt,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 8,
    },

    fixtureTeamName: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 13,
      textAlign: "center",
    },

    fixtureCenter: {
      alignItems: "center",
      flex: 1,
    },

    fixtureVs: {
      color: theme.gold,
      fontWeight: "bold",
      fontSize: 18,
    },

    fixtureDate: {
      color: theme.subText,
      fontSize: 11,
      marginTop: 5,
    },

    emptyBox: {
      backgroundColor: theme.card,
      borderRadius: 22,
      padding: 22,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 22,
    },

    emptyTitle: {
      color: theme.text,
      fontWeight: "bold",
      fontSize: 16,
      textAlign: "center",
    },

    emptySub: {
      color: theme.subText,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 20,
    },

    newsCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },

    newsImage: {
      width: "100%",
      height: 150,
      resizeMode: "cover",
      backgroundColor: theme.cardAlt,
    },

    newsContent: {
      padding: 16,
    },

    newsSource: {
      color: theme.accent,
      fontWeight: "bold",
      marginBottom: 6,
      fontSize: 12,
    },

    newsTitle: {
      color: theme.text,
      lineHeight: 22,
      fontWeight: "600",
    },

    searchContainer: {
      flex: 1,
      backgroundColor: theme.background,
      paddingTop: 60,
      paddingHorizontal: 16,
    },

    searchTop: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 14,
    },

    searchInput: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: 18,
      paddingHorizontal: 18,
      height: 54,
      color: theme.text,
      marginRight: 12,
      fontSize: 15,
      borderWidth: 1,
      borderColor: theme.border,
    },

    searchCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },

    searchStatus: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      backgroundColor: theme.cardAlt,
      borderRadius: 14,
      paddingHorizontal: 13,
      paddingVertical: 10,
      marginBottom: 12,
    },

    searchStatusText: {
      color: theme.subText,
      fontSize: 11,
      fontWeight: "700",
    },

    searchLogo: {
      width: 42,
      height: 42,
      resizeMode: "contain",
      marginRight: 14,
    },

    searchFlag: {
      marginRight: 14,
    },

    searchFallback: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.cardAlt,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
    },

    searchPlayer: {
      borderRadius: 12,
      marginRight: 14,
    },

    searchCopy: {
      flex: 1,
      marginRight: 8,
    },

    searchName: {
      color: theme.text,
      fontWeight: "bold",
    },

    searchType: {
      color: theme.subText,
      marginTop: 4,
      textTransform: "capitalize",
      fontSize: 12,
    },

    noSearchResults: {
      alignItems: "center",
      paddingTop: 48,
      paddingHorizontal: 30,
    },

    noSearchTitle: {
      color: theme.text,
      fontWeight: "800",
      fontSize: 17,
      marginTop: 12,
    },

    noSearchText: {
      color: theme.subText,
      textAlign: "center",
      lineHeight: 19,
      fontSize: 12,
      marginTop: 6,
    },
  });
}
