import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";

import { Ionicons } from "@expo/vector-icons";

import {
  useState,
  useCallback,
} from "react";

import {
  router,
  useFocusEffect,
} from "expo-router";

import AsyncStorage from "@react-native-async-storage/async-storage";

import AnimatedGlowCard from "../../components/AnimatedGlowCard";
import CompetitionLogo from "../../components/CompetitionLogo";
import TeamBadge from "../../components/TeamBadge";
import PlayerJerseyImage from "../../components/PlayerJerseyImage";

import {
  useAppTheme,
} from "../../context/ThemeContext";

const LEAGUES_KEY = "favorite_leagues";
const CLUBS_KEY = "favorite_clubs";
const PLAYERS_KEY = "favorite_players";

export default function FavoritesScreen() {
  const { theme } =
    useAppTheme();

  const styles =
    createStyles(theme);

  const [favoriteLeagues, setFavoriteLeagues] =
    useState([]);

  const [favoriteClubs, setFavoriteClubs] =
    useState([]);

  const [favoritePlayers, setFavoritePlayers] =
    useState([]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [])
  );

  async function loadFavorites() {
    const savedLeagues =
      await AsyncStorage.getItem(
        LEAGUES_KEY
      );

    const savedClubs =
      await AsyncStorage.getItem(
        CLUBS_KEY
      );

    const savedPlayers =
      await AsyncStorage.getItem(
        PLAYERS_KEY
      );

    setFavoriteLeagues(
      savedLeagues
        ? JSON.parse(savedLeagues)
        : []
    );

    setFavoriteClubs(
      savedClubs
        ? JSON.parse(savedClubs)
        : []
    );

    setFavoritePlayers(
      savedPlayers
        ? JSON.parse(savedPlayers)
        : []
    );
  }

  async function removeLeague(code) {
    const updated =
      favoriteLeagues.filter(
        (item) =>
          item.code !== code
      );

    setFavoriteLeagues(updated);

    await AsyncStorage.setItem(
      LEAGUES_KEY,
      JSON.stringify(updated)
    );
  }

  async function removeClub(id) {
    const updated =
      favoriteClubs.filter(
        (item) =>
          String(item.id) !==
          String(id)
      );

    setFavoriteClubs(updated);

    await AsyncStorage.setItem(
      CLUBS_KEY,
      JSON.stringify(updated)
    );
  }

  async function removePlayer(id) {
    const updated =
      favoritePlayers.filter(
        (item) =>
          String(item.id) !==
          String(id)
      );

    setFavoritePlayers(updated);

    await AsyncStorage.setItem(
      PLAYERS_KEY,
      JSON.stringify(updated)
    );
  }

  const totalFavorites =
    favoriteLeagues.length +
    favoriteClubs.length +
    favoritePlayers.length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.small}>
            YOUR FAVORITES
          </Text>

          <Text style={styles.title}>
            Favorites
          </Text>

          <Text style={styles.counter}>
            {totalFavorites} saved items
          </Text>
        </View>

        <View style={styles.starGlow}>
          <Ionicons
            name="star"
            size={30}
            color={theme.gold}
          />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
      >
        <Text style={styles.section}>
          Favorite Leagues
        </Text>

        {favoriteLeagues.length ===
        0 ? (
          <EmptyState
            title="No favorite leagues yet"
            subtitle="Star a league to save it here."
            styles={styles}
            theme={theme}
          />
        ) : (
          favoriteLeagues.map(
            (
              league,
              index
            ) => (
              <AnimatedGlowCard
                key={league.code}
                style={styles.card}
                glowColor={
                  theme.gold
                }
                delay={index * 70}
                onPress={() =>
                  router.push({
                    pathname:
                      "/league/[id]",
                    params: {
                      id: league.code,
                      name:
                        league.name,
                    },
                  })
                }
              >
                <View
                  style={
                    styles.left
                  }
                >
                  <CompetitionLogo
                    code={league.code}
                    uri={league.logo}
                    size={48}
                    theme={theme}
                    style={styles.logo}
                  />

                  <View>
                    <Text
                      style={
                        styles.name
                      }
                    >
                      {
                        league.name
                      }
                    </Text>

                    <Text
                      style={
                        styles.type
                      }
                    >
                      League •{" "}
                      {
                        league.code
                      }
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={(
                    e
                  ) => {
                    e.stopPropagation();

                    removeLeague(
                      league.code
                    );
                  }}
                >
                  <Ionicons
                    name="star"
                    size={24}
                    color={
                      theme.gold
                    }
                  />
                </Pressable>
              </AnimatedGlowCard>
            )
          )
        )}

        <Text style={styles.section}>
          Favorite Clubs
        </Text>

        {favoriteClubs.length ===
        0 ? (
          <EmptyState
            title="No favorite clubs yet"
            subtitle="Star clubs from league tables or club pages."
            styles={styles}
            theme={theme}
          />
        ) : (
          favoriteClubs.map(
            (
              club,
              index
            ) => (
              <AnimatedGlowCard
                key={club.id}
                style={styles.card}
                glowColor={
                  theme.accent
                }
                delay={index * 70}
                onPress={() =>
                  router.push({
                    pathname:
                      "/team/[id]",
                    params: {
                      id: club.id,
                      name:
                        club.name,
                      logo:
                        club.logo,
                      competitionCode:
                        club.competitionCode || "",
                    },
                  })
                }
              >
                <View
                  style={
                    styles.left
                  }
                >
                  <TeamBadge
                    uri={club.logo}
                    name={club.name}
                    competitionCode={club.competitionCode}
                    size={40}
                    theme={theme}
                    style={styles.logo}
                  />

                  <View>
                    <Text
                      style={
                        styles.name
                      }
                    >
                      {club.name}
                    </Text>

                    <Text
                      style={
                        styles.type
                      }
                    >
                      Club
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={(
                    e
                  ) => {
                    e.stopPropagation();

                    removeClub(
                      club.id
                    );
                  }}
                >
                  <Ionicons
                    name="star"
                    size={24}
                    color={
                      theme.gold
                    }
                  />
                </Pressable>
              </AnimatedGlowCard>
            )
          )
        )}

        <Text style={styles.section}>
          Favorite Players
        </Text>

        {favoritePlayers.length ===
        0 ? (
          <EmptyState
            title="No favorite players yet"
            subtitle="Star a player profile to save them here."
            styles={styles}
            theme={theme}
          />
        ) : (
          favoritePlayers.map(
            (
              player,
              index
            ) => (
              <AnimatedGlowCard
                key={player.id}
                style={styles.card}
                glowColor={
                  theme.accent
                }
                delay={index * 70}
                onPress={() =>
                  router.push({
                    pathname:
                      "/player/[id]",
                    params: {
                      id: player.id,
                      name:
                        player.name,
                      teamId:
                        player.teamId || "",
                      teamName:
                        player.team || "",
                      teamLogo:
                        player.teamLogo || "",
                      teamArea:
                        player.teamArea || "",
                      competitionCode:
                        player.competitionCode || "",
                      photo:
                        player.photo || "",
                    },
                  })
                }
              >
                <View
                  style={
                    styles.left
                  }
                >
                  <PlayerJerseyImage
                    playerId={player.id}
                      playerName={player.name}
                      teamName={player.team}
                      teamLogo={player.teamLogo}
                      uri={player.photo}
                    verifyCurrentTeam
                    size={42}
                    style={styles.playerPhoto}
                    theme={theme}
                  />

                  <View>
                    <Text
                      style={
                        styles.name
                      }
                    >
                      {
                        player.name
                      }
                    </Text>

                    <Text
                      style={
                        styles.type
                      }
                    >
                      {player.team
                        ? `Player • ${player.team}`
                        : "Player"}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={(
                    e
                  ) => {
                    e.stopPropagation();

                    removePlayer(
                      player.id
                    );
                  }}
                >
                  <Ionicons
                    name="star"
                    size={24}
                    color={
                      theme.gold
                    }
                  />
                </Pressable>
              </AnimatedGlowCard>
            )
          )
        )}

        <View
          style={{
            height: 80,
          }}
        />
      </ScrollView>
    </View>
  );
}

