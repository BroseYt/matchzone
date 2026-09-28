import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";

import { router } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  useEffect,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import AnimatedGlowCard from "../../components/AnimatedGlowCard";
import CompetitionLogo from "../../components/CompetitionLogo";

import {
  useAppTheme,
} from "../../context/ThemeContext";

const STORAGE_KEY =
  "favorite_leagues";

const leagues = [
  {
    code: "WC",
    name: "FIFA World Cup",
    logo: null,
  },
  {
    code: "CL",
    name: "UEFA Champions League",
    logo:
      "https://crests.football-data.org/CL.png",
  },
  {
    code: "EL",
    name: "UEFA Europa League",
    logo:
      "https://media.api-sports.io/football/leagues/3.png",
  },
  {
    code: "UCL",
    name: "UEFA Conference League",
    logo:
      "https://media.api-sports.io/football/leagues/848.png",
  },
  {
    code: "FR",
    name: "International & Club Friendlies",
    logo:
      "https://media.api-sports.io/football/leagues/10.png",
  },
  {
    code: "BL1",
    name: "Bundesliga",
    logo:
      "https://crests.football-data.org/BL1.png",
  },
  {
    code: "DED",
    name: "Eredivisie",
    logo:
      "https://crests.football-data.org/ED.png",
  },
  {
    code: "BSA",
    name:
      "Campeonato Brasileiro Série A",
    logo:
      "https://crests.football-data.org/bsa.png",
  },
  {
    code: "PD",
    name: "La Liga",
    logo:
      "https://crests.football-data.org/PD.png",
  },
  {
    code: "FL1",
    name: "Ligue 1",
    logo:
      "https://crests.football-data.org/FL1.png",
  },
  {
    code: "ELC",
    name: "Championship",
    logo:
      "https://crests.football-data.org/ELC.png",
  },
  {
    code: "PPL",
    name: "Primeira Liga",
    logo:
      "https://crests.football-data.org/PPL.png",
  },
  {
    code: "EC",
    name:
      "European Championship",
    logo:
      "https://crests.football-data.org/ec.png",
  },
  {
    code: "SA",
    name: "Serie A",
    logo:
      "https://crests.football-data.org/SA.png",
  },
  {
    code: "PL",
    name: "Premier League",
    logo:
      "https://crests.football-data.org/PL.png",
  },
];

function LeagueLogo({
  league,
  styles,
  theme,
}) {
  return (
    <CompetitionLogo
      code={league.code}
      uri={league.logo}
      size={54}
      theme={theme}
      style={styles.logo}
    />
  );
}

export default function LeaguesScreen() {
  const { theme } =
    useAppTheme();

  const styles =
    createStyles(theme);

  const [favorites, setFavorites] =
    useState([]);

  useEffect(() => {
    loadFavorites();
  }, []);

  async function loadFavorites() {
    try {
      const saved =
        await AsyncStorage.getItem(
          STORAGE_KEY
        );

      if (saved) {
        setFavorites(
          JSON.parse(saved)
        );
      }
    } catch (error) {
      console.log(
        "LOAD FAVORITES ERROR:",
        error
      );
    }
  }

  async function toggleFavorite(
    league
  ) {
    try {
      const exists =
        favorites.find(
          (item) =>
            item.code ===
            league.code
        );

      let updatedFavorites;

      if (exists) {
        updatedFavorites =
          favorites.filter(
            (item) =>
              item.code !==
              league.code
          );
      } else {
        updatedFavorites = [
          ...favorites,
          league,
        ];
      }

      setFavorites(
        updatedFavorites
      );

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(
          updatedFavorites
        )
      );
    } catch (error) {
      console.log(
        "FAVORITE ERROR:",
        error
      );
    }
  }

  function isFavorite(code) {
    return favorites.some(
      (item) =>
        item.code === code
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          Leagues
        </Text>

        <View style={styles.headerGlow}>
          <Pressable style={styles.searchBtn}>
            <Ionicons
              name="trophy"
              size={24}
              color={theme.text}
            />
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
      >
        {leagues.map(
          (league, index) => (
            <AnimatedGlowCard
              key={league.code}
              style={styles.leagueCard}
              glowColor={theme.accent}
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
              <View style={styles.left}>
                <LeagueLogo
                  league={league}
                  styles={styles}
                  theme={theme}
                />

                <View style={{ flex: 1 }}>
                  <Text
                    style={styles.name}
                    numberOfLines={2}
                  >
                    {league.name}
                  </Text>

                  <Text style={styles.code}>
                    {league.code}
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  toggleFavorite(league);
                }}
                style={styles.starBtn}
              >
                <Ionicons
                  name={
                    isFavorite(
                      league.code
                    )
                      ? "star"
                      : "star-outline"
                  }
                  size={24}
                  color={theme.gold}
                />
              </Pressable>
            </AnimatedGlowCard>
          )
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function createStyles(theme) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        theme.background,
      paddingTop: 55,
      paddingHorizontal: 18,
    },

    header: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 28,
    },

    title: {
      color: theme.text,
      fontSize: 32,
      fontWeight: "bold",
    },

    headerGlow: {
      shadowColor:
        theme.accent,
      shadowOpacity: 0.7,
      shadowRadius: 14,
      elevation: 10,
    },

    searchBtn: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor:
        theme.card,
      justifyContent:
        "center",
      alignItems:
        "center",
      borderWidth: 1,
      borderColor:
        theme.border,
    },

    leagueCard: {
      backgroundColor:
        theme.card,
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      borderWidth: 1,
      borderColor:
        theme.border,
    },

    left: {
      flexDirection: "row",
      alignItems:
        "center",
      flex: 1,
    },

    logo: {
      width: 54,
      height: 54,
      marginRight: 16,
    },

    fallbackLogo: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor:
        theme.cardAlt,
      justifyContent:
        "center",
      alignItems:
        "center",
      marginRight: 16,
    },

    name: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "700",
      paddingRight: 12,
    },

    code: {
      color:
        theme.subText,
      marginTop: 6,
      fontSize: 13,
    },

    starBtn: {
      paddingLeft: 12,
    },
  });
}
