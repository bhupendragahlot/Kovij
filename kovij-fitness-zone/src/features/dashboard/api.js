import { useQuery } from "@tanstack/react-query";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";

/** The "Today" screen. Refreshes every minute while open so the desk sees new check-ins. */
export function useDashboard() {
  return useQuery({
    queryKey: qk.dashboard,
    queryFn: () => api.get("/admin/dashboard"),
    refetchInterval: 60_000,
  });
}
