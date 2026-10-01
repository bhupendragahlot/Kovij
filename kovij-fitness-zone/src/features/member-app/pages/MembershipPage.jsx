import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, History, Sparkles } from "lucide-react";
import { MembershipCard } from "../MembershipCard";
import { useMembershipHistory, useMyMembership, usePlans, useRequestPlan, useWithdrawRequest } from "../queries";
import { useIdempotencyKey } from "../../../shared/hooks/useIdempotencyKey";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, FormError, PageHeader, Skeleton, SkeletonList, useConfirm, useToast } from "../../../shared/ui";
import { formatDate, formatINR, pluralize } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";

const EVENT_TEXT = {
  join: "Joined",
  renew: "Renewed",
  upgrade: "Upgraded",
  downgrade: "Changed plan",
  freeze: "Frozen",
  unfreeze: "Unfrozen",
  extend: "Free days added",
  cancel: "Cancelled",
  ended: "Plan ended",
};

const perMonth = (p) => (p.durationDays >= 60 ? `${formatINR(Math.round((p.price / p.durationDays) * 30))} a month` : null);

export default function MembershipPage() {
  const standing = useMyMembership();
  const s = standing.data;
  return (
    <>
      <PageHeader title="My plan" />
      <div className="flex flex-col gap-4">
        {standing.isPending ? <Skeleton className="h-48 rounded-hero" /> : standing.isError ? <Card><ErrorState error={standing.error} onRetry={() => standing.refetch()} /></Card> : <MembershipCard standing={s} />}
        {s && !s.canRequestPlan && <PendingRequest standing={s} />}
        {s && s.canRequestPlan && <PlanPicker standing={s} />}
        <PlanHistory />
      </div>
    </>
  );
}

/** A request is waiting for payment (or a renewal is queued): show it instead of more plans. */
function PendingRequest({ standing }) {
  const withdraw = useWithdrawRequest();
  const confirm = useConfirm();
  const toast = useToast();
  const navigate = useNavigate();
  const req = standing.state === "pending" ? standing.membership : standing.next;
  if (!req) return null;
  const awaiting = req.status === "pending";

  const cancel = async () => {
    const ok = await confirm({ title: "Withdraw this request?", body: `${req.planName} won’t start, and its unpaid bill is removed.`, confirmLabel: "Withdraw", tone: "danger" });
    if (ok) withdraw.mutate(req.id, { onSuccess: () => toast.success("Request withdrawn"), onError: (e) => toast.error("Couldn't withdraw", { description: e.message }) });
  };

  return (
    <Card>
      <CardHeader title={awaiting ? "Waiting for payment" : "Your next plan"} description={awaiting ? `${req.planName} starts once it’s paid.` : `${req.planName} starts on ${formatDate(req.startDate)}.`} />
      <div className="flex flex-wrap gap-2">
        {awaiting && (
          <Button variant="primary" onClick={() => navigate("/member/payments")}>
            Pay now
          </Button>
        )}
        {awaiting && (
          <Button variant="ghost" onClick={cancel} loading={withdraw.isPending}>
            Withdraw request
          </Button>
        )}
      </div>
    </Card>
  );
}

