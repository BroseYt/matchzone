import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useEffect,
  useState,
} from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";

import { getVerifiedPlayerProfile } from "../services/stats";

export default function PlayerJerseyImage({
  playerName,
  playerId,
  teamLogo,
  uri,
  preferProvided = false,
  size = 48,
  style,
  theme,
  contentFit = "contain",
}) {
  const [resolvedUri, setResolvedUri] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    setFailed(false);
    setResolvedUri(null);

    async function resolveImage() {
      if (preferProvided && uri) {
        if (active) setResolvedUri(uri);
        return;
      }

      const details = await getVerifiedPlayerProfile(
        playerId,
        playerName
      );

      if (details?.photo) {
        if (active) setResolvedUri(details.photo);
        return;
      }

      if (active) setResolvedUri(null);
    }

    resolveImage();
    return () => {
      active = false;
    };
  }, [
    playerId,
    playerName,
    uri,
    preferProvided,
  ]);

  const dimensions = {
    width: size,
    height: size,
  };

  if (resolvedUri && !failed) {
    return (
      <View
        style={[
          styles.frame,
          dimensions,
          {
            backgroundColor: theme?.cardAlt,
            borderColor: theme?.border,
          },
          style,
        ]}
      >
        <Image
          source={{ uri: resolvedUri }}
          style={styles.image}
          contentFit={contentFit}
          transition={150}
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
          backgroundColor: theme?.cardAlt,
          borderColor: theme?.border,
        },
        style,
      ]}
      accessibilityLabel={`${playerName || "Player"} image unavailable`}
    >
      {teamLogo ? (
        <Image
          source={{ uri: teamLogo }}
          style={{
            width: size * 0.48,
            height: size * 0.48,
          }}
          contentFit="contain"
        />
      ) : (
        <Ionicons
          name="shirt-outline"
          size={Math.max(18, size * 0.38)}
          color={theme?.accent}
        />
      )}
      <Text
        style={[
          styles.initials,
          {
            color: theme?.text,
            fontSize: Math.max(8, size * 0.14),
          },
        ]}
      >
        {String(playerName || "Player")
          .split(/\s+/)
          .filter(Boolean)
          .slice(-2)
          .map((word) => word[0])
          .join("")
          .toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    overflow: "hidden",
    borderWidth: 1,
    justifyContent: "flex-end",
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
  },
  initials: {
    fontWeight: "900",
    marginTop: 2,
  },
});
