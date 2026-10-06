import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../app/http";
import { retryDelay, retryIdempotent } from "../../../app/queryClient";
import { exerciseDbRetry } from "../../exercisedb/format";
import { tk } from "../api";

/**
 * ExerciseDB search and scheduled exercises (staff). Scheduled exercises sit under ["training"] so
 * any training change refreshes them; ExerciseDB lookups don't change with our data, so they don't.
 */
export const xk = {
  filters: ["exercisedb", "filters"],
  search: (params) => ["exercisedb", "search", params],
  exercise: (id) => ["exercisedb", "exercise", id],
  assignments: [...tk.all, "exercise-assignments"],
  overview: (params) => [...tk.all, "exercise-assignments", "overview", params],
  member: (id) => [...tk.all, "exercise-assignments", "member", id],
  history: (id, params) => [...tk.all, "exercise-assignments", "member", id, "history", params],
};

// ── ExerciseDB (through our server) ────────────────────────────────────────

export function useExerciseDbFilters() {
  return useQuery({ queryKey: xk.filters, queryFn: () => api.get("/admin/exercisedb/filters"), staleTime: 60 * 60_000, retry: exerciseDbRetry });
}

export function useExerciseDbSearch(params, { enabled = true } = {}) {
  return useInfiniteQuery({
    queryKey: xk.search(params),
    queryFn: ({ pageParam }) => api.get("/admin/exercisedb/exercises", { ...params, after: pageParam || undefined }),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor || undefined,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
    retry: exerciseDbRetry,
    enabled,
  });
}

export function useExerciseDbExercise(id) {
  return useQuery({
    queryKey: xk.exercise(id),
    queryFn: () => api.get(`/admin/exercisedb/exercises/${encodeURIComponent(id)}`),
    select: (d) => d.exercise,
    enabled: Boolean(id),
    staleTime: 30 * 60_000,
    retry: exerciseDbRetry,
  });
}

/** For ExerciseDbBrowser. */
export const staffExerciseDb = { useFilters: useExerciseDbFilters, useSearch: useExerciseDbSearch };

// ── Scheduled exercises ────────────────────────────────────────────────────

export function useExerciseAssignments(params, { enabled = true } = {}) {
  return useQuery({ queryKey: xk.overview(params), queryFn: () => api.get("/admin/exercise-assignments", params), placeholderData: keepPreviousData, enabled });
}

export function useMemberExerciseSchedule(memberId, { enabled = true } = {}) {
  return useQuery({
    queryKey: xk.member(memberId),
    queryFn: () => api.get(`/admin/exercise-assignments/members/${memberId}`),
    enabled: Boolean(memberId) && enabled,
  });
}

export function useMemberExerciseHistory(memberId, params, { enabled = true } = {}) {
  return useQuery({
    queryKey: xk.history(memberId, params),
    queryFn: () => api.get(`/admin/exercise-assignments/members/${memberId}/history`, params),
    placeholderData: keepPreviousData,
    enabled: Boolean(memberId) && enabled,
  });
}

function useAssignmentMutation(mutationFn, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: xk.assignments });
      options.onSuccess?.(...args);
    },
  });
}

/** Schedules exercises and messages the member, so it carries an Idempotency-Key and retries safely. */
export const useAssignExercises = () =>
  useAssignmentMutation(({ memberId, payload, idempotencyKey }) => api.post(`/admin/exercise-assignments/members/${memberId}`, payload, { idempotencyKey }), {
    retry: retryIdempotent,
    retryDelay,
  });

export const useUpdateExerciseAssignment = () => useAssignmentMutation(({ id, payload }) => api.patch(`/admin/exercise-assignments/${id}`, payload));
export const useCancelExerciseAssignment = () => useAssignmentMutation((id) => api.post(`/admin/exercise-assignments/${id}/cancel`, {}));
/** Tick off (or undo) for the member. Both are safe to repeat. */
export const useSetExerciseDone = () =>
  useAssignmentMutation(({ id, done }) => api.post(`/admin/exercise-assignments/${id}/${done ? "complete" : "reopen"}`, {}));
