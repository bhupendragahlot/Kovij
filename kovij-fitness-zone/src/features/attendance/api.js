import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";
import { retryDelay, retryIdempotent } from "../../app/queryClient";
import { gymDayKey } from "../../shared/lib/format";

export function useAttendance(date = gymDayKey()) {
  return useQuery({
    queryKey: qk.attendance.day(date),
    queryFn: () => api.get("/admin/attendance", { date }),
    refetchInterval: 60_000,
  });
}

/**
 * Check a member in. The server allows one visit per member per day, so a retry after a
 * dropped connection returns the existing visit rather than counting twice.
 */
export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post("/admin/attendance", payload),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.attendance.all });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}

export function useUndoCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attendanceId) => api.delete(`/admin/attendance/${attendanceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.attendance.all });
      queryClient.invalidateQueries({ queryKey: qk.dashboard });
    },
  });
}
