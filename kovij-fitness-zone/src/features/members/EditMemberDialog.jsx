import { useEffect, useState } from "react";
import { useUpdateMember } from "./api";
import { AddressFields, ContactFields, HealthFields } from "./MemberFormFields";
import { fieldErrorsFor, fromMember, toDetailsPayload, toHealthPayload } from "./memberForm";
import { Button, Dialog, FormError, useConfirm, useToast } from "../../shared/ui";

export function EditMemberDialog({ open, onClose, member, profile }) {
  const update = useUpdateMember(member?._id);
  const toast = useToast();
  const confirm = useConfirm();
  const [form, setForm] = useState(() => fromMember(member, profile));
  const [initial, setInitial] = useState(form);

  useEffect(() => {
    if (open) {
      const next = fromMember(member, profile);
      setForm(next);
      setInitial(next);
      update.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const close = async () => {
    if (dirty && !(await confirm({ title: "Discard your changes?", confirmLabel: "Discard", cancelLabel: "Keep editing", tone: "danger" }))) return;
    onClose();
  };

  const submit = (e) => {
    e.preventDefault();
    update.mutate(
      { details: toDetailsPayload(form.details), health: toHealthPayload(form.health) },
      {
        onSuccess: () => {
          toast.success("Details saved");
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Edit details"
      placement="side"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="edit-member" variant="primary" loading={update.isPending} disabled={!dirty}>
            Save details
          </Button>
        </>
      }
    >
      <FormError error={update.error} />
      <form id="edit-member" onSubmit={submit} className="flex flex-col gap-8" noValidate>
        <section aria-label="Contact">
          <ContactFields value={form.details} onChange={(details) => setForm({ ...form, details })} errors={fieldErrorsFor(update.error, "details")} />
        </section>
        <section aria-label="Address and notes">
          <AddressFields value={form.details} onChange={(details) => setForm({ ...form, details })} errors={fieldErrorsFor(update.error, "details")} />
        </section>
        <section aria-label="Health">
          <h3 className="mb-3 text-[15px] font-semibold">Health</h3>
          <HealthFields value={form.health} onChange={(health) => setForm({ ...form, health })} errors={fieldErrorsFor(update.error, "health")} />
        </section>
      </form>
    </Dialog>
  );
}
