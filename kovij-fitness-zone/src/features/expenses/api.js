import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, http } from "../../app/http";
import { retryDelay, retryIdempotent } from "../../app/queryClient";

export const expenseKeys = {
  all: ["expenses"],
  list: (params) => ["expenses", "list", params],
};

/** Expenses change the revenue page's "spent" and "net" figures too. */
function invalidate(queryClient) {
  queryClient.invalidateQueries({ queryKey: expenseKeys.all });
  queryClient.invalidateQueries({ queryKey: ["finance"] });
}

export function useExpenses(params) {
  return useQuery({
    queryKey: expenseKeys.list(params),
    queryFn: () => api.get("/admin/expenses", params),
    placeholderData: keepPreviousData,
  });
}

/** Add an expense (idempotent: a double tap records it once). */
export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ payload, idempotencyKey }) => api.post("/admin/expenses", payload, { idempotencyKey }),
    retry: retryIdempotent,
    retryDelay,
    onSuccess: () => invalidate(queryClient),
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }) => api.patch(`/admin/expenses/${id}`, payload),
    onSuccess: () => invalidate(queryClient),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/admin/expenses/${id}`),
    onSuccess: () => invalidate(queryClient),
  });
}

/** Attach or replace the bill (photo or PDF); `file` null removes it. */
export function useExpenseBill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }) => {
      if (!file) return api.delete(`/admin/expenses/${id}/bill`);
      const form = new FormData();
      form.append("bill", file);
      return http.put(`/admin/expenses/${id}/bill`, form, { timeout: 60_000 }).then((r) => r.data);
    },
    onSuccess: () => invalidate(queryClient),
  });
}

/** Bills are private: fetch with the staff token, then open the file from memory. */
export async function openBill(id) {
  const tab = window.open("", "_blank");
  try {
    const res = await http.get(`/admin/expenses/${id}/bill`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    if (tab) tab.location.href = url;
    else window.location.assign(url);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    throw e;
  }
}
