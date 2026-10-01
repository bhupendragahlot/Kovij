import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "../../app/http";

export const activityKeys = {
  all: ["activity"],
  list: (params) => ["activity", "list", params],
  signIns: (params) => ["activity", "sign-ins", params],
};

/** Clean params: drop empty filters so the query key and URL stay short. */
const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v != null));

export function useActivity(params) {
  const p = clean(params);
  return useQuery({ queryKey: activityKeys.list(p), queryFn: () => api.get("/admin/activity", p), placeholderData: keepPreviousData, staleTime: 15_000 });
}

export function useSignIns(params) {
  const p = clean(params);
  return useQuery({ queryKey: activityKeys.signIns(p), queryFn: () => api.get("/admin/activity/sign-ins", p), placeholderData: keepPreviousData, staleTime: 15_000 });
}
