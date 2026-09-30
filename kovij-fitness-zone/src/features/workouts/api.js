import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";
import { retryDelay, retryIdempotent } from "../../app/queryClient";

/** Query keys for trainers, the exercise library and workouts. Everything sits under ["training"]. */
export const tk = {
  all: ["training"],
  trainers: ["training", "trainers"],
  trainer: (id) => ["training", "trainers", id],
  trainerMembers: (id, params) => ["training", "trainers", id, "members", params],
  me: ["training", "me"],
  logins: ["training", "logins"],
  performance: ["training", "performance"],
  exercises: (params) => ["training", "exercises", params],
  plans: (params) => ["training", "plans", params],
  plan: (id) => ["training", "plan", id],
  roster: (params) => ["training", "roster", params],
  member: (id) => ["training", "member", id],
  memberLogs: (id, params) => ["training", "member", id, "logs", params],
  progress: (id) => ["training", "member", id, "progress"],
  exerciseProgress: (id, exerciseId) => ["training", "member", id, "progress", exerciseId],
};

/** Training data is small and interlinked: a write refreshes all of it. */
function useTrainingMutation(mutationFn, { members = false, ...options } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: tk.all });
      queryClient.invalidateQueries({ queryKey: qk.trainers });
      if (members) queryClient.invalidateQueries({ queryKey: qk.members.all });
      options.onSuccess?.(...args);
    },
  });
}

// ── Trainers ───────────────────────────────────────────────────────────────

export function useTrainers() {
  return useQuery({ queryKey: tk.trainers, queryFn: () => api.get("/admin/trainers"), select: (d) => d.trainers || [], staleTime: 60_000 });
}

/** The trainer profile linked to the signed-in login (null if none). */
export function useMyTrainer({ enabled = true } = {}) {
  return useQuery({ queryKey: tk.me, queryFn: () => api.get("/admin/trainers/me"), select: (d) => d.trainer, staleTime: 5 * 60_000, enabled });
}

export function useTrainerLogins({ enabled = true } = {}) {
  return useQuery({ queryKey: tk.logins, queryFn: () => api.get("/admin/trainers/logins"), select: (d) => d.users || [], enabled });
}

export function useTrainerPerformance({ enabled = true } = {}) {
  return useQuery({ queryKey: tk.performance, queryFn: () => api.get("/admin/trainers/performance"), select: (d) => d.items || [], enabled });
}

export function useTrainerMembers(id, params, { enabled = true } = {}) {
  return useQuery({
    queryKey: tk.trainerMembers(id, params),
    queryFn: () => api.get(`/admin/trainers/${id}/members`, params),
    placeholderData: keepPreviousData,
    enabled: Boolean(id) && enabled,
  });
}

export const useSaveTrainer = () =>
  useTrainingMutation(({ id, payload, idempotencyKey }) =>
    id ? api.patch(`/admin/trainers/${id}`, payload) : api.post("/admin/trainers", payload, { idempotencyKey })
  );

export const useRemoveTrainer = () => useTrainingMutation((id) => api.delete(`/admin/trainers/${id}`));

export const useUploadTrainerPhoto = () =>
  useTrainingMutation(({ id, file }) => {
    const form = new FormData();
    form.append("photo", file);
    return api.post(`/admin/trainers/${id}/photo`, form);
  });

export const useAssignTrainerMembers = () =>
  useTrainingMutation(({ trainerId, memberIds }) => api.post(`/admin/trainers/${trainerId}/members`, { memberIds }), { members: true });

export const useUnassignTrainerMember = () =>
  useTrainingMutation(({ trainerId, memberId }) => api.delete(`/admin/trainers/${trainerId}/members/${memberId}`), { members: true });

// ── Exercise library ───────────────────────────────────────────────────────

export function useExercises(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: tk.exercises(params),
    queryFn: () => api.get("/admin/exercises", params),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    enabled,
  });
}

