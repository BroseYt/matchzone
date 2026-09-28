import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useAppTheme } from "../context/ThemeContext";
import {
  cancelAllNotifications,
  EXPO_PUSH_TOKEN_KEY,
  NOTIFICATION_SETTINGS_KEY,
  registerDeviceAlerts,
  registerForPushNotifications,
  sendTestNotification,
  unregisterDeviceAlerts,
} from "../services/notifications";

const defaultSettings = {
  goals: true,
  kickoff: true,
  fullTime: true,
  favoriteClubs: true,
  breakingNews: false,
  matchReminders: true,
};

export default function NotificationsScreen() {
  const { theme } = useAppTheme();
  const styles = createStyles(theme);

  const [settings, setSettings] = useState(defaultSettings);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushToken, setPushToken] = useState(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const saved = await AsyncStorage.getItem(
          NOTIFICATION_SETTINGS_KEY
        );
        const savedToken = await AsyncStorage.getItem(
          EXPO_PUSH_TOKEN_KEY
        );

        if (saved) setSettings(JSON.parse(saved));

        if (savedToken) {
          setPushToken(savedToken);
          setPushEnabled(true);
        }
      } catch (error) {
        console.log("NOTIFICATION LOAD ERROR:", error);
      }
    }

    loadSettings();
  }, []);

  async function toggleSetting(key) {
    try {
      const updated = {
        ...settings,
        [key]: !settings[key],
      };

      setSettings(updated);
      await AsyncStorage.setItem(
        NOTIFICATION_SETTINGS_KEY,
        JSON.stringify(updated)
      );

      if (pushToken) {
        await registerDeviceAlerts(pushToken, updated);
      }
    } catch (error) {
      console.log("SETTING TOGGLE ERROR:", error);
    }
  }

  async function enablePushNotifications() {
    try {
      setLoading(true);

      if (Platform.OS === "android") {
        Alert.alert(
          "Expo Go limitation",
          "Full push support is available in the development or installed app build."
        );
      }

      const result = await registerForPushNotifications();

      if (!result.success) {
        Alert.alert(
          "Notifications",
          result.message || "Could not enable notifications."
        );
        return;
      }

      setPushEnabled(true);
      setPushToken(result.token);
      await Promise.all([
        AsyncStorage.setItem(EXPO_PUSH_TOKEN_KEY, result.token),
        AsyncStorage.setItem(
          NOTIFICATION_SETTINGS_KEY,
          JSON.stringify(settings)
        ),
        registerDeviceAlerts(result.token, settings),
      ]);

      Alert.alert(
        "Notifications enabled",
        "Match alerts are ready on this device."
      );
    } catch (error) {
      console.log("ENABLE PUSH ERROR:", error);
      Alert.alert(
        "Could not enable notifications",
        error.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleTestNotification() {
    try {
      setTesting(true);
      await sendTestNotification();
      Alert.alert(
        "Test sent",
        "A notification should appear shortly on supported devices."
      );
    } catch (error) {
      console.log("TEST NOTIFICATION ERROR:", error);
      Alert.alert(
        "Notification failed",
        "Test notifications require a supported Android or iPhone build."
      );
    } finally {
      setTesting(false);
    }
  }

  async function disableNotifications() {
    try {
      await unregisterDeviceAlerts(pushToken);
      await cancelAllNotifications();
      await AsyncStorage.removeItem(EXPO_PUSH_TOKEN_KEY);
      setPushEnabled(false);
      setPushToken(null);
      Alert.alert("Disabled", "Notifications have been disabled.");
    } catch (error) {
      console.log("DISABLE NOTIFICATION ERROR:", error);
    }
  }

  const rows = [
    {
      section: "Match alerts",
      items: [
        {
          key: "goals",
          icon: "football",
          title: "Goal alerts",
          subtitle: "Get notified when goals are scored",
        },
        {
          key: "kickoff",
          icon: "time",
          title: "Kickoff alerts",
          subtitle: "Know when matches start",
        },
        {
          key: "fullTime",
          icon: "flag",
          title: "Full-time alerts",
          subtitle: "Receive final score updates",
        },
      ],
    },
    {
      section: "Favorites",
      items: [
        {
          key: "favoriteClubs",
          icon: "star",
          title: "Favorite club alerts",
          subtitle: "Only alerts for saved clubs",
        },
        {
          key: "matchReminders",
          icon: "calendar",
          title: "Match reminders",
          subtitle: "Remind me before kickoff",
        },
      ],
    },
    {
      section: "News",
      items: [
        {
          key: "breakingNews",
          icon: "newspaper",
          title: "Breaking news",
          subtitle: "Major football news alerts",
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={27} color={theme.text} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="notifications"
              size={34}
              color={theme.accent}
            />
          </View>
          <Text style={styles.heroTitle}>Match alerts</Text>
          <Text style={styles.heroSubtitle}>
            Control reminders, scores and football updates from one place.
          </Text>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: pushEnabled
                    ? theme.success
                    : theme.danger,
                },
              ]}
            />
            <Text style={styles.statusText}>
              {pushEnabled
                ? "Push notifications enabled"
                : "Push notifications disabled"}
            </Text>
          </View>
        </View>

        {!pushEnabled ? (
          <Pressable
            style={styles.primaryButton}
            onPress={enablePushNotifications}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={theme.onAccent} />
            ) : (
              <>
                <Ionicons
                  name="notifications"
                  size={21}
                  color={theme.onAccent}
                />
                <Text style={styles.primaryButtonText}>
                  Enable push notifications
                </Text>
              </>
            )}
          </Pressable>
        ) : (
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, styles.testButton]}
              onPress={handleTestNotification}
              disabled={testing}
            >
              {testing ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <>
                  <Ionicons
                    name="send"
                    size={19}
                    color={theme.onAccent}
                  />
                  <Text style={styles.actionButtonText}>Test</Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={[styles.actionButton, styles.disableButton]}
              onPress={disableNotifications}
            >
              <Ionicons
                name="close-circle"
                size={19}
                color={theme.onDanger}
              />
              <Text style={styles.disableButtonText}>Disable</Text>
            </Pressable>
          </View>
        )}

        {rows.map((group) => (
          <View key={group.section}>
            <Text style={styles.section}>{group.section}</Text>
            {group.items.map((item) => (
              <NotificationRow
                key={item.key}
                {...item}
                value={settings[item.key]}
                onChange={() => toggleSetting(item.key)}
                styles={styles}
                theme={theme}
              />
            ))}
          </View>
        ))}

        {pushToken ? (
          <View style={styles.tokenCard}>
            <Text style={styles.tokenTitle}>Device registered</Text>
            <Text style={styles.tokenText}>
              This device has a valid Expo push token. The full token remains
              hidden from the main interface.
            </Text>
          </View>
        ) : null}

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

function NotificationRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  styles,
  theme,
}) {
  return (
    <View style={styles.card}>
      <View style={styles.rowCopy}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={21} color={theme.accent} />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardSubtitle}>{subtitle}</Text>
        </View>
      </View>

      <Switch
        value={value}
        onValueChange={onChange}
        thumbColor={value ? theme.accent : theme.card}
        trackColor={{
          false: theme.border,
          true: theme.isDark ? "#164E63" : "#9CC9FA",
        }}
        ios_backgroundColor={theme.border}
      />
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
      marginBottom: 22,
    },
    backButton: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 13,
    },
    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: "900",
    },
    heroCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 23,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 17,
    },
    heroIcon: {
      width: 72,
      height: 72,
      borderRadius: 24,
      backgroundColor: theme.cardAlt,
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 14,
    },
    heroTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
    },
    heroSubtitle: {
      color: theme.subText,
      marginTop: 8,
      textAlign: "center",
      lineHeight: 20,
      fontSize: 12,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 15,
    },
    statusDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      marginRight: 7,
    },
    statusText: {
      color: theme.text,
      fontWeight: "700",
      fontSize: 12,
    },
    primaryButton: {
      backgroundColor: theme.accent,
      borderRadius: 18,
      padding: 16,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 22,
    },
    primaryButtonText: {
      color: theme.onAccent,
      fontWeight: "900",
      marginLeft: 9,
    },
    actionRow: {
      flexDirection: "row",
      marginBottom: 22,
    },
    actionButton: {
      flex: 1,
      borderRadius: 18,
      padding: 15,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
    },
    testButton: {
      backgroundColor: theme.accent,
      marginRight: 7,
    },
    disableButton: {
      backgroundColor: theme.danger,
      marginLeft: 7,
    },
    actionButtonText: {
      color: theme.onAccent,
      fontWeight: "900",
      marginLeft: 7,
    },
    disableButtonText: {
      color: theme.onDanger,
      fontWeight: "900",
      marginLeft: 7,
    },
    section: {
      color: theme.text,
      fontSize: 19,
      fontWeight: "900",
      marginBottom: 12,
      marginTop: 3,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 19,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    rowCopy: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 12,
    },
    iconBox: {
      width: 43,
      height: 43,
      borderRadius: 14,
      backgroundColor: theme.cardAlt,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 13,
    },
    textBlock: {
      flex: 1,
    },
    cardTitle: {
      color: theme.text,
      fontWeight: "800",
    },
    cardSubtitle: {
      color: theme.subText,
      fontSize: 11,
      marginTop: 4,
      lineHeight: 17,
    },
    tokenCard: {
      backgroundColor: theme.cardAlt,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 5,
    },
    tokenTitle: {
      color: theme.text,
      fontWeight: "800",
      marginBottom: 6,
    },
    tokenText: {
      color: theme.subText,
      fontSize: 11,
      lineHeight: 17,
    },
    bottomSpace: {
      height: 80,
    },
  });
}
