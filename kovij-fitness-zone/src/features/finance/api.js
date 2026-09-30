import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../app/http";

export const financeKeys = {
  all: ["finance"],
  overview: (month) => ["finance", "overview", month],
};

/** Revenue page figures for one month (headline tiles are always "so far" for today, month, year). */
export function useFinanceOverview(month) {
  return useQuery({
    queryKey: financeKeys.overview(month),
    queryFn: () => api.get("/admin/finance/overview", { month }),
    placeholderData: keepPreviousData,
  });
}
