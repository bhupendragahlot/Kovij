import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useSaveTrainer, useTrainerLogins, useUploadTrainerPhoto } from "../api";
import { ScheduleEditor } from "./ScheduleEditor";
import { useIdempotencyKey } from "../../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../../shared/hooks/useOnlineStatus";
import { Avatar, Button, Dialog, Field, FormError, InlineAlert, Input, Select, Switch, TagInput, Textarea, useToast } from "../../../shared/ui";

const EMPTY = {
  name: "",
  role: "",
  phone: "",
  email: "",
  image: "",
  instagram: "",
  description: "",
  specialties: [],
  shift: "",
  schedule: [],
  userId: "",
  isActive: true,
  showOnFrontend: true,
};

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

function fromTrainer(t) {
  return {
    ...EMPTY,
    ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, t[k] ?? EMPTY[k]])),
    schedule: (t.schedule || []).map((d) => ({ day: d.day, shifts: d.shifts.map((s) => ({ start: s.start, end: s.end })) })),
    userId: t.userId ? String(t.userId) : "",
  };
}

/** Add or edit a trainer: profile, weekly schedule, photo, and the staff login it belongs to. */
export function TrainerDialog({ open, trainer, onClose }) {
  const save = useSaveTrainer();
  const upload = useUploadTrainerPhoto();
  const logins = useTrainerLogins({ enabled: open });
  const idempotency = useIdempotencyKey();
  const online = useOnlineStatus();
  const toast = useToast();
  const fileRef = useRef(null);
  const [form, setForm] = useState(EMPTY);
  const [photo, setPhoto] = useState(null); // { file, preview }
  const [photoError, setPhotoError] = useState(null);

  useEffect(() => {
    if (!open) return;
    save.reset();
    upload.reset();
    idempotency.reset();
    setForm(trainer ? fromTrainer(trainer) : EMPTY);
    setPhoto(null);
    setPhotoError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Free the preview's memory when it is replaced or the dialog closes.
  useEffect(() => () => photo && URL.revokeObjectURL(photo.preview), [photo]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = save.error?.fields || {};

  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return setPhotoError("Choose a JPEG, PNG or WebP photo");
    if (file.size > MAX_PHOTO_BYTES) return setPhotoError("Choose a photo under 5 MB");
    setPhotoError(null);
    setPhoto({ file, preview: URL.createObjectURL(file) });
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form, userId: form.userId || null };
    const done = (saved) => {
      toast.success(trainer ? "Trainer saved" : `${saved.name} added`);
      onClose();
    };
    save.mutate(
      { id: trainer?._id, payload, idempotencyKey: trainer ? undefined : idempotency.keyFor(payload) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          if (!photo) return done(data.trainer);
          upload.mutate(
            { id: data.trainer._id, file: photo.file },
            {
              onSuccess: () => done(data.trainer),
              onError: (err) => {
                // The profile is saved; only the photo failed. Keep the dialog open on the saved trainer.
                toast.warning(`${data.trainer.name} saved, but the photo didn't upload`, { description: err.message });
                onClose();
              },
            }
          );
        },
      }
    );
  };

  const busy = save.isPending || upload.isPending;
  const loginOptions = logins.data || [];

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
          <Button type="submit" form="trainer-form" variant="primary" loading={busy} disabled={!online}>
            {trainer ? "Save trainer" : "Add trainer"}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You're offline. Reconnect to save.
        </InlineAlert>
      )}
      <FormError error={save.error} />
      <form id="trainer-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <div className="flex items-center gap-4 sm:col-span-2">
          <Avatar name={form.name || "?"} src={photo?.preview || form.image} size="xl" />
          <div className="flex flex-col gap-1">
            <Button variant="secondary" icon={Camera} onClick={() => fileRef.current?.click()}>
              {photo || form.image ? "Change photo" : "Add photo"}
            </Button>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" tabIndex={-1} aria-hidden onChange={pickPhoto} />
            <p className="text-[13px] text-ink-3">{photoError ? <span className="font-medium text-bad">{photoError}</span> : "Shown on the website and in the member app."}</p>
          </div>
        </div>
        <Field label="Name" error={errors.name} required>
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Title" error={errors.role} required hint="Shown on the website, e.g. Strength coach.">
          <Input value={form.role} onChange={(e) => set({ role: e.target.value })} maxLength={80} />
        </Field>
        <Field label="Phone" optional error={errors.phone} hint="Staff see it; members see it only for their own trainer.">
          <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={20} />
        </Field>
        <Field label="Email" optional error={errors.email} hint="Staff only.">
          <Input type="email" inputMode="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field
          label="Staff login"
          optional
          error={errors.userId}
          className="sm:col-span-2"
          hint={loginOptions.length ? "Links this profile to the trainer's sign-in, so they see “My members”." : "Create a staff login with the trainer role in Settings first."}
        >
          <Select value={form.userId} onChange={(e) => set({ userId: e.target.value })} disabled={logins.isPending}>
            <option value="">Not linked</option>
            {loginOptions.map((u) => {
              const takenByOther = u.linkedTrainer && u.linkedTrainer.id !== trainer?._id;
              return (
                <option key={u.id} value={u.id} disabled={takenByOther}>
                  {u.name} (@{u.username}){takenByOther ? `, linked to ${u.linkedTrainer.name}` : ""}
                  {u.isActive ? "" : ", inactive"}
                </option>
              );
            })}
          </Select>
        </Field>
        <Field label="Specialties" optional error={errors.specialties} className="sm:col-span-2">
          <TagInput value={form.specialties} onChange={(specialties) => set({ specialties })} placeholder="e.g. Powerlifting, then Enter" max={12} />
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">Weekly schedule</legend>
          <p className="mb-3 text-[13px] text-ink-3">When they're on the floor. Members see this for their own trainer.</p>
          <ScheduleEditor value={form.schedule} onChange={(schedule) => set({ schedule })} errors={errors} />
          {!form.schedule.length && (
            <Field label="Or describe it" optional error={errors.shift} className="mt-3" hint="Used only when no weekly schedule is set.">
              <Input value={form.shift} onChange={(e) => set({ shift: e.target.value })} placeholder="6–11 am, Mon–Sat" maxLength={120} />
            </Field>
          )}
        </fieldset>
        <Field label="Bio" optional error={errors.description} className="sm:col-span-2">
          <Textarea value={form.description} onChange={(e) => set({ description: e.target.value })} rows={3} maxLength={1000} />
        </Field>
        <Field label="Instagram link" optional error={errors.instagram} className="sm:col-span-2">
          <Input type="url" inputMode="url" value={form.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="https://instagram.com/…" />
        </Field>
        <Field label="Photo link" optional error={errors.image} className="sm:col-span-2" hint="Or paste a link instead of uploading.">
          <Input type="url" inputMode="url" value={form.image} onChange={(e) => set({ image: e.target.value })} disabled={Boolean(photo)} />
        </Field>
        <div className="flex flex-col gap-4 sm:col-span-2">
          <Switch label="Currently working here" description="Turn off instead of removing, to keep their history." checked={form.isActive} onChange={(isActive) => set({ isActive })} />
          <Switch label="Show on website" checked={form.showOnFrontend} onChange={(showOnFrontend) => set({ showOnFrontend })} />
        </div>
      </form>
    </Dialog>
  );
}
