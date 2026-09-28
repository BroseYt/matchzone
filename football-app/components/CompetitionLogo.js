import { StyleSheet, Text, View } from "react-native";

import { useEffect, useMemo, useState } from "react";

import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import {
  getCompetition,
} from "../constants/competitions";

export default function CompetitionLogo({
  code,
  uri,
  size = 54,
  theme,
  style,
}) {
  const competition = getCompetition(code);
  const sources = useMemo(
    () =>
      [...new Set([uri, competition?.logo].filter(Boolean))],
    [competition?.logo, uri]
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const image = sources[sourceIndex];

  useEffect(() => {
    setSourceIndex(0);
  }, [sources]);

  if (code === "WC") {
    return (
      <View
        style={[
          styles.badge,
          {
            width: size,
            height: size,
            borderRadius: size * 0.24,
            backgroundColor: "#6D123F",
            borderColor: "#E7B85C",
          },
          style,
        ]}
      >
        <Ionicons
          name="trophy"
          size={size * 0.38}
          color="#E7B85C"
        />

        <Text
          style={[
            styles.worldCupText,
            { fontSize: size * 0.2 },
          ]}
        >
          26
        </Text>
      </View>
    );
  }

  if (image) {
    return (
      <View
        style={[
          styles.imageBadge,
          {
            width: size,
            height: size,
            borderRadius: size * 0.24,
            backgroundColor: "#F8FAFC",
            borderColor: theme?.border || "#CBD5E1",
          },
          style,
        ]}
      >
        <Image
          source={{ uri: image }}
          style={{
            width: size * 0.82,
            height: size * 0.82,
          }}
          contentFit="contain"
          transition={120}
          onError={() =>
            setSourceIndex((current) => current + 1)
          }
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size * 0.24,
          backgroundColor:
            competition?.accent || theme?.cardAlt || "#13213D",
          borderColor: theme?.border || "#294164",
        },
        style,
      ]}
    >
      <Ionicons
        name="trophy"
        size={size * 0.34}
        color={theme?.text || "white"}
      />

      <Text
        style={[
          styles.code,
          {
            color: theme?.text || "white",
            fontSize: size * 0.15,
          },
        ]}
      >
        {code || "CUP"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    overflow: "hidden",
  },

  imageBadge: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    overflow: "hidden",
  },

  code: {
    fontWeight: "900",
    marginTop: 2,
  },

  worldCupText: {
    color: "white",
    fontWeight: "900",
    lineHeight: 14,
  },
});
