import { useEffect, useState } from "react";
import { Banknote, CreditCard, Printer, Smartphone } from "lucide-react";
import { useCollectPayment, useRecordPayment, openReceipt } from "./api";
import { MemberPicker } from "../members/MemberPicker";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, Field, FormError, InlineAlert, Input, SegmentedControl, Select, useToast } from "../../shared/ui";
import { formatDate, formatINR } from "../../shared/lib/format";
import { PAYMENT_TYPE_LABEL } from "../../shared/domain/status";

const MODE_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
];

/** Payment mode + (for UPI/card) a reference, shared by every money form. */
export function PaymentModeFields({ mode, txnRef, onChange, errors = {} }) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Paid by" error={errors.mode}>
        <SegmentedControl label="Payment mode" value={mode} onChange={(v) => onChange({ mode: v })} options={MODE_OPTIONS} block />
      </Field>
      {mode && mode !== "cash" && (
        <Field label={mode === "upi" ? "UPI reference" : "Card slip number"} optional hint="Helps match the payment on your bank statement." error={errors.txnRef}>
          <Input value={txnRef} onChange={(e) => onChange({ txnRef: e.target.value })} inputMode={mode === "upi" ? "numeric" : "text"} maxLength={80} />
        </Field>
      )}
    </div>
  );
}

function OfflineNotice() {
  return (
    <InlineAlert tone="offline" className="mb-4">
      Payments need a connection so the receipt number is issued once. Reconnect to continue.
    </InlineAlert>
  );
}

/** Toast after money is taken, with a one-tap receipt. */
function useReceiptToast() {
  const toast = useToast();
  return (payment, title) =>
    toast.success(title, {
      description: `Receipt ${payment.invoiceNo}`,
      action: { label: "Print", onClick: () => openReceipt(payment._id) },
    });
}

/**
 * Record money received at the desk (e.g. personal training, a top-up).
 * If `member` is given, it is fixed; otherwise the desk searches for one.
 */
export function RecordPaymentDialog({ open, onClose, member: fixedMember }) {
  const online = useOnlineStatus();
  const record = useRecordPayment();
  const idempotency = useIdempotencyKey();
  const showReceipt = useReceiptToast();
  const [member, setMember] = useState(fixedMember || null);
  const [form, setForm] = useState({ type: "personal_training", amount: "", mode: "cash", txnRef: "", note: "" });
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (open) {
      setMember(fixedMember || null);
      setForm({ type: "personal_training", amount: "", mode: "cash", txnRef: "", note: "" });
      setClientErrors({});
      record.reset();
      idempotency.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = { ...record.error?.fields, ...clientErrors };

  const submit = (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!member) nextErrors.memberId = "Choose who paid";
    if (!(Number(form.amount) > 0)) nextErrors.amount = "Enter the amount received";
    setClientErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = {
      memberId: member._id,
      type: form.type,
      amount: Number(form.amount),
      mode: form.mode,
      txnRef: form.txnRef || undefined,
      note: form.note || undefined,
    };
    record.mutate(
      { payload, idempotencyKey: idempotency.keyFor(payload) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          showReceipt(data.payment, `${formatINR(data.payment.amount)} recorded for ${member.name}`);
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Record a payment"
      description="For money received now. Plan renewals are recorded when you renew."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="record-payment" variant="primary" loading={record.isPending} disabled={!online}>
            {Number(form.amount) > 0 ? `Record ${formatINR(form.amount)}` : "Record payment"}
          </Button>
        </>
      }
    >
      {!online && <OfflineNotice />}
      <FormError error={record.error} />
      <form id="record-payment" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {fixedMember ? null : (
          <Field label="Member" error={errors.memberId}>
            <MemberPicker value={member} onChange={setMember} />
          </Field>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="For" error={errors.type}>
            <Select value={form.type} onChange={(e) => set({ type: e.target.value })}>
              {["personal_training", "membership", "renewal", "registration", "other"].map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount" error={errors.amount}>
            <Input
              prefix="₹"
              type="number"
              inputMode="decimal"
              min="1"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value })}
            />
          </Field>
        </div>
        <PaymentModeFields mode={form.mode} txnRef={form.txnRef} onChange={set} errors={errors} />
        <Field label="Note" optional error={errors.note}>
          <Input value={form.note} onChange={(e) => set({ note: e.target.value })} maxLength={300} placeholder="e.g. 8 PT sessions with Aman" />
        </Field>
      </form>
    </Dialog>
  );
}

/** Settle a due that already exists (self-join registration, "collect later" renewal). */
export function CollectPaymentDialog({ payment, memberName, onClose }) {
  const online = useOnlineStatus();
  const collect = useCollectPayment();
  const idempotency = useIdempotencyKey();
  const toast = useToast();
  const [form, setForm] = useState({ mode: "cash", txnRef: "" });

  useEffect(() => {
    if (payment) {
      setForm({ mode: "cash", txnRef: "" });
      collect.reset();
      idempotency.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?._id]);

  const who = memberName || (typeof payment?.memberId === "object" ? payment.memberId?.name : null);

  const submit = (e) => {
    e.preventDefault();
    const body = { mode: form.mode, txnRef: form.txnRef || undefined };
    collect.mutate(
      { paymentId: payment._id, payload: body, idempotencyKey: idempotency.keyFor({ id: payment._id, ...body }) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          toast.success(`${formatINR(data.payment.amount)} collected`, {
            description: data.activatedMembership
              ? `Plan is now active until ${formatDate(data.activatedMembership.endDate)}.`
              : `Receipt ${data.payment.invoiceNo}`,
            action: { label: "Print", onClick: () => openReceipt(data.payment._id) },
          });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={Boolean(payment)}
      onClose={onClose}
      title="Collect payment"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="collect-payment" variant="primary" loading={collect.isPending} disabled={!online}>
            Collect {payment ? formatINR(payment.amount) : ""}
          </Button>
        </>
      }
    >
      {!online && <OfflineNotice />}
      <FormError error={collect.error} />
      {payment && (
        <form id="collect-payment" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="rounded-tile bg-surface-2 p-4">
            <p className="text-sm text-ink-3">{who || "Amount due"}</p>
            <p className="mt-0.5 text-[28px] font-bold leading-9">{formatINR(payment.amount)}</p>
            <p className="text-sm text-ink-2">
              {PAYMENT_TYPE_LABEL[payment.type]}
              {payment.membershipId?.planName ? `: ${payment.membershipId.planName}` : ""}
            </p>
          </div>
          <PaymentModeFields mode={form.mode} txnRef={form.txnRef} onChange={(p) => setForm((f) => ({ ...f, ...p }))} errors={collect.error?.fields} />
        </form>
      )}
    </Dialog>
  );
}

export function ReceiptButton({ paymentId, size = "sm" }) {
  const toast = useToast();
  return (
    <Button
      size={size}
      variant="ghost"
      icon={Printer}
      onClick={() => openReceipt(paymentId).catch((e) => toast.error("Couldn't open the receipt", { description: e.message }))}
    >
      Receipt
    </Button>
  );
}
