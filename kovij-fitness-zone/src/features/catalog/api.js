import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";

/**
 * Plans and trainers share one CRUD shape, so one factory builds both hook sets.
 * @param {{ key: unknown[], listUrl: string, writeUrl: string, plural: string, updateMethod?: 'put'|'patch' }} cfg
 */
function catalogResource({ key, listUrl, writeUrl, plural, updateMethod = "patch" }) {
  return {
    useList: (options = {}) =>
      useQuery({
        queryKey: key,
        queryFn: () => api.get(listUrl),
        select: (d) => d[plural] || [],
        staleTime: 5 * 60_000,
        ...options,
      }),
    useSave: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: ({ id, payload }) => (id ? api[updateMethod](`${writeUrl}/${id}`, payload) : api.post(writeUrl, payload)),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
      });
    },
    useRemove: () => {
      const queryClient = useQueryClient();
      return useMutation({
        mutationFn: (id) => api.delete(`${writeUrl}/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
      });
    },
  };
}

export const plansResource = catalogResource({ key: qk.plans, listUrl: "/plans", writeUrl: "/plans", plural: "plans" });
export const trainersResource = catalogResource({ key: qk.trainers, listUrl: "/admin/trainers", writeUrl: "/admin/trainers", plural: "trainers" });

/** Plans a member can buy today (active), cheapest first. */
export function useSellablePlans() {
  return plansResource.useList({
    select: (d) => (d.plans || []).filter((p) => p.status !== "Inactive").sort((a, b) => Number(a.price) - Number(b.price)),
  });
}
