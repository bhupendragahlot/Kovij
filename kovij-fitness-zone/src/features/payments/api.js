import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, http } from "../../app/http";
import { invalidateMemberData, qk } from "../../app/queryKeys";
import { retryDelay, retryIdempotent } from "../../app/queryClient";
import { useSettings } from "../settings/api";

/** Payment-module query keys beyond the shared qk.payments ones. */
export const paymentKeys = {
  detail: (id) => ["payments", "detail", id],
  onlineStatus: ["payments", "online-status"],
  finance: ["finance"],
};

/** Revenue figures move whenever money does. */
function invalidateMoney(queryClient) {
  invalidateMemberData(queryClient);
  queryClient.invalidateQueries({ queryKey: paymentKeys.finance });
}

export function usePayments(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: qk.payments.list(params),
    queryFn: () => api.get("/admin/payments", params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** One payment with its part payments (or the bill a part belongs to). */
export function usePayment(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: paymentKeys.detail(id),
    queryFn: () => api.get(`/admin/payments/${id}`),
    enabled: Boolean(id) && enabled,
  });
}

/**
 * Money received at the desk. The caller supplies an Idempotency-Key from
 * useIdempotencyKey(); automatic retries reuse it, so the member is charged once.
 */
export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }) => api.post("/admin/payments", payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateMoney(queryClient),
  });
}

/** Settle all or part of a due. Idempotent for the same reason as useRecordPayment. */
export function useCollectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, payload, idempotencyKey }) => api.post(`/admin/payments/${paymentId}/collect`, payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateMoney(queryClient),
  });
}

/** Confirm or reject a member's UPI reference. */
export function useVerifyPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, payload, idempotencyKey }) => api.post(`/admin/payments/${paymentId}/verify`, payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateMoney(queryClient),
  });
}

/** Record that money was given back (managers). */
export function useRefundPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, payload, idempotencyKey }) => api.post(`/admin/payments/${paymentId}/refund`, payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateMoney(queryClient),
  });
}

export function useSendReceipt() {
  return useMutation({ mutationFn: (paymentId) => api.post(`/admin/payments/${paymentId}/send-receipt`) });
}

/** Whether online payments can work on this server (never includes keys). */
export function useOnlinePaymentStatus({ enabled = true } = {}) {
  return useQuery({
    queryKey: paymentKeys.onlineStatus,
    queryFn: () => api.get("/admin/payments/online-status"),
    staleTime: 5 * 60_000,
    enabled,
  });
}

const DESK_MODES = [
  ["cash", "acceptCash"],
  ["upi", "acceptUpi"],
  ["card", "acceptCard"],
];

/**
 * Payment modes the desk may take, from Settings > Payments. Until settings load (or if every
 * mode is off, which the server would refuse anyway) all modes are offered.
 */
export function useAcceptedModes() {
  const settings = useSettings();
  const payments = settings.data?.payments;
  const accepted = DESK_MODES.filter(([, flag]) => payments?.[flag] !== false).map(([mode]) => mode);
  return {
    modes: accepted.length ? accepted : DESK_MODES.map(([mode]) => mode),
    allowPartial: payments?.allowPartial !== false,
    loaded: Boolean(settings.data),
  };
}

/**
 * Open a printable receipt in a new tab. The receipt route needs the staff token, so it is
 * fetched here and handed to the new tab as a blob URL.
 */
export async function openReceipt(paymentId) {
  const tab = window.open("", "_blank");
  try {
    const html = await api.text(`/admin/payments/${paymentId}/receipt`);
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}

/** Save a server-generated CSV (staff token attached) under `filename`. */
export async function downloadCsv(url, params, filename) {
  const res = await http.get(url, { params, responseType: "blob" });
  const href = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}
