import { useEffect, useState } from "react";
import { Clock, Dumbbell, Eye, EyeOff, Pencil, Phone, Plus, Trash2 } from "lucide-react";
import { trainersResource } from "./api";
import { usePermission } from "../auth/permissions";
import {
  Avatar,
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
  SkeletonList,
  Switch,
  TagInput,
  Textarea,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { phoneHref } from "../../shared/lib/format";

const EMPTY = { name: "", role: "", phone: "", email: "", image: "", instagram: "", description: "", specialties: [], shift: "", isActive: true, showOnFrontend: true };

function TrainerDialog({ open, trainer, onClose }) {
  const save = trainersResource.useSave();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    if (!open) return;
    save.reset();
    setForm(trainer ? { ...EMPTY, ...trainer } : EMPTY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = save.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const { name, role, phone, email, image, instagram, description, specialties, shift, isActive, showOnFrontend } = form;
    save.mutate(
      { id: trainer?._id, payload: { name, role, phone, email, image, instagram, description, specialties, shift, isActive, showOnFrontend } },
      { onSuccess: () => (toast.success(trainer ? "Trainer saved" : `${name} added`), onClose()) }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={trainer ? `Edit ${trainer.name}` : "Add a trainer"}
      placement="side"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="trainer-form" variant="primary" loading={save.isPending}>
            {trainer ? "Save trainer" : "Add trainer"}
          </Button>
        </>
      }
    >
      <FormError error={save.error} />
      <form id="trainer-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name" error={errors.name} required>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Title" error={errors.role} required hint="Shown on the website, e.g. Strength coach.">
          <Input value={form.role} onChange={(e) => set({ role: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Phone" optional error={errors.phone} hint="Staff only, never shown publicly.">
          <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
        </Field>
        <Field label="Shift" optional error={errors.shift}>
          <Input value={form.shift} onChange={(e) => set({ shift: e.target.value })} placeholder="6–11 am, Mon–Sat" />
        </Field>
        <Field label="Specialties" optional error={errors.specialties} className="sm:col-span-2">
          <TagInput value={form.specialties} onChange={(specialties) => set({ specialties })} placeholder="e.g. Powerlifting, then Enter" max={12} />
        </Field>
        <Field label="Photo link" optional error={errors.image} className="sm:col-span-2" hint="Paste an image URL. A square photo works best.">
          <Input type="url" inputMode="url" value={form.image} onChange={(e) => set({ image: e.target.value })} />
        </Field>
        <Field label="Instagram link" optional error={errors.instagram} className="sm:col-span-2">
          <Input type="url" inputMode="url" value={form.instagram} onChange={(e) => set({ instagram: e.target.value })} />
        </Field>
        <Field label="Bio" optional error={errors.description} className="sm:col-span-2">
          <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={1000} />
        </Field>
        <div className="flex flex-col gap-4 sm:col-span-2">
          <Switch label="Currently working here" checked={form.isActive} onChange={(isActive) => set({ isActive })} />
          <Switch label="Show on website" checked={form.showOnFrontend} onChange={(showOnFrontend) => set({ showOnFrontend })} />
        </div>
      </form>
    </Dialog>
  );
}

export default function TrainersPage() {
  const trainers = trainersResource.useList();
  const remove = trainersResource.useRemove();
  const canManage = usePermission("trainers.manage");
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const onDelete = async (t) => {
    const ok = await confirm({ title: `Remove ${t.name}?`, body: "They'll disappear from the website too. To keep their profile, turn off “Currently working here” instead.", confirmLabel: "Remove trainer", tone: "danger" });
    if (ok) remove.mutate(t._id, { onSuccess: () => toast.success(`${t.name} removed`), onError: (e) => toast.error("Couldn't remove", { description: e.message }) });
  };

  return (
    <>
      <PageHeader
        title="Trainers"
        description="Your coaching team, their shifts and what appears on the website."
        actions={canManage && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Add trainer</Button>}
      />
      {trainers.isPending ? (
        <Card><SkeletonList rows={3} /></Card>
      ) : trainers.isError ? (
        <Card><ErrorState error={trainers.error} onRetry={() => trainers.refetch()} /></Card>
      ) : trainers.data.length === 0 ? (
        <Card>
          <EmptyState icon={Dumbbell} title="No trainers yet" body="Add your coaches so members can see who trains them." action={canManage && <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>Add trainer</Button>} />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {trainers.data.map((t) => (
            <li key={t._id}>
              <Card className={cn("flex h-full flex-col", t.isActive === false && "opacity-70")}>
                <div className="flex items-center gap-3">
                  <Avatar name={t.name} src={t.image} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">{t.name}</p>
                    <p className="truncate text-[13px] text-ink-3">{t.role}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.isActive === false ? <Badge size="sm">Not working here</Badge> : <Badge size="sm" tone="good">Active</Badge>}
                  {t.showOnFrontend ? <Badge size="sm" icon={Eye}>On website</Badge> : <Badge size="sm" icon={EyeOff}>Hidden</Badge>}
                  {(t.specialties || []).slice(0, 3).map((s) => (
                    <Badge key={s} size="sm" tone="brand">{s}</Badge>
                  ))}
                </div>
                <div className="mt-3 flex flex-col gap-1 text-sm text-ink-2">
                  {t.shift && <p className="flex items-center gap-1.5"><Clock className="size-3.5 text-ink-3" aria-hidden />{t.shift}</p>}
                  {t.phone && (
                    <a href={phoneHref(t.phone)} className="flex items-center gap-1.5 hover:underline"><Phone className="size-3.5 text-ink-3" aria-hidden /><span className="tabular">{t.phone}</span></a>
                  )}
                </div>
                {canManage && (
                  <div className="mt-auto flex gap-2 pt-4">
                    <Button size="sm" variant="quiet" icon={Pencil} onClick={() => setEditing(t)}>Edit</Button>
                    <Button size="sm" variant="ghost" icon={Trash2} onClick={() => onDelete(t)}>Remove</Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <TrainerDialog open={creating || Boolean(editing)} trainer={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </>
  );
}
