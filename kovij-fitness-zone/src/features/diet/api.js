import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { retryDelay, retryIdempotent } from "../../app/queryClient";

/** Query keys for diet plans and members' diets (wellness module). */
export const dietKeys = {
  all: ["diet"],
  plans: (params) => ["diet", "plans", params],
  plan: (id) => ["diet", "plan", id],
  member: (memberId) => ["diet", "member", memberId],
  day: (memberId, day) => ["diet", "member", memberId, "day", day],
  history: (memberId, days) => ["diet", "member", memberId, "history", days],
};

// ── Templates ───────────────────────────────────────────────────────────────

export function useDietPlans(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: dietKeys.plans(params),
    queryFn: () => api.get("/admin/diets", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDietPlan(id) {
  return useQuery({
    queryKey: dietKeys.plan(id),
    queryFn: () => api.get(`/admin/diets/${id}`).then((d) => d.plan),
    enabled: Boolean(id) && id !== "new",
  });
}

function useInvalidateDiet() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: dietKeys.all });
}

/** Create (idempotent: safe to retry) or save the whole plan. */
export function useSaveDietPlan() {
  const invalidate = useInvalidateDiet();
  return useMutation({
    mutationFn: ({ id, payload, idempotencyKey }) =>
      id ? api.put(`/admin/diets/${id}`, payload) : api.post("/admin/diets", payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: invalidate,
  });
}

export function useArchiveDietPlan() {
  const invalidate = useInvalidateDiet();
  return useMutation({ mutationFn: ({ id, archived }) => api.patch(`/admin/diets/${id}`, { archived }), onSuccess: invalidate });
}

export function useDuplicateDietPlan() {
  const invalidate = useInvalidateDiet();
  return useMutation({
    mutationFn: ({ id, idempotencyKey }) => api.post(`/admin/diets/${id}/duplicate`, undefined, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: invalidate,
  });
}

export function useDeleteDietPlan() {
  const invalidate = useInvalidateDiet();
  return useMutation({ mutationFn: (id) => api.delete(`/admin/diets/${id}`), onSuccess: invalidate });
}

// ── A member's diet ─────────────────────────────────────────────────────────

const memberBase = (memberId) => `/admin/diets/members/${memberId}`;

export function useMemberDiet(memberId) {
  return useQuery({
    queryKey: dietKeys.member(memberId),
    queryFn: () => api.get(memberBase(memberId)),
    enabled: Boolean(memberId),
  });
}

/** One earlier day's log (today's comes with the overview). */
export function useDietDay(memberId, day, { enabled = true } = {}) {
  return useQuery({
    queryKey: dietKeys.day(memberId, day),
    queryFn: () => api.get(`${memberBase(memberId)}/days/${day}`).then((d) => d.day),
    enabled: Boolean(memberId && day) && enabled,
  });
}

export function useNutritionHistory(memberId, days = 14) {
  return useQuery({
    queryKey: dietKeys.history(memberId, days),
    queryFn: () => api.get(`${memberBase(memberId)}/history`, { days }),
    enabled: Boolean(memberId),
  });
}

/** Give a plan to a member. Idempotent: a retried tap never assigns twice. */
export function useAssignDiet(memberId) {
  const invalidate = useInvalidateDiet();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey, memberId: target }) => api.post(`${memberBase(target || memberId)}/assign`, payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: invalidate,
  });
}

export function useStopDiet(memberId) {
  const invalidate = useInvalidateDiet();
  return useMutation({ mutationFn: () => api.post(`${memberBase(memberId)}/stop`), onSuccess: invalidate });
}

/**
 * Writes to a day's log return the fresh day; today's copy in the overview is updated in place
 * so ticking feels instant, then history refreshes in the background.
 */
function useDayMutation(memberId, fn, options = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    ...options,
    onSuccess: (data) => {
      queryClient.setQueryData(dietKeys.member(memberId), (prev) => (prev && prev.today?.day === data.day.day ? { ...prev, today: data.day } : prev));
      queryClient.setQueryData(dietKeys.day(memberId, data.day.day), data.day);
      queryClient.invalidateQueries({ queryKey: ["diet", "member", memberId, "history"] });
    },
  });
}

export const useTickMeal = (memberId) =>
  useDayMutation(memberId, ({ day, mealId, eaten }) => api.put(`${memberBase(memberId)}/days/${day}/meals/${mealId}`, { eaten }));

export const useSetWater = (memberId) =>
  useDayMutation(memberId, ({ day, glasses }) => api.put(`${memberBase(memberId)}/days/${day}/water`, { glasses }));

export const useRemoveExtra = (memberId) =>
  useDayMutation(memberId, ({ day, itemId }) => api.delete(`${memberBase(memberId)}/days/${day}/items/${itemId}`));

/** Add an extra food item. Idempotent: a double tap adds it once. */
export const useAddExtra = (memberId) =>
  useDayMutation(memberId, ({ day, item, idempotencyKey }) => api.post(`${memberBase(memberId)}/days/${day}/items`, item, { idempotencyKey }), {
    retry: retryIdempotent,
    retryDelay,
  });
