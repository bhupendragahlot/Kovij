import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../app/http";
import { invalidateMemberData, qk } from "../../app/queryKeys";
import { retryDelay, retryIdempotent } from "../../app/queryClient";

export function usePayments(params, { enabled = true } = {}) {
  return useQuery({
    queryKey: qk.payments.list(params),
    queryFn: () => api.get("/admin/payments", params),
    placeholderData: keepPreviousData,
    enabled,
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
    onSuccess: () => invalidateMemberData(queryClient),
  });
}

/** Settle a pending due. Idempotent for the same reason as useRecordPayment. */
export function useCollectPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, payload, idempotencyKey }) => api.post(`/admin/payments/${paymentId}/collect`, payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidateMemberData(queryClient),
  });
}

export function useSendReceipt() {
  return useMutation({ mutationFn: (paymentId) => api.post(`/admin/payments/${paymentId}/send-receipt`) });
}

/**
 * Open a printable receipt in a new tab. The receipt route needs the staff token, so it is
 * fetched here and handed to the new tab as a blob URL.
 */
export async function openReceipt(paymentId) {
  const tab = window.open("", "_blank");
  const html = await api.text(`/admin/payments/${paymentId}/receipt`);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  if (tab) tab.location.href = url;
  else window.location.assign(url);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
