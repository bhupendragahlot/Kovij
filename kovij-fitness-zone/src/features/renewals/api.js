import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../app/http";

/** Renewals desk lists. Selling a plan invalidates ["renewals"] (see members/api.js). */
export const renewalKeys = {
  all: ["renewals"],
  ending: (params) => ["renewals", "ending", params],
  lapsed: (params) => ["renewals", "lapsed", params],
  history: (params) => ["renewals", "history", params],
};

export function useEndingPlans(params, { enabled = true } = {}) {
  return useQuery({ queryKey: renewalKeys.ending(params), queryFn: () => api.get("/admin/memberships/ending", params), placeholderData: keepPreviousData, enabled });
}

export function useLapsedMembers(params, { enabled = true } = {}) {
  return useQuery({ queryKey: renewalKeys.lapsed(params), queryFn: () => api.get("/admin/memberships/lapsed", params), placeholderData: keepPreviousData, enabled });
}

export function useRenewalHistory(params, { enabled = true } = {}) {
  return useQuery({ queryKey: renewalKeys.history(params), queryFn: () => api.get("/admin/memberships/renewal-history", params), placeholderData: keepPreviousData, enabled });
}
