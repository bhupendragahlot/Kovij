/**
 * Every TanStack Query key in one place, so invalidation after a write is predictable:
 * a payment touches payments, the member, and the dashboard. Nothing else needs to know.
 */
export const qk = {
  dashboard: ["dashboard"],
  members: {
    all: ["members"],
    list: (params) => ["members", "list", params],
    detail: (id) => ["members", "detail", id],
    duplicates: (params) => ["members", "duplicates", params],
  },
  payments: {
    all: ["payments"],
    list: (params) => ["payments", "list", params],
  },
  attendance: {
    all: ["attendance"],
    day: (date) => ["attendance", date],
  },
  leads: {
    all: ["leads"],
    list: (params) => ["leads", "list", params],
  },
  plans: ["plans"],
  products: ["products"],
  trainers: ["trainers"],
  campaigns: {
    all: ["campaigns"],
    audience: (filter) => ["campaigns", "audience", filter],
  },
  settings: ["settings"],
  staff: ["staff"],
};

/** After anything that changes a member's standing, money, or visits. */
export function invalidateMemberData(queryClient) {
  for (const key of [qk.members.all, qk.payments.all, qk.dashboard, qk.attendance.all]) {
    queryClient.invalidateQueries({ queryKey: key });
  }
}
