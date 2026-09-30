import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { retryDelay, retryIdempotent } from "../../app/queryClient";
import { gymDayKey } from "../../shared/lib/format";
import { downloadText } from "./lib";

/** Query keys for this module. Everything sits under ["attendance"], so the app-wide member invalidation reaches it. */
export const attendanceKeys = {
  all: ["attendance"],
  day: (date, memberId) => ["attendance", "day", date, memberId || null],
  month: (month) => ["attendance", "month", month],
  monthMembers: (params) => ["attendance", "month-members", params],
  memberSummary: (id) => ["attendance", "member", id, "summary"],
  memberMonth: (id, month) => ["attendance", "member", id, "month", month],
  memberHistory: (id, params) => ["attendance", "member", id, "history", params],
  memberQr: (id) => ["attendance", "member", id, "qr"],
  gym: ["attendance", "kiosk", "gym"],
};

/** After a visit changes: attendance views, today's dashboard numbers, and the member profile's visit tile. */
function invalidateVisits(queryClient) {
  queryClient.invalidateQueries({
    queryKey: attendanceKeys.all,
    // QR codes and the gym name don't change when someone checks in.
    predicate: (q) => !["qr", "gym"].includes(q.queryKey[q.queryKey.length - 1]),
  });
  queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["members", "detail"] });
}

// ── Reads ──────────────────────────────────────────────────────────────────

/** One day: visits, per-hour counts and the desk log. Today refreshes every minute. */
export function useAttendance(date = gymDayKey(), { memberId } = {}) {
  return useQuery({
    queryKey: attendanceKeys.day(date, memberId),
    queryFn: () => api.get("/admin/attendance", { date, memberId }),
    refetchInterval: date === gymDayKey() ? 60_000 : false,
    placeholderData: keepPreviousData,
  });
}

export function useAttendanceMonth(month) {
  return useQuery({
    queryKey: attendanceKeys.month(month),
    queryFn: () => api.get("/admin/attendance/month", { month }),
    placeholderData: keepPreviousData,
  });
}

export function useMonthMembers(params) {
  return useQuery({
    queryKey: attendanceKeys.monthMembers(params),
    queryFn: () => api.get("/admin/attendance/month/members", params),
    placeholderData: keepPreviousData,
  });
}

export function useMemberAttendanceSummary(memberId) {
  return useQuery({
    queryKey: attendanceKeys.memberSummary(memberId),
    queryFn: () => api.get(`/admin/attendance/members/${memberId}/summary`),
    enabled: Boolean(memberId),
  });
}

export function useMemberAttendanceMonth(memberId, month) {
  return useQuery({
    queryKey: attendanceKeys.memberMonth(memberId, month),
    queryFn: () => api.get(`/admin/attendance/members/${memberId}/month`, { month }),
    enabled: Boolean(memberId),
    placeholderData: keepPreviousData,
  });
}

export function useMemberAttendanceHistory(memberId, params) {
  return useQuery({
    queryKey: attendanceKeys.memberHistory(memberId, params),
    queryFn: () => api.get(`/admin/attendance/members/${memberId}/history`, params),
    enabled: Boolean(memberId),
    placeholderData: keepPreviousData,
  });
}

/** The member's entry QR code (front desk and up). */
export function useMemberQr(memberId, { enabled = true } = {}) {
  return useQuery({
    queryKey: attendanceKeys.memberQr(memberId),
    queryFn: () => api.get(`/admin/attendance/members/${memberId}/qr`),
    enabled: Boolean(memberId) && enabled,
    staleTime: 5 * 60_000,
  });
}

/** Gym name and logo for the kiosk screen (public settings). */
export function useKioskGym() {
  return useQuery({
    queryKey: attendanceKeys.gym,
    queryFn: () => api.get("/settings"),
    select: (s) => ({ gymName: s.gymName, logoUrl: s.logoUrl }),
    staleTime: Infinity,
  });
}

// ── Writes (callers pass an idempotencyKey per action; retries reuse it) ────

/**
 * Check a member in. The server allows one visit per member per day, so a retry after a
 * dropped connection returns the existing visit rather than counting twice.
 */
export function useCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ idempotencyKey, ...payload }) => api.post("/admin/attendance", payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateVisits(queryClient),
  });
}

export function useUndoCheckIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attendanceId) => api.delete(`/admin/attendance/${attendanceId}`),
    onSuccess: () => invalidateVisits(queryClient),
  });
}

export function useCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ attendanceId, method = "desk", idempotencyKey }) =>
      api.post(`/admin/attendance/${attendanceId}/check-out`, { method }, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateVisits(queryClient),
  });
}

export function useUndoCheckOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attendanceId) => api.delete(`/admin/attendance/${attendanceId}/check-out`),
    onSuccess: () => invalidateVisits(queryClient),
  });
}

/** A QR scan (or a typed member code at the desk). `source: "kiosk"` never lets anyone in without a plan. */
export function useScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, mode = "auto", source = "desk", idempotencyKey }) =>
      api.post("/admin/attendance/scan", { code, mode, source }, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateVisits(queryClient),
  });
}

/** Replace a lost or shared QR code; the old one stops working at once. */
export function useReissueQr(memberId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reason, idempotencyKey }) => api.post(`/admin/attendance/members/${memberId}/qr/reissue`, { reason }, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: (data) => {
      queryClient.setQueryData(attendanceKeys.memberQr(memberId), data);
      // The desk log shows the replacement.
      queryClient.invalidateQueries({ queryKey: ["attendance", "day", gymDayKey()] });
    },
  });
}

/** Download a month as CSV: one row per visit, or one row per member. */
export async function downloadAttendanceCsv({ month, kind = "visits" }) {
  const text = await api.text("/admin/attendance/export", { month, kind });
  downloadText(text, `attendance-${kind === "members" ? "members-" : ""}${month}.csv`);
}
