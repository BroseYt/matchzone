/* eslint-disable react/no-unescaped-entities */
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from "react-native";

import colors from "../constants/colors";

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.logo}>
        FOOTBALL HUB
      </Text>

      <Text style={styles.sectionTitle}>
        Trending Matches
      </Text>

      <View style={styles.matchCard}>
        <View>
          <Text style={styles.team}>
            Arsenal
          </Text>

          <Text style={styles.team}>
            Chelsea
          </Text>
        </View>

        <View>
          <Text style={styles.score}>
            2 - 1
          </Text>

          <Text style={styles.live}>
            LIVE • 78'
          </Text>
        </View>
      </View>

      <View style={styles.matchCard}>
        <View>
          <Text style={styles.team}>
            Barcelona
          </Text>

          <Text style={styles.team}>
            Real Madrid
          </Text>
        </View>

        <View>
          <Text style={styles.score}>
            1 - 1
          </Text>

          <Text style={styles.live}>
            HT
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },

  logo: {
    color: colors.primary,
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 40,
    marginBottom: 30,
  },

  sectionTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 20,
  },

  matchCard: {
    backgroundColor: colors.card,
    padding: 20,
    borderRadius: 18,

    flexDirection: "row",
    justifyContent: "space-between",

    marginBottom: 20,
  },

  team: {
    color: colors.text,
    fontSize: 18,
    marginBottom: 10,
  },

  score: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "right",
  },

  live: {
    color: colors.primary,
    marginTop: 10,
    textAlign: "right",
  },
});
