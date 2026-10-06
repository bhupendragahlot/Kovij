import { useEffect, useState } from "react";
import { useUpdateMember } from "./api";
import { AddressFields, ContactFields, HealthFields, JoiningFields } from "./MemberFormFields";
import { fieldErrorsFor, fromMember, toDetailsPayload, toHealthPayload } from "./memberForm";
import { usePermission } from "../auth/permissions";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, FormError, InlineAlert, useConfirm, useToast } from "../../shared/ui";

export function EditMemberDialog({ open, onClose, member, profile }) {
  const update = useUpdateMember(member?._id);
  const toast = useToast();
  const confirm = useConfirm();
  const online = useOnlineStatus();
  const canSeeHealth = usePermission("members.health.view");
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
      { details: toDetailsPayload(form.details, { clearable: true }), health: canSeeHealth ? toHealthPayload(form.health) : undefined },
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
          <Button type="submit" form="edit-member" variant="primary" loading={update.isPending} disabled={!dirty || !online}>
            Save details
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          Saving needs a connection. Your changes stay here until you reconnect.
        </InlineAlert>
      )}
      <FormError error={update.error} />
      <form id="edit-member" onSubmit={submit} className="flex flex-col gap-8" noValidate>
        <section aria-label="Contact">
          <ContactFields value={form.details} onChange={(details) => setForm({ ...form, details })} errors={fieldErrorsFor(update.error, "details")} />
        </section>
        <section aria-label="Joining">
          <h3 className="mb-3 text-body-lg font-semibold">Joining</h3>
          <JoiningFields value={form.details} onChange={(details) => setForm({ ...form, details })} errors={fieldErrorsFor(update.error, "details")} excludeId={member?._id} />
        </section>
        <section aria-label="Address and notes">
          <AddressFields value={form.details} onChange={(details) => setForm({ ...form, details })} errors={fieldErrorsFor(update.error, "details")} />
        </section>
        {canSeeHealth && (
          <section aria-label="Health">
            <h3 className="mb-3 text-body-lg font-semibold">Health</h3>
            <HealthFields value={form.health} onChange={(health) => setForm({ ...form, health })} errors={fieldErrorsFor(update.error, "health")} />
          </section>
        )}
      </form>
    </Dialog>
  );
}