function PlanPicker({ standing }) {
  const plans = usePlans();
  const [chosen, setChosen] = useState(null);
  const data = plans.data;
  const renewing = ["active", "paused", "expired"].includes(standing.state);

  return (
    <Card>
      <CardHeader
        title={standing.state === "none" ? "Choose a plan" : renewing ? "Renew or change plan" : "Plans"}
        description={data?.startsAfter ? `A new plan starts the day after your current one ends (${formatDate(data.startsAfter)}), so you don’t lose any days.` : "Your plan starts as soon as it’s paid."}
      />
      {plans.isPending ? (
        <SkeletonList rows={3} />
      ) : plans.isError ? (
        <ErrorState compact error={plans.error} onRetry={() => plans.refetch()} />
      ) : !data.plans.length ? (
        <EmptyState compact icon={Sparkles} title="No plans to show" body="Ask at the desk about plans." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {data.plans.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setChosen(p)}
                className={cn("flex h-full w-full flex-col rounded-tile border p-4 text-left transition-colors hover:border-brand", p.popular ? "border-brand bg-brand-soft/40" : "border-line-strong bg-surface")}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="text-[17px] font-bold">{p.name}</span>
                  {p.isCurrent ? <Badge size="sm">Your plan</Badge> : p.popular ? <Badge size="sm" tone="brand">Popular</Badge> : null}
                </span>
                <span className="tabular mt-1 text-[24px] font-bold">{formatINR(p.price)}</span>
                <span className="text-[13px] text-ink-3">
                  {pluralize(p.durationDays, "day")}
                  {perMonth(p) && ` · ${perMonth(p)}`}
                </span>
                {p.features?.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 text-[13px] text-ink-2">
                    {p.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex gap-1.5">
                        <Check className="mt-0.5 size-3.5 shrink-0 text-good" aria-hidden />
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
                <span className="mt-4 text-sm font-bold text-brand-ink">{p.isCurrent ? "Renew this plan" : "Choose"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmPlan plan={chosen} info={data} onClose={() => setChosen(null)} />
    </Card>
  );
}

function ConfirmPlan({ plan, info, onClose }) {
  const request = useRequestPlan();
  const { keyFor, reset } = useIdempotencyKey();
  const toast = useToast();
  const navigate = useNavigate();
  if (!plan) return null;
  const fee = info?.registrationFee || 0;
  const total = plan.price + fee;

  const submit = () => {
    const payload = { planId: plan.id };
    request.mutate(
      { planId: plan.id, idempotencyKey: keyFor(payload) },
      {
        onSuccess: () => {
          reset();
          onClose();
          toast.success(`${plan.name} requested`, { description: `Pay ${formatINR(total)} to start it.` });
          navigate("/member/payments");
        },
      }
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      title={plan.name}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={request.isPending}>
            Request plan
          </Button>
        </>
      }
    >
      <FormError error={request.error} />
      <dl className="flex flex-col gap-2 text-[15px]">
        <div className="flex justify-between">
          <dt>{plan.name}</dt>
          <dd className="tabular font-semibold">{formatINR(plan.price)}</dd>
        </div>
        {fee > 0 && (
          <div className="flex justify-between">
            <dt>Registration (first plan only)</dt>
            <dd className="tabular font-semibold">{formatINR(fee)}</dd>
          </div>
        )}
        <div className="flex justify-between border-t border-line pt-2 text-[17px] font-bold">
          <dt>To pay</dt>
          <dd className="tabular">{formatINR(total)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-ink-3">
        {info?.startsAfter ? `Starts on ${formatDate(info.startsAfter)}, right after your current plan.` : "Starts as soon as it’s paid."} Pay in the app by UPI, or at the desk.
      </p>
    </Dialog>
  );
}

function PlanHistory() {
  const history = useMembershipHistory();
  const events = history.data?.events || [];
  return (
    <Card>
      <CardHeader title="History" />
      {history.isPending ? (
        <SkeletonList rows={3} />
      ) : history.isError ? (
        <ErrorState compact error={history.error} onRetry={() => history.refetch()} />
      ) : !events.length ? (
        <EmptyState compact icon={History} title="Nothing yet" body="Your plans, renewals and freezes will show here." />
      ) : (
        <ol className="relative ml-2 border-l border-line">
          {events.slice(0, 20).map((e) => (
            <li key={e.id} className="relative pb-4 pl-5 last:pb-0">
              <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-brand" aria-hidden />
              <p className="font-semibold">
                {EVENT_TEXT[e.type] || e.type}
                {e.planName && <span className="font-normal text-ink-2"> · {e.type === "upgrade" || e.type === "downgrade" ? `${e.fromPlanName} → ${e.planName}` : e.planName}</span>}
              </p>
              <p className="text-[13px] text-ink-3">
                {formatDate(e.at)}
                {e.days ? ` · ${pluralize(e.days, "day")}` : ""}
                {e.from && e.to && e.type !== "ended" ? ` · ${formatDate(e.from)} to ${formatDate(e.to)}` : ""}
                {e.amount ? ` · ${formatINR(e.amount)}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
