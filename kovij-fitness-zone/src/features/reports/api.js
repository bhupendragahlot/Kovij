import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../app/http";
import { gymDayKey } from "../../shared/lib/format";

export const reportKeys = {
  all: ["reports"],
  overview: (params) => ["reports", "overview", params],
  notComingIn: (params) => ["reports", "not-coming-in", params],
};

export function useReportOverview(params) {
  return useQuery({
    queryKey: reportKeys.overview(params),
    queryFn: () => api.get("/admin/reports/overview", params),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export function useNotComingIn(params) {
  return useQuery({
    queryKey: reportKeys.notComingIn(params),
    queryFn: () => api.get("/admin/reports/not-coming-in", params),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

const addDays = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Period presets in gym days (inclusive). */
export const PERIODS = [
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "90d", label: "Last 90 days" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Pick dates" },
];

export function periodDates(range, custom = {}, now = new Date()) {
  const today = gymDayKey(now);
  switch (range) {
    case "last-month": {
      const firstThis = `${today.slice(0, 8)}01`;
      const lastPrev = addDays(firstThis, -1);
      return { from: `${lastPrev.slice(0, 8)}01`, to: lastPrev };
    }
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "12m":
      return { from: addDays(today, -364), to: today };
    case "custom":
      return { from: custom.from || `${today.slice(0, 8)}01`, to: custom.to || today };
    default:
      return { from: `${today.slice(0, 8)}01`, to: today };
  }
}

export { addDays };
