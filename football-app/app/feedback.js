import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";

import { useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "../services/firebase";
import { useAppTheme } from "../context/ThemeContext";

export default function FeedbackScreen() {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendFeedback() {
    if (!message.trim()) {
      Alert.alert("Empty message", "Please type your feedback first.");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "feedback"), {
        message: message.trim(),
        userEmail: auth.currentUser?.email || "Guest",
        userId: auth.currentUser?.uid || null,
        app: "MatchZone",
        status: "new",
        createdAt: serverTimestamp(),
      });

      setMessage("");

      Alert.alert(
        "Feedback sent",
        "Thank you. Your feedback has been saved successfully."
      );

      router.back();
    } catch (error) {
      console.log("FEEDBACK ERROR:", error);

      Alert.alert(
        "Feedback failed",
        "Could not save your feedback right now."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.text} />
        </Pressable>

        <Text style={styles.title}>Feedback</Text>
      </View>

      <Text style={styles.label}>Tell us what to improve</Text>

      <Text style={styles.helper}>
        Your message will be saved securely so the MatchZone team can review it.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Type your message here..."
        placeholderTextColor={theme.subText}
        value={message}
        onChangeText={setMessage}
        multiline
      />

      <Pressable
        style={styles.sendBtn}
        onPress={sendFeedback}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color={theme.onAccent} />
        ) : (
          <>
            <Ionicons name="send" size={22} color={theme.onAccent} />
            <Text style={styles.sendText}>Send Feedback</Text>
          </>
        )}
      </Pressable>
    </View>
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

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 30,
    },

    backBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.card,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },

    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: "bold",
    },

    label: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 8,
    },

    helper: {
      color: theme.subText,
      lineHeight: 20,
      marginBottom: 16,
    },

    input: {
      backgroundColor: theme.card,
      color: theme.text,
      borderRadius: 20,
      padding: 18,
      minHeight: 190,
      textAlignVertical: "top",
      borderWidth: 1,
      borderColor: theme.border,
    },

    sendBtn: {
      backgroundColor: theme.accent,
      borderRadius: 30,
      paddingVertical: 16,
      marginTop: 22,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },

    sendText: {
      color: theme.onAccent,
      fontWeight: "bold",
      marginLeft: 10,
    },
  });
}
