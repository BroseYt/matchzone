import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";

import HomeScreen from "../screens/HomeScreen";
import LiveScreen from "../screens/LiveScreen";
import PredictionScreen from "../screens/PredictionScreen";

const Tab = createBottomTabNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,

          tabBarStyle: {
            backgroundColor: "#151B2E",
            borderTopWidth: 0,
            height: 65,
            paddingBottom: 8,
            paddingTop: 8,
          },

          tabBarActiveTintColor: "#00FF87",
          tabBarInactiveTintColor: "#8E9AAF",
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
        />

        <Tab.Screen
          name="Live"
          component={LiveScreen}
        />

        <Tab.Screen
          name="Predictions"
          component={PredictionScreen}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}