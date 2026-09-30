import { createSlice, nanoid } from "@reduxjs/toolkit";

/**
 * Toasts are plain data in the store. An optional action (e.g. Undo) is a callback, which
 * is not serialisable, so it lives in this module-level registry keyed by toast id.
 */
export const toastActionRegistry = new Map();

const toastSlice = createSlice({
  name: "toasts",
  initialState: { items: [] },
  reducers: {
    toastAdded: {
      reducer(state, { payload }) {
        state.items = [...state.items.filter((t) => t.id !== payload.id), payload].slice(-4);
      },
      prepare({ id, tone = "neutral", title, description, actionLabel, duration }) {
        return {
          payload: {
            id: id || nanoid(),
            tone,
            title,
            description,
            actionLabel,
            duration: duration ?? (tone === "danger" ? 8000 : 5000),
          },
        };
      },
    },
    toastDismissed(state, { payload }) {
      state.items = state.items.filter((t) => t.id !== payload);
    },
  },
});

export const { toastAdded, toastDismissed } = toastSlice.actions;
export default toastSlice.reducer;
export const selectToasts = (s) => s.toasts.items;
