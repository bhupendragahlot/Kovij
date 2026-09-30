import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import "@fontsource-variable/manrope";
import "./index.css";
import App from "./App.jsx";
import { store } from "./app/store";
import { queryClient } from "./app/queryClient";
import { ThemeSync } from "./app/theme";
import { registerServiceWorker } from "./app/pwa";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeSync />
        <App />
      </QueryClientProvider>
    </Provider>
  </React.StrictMode>
);

registerServiceWorker();
