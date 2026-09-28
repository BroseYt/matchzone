import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { footballFetch } from "./footballApi";

export const NOTIFICATION_SETTINGS_KEY = "notification_settings";
export const EXPO_PUSH_TOKEN_KEY = "expo_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications() {
  try {
    if (Platform.OS === "web") {
      return {
        success: false,
        message:
          "Push notifications do not work on web preview. Test them on a real Android/iPhone build.",
        token: null,
      };
    }

    if (!Device.isDevice) {
      return {
        success: false,
        message:
          "Push notifications need a real physical phone, not a simulator.",
        token: null,
      };
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "MatchZone Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#00D9FF",
        sound: "default",
      });
      await Notifications.setNotificationChannelAsync("goals", {
        name: "Goal alerts",
        description: "Immediate score alerts for matches you follow",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 300, 150, 300, 150, 450],
        lightColor: "#00D9FF",
        sound: "default",
        enableVibrate: true,
        showBadge: true,
      });
    }

    const existingStatus = await Notifications.getPermissionsAsync();

    let finalStatus = existingStatus.status;

    if (existingStatus.status !== "granted") {
      const permission = await Notifications.requestPermissionsAsync();
      finalStatus = permission.status;
    }

    if (finalStatus !== "granted") {
      return {
        success: false,
        message:
          "Notification permission was not granted. Please allow notifications in phone settings.",
        token: null,
      };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ||
      Constants.easConfig?.projectId;

    if (!projectId) {
      return {
        success: false,
        message:
          "Missing EAS projectId. Create a real development/preview build with EAS first.",
        token: null,
      };
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return {
      success: true,
      message: "Notifications enabled successfully.",
      token: token.data,
    };
  } catch (error) {
    console.log("PUSH REGISTER ERROR:", error);

    return {
      success: false,
      message:
        error.message || "Could not register for notifications.",
      token: null,
    };
  }
}

export async function sendTestNotification() {
  try {
    if (Platform.OS === "web") {
      throw new Error(
        "Test notifications do not work on web preview. Use Android/iPhone."
      );
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "MatchZone",
        body: "Notifications are working correctly.",
        sound: "default",
      },
      trigger: {
        seconds: 2,
      },
    });

    return true;
  } catch (error) {
    console.log("TEST NOTIFICATION ERROR:", error);
    throw error;
  }
}

export async function scheduleKickoffReminder(match) {
  try {
    if (Platform.OS === "web") {
      return null;
    }

    const kickoffTime = new Date(match.utcDate).getTime();
    const reminderTime = kickoffTime - 15 * 60 * 1000;
    const now = Date.now();

    if (reminderTime <= now) {
      return null;
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Match starting soon",
        body: `${match.homeTeam?.shortName || match.homeTeam?.name} vs ${
          match.awayTeam?.shortName || match.awayTeam?.name
        } starts in 15 minutes.`,
        sound: "default",
        data: {
          matchId: match.id,
        },
      },
      trigger: {
        date: new Date(reminderTime),
      },
    });

    return id;
  } catch (error) {
    console.log("KICKOFF REMINDER ERROR:", error);
    return null;
  }
}

export async function cancelAllNotifications() {
  try {
    if (Platform.OS === "web") {
      return false;
    }

    await Notifications.cancelAllScheduledNotificationsAsync();

    return true;
  } catch (error) {
    console.log("CANCEL NOTIFICATIONS ERROR:", error);
    return false;
  }
}

async function alertRequest(path, method, body) {
  const response = await footballFetch(path, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Could not update match alerts.");
  }

  return data;
}

export async function registerDeviceAlerts(token, settings) {
  return alertRequest("/alerts/devices", "POST", {
    token,
    settings,
  });
}

export async function unregisterDeviceAlerts(token) {
  if (!token) return false;

  await alertRequest("/alerts/devices", "DELETE", { token });
  return true;
}

export async function subscribeToMatchAlerts(
  match,
  token,
  settings,
  syncScore = false
) {
  if (!match?.id || !token) {
    throw new Error("Enable push notifications before following a match.");
  }

  return alertRequest(
    `/alerts/matches/${encodeURIComponent(match.id)}`,
    "POST",
    { token, match, settings, syncScore }
  );
}

export async function unsubscribeFromMatchAlerts(matchId, token) {
  if (!matchId || !token) return false;

  await alertRequest(
    `/alerts/matches/${encodeURIComponent(matchId)}`,
    "DELETE",
    { token }
  );
  return true;
}

export async function getMatchAlertStatus(matchId, token) {
  if (!matchId || !token) return false;

  const data = await alertRequest(
    `/alerts/matches/${encodeURIComponent(
      matchId
    )}?token=${encodeURIComponent(token)}`,
    "GET"
  );
  return Boolean(data.subscribed);
}

export async function getStoredNotificationPreferences() {
  const [token, savedSettings] = await Promise.all([
    AsyncStorage.getItem(EXPO_PUSH_TOKEN_KEY),
    AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY),
  ]);

  return {
    token,
    settings: savedSettings ? JSON.parse(savedSettings) : null,
  };
}

export async function sendLocalGoalNotification(match) {
  if (Platform.OS === "web") return null;

  const home = match?.score?.fullTime?.home ?? 0;
  const away = match?.score?.fullTime?.away ?? 0;

  return Notifications.scheduleNotificationAsync({
    content: {
      title: "GOAL",
      body: `${match?.homeTeam?.name || "Home"} ${home}-${away} ${
        match?.awayTeam?.name || "Away"
      }`,
      sound: "default",
      data: { matchId: match?.id },
    },
    trigger: null,
  });
}
