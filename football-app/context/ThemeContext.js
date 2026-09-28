import {
  Appearance,
  Platform,
} from "react-native";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ThemeContext = createContext(null);
const THEME_KEY = "matchzone_theme_mode";

export const darkTheme = {
  isDark: true,
  background: "#020617",
  card: "#081028",
  cardAlt: "#0B1D39",
  text: "#F8FAFC",
  subText: "#94A3B8",
  accent: "#00D9FF",
  onAccent: "#020617",
  border: "#16345F",
  danger: "#EF4444",
  onDanger: "#FFFFFF",
  success: "#22C55E",
  warning: "#F59E0B",
  gold: "#FACC15",
  overlay: "rgba(0,0,0,0.72)",
  shadow: "#000000",
};

export const lightTheme = {
  isDark: false,
  background: "#F4F7FB",
  card: "#FFFFFF",
  cardAlt: "#EAF0F8",
  text: "#0F172A",
  subText: "#526176",
  accent: "#087CF0",
  onAccent: "#FFFFFF",
  border: "#D5DFEC",
  danger: "#DC2626",
  onDanger: "#FFFFFF",
  success: "#15803D",
  warning: "#B45309",
  gold: "#B77900",
  overlay: "rgba(15,23,42,0.48)",
  shadow: "#64748B",
};

function syncSystemTheme(darkMode) {
  if (
    Platform.OS !== "web" &&
    typeof Appearance.setColorScheme === "function"
  ) {
    Appearance.setColorScheme(darkMode ? "dark" : "light");
  }

  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.style.colorScheme =
      darkMode ? "dark" : "light";
    document.body.style.backgroundColor = darkMode
      ? darkTheme.background
      : lightTheme.background;
  }
}

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(true);
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        const nextDarkMode =
          saved === null ? true : JSON.parse(saved);

        if (active) {
          setDarkMode(Boolean(nextDarkMode));
          syncSystemTheme(Boolean(nextDarkMode));
        }
      } catch (error) {
        console.log("THEME LOAD ERROR:", error);

        if (active) {
          syncSystemTheme(true);
        }
      } finally {
        if (active) {
          setThemeReady(true);
        }
      }
    }

    loadTheme();
    return () => {
      active = false;
    };
  }, []);

  async function toggleTheme(value) {
    const nextDarkMode = Boolean(value);

    setDarkMode(nextDarkMode);
    syncSystemTheme(nextDarkMode);

    try {
      await AsyncStorage.setItem(
        THEME_KEY,
        JSON.stringify(nextDarkMode)
      );
    } catch (error) {
      console.log("THEME SAVE ERROR:", error);
    }
  }

  const value = useMemo(
    () => ({
      theme: darkMode ? darkTheme : lightTheme,
      darkMode,
      themeReady,
      toggleTheme,
    }),
    [darkMode, themeReady]
  );

  if (!themeReady) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useAppTheme must be used inside ThemeProvider."
    );
  }

  return context;
}
