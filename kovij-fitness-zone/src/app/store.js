import { configureStore, createListenerMiddleware } from "@reduxjs/toolkit";
import uiReducer, { persistUi } from "./uiSlice";
import sessionReducer, { persistSession } from "../features/auth/sessionSlice";
import toastReducer from "../shared/ui/toast/toastSlice";

/**
 * Client/UI state only (theme, layout, staff session, toasts).
 * Server data (members, payments, …) lives in TanStack Query, never in Redux.
 */
const persistence = createListenerMiddleware();
persistence.startListening({
  predicate: (action, current, previous) => current.ui !== previous.ui || current.session !== previous.session,
  effect: (action, api) => {
    const state = api.getState();
    persistUi(state.ui);
    persistSession(state.session);
  },
});

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    session: sessionReducer,
    toasts: toastReducer,
  },
  middleware: (getDefault) => getDefault().prepend(persistence.middleware),
});
