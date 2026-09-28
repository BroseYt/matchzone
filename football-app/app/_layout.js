import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";

import {
  ThemeProvider,
  useAppTheme,
} from "../context/ThemeContext";

function AppStack() {
  const { theme } = useAppTheme();

  return (
    <>
      <StatusBar style={theme.isDark ? "light" : "dark"} />

      <Stack
        screenOptions={{
          headerShown: false,
          animation:
            Platform.OS === "ios"
              ? "ios_from_right"
              : "slide_from_right",
          animationDuration: 280,
          gestureEnabled: true,
          contentStyle: {
            backgroundColor: theme.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" />

        <Stack.Screen
          name="match/[id]"
          options={{
            presentation: "card",
            animation: "slide_from_bottom",
          }}
        />

        <Stack.Screen name="league/[id]" />
        <Stack.Screen name="team/[id]" />
        <Stack.Screen name="player/[id]" />
        <Stack.Screen name="watch/[id]" />
        <Stack.Screen name="legal/[document]" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="feedback" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppStack />
    </ThemeProvider>
  );
}