function EmptyState({
  title,
  subtitle,
  styles,
  theme,
}) {
  return (
    <AnimatedGlowCard
      style={styles.emptyCard}
      glowColor={theme.accent}
    >
      <Ionicons
        name="star-outline"
        size={42}
        color={theme.border}
      />

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
      backgroundColor:
        theme.background,
      paddingTop: 55,
      paddingHorizontal: 14,
    },

    header: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 24,
    },

    small: {
      color: theme.gold,
      fontSize: 11,
      fontWeight: "bold",
    },

    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: "bold",
      marginTop: 4,
    },

    counter: {
      color: theme.subText,
      marginTop: 6,
    },

    starGlow: {
      shadowColor:
        theme.gold,
      shadowOpacity: 0.8,
      shadowRadius: 14,
      elevation: 10,
    },

    section: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 14,
      marginTop: 8,
    },

    card: {
      backgroundColor:
        theme.card,
      borderRadius: 20,
      padding: 18,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 12,
      borderWidth: 1,
      borderColor:
        theme.border,
    },

    left: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
    },

    logo: {
      width: 40,
      height: 40,
      marginRight: 14,
      resizeMode:
        "contain",
    },

    name: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "600",
      width: 210,
    },

    type: {
      color: theme.subText,
      marginTop: 4,
    },

    emptyCard: {
      backgroundColor:
        theme.card,
      borderRadius: 22,
      padding: 24,
      alignItems: "center",
      marginBottom: 24,
      borderWidth: 1,
      borderColor:
        theme.border,
    },

    emptyTitle: {
      color: theme.text,
      fontWeight: "bold",
      marginTop: 14,
      fontSize: 16,
      textAlign: "center",
    },

    emptySub: {
      color: theme.subText,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 20,
    },

    playerPhoto: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor:
        theme.cardAlt,
      borderWidth: 1,
      borderColor:
        theme.border,
      marginRight: 14,
    },
  });
}
