/** Monday-first weekday names, matching the server's heatmap rows. */
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 6 → "6a", 18 → "6p" (add "m" for "6am"). */
export const hourLabel = (h) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`;
