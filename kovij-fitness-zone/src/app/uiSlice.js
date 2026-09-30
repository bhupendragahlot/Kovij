import { createSlice } from "@reduxjs/toolkit";
import { storage } from "../shared/lib/storage";

export const THEME_STORAGE_KEY = "theme"; // shared with the public website
const SIDEBAR_KEY = "kv.sidebarCollapsed";
const THEMES = ["light", "dark", "system"];

function initialTheme() {
  const saved = typeof window !== "undefined" ? storage.getRaw(THEME_STORAGE_KEY) : null;
  return THEMES.includes(saved) ? saved : "system";
}

const uiSlice = createSlice({
  name: "ui",
  initialState: () => ({
    /** User preference; "system" follows the device setting. */
    theme: initialTheme(),
    sidebarCollapsed: typeof window !== "undefined" ? Boolean(storage.get(SIDEBAR_KEY, false)) : false,
    commandPaletteOpen: false,
  }),
  reducers: {
    themeChanged(state, { payload }) {
      if (THEMES.includes(payload)) state.theme = payload;
    },
    sidebarToggled(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    commandPaletteSet(state, { payload }) {
      state.commandPaletteOpen = Boolean(payload);
    },
  },
});

export const { themeChanged, sidebarToggled, commandPaletteSet } = uiSlice.actions;
export default uiSlice.reducer;

export const selectThemePreference = (s) => s.ui.theme;
export const selectSidebarCollapsed = (s) => s.ui.sidebarCollapsed;
export const selectCommandPaletteOpen = (s) => s.ui.commandPaletteOpen;

export function persistUi(ui) {
  storage.setRaw(THEME_STORAGE_KEY, ui.theme);
  storage.set(SIDEBAR_KEY, ui.sidebarCollapsed);
}
