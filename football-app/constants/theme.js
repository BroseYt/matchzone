import {
  darkTheme,
  lightTheme,
} from "../context/ThemeContext";

export function getTheme(isDark = true) {
  return isDark ? darkTheme : lightTheme;
}

export {
  lightTheme,
  darkTheme,
};
