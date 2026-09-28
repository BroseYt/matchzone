import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "app_theme_mode";

export async function saveThemeMode(isDark) {
  await AsyncStorage.setItem(
    THEME_KEY,
    JSON.stringify(isDark)
  );
}

export async function loadThemeMode() {
  const saved = await AsyncStorage.getItem(THEME_KEY);

  if (saved === null) return true;

  return JSON.parse(saved);
}