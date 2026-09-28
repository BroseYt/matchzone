import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";

import colors from "../constants/colors";

export default function PredictionScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Predictions
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },

  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "bold",
    marginTop: 40,
  },
});