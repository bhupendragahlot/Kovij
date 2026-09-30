import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, http } from "../../app/http";
import { invalidateMemberData, qk } from "../../app/queryKeys";
import { retryDelay, retryIdempotent } from "../../app/queryClient";
import { ApiError } from "../../shared/lib/apiClient";

/** Keys owned by this module, all under ["members"] so invalidateMemberData refreshes them. */
export const memberKeys = {
  timeline: (id) => ["members", "timeline", id],
};
const RENEWALS = ["renewals"];

/** Anything that changes a plan also changes the renewals lists. */
function invalidatePlans(queryClient) {
  invalidateMemberData(queryClient);
  queryClient.invalidateQueries({ queryKey: RENEWALS });
}

export function useMembers(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: qk.members.list(params),
    queryFn: () => api.get("/admin/members", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMember(id) {
  return useQuery({
    queryKey: qk.members.detail(id),
    queryFn: () => api.get(`/admin/members/${id}`),
    enabled: Boolean(id),
  });
}

/** Joins, renewals, plan changes, freezes, extensions and cancellations, newest first. */
export function useMemberTimeline(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: memberKeys.timeline(id),
    queryFn: () => api.get(`/admin/members/${id}/timeline`),
    select: (d) => d.items,
    enabled: Boolean(id) && enabled,
  });
}

/** Live "this person may already be registered" hint while typing a phone/email. */
export function useDuplicateCheck({ phone, email, excludeId }) {
  const digits = String(phone || "").replace(/\D/g, "");
  const emailOk = /\S+@\S+\.\S+/.test(email || "");
  const params = { phone: digits.length >= 10 ? phone : undefined, email: emailOk ? email : undefined, excludeId };
  return useQuery({
    queryKey: qk.members.duplicates(params),
    queryFn: () => api.get("/admin/members/duplicates", params),
    enabled: Boolean(params.phone || params.email),
    staleTime: 60_000,
    select: (d) => d.matches,
  });
}

/** Desk registration (optionally with first plan + payment). Idempotent: safe to retry. */
export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }) => api.post("/admin/members", payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidatePlans(queryClient),
  });
}

export function useUpdateMember(memberId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.patch(`/admin/members/${memberId}`, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(qk.members.detail(memberId), (prev) => (prev ? { ...prev, member: { ...prev.member, ...data.member }, profile: data.profile ?? prev.profile } : prev));
      queryClient.invalidateQueries({ queryKey: qk.members.all });
    },
  });
}

/** Upload a profile photo (a Blob already resized by preparePhoto). */
export function uploadMemberPhoto(memberId, blob) {
  const form = new FormData();
  form.append("photo", blob, blob.name || "photo.jpg");
  return http.post(`/admin/members/${memberId}/photo`, form, { timeout: 60_000 }).then((r) => r.data);
}

export function useMemberPhoto(memberId) {
  const queryClient = useQueryClient();
  const onSuccess = (data) => {
    queryClient.setQueryData(qk.members.detail(memberId), (prev) => (prev ? { ...prev, member: { ...prev.member, profilePhoto: data.member.profilePhoto } } : prev));
    queryClient.invalidateQueries({ queryKey: qk.members.all });
  };
  const upload = useMutation({ mutationFn: (blob) => uploadMemberPhoto(memberId, blob), onSuccess });
  const remove = useMutation({ mutationFn: () => api.delete(`/admin/members/${memberId}/photo`), onSuccess });
  return { upload, remove };
}

/** Renew / switch / first plan. Idempotent because it may take money. */
export function useSellPlan(memberId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }) => api.post(`/admin/members/${memberId}/memberships`, payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidatePlans(queryClient),
  });
}

export function useCancelMembership(memberId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, reason }) => api.post(`/admin/members/${memberId}/memberships/${membershipId}/cancel`, reason ? { reason } : {}),
    onSuccess: () => invalidatePlans(queryClient),
  });
}

/**
 * Freeze, unfreeze and extend. Each is idempotent (a double tap must not freeze or add days
 * twice), so automatic retries reuse the same key.
 */
function usePlanAction(path) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, payload, idempotencyKey }) => api.post(`/admin/memberships/${membershipId}/${path}`, payload || {}, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidatePlans(queryClient),
  });
}
export const useFreezeMembership = () => usePlanAction("freeze");
export const useUnfreezeMembership = () => usePlanAction("unfreeze");
export const useExtendMembership = () => usePlanAction("extend");

export function useNotifyMember(memberId) {
  return useMutation({
    mutationFn: (payload) => api.post(`/admin/members/${memberId}/notify`, payload),
  });
}

/**
 * Download the filtered members list as CSV. Fetched with the staff token, then saved from memory.
 * @returns the number of members exported
 */
export async function downloadMembersCsv(params) {
  // Read errors ourselves: a blob response would otherwise hide the server's message.
  const res = await http.get("/admin/members/export.csv", { params, responseType: "blob", timeout: 60_000, validateStatus: () => true });
  if (res.status >= 400) {
    let body = {};
    try {
      body = JSON.parse(await res.data.text());
    } catch {
      /* not JSON */
    }
    throw new ApiError({ status: res.status, code: body.code || `HTTP_${res.status}`, message: body.message || "Couldn't export the list. Try again.", details: body.details });
  }
  const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "")?.[1] || "members.csv";
  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return Number(res.headers["x-row-count"]) || 0;
}
