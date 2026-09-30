import { useEffect, useState } from "react";
import { useSellPlan } from "./api";
import { SaleFields } from "./SaleFields";
import { EMPTY_SALE, saleSummary, salePayload } from "./sale";
import { useSellablePlans } from "../catalog/api";
import { useSettings } from "../settings/api";
import { usePermission } from "../auth/permissions";
import { openReceipt } from "../payments/api";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, FormError, InlineAlert, SkeletonList, useToast } from "../../shared/ui";
import { formatDate, formatINR } from "../../shared/lib/format";

/** Renew, switch, or add a first plan for an existing member. */
export function SellPlanDialog({ open, onClose, member, memberships = [] }) {
  const online = useOnlineStatus();
  const plans = useSellablePlans();
  const settings = useSettings();
  const canOverridePrice = usePermission("price.override");
  const sell = useSellPlan(member?._id);
  const idempotency = useIdempotencyKey();
  const toast = useToast();

  const active = memberships.find((m) => m.status === "active");
  const blocking = memberships.find((m) => m.status === "upcoming" || m.status === "pending");
  const isFirstPlan = memberships.length === 0;
  const [sale, setSale] = useState(EMPTY_SALE);

  useEffect(() => {
    if (!open) return;
    sell.reset();
    idempotency.reset();
    // Default to renewing the same plan: the most common desk action.
    const samePlan = plans.data?.find((p) => p._id === String(active?.planId));
    setSale({ ...EMPTY_SALE, planId: samePlan?._id || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plans.data]);

  const plan = plans.data?.find((p) => p._id === sale.planId);
  const { total } = saleSummary({ plan, sale, registrationFee: settings.data?.registrationFee || 0, isFirstPlan });
  const fieldErrors = sell.error?.fields || {};
  const [clientError, setClientError] = useState({});

  const submit = (e) => {
    e.preventDefault();
    if (!sale.planId) return setClientError({ planId: "Choose a plan" });
    setClientError({});
    const payload = salePayload(sale);
    sell.mutate(
      { payload, idempotencyKey: idempotency.keyFor(payload) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          const m = data.sale.membership;
          const planPayment = data.sale.payments?.find((p) => p.type !== "registration");
          toast.success(active ? `Renewed ${data.sale.planName || "plan"}` : `${data.sale.planName || "Plan"} added`, {
            description: m.status === "upcoming" ? `Starts ${formatDate(m.startDate)}, ends ${formatDate(m.endDate)}` : `Active until ${formatDate(m.endDate)}`,
            action: planPayment?.status === "paid" ? { label: "Print", onClick: () => openReceipt(planPayment._id) } : undefined,
          });
          onClose();
        },
      }
    );
  };

  const verb = active ? "Renew" : "Add plan";
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={active ? `Renew ${member?.name?.split(" ")[0] || "plan"}` : `Add a plan for ${member?.name?.split(" ")[0] || "member"}`}
      description={active ? `Current plan: ${active.planName}, ends ${formatDate(active.endDate)}.` : undefined}
      size="lg"
      placement="side"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="sell-plan" variant="primary" loading={sell.isPending} disabled={!online || Boolean(blocking)}>
            {plan ? `${verb}, ${sale.collect === "now" ? "collect" : "due"} ${formatINR(total)}` : verb}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          Selling a plan needs a connection. Reconnect to continue.
        </InlineAlert>
      )}
      {blocking && (
        <InlineAlert tone="warning" className="mb-4" title="A plan is already waiting">
          {blocking.planName} is {blocking.status === "pending" ? "waiting for payment" : `set to start on ${formatDate(blocking.startDate)}`}. Collect or cancel it before adding another.
        </InlineAlert>
      )}
      <FormError error={sell.error} />
      {plans.isPending ? (
        <SkeletonList rows={3} />
      ) : (
        <form id="sell-plan" onSubmit={submit} noValidate>
          <SaleFields
            plans={plans.data || []}
            sale={sale}
            onChange={setSale}
            errors={{ ...fieldErrors, ...clientError, mode: fieldErrors["payment.mode"] || fieldErrors.mode }}
            activeEndDate={active?.endDate}
            isFirstPlan={isFirstPlan}
            registrationFee={settings.data?.registrationFee || 0}
            canOverridePrice={canOverridePrice}
          />
        </form>
      )}
    </Dialog>
  );
}