export const useSaveExercise = () =>
  useTrainingMutation(({ id, payload, idempotencyKey }) =>
    id ? api.patch(`/admin/exercises/${id}`, payload) : api.post("/admin/exercises", payload, { idempotencyKey })
  );

export const useRemoveExercise = () => useTrainingMutation((id) => api.delete(`/admin/exercises/${id}`));

// ── Plan templates ─────────────────────────────────────────────────────────

export function useWorkoutPlans(params, { enabled = true } = {}) {
  return useQuery({ queryKey: tk.plans(params), queryFn: () => api.get("/admin/workouts", params), placeholderData: keepPreviousData, enabled });
}

export function useWorkoutPlan(id) {
  return useQuery({ queryKey: tk.plan(id), queryFn: () => api.get(`/admin/workouts/${id}`), select: (d) => d.plan, enabled: Boolean(id) });
}

export function useSavePlan() {
  const queryClient = useQueryClient();
  return useTrainingMutation(
    ({ id, payload, idempotencyKey }) => (id ? api.patch(`/admin/workouts/${id}`, payload) : api.post("/admin/workouts", payload, { idempotencyKey })),
    // The response is the whole plan: show it straight away (no skeleton after "Create plan").
    { onSuccess: (data) => queryClient.setQueryData(tk.plan(data.plan._id), data) }
  );
}

export const useDuplicatePlan = () => useTrainingMutation((id) => api.post(`/admin/workouts/${id}/duplicate`));

export const useRemovePlan = () => useTrainingMutation((id) => api.delete(`/admin/workouts/${id}`));

/** Gives a plan to members and messages them, so it carries an Idempotency-Key and retries safely. */
export function useAssignPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, payload, idempotencyKey }) => api.post(`/admin/workouts/${planId}/assign`, payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tk.all }),
  });
}

// ── Members ────────────────────────────────────────────────────────────────

export function useWorkoutRoster(params, { enabled = true } = {}) {
  return useQuery({ queryKey: tk.roster(params), queryFn: () => api.get("/admin/workouts/members", params), placeholderData: keepPreviousData, enabled });
}

export function useMemberWorkout(memberId, { enabled = true } = {}) {
  return useQuery({ queryKey: tk.member(memberId), queryFn: () => api.get(`/admin/workouts/members/${memberId}`), enabled: Boolean(memberId) && enabled });
}

export function useMemberLogs(memberId, params, { enabled = true } = {}) {
  return useQuery({
    queryKey: tk.memberLogs(memberId, params),
    queryFn: () => api.get(`/admin/workouts/members/${memberId}/logs`, params),
    placeholderData: keepPreviousData,
    enabled: Boolean(memberId) && enabled,
  });
}

export function useMemberProgress(memberId, { enabled = true } = {}) {
  return useQuery({ queryKey: tk.progress(memberId), queryFn: () => api.get(`/admin/workouts/members/${memberId}/progress`), enabled: Boolean(memberId) && enabled });
}

export function useExerciseProgress(memberId, exerciseId) {
  return useQuery({
    queryKey: tk.exerciseProgress(memberId, exerciseId),
    queryFn: () => api.get(`/admin/workouts/members/${memberId}/progress/${exerciseId}`),
    enabled: Boolean(memberId && exerciseId),
    placeholderData: keepPreviousData,
  });
}

/** Saving the same day and plan day again updates that session on the server, so retries are safe. */
export function useLogSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, payload }) => api.post(`/admin/workouts/members/${memberId}/logs`, payload),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tk.all }),
  });
}

export const useDeleteLog = () => useTrainingMutation((logId) => api.delete(`/admin/workouts/logs/${logId}`));

export const useUpdateAssignment = () => useTrainingMutation(({ id, payload }) => api.patch(`/admin/workouts/assignments/${id}`, payload));

export const useEndAssignment = () => useTrainingMutation(({ id, note }) => api.post(`/admin/workouts/assignments/${id}/end`, { note }));
