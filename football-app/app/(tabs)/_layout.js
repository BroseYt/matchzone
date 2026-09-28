import { Tabs } from "expo-router";

import {
  Ionicons,
  FontAwesome5,
} from "@expo/vector-icons";

import {
  useAppTheme,
} from "../../context/ThemeContext";

export default function TabLayout() {
  const { theme } = useAppTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: true,

        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopWidth: 1,
          borderTopColor: theme.border,
          height: 74,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 0,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },

        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.subText,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="live"
        options={{
          title: "Watch Hub",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "play-circle" : "play-circle-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="favorites"
        options={{
          title: "Favorites",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? "star" : "star-outline"}
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="predictions"
        options={{
          title: "Predictions",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={
                focused
                  ? "analytics"
                  : "analytics-outline"
              }
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="leagues"
        options={{
          title: "Leagues",
          tabBarIcon: ({ color, size }) => (
            <FontAwesome5
              name="trophy"
              size={size - 2}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
