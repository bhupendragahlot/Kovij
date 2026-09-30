import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useMediaQuery } from "../shared/hooks/useMediaQuery";
import { selectThemePreference, themeChanged } from "./uiSlice";

/** The theme actually on screen: the preference, or the device setting when "system". */
export function useResolvedTheme() {
  const preference = useSelector(selectThemePreference);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function useThemeControls() {
  const dispatch = useDispatch();
  const preference = useSelector(selectThemePreference);
  const resolved = useResolvedTheme();
  const setTheme = useCallback((t) => dispatch(themeChanged(t)), [dispatch]);
  const toggleTheme = useCallback(() => dispatch(themeChanged(resolved === "dark" ? "light" : "dark")), [dispatch, resolved]);
  return { preference, theme: resolved, setTheme, toggleTheme };
}

const THEME_COLORS = { light: "#eceef1", dark: "#0b0c0e" };

/** Applies the resolved theme to <html> (class + browser UI color). Render once at the root. */
export function ThemeSync() {
  const theme = useResolvedTheme();
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "theme-color";
      document.head.appendChild(meta);
    }
    meta.content = THEME_COLORS[theme];
  }, [theme]);
  return null;
}
