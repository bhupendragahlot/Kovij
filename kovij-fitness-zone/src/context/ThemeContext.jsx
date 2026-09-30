import { useThemeControls } from "../app/theme";

/**
 * Compatibility adapter for the public website and member portal, which call `useTheme()`.
 * Theme state lives in the Redux ui slice (see app/theme.js); there is no separate context.
 */
export function useTheme() {
  const { theme, toggleTheme } = useThemeControls();
  return { theme, toggleTheme };
}
