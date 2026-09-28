import { StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import {
  findWorldCupTeam,
  getFlagUrl,
} from "../constants/worldCup2026";

function getInitials(name) {
  const words = String(name || "Team")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function TeamBadge({
  team,
  uri,
  name,
  competitionCode,
  countryCode,
  size = 52,
  variant,
  theme,
  style,
}) {
  const displayName =
    name || team?.shortName || team?.name || team?.tla || "Team";
  const worldCupTeam = useMemo(
    () => findWorldCupTeam(displayName),
    [displayName]
  );
  const resolvedCountryCode =
    countryCode ||
    (competitionCode === "WC" ? worldCupTeam?.code : null);
  const imageUri = resolvedCountryCode
    ? getFlagUrl(resolvedCountryCode)
    : uri || team?.crest || null;
  const isFlag =
    variant === "flag" ||
    Boolean(resolvedCountryCode) ||
    String(imageUri || "").includes("flagcdn.com");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUri]);

  const dimensions = isFlag
    ? {
        width: size,
        height: Math.round(size * 0.68),
        borderRadius: Math.max(4, Math.round(size * 0.1)),
      }
    : {
        width: size,
        height: size,
        borderRadius: Math.max(8, Math.round(size * 0.22)),
      };

  if (imageUri && !failed) {
    return (
      <View
        style={[
          styles.frame,
          dimensions,
          {
            backgroundColor: theme?.cardAlt || "#13213D",
            borderColor: theme?.border || "#294164",
          },
          style,
        ]}
      >
        <Image
          source={{ uri: imageUri }}
          style={styles.image}
          contentFit="contain"
          transition={120}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        dimensions,
        {
          backgroundColor: theme?.cardAlt || "#13213D",
          borderColor: theme?.border || "#294164",
        },
        style,
      ]}
      accessibilityLabel={`${displayName} badge`}
    >
      <Ionicons
        name={isFlag ? "flag" : "shield-outline"}
        size={Math.max(14, size * 0.32)}
        color={theme?.accent || "#00D9FF"}
      />
      <Text
        numberOfLines={1}
        style={[
          styles.initials,
          {
            color: theme?.text || "#FFFFFF",
            fontSize: Math.max(8, size * 0.16),
          },
        ]}
      >
        {resolvedCountryCode
          ? resolvedCountryCode.toUpperCase().replace("-", " ")
          : getInitials(displayName)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  fallback: {
    overflow: "hidden",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  initials: {
    fontWeight: "900",
    marginTop: 1,
    textAlign: "center",
  },
});
