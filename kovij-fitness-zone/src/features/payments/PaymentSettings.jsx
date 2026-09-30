import { useEffect, useMemo, useState } from "react";
import { useOnlinePaymentStatus } from "./api";
import { QrCode } from "./UpiQrCode";
import { UPI_ID_PATTERN, upiLink } from "./upi";
import { useUpdateSettings } from "../settings/api";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";
import { Badge, Button, Card, CardHeader, Field, FormError, InlineAlert, Input, Skeleton, Switch, useToast } from "../../shared/ui";

const FIELDS = ["acceptCash", "acceptUpi", "acceptCard", "allowPartial", "upiId", "payeeName", "onlineEnabled"];
const DESK_MODES = [
  { key: "acceptCash", label: "Cash" },
  { key: "acceptUpi", label: "UPI", description: "Scanned at the desk, or paid from the member app to the UPI ID below." },
  { key: "acceptCard", label: "Card", description: "Swipe or tap machine at the desk." },
];

const fromSettings = (payments = {}) => ({
  acceptCash: payments.acceptCash !== false,
  acceptUpi: payments.acceptUpi !== false,
  acceptCard: payments.acceptCard !== false,
  allowPartial: payments.allowPartial !== false,
  upiId: payments.upiId || "",
  payeeName: payments.payeeName || "",
  onlineEnabled: Boolean(payments.onlineEnabled),
});

/** Online checkout status: connected (test/live), or what is missing. */
function GatewayStatus({ status }) {
  if (!status) return <Skeleton className="h-6 w-40 rounded-full" />;
  const g = status.gateway;
  if (!g.configured) return <Badge tone="neutral">Not connected</Badge>;
  return <Badge tone={g.mode === "live" ? "good" : "info"}>{g.mode === "live" ? "Razorpay connected" : "Razorpay connected in test mode"}</Badge>;
}

/**
 * Settings > Payments: how the gym takes money. Receives { settings, readOnly }.
 * Saves only changed fields; the server merges the payments group field by field.
 */
