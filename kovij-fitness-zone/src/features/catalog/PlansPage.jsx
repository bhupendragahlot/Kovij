import { useEffect, useState } from "react";
import { Archive, Eye, EyeOff, Layers, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { plansResource } from "./api";
import { usePermission } from "../auth/permissions";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Input,
  PageHeader,
  Select,
  SkeletonList,
  Switch,
  TagInput,
  Textarea,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatINR } from "../../shared/lib/format";
import { PLAN_DURATION_LABEL } from "../../shared/domain/status";

const EMPTY = { name: "", price: "", duration: "month", durationInDays: "", description: "", features: [], popular: false, status: "Active", showOnFrontend: true };

function PlanDialog({ open, plan, onClose }) {
  const save = plansResource.useSave();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    save.reset();
    setForm(plan ? { ...EMPTY, ...plan, price: String(plan.price ?? ""), durationInDays: plan.durationInDays ? String(plan.durationInDays) : "" } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = save.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      price: Number(form.price),
      duration: form.duration,
      durationInDays: form.durationInDays ? Number(form.durationInDays) : null,
      description: form.description || undefined,
      features: form.features,
      popular: form.popular,
      status: form.status,
      showOnFrontend: form.showOnFrontend,
    };
    save.mutate({ id: plan?._id, payload }, { onSuccess: () => (toast.success(plan ? "Plan saved" : `${form.name} created`), onClose()) });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={plan ? `Edit ${plan.name}` : "New plan"}
      description="Price changes apply to new sales only. Existing members keep what they paid."
      placement="side"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" variant="primary" loading={save.isPending}>
            {plan ? "Save plan" : "Create plan"}
          </Button>
        </>
      }
    >
      <FormError error={save.error} />
      <form id="plan-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Plan name" error={errors.name} required className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Quarterly strength" maxLength={80} />
        </Field>
        <Field label="Price" error={errors.price} required>
          <Input prefix="₹" type="number" inputMode="decimal" min="0" value={form.price} onChange={(e) => set({ price: e.target.value })} />
        </Field>
        <Field label="Length" error={errors.duration}>
          <Select value={form.duration} onChange={(e) => set({ duration: e.target.value })}>
            {Object.entries(PLAN_DURATION_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Exact number of days" optional hint="Overrides the length above, e.g. 45 for a festival offer." error={errors.durationInDays} className="sm:col-span-2">
          <Input type="number" inputMode="numeric" min="1" value={form.durationInDays} onChange={(e) => set({ durationInDays: e.target.value })} suffix="days" />
        </Field>
        <Field label="What's included" optional hint="Shown on the website pricing cards." error={errors.features} className="sm:col-span-2">
          <TagInput value={form.features} onChange={(features) => set({ features })} placeholder="e.g. Diet consultation, then Enter" />
        </Field>
        <Field label="Description" optional error={errors.description} className="sm:col-span-2">
          <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={2} maxLength={500} />
        </Field>
        <div className="flex flex-col gap-4 sm:col-span-2">
          <Switch label="Available to sell" description="Turn off to stop new sales without affecting current members." checked={form.status === "Active"} onChange={(on) => set({ status: on ? "Active" : "Inactive" })} />
          <Switch label="Show on website" checked={form.showOnFrontend} onChange={(showOnFrontend) => set({ showOnFrontend })} />
          <Switch label="Mark as most popular" description="Highlighted on the website." checked={form.popular} onChange={(popular) => set({ popular })} />
        </div>
      </form>
    </Dialog>
  );
}

export default function PlansPage() {
  const plans = plansResource.useList();
  const remove = plansResource.useRemove();
  const save = plansResource.useSave();
  const canManage = usePermission("plans.manage");
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const onDelete = async (plan) => {
    const ok = await confirm({ title: `Delete ${plan.name}?`, body: "This can't be undone.", confirmLabel: "Delete plan", tone: "danger" });
    if (!ok) return;
    remove.mutate(plan._id, {
      onSuccess: () => toast.success(`${plan.name} deleted`),
      onError: (e) => {
        if (e.code === "PLAN_IN_USE") {
          toast.warning("Members have bought this plan", {
            description: "Stop selling it instead, so their history stays intact.",
            action: { label: "Stop selling", onClick: () => save.mutate({ id: plan._id, payload: { status: "Inactive" } }) },
          });
        } else toast.error("Couldn't delete the plan", { description: e.message });
      },
    });
  };

  return (
    <>
      <PageHeader
        title="Plans"
        description="What members can buy. Changes apply to new sales."
        actions={
          canManage && (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New plan
            </Button>
          )
        }
      />
      {plans.isPending ? (
        <Card>
          <SkeletonList rows={3} />
        </Card>
      ) : plans.isError ? (
        <Card>
          <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
        </Card>
      ) : plans.data.length === 0 ? (
        <Card>
          <EmptyState icon={Layers} title="No plans yet" body="Create your first plan, for example a monthly membership, so the desk can start selling." action={canManage && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>New plan</Button>} />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {plans.data.map((p) => {
            const inactive = p.status === "Inactive";
            return (
              <li key={p._id}>
                <Card className={cn("flex h-full flex-col", inactive && "opacity-70")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[15px] font-semibold">
                        {p.name}
                        {p.popular && <Star className="size-3.5 fill-current text-brand-ink" aria-label="Most popular" />}
                      </p>
                      <p className="text-[13px] text-ink-3">{p.durationInDays ? `${p.durationInDays} days` : PLAN_DURATION_LABEL[p.duration] || p.duration}</p>
                    </div>
                    <p className="text-2xl font-bold tracking-tight">{formatINR(p.price)}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {inactive ? <Badge size="sm" icon={Archive}>Not for sale</Badge> : <Badge size="sm" tone="good">On sale</Badge>}
                    {p.showOnFrontend ? <Badge size="sm" icon={Eye}>On website</Badge> : <Badge size="sm" icon={EyeOff}>Hidden from website</Badge>}
                  </div>
                  {p.features?.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-1 text-sm text-ink-2">
                      {p.features.slice(0, 4).map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                      {p.features.length > 4 && <li className="text-ink-3">and {p.features.length - 4} more</li>}
                    </ul>
                  )}
                  {canManage && (
                    <div className="mt-auto flex gap-2 pt-4">
                      <Button size="sm" variant="quiet" icon={Pencil} onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onDelete(p)}>
                        Delete
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
      <PlanDialog open={creating || Boolean(editing)} plan={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}
