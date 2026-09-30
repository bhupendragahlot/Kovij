import { useId } from "react";
import { Check, Star } from "lucide-react";
import { Field, Input, SegmentedControl } from "../../shared/ui";
import { PaymentModeFields } from "../payments/components";
import { cn } from "../../shared/lib/cn";
import { formatDate, formatINR } from "../../shared/lib/format";
import { PLAN_DURATION_LABEL } from "../../shared/domain/status";
import { saleSummary } from "./sale";

const planDuration = (p) => (p.durationInDays ? `${p.durationInDays} days` : PLAN_DURATION_LABEL[p.duration] || p.duration);

export function PlanChoice({ plans, value, onChange, error }) {
  const labelId = useId();
  return (
    <div>
      <p id={labelId} className="mb-2 text-sm font-semibold text-ink">
        Plan
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {plans.map((p) => {
          const selected = p._id === value;
          return (
            <button
              key={p._id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(p._id)}
              className={cn(
                "relative flex items-start justify-between gap-3 rounded-tile border-2 p-3.5 text-left transition-colors",
                selected ? "border-brand bg-brand-soft" : "border-line hover:border-line-strong"
              )}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-semibold text-ink">
                  {p.name}
                  {p.popular && <Star className="size-3.5 fill-current text-brand-ink" aria-label="Popular" />}
                </span>
                <span className="block text-[13px] text-ink-3">{planDuration(p)}</span>
              </span>
              <span className="text-right">
                <span className="block font-bold text-ink">{formatINR(p.price)}</span>
                {selected && <Check className="ml-auto mt-1 size-4 text-brand-ink" aria-hidden strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[13px] font-medium text-bad">{error}</p>}
    </div>
  );
}

/**
 * Plan + start + payment fields. Used by "Register member" and "Renew plan".
 * The price summary is shown so the desk reads out the exact amount before charging.
 */
export function SaleFields({ plans, sale, onChange, errors = {}, activeEndDate, isFirstPlan, registrationFee = 0, canOverridePrice }) {
  const plan = plans.find((p) => p._id === sale.planId);
  const { lines, total } = saleSummary({ plan, sale, registrationFee, isFirstPlan });
  const set = (patch) => onChange({ ...sale, ...patch });

  return (
    <div className="flex flex-col gap-5">
      <PlanChoice plans={plans} value={sale.planId} onChange={(planId) => set({ planId, priceOverride: "" })} error={errors.planId} />

      {activeEndDate && (
        <Field label="Starts" hint={sale.start === "today" ? "The current plan ends today and the new one starts now." : undefined}>
          <SegmentedControl
            label="When the plan starts"
            block
            value={sale.start === "today" ? "today" : "auto"}
            onChange={(start) => set({ start })}
            options={[
              { value: "auto", label: `After ${formatDate(activeEndDate)}` },
              { value: "today", label: "Today" },
            ]}
          />
        </Field>
      )}

      {plan && canOverridePrice && (
        <Field label="Price" optional hint={`List price ${formatINR(plan.price)}. Change only for an agreed discount.`} error={errors.priceOverride}>
          <Input prefix="₹" type="number" inputMode="decimal" min="0" value={sale.priceOverride} placeholder={String(plan.price)} onChange={(e) => set({ priceOverride: e.target.value })} />
        </Field>
      )}

      <Field label="Payment">
        <SegmentedControl
          label="When the member pays"
          block
          value={sale.collect}
          onChange={(collect) => set({ collect })}
          options={[
            { value: "now", label: "Paying now" },
            { value: "later", label: "Pay later" },
          ]}
        />
      </Field>
      {sale.collect === "now" ? (
        <PaymentModeFields mode={sale.mode} txnRef={sale.txnRef} onChange={set} errors={errors} />
      ) : (
        <p className="-mt-2 text-[13px] text-ink-3">The amount is added to the member&apos;s dues and shows up under Payments until collected.</p>
      )}

      {plan && (
        <dl className="rounded-tile bg-surface-2 p-4 text-sm">
          {lines.map((l) => (
            <div key={l.label} className="flex justify-between py-0.5">
              <dt className="text-ink-2">{l.label}</dt>
              <dd className="tabular font-semibold">{formatINR(l.amount)}</dd>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t border-line pt-2 text-[15px]">
            <dt className="font-semibold">{sale.collect === "now" ? "Collect now" : "Added to dues"}</dt>
            <dd className="tabular font-bold">{formatINR(total)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}
