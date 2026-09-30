/** Selling a plan: blank form state, price summary, and form → API payload (server saleSchema). */

export const EMPTY_SALE = { planId: "", start: "auto", collect: "now", mode: "cash", txnRef: "", priceOverride: "" };

/** Price lines for the chosen plan: what the member pays now or owes. */
export function saleSummary({ plan, sale, registrationFee, isFirstPlan }) {
  if (!plan) return { lines: [], total: 0 };
  const price = sale.priceOverride !== "" && sale.priceOverride != null ? Number(sale.priceOverride) : Number(plan.price);
  const lines = [{ label: plan.name, amount: price }];
  if (isFirstPlan && registrationFee > 0) lines.push({ label: "Registration fee", amount: registrationFee });
  return { lines, total: lines.reduce((s, l) => s + l.amount, 0) };
}

export function salePayload(sale) {
  return {
    planId: sale.planId,
    start: sale.start,
    ...(sale.priceOverride !== "" && sale.priceOverride != null && { priceOverride: Number(sale.priceOverride) }),
    payment: sale.collect === "now" ? { collect: "now", mode: sale.mode, txnRef: sale.txnRef || undefined } : { collect: "later" },
  };
}