export default function PaymentSettings({ settings, readOnly }) {
  const update = useUpdateSettings();
  const toast = useToast();
  const online = useOnlineStatus();
  const gateway = useOnlinePaymentStatus();
  const initial = useMemo(() => fromSettings(settings.payments), [settings.payments]);
  const [form, setForm] = useState(initial);
  const [clientErrors, setClientErrors] = useState({});
  useEffect(() => setForm(initial), [initial]);

  const changed = Object.fromEntries(FIELDS.filter((k) => form[k] !== initial[k]).map((k) => [k, typeof form[k] === "string" ? form[k].trim() : form[k]]));
  const dirty = Object.keys(changed).length > 0;
  useUnsavedChangesGuard(dirty && !readOnly);

  const serverErrors = Object.fromEntries(Object.entries(update.error?.fields || {}).map(([k, v]) => [k.replace(/^payments\./, ""), v]));
  const errors = { ...serverErrors, ...clientErrors };
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const deskModesOn = DESK_MODES.filter((m) => form[m.key]).length;
  const g = gateway.data?.gateway;
  const upiValid = UPI_ID_PATTERN.test(form.upiId.trim());
  const previewLink = upiValid ? upiLink({ upiId: form.upiId.trim(), payeeName: form.payeeName.trim() || settings.gymName }) : null;

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (form.upiId.trim() && !upiValid) next.upiId = "Enter a UPI ID like kovijgym@okicici";
    if (!form.upiId.trim() && initial.upiId) next.upiId = "To stop UPI payments, turn off UPI above instead of clearing the ID";
    if (form.acceptUpi && !form.upiId.trim() && changed.acceptUpi) next.upiId = "Add the gym's UPI ID so members can pay from the app";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    update.mutate({ payments: changed }, { onSuccess: () => toast.success("Payment settings saved") });
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {readOnly && <InlineAlert tone="info">Only the owner can change these settings.</InlineAlert>}
      <FormError error={update.error} />
      <fieldset disabled={readOnly} className="contents">
        <Card padding="lg">
          <CardHeader title="Ways to pay at the desk" description="Only the ways turned on here are offered when collecting money." />
          <div className="flex flex-col gap-5">
            {DESK_MODES.map((m) => (
              <Switch
                key={m.key}
                label={m.label}
                description={form[m.key] && deskModesOn === 1 ? "At least one way to pay has to stay on." : m.description}
                checked={form[m.key]}
                disabled={readOnly || (form[m.key] && deskModesOn === 1)}
                onChange={(v) => set({ [m.key]: v })}
              />
            ))}
            <div className="border-t border-line pt-5">
              <Switch
                label="Allow part payments"
                description="Collect some of a bill now and keep the rest due. Each part gets its own receipt."
                checked={form.allowPartial}
                disabled={readOnly}
                onChange={(v) => set({ allowPartial: v })}
              />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader title="UPI payments from the member app" description="Members pay this UPI ID from their own UPI app and send you the reference number to check." />
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-4">
              <Field label="Gym's UPI ID" error={errors.upiId} hint="Find it in your bank or UPI business app, e.g. kovijgym@okicici.">
                <Input value={form.upiId} onChange={(e) => set({ upiId: e.target.value })} autoCapitalize="none" autoCorrect="off" spellCheck={false} inputMode="email" maxLength={80} />
              </Field>
              <Field label="Name members see" optional error={errors.payeeName} hint={`Shown in the member's UPI app. Leave blank to use “${settings.gymName || "the gym name"}”.`}>
                <Input value={form.payeeName} onChange={(e) => set({ payeeName: e.target.value })} maxLength={80} />
              </Field>
              {!form.acceptUpi && <InlineAlert tone="warning">UPI is turned off above, so members can&apos;t pay by UPI from the app.</InlineAlert>}
            </div>
            <div className="flex flex-col items-center gap-2 sm:w-44">
              {previewLink ? (
                <>
                  <QrCode value={previewLink} label={`UPI QR code for ${form.upiId.trim()}`} className="size-40 p-1" />
                  <p className="text-center text-[13px] text-ink-3">Scan with any UPI app to check it shows the right name. Don&apos;t pay.</p>
                </>
              ) : (
                <div className="grid size-40 place-items-center rounded-tile border border-dashed border-line-strong p-4 text-center text-[13px] text-ink-3">
                  The QR preview appears when the UPI ID looks right.
                </div>
              )}
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <CardHeader
            title="Online checkout (card, UPI, netbanking)"
            description="Members pay in the app and the payment is recorded automatically, with no reference to check."
            action={<GatewayStatus status={gateway.data} />}
          />
          <Switch
            label="Let members pay online"
            description={
              g && !g.configured
                ? "Needs a Razorpay account connected to this system first."
                : "Members see a Pay online button on their bills."
            }
            checked={form.onlineEnabled}
            disabled={readOnly || !g?.configured}
            onChange={(v) => set({ onlineEnabled: v })}
          />
          {gateway.isError && (
            <InlineAlert tone="danger" className="mt-4" action={<Button size="sm" onClick={() => gateway.refetch()}>Try again</Button>}>
              Couldn&apos;t check whether online checkout is connected.
            </InlineAlert>
          )}
          {g && !g.configured && (
            <InlineAlert tone="info" className="mt-4" title="How to connect">
              Create a Razorpay account for the gym, then ask your developer to add its key id and key secret to the server settings
              (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET). Keys are never entered or shown here.
            </InlineAlert>
          )}
          {g?.configured && !g.webhookConfigured && (
            <InlineAlert tone="warning" className="mt-4">
              Automatic confirmation from Razorpay isn&apos;t set up (RAZORPAY_WEBHOOK_SECRET), so a payment is recorded only when the member returns to the app after paying.
            </InlineAlert>
          )}
        </Card>
      </fieldset>

      {!readOnly && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {dirty && (
            <Button variant="ghost" onClick={() => (setForm(initial), setClientErrors({}))}>
              Undo changes
            </Button>
          )}
          <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty || !online}>
            Save payment settings
          </Button>
        </div>
      )}
      {!online && !readOnly && <InlineAlert tone="offline">You&apos;re offline. Changes can be saved when the connection is back.</InlineAlert>}
    </form>
  );
}
