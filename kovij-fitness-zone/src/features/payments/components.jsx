import { useEffect, useState } from "react";
import { Banknote, CircleCheck, CreditCard, Printer, Smartphone, Undo2, XCircle } from "lucide-react";
import { useAcceptedModes, useCollectPayment, useRecordPayment, useRefundPayment, useVerifyPayment, openReceipt } from "./api";
import { MODE_LABEL, PAYMENT_STATE, TYPE_LABEL, paymentState } from "./labels";
import { MemberPicker } from "../members/MemberPicker";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Badge, Button, Dialog, Field, FormError, InlineAlert, Input, SegmentedControl, Select, Textarea, useToast } from "../../shared/ui";
import { formatDate, formatDateTime, formatINR } from "../../shared/lib/format";

const MODE_OPTIONS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "upi", label: "UPI", icon: Smartphone },
  { value: "card", label: "Card", icon: CreditCard },
];

const memberNameOf = (payment, fallback) => fallback || (typeof payment?.memberId === "object" ? payment.memberId?.name : null);
const forLabel = (p) => `${TYPE_LABEL[p.type] || p.type}${p.membershipId?.planName ? `: ${p.membershipId.planName}` : ""}`;

/** Payment status pill that also knows refunds and UPI references waiting to be checked. */
export function PaymentStatusBadge({ payment, size = "sm" }) {
  const meta = PAYMENT_STATE[paymentState(payment)];
  if (!meta) return null;
  return (
    <Badge tone={meta.tone} icon={meta.icon} size={size}>
      {meta.label}
    </Badge>
  );
}

/**
 * Payment mode + (for UPI/card) a reference, shared by every money form. Only the modes turned
 * on in Settings > Payments are offered; if the current one is off, the first allowed is picked.
 */
export function PaymentModeFields({ mode, txnRef, onChange, errors = {} }) {
  const { modes } = useAcceptedModes();
  const options = MODE_OPTIONS.filter((o) => modes.includes(o.value));

  useEffect(() => {
    if (mode && !modes.includes(mode)) onChange({ mode: modes[0] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, modes.join(",")]);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Paid by" error={errors.mode}>
        <SegmentedControl label="Payment mode" value={mode} onChange={(v) => onChange({ mode: v })} options={options} block />
      </Field>
      {mode && mode !== "cash" && (
        <Field label={mode === "upi" ? "UPI reference" : "Card slip number"} optional hint="Helps match the payment on your bank statement." error={errors.txnRef}>
          <Input value={txnRef} onChange={(e) => onChange({ txnRef: e.target.value })} inputMode={mode === "upi" ? "numeric" : "text"} maxLength={80} />
        </Field>
      )}
    </div>
  );
}

export function OfflineNotice({ children }) {
  return (
    <InlineAlert tone="offline" className="mb-4">
      {children || "Payments need a connection so the receipt number is issued once. Reconnect to continue."}
    </InlineAlert>
  );
}

/** Toast after money is taken, with a one-tap receipt. */
function useReceiptToast() {
  const toast = useToast();
  return (payment, title, description) =>
    toast.success(title, {
      description: description || `Receipt ${payment.invoiceNo}`,
      action: { label: "Print", onClick: () => openReceipt(payment._id).catch(() => toast.error("Couldn't open the receipt")) },
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
  const { modes } = useAcceptedModes();
  const [member, setMember] = useState(fixedMember || null);
  const [form, setForm] = useState({ type: "personal_training", amount: "", mode: "cash", txnRef: "", note: "" });
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (open) {
      setMember(fixedMember || null);
      setForm({ type: "personal_training", amount: "", mode: modes[0], txnRef: "", note: "" });
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
                  {TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount" error={errors.amount}>
            <Input prefix="₹" type="number" inputMode="decimal" min="1" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
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

/** Amount owed on a due, with part-payment progress when some was already paid. */
function DueSummary({ payment, who }) {
  const paidSoFar = payment.originalAmount != null ? payment.originalAmount - payment.amount : 0;
  return (
    <div className="rounded-tile bg-surface-2 p-4">
      <p className="text-sm text-ink-3">{who || "Amount due"}</p>
      <p className="tabular mt-0.5 text-[28px] font-bold leading-9">{formatINR(payment.amount)}</p>
      <p className="text-sm text-ink-2">
        {forLabel(payment)}, bill {payment.invoiceNo}
      </p>
      {paidSoFar > 0 && (
        <p className="mt-1 text-[13px] text-ink-3">
          {formatINR(paidSoFar)} of {formatINR(payment.originalAmount)} already paid
        </p>
      )}
    </div>
  );
}

/** Settle all or part of a due that already exists (self-join registration, "collect later" renewal). */
export function CollectPaymentDialog({ payment, memberName, onClose }) {
  const online = useOnlineStatus();
  const collect = useCollectPayment();
  const idempotency = useIdempotencyKey();
  const showReceipt = useReceiptToast();
  const toast = useToast();
  const { modes, allowPartial } = useAcceptedModes();
  const [form, setForm] = useState({ mode: "cash", txnRef: "", split: "full", amount: "" });
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (payment) {
      setForm({ mode: modes[0], txnRef: "", split: "full", amount: "" });
      setClientErrors({});
      collect.reset();
      idempotency.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?._id]);

  const who = memberNameOf(payment, memberName);
  const part = form.split === "part";
  const partAmount = Number(form.amount);
  const amount = part ? partAmount : payment?.amount;
  const errors = { ...collect.error?.fields, ...clientErrors };
  const waiting = payment?.verification?.state === "submitted" ? payment.verification : null;

  const submit = (e) => {
    e.preventDefault();
    if (part && !(partAmount > 0 && partAmount < payment.amount)) {
      setClientErrors({ amount: `Enter an amount between ₹1 and ${formatINR(payment.amount - 1)}` });
      return;
    }
    setClientErrors({});
    const body = { mode: form.mode, txnRef: form.txnRef || undefined, ...(part && { amount: partAmount }) };
    collect.mutate(
      { paymentId: payment._id, payload: body, idempotencyKey: idempotency.keyFor({ id: payment._id, ...body }) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          if (data.partial) {
            showReceipt(data.payment, `${formatINR(data.payment.amount)} collected`, `${formatINR(data.balance)} still due. Receipt ${data.payment.invoiceNo}.`);
          } else if (data.activatedMembership) {
            toast.success(`${formatINR(data.payment.amount)} collected`, {
              description: `Plan is now active until ${formatDate(data.activatedMembership.endDate)}.`,
              action: { label: "Print", onClick: () => openReceipt(data.payment._id).catch(() => toast.error("Couldn't open the receipt")) },
            });
          } else {
            showReceipt(data.payment, `${formatINR(data.payment.amount)} collected`);
          }
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
            {amount > 0 ? `Collect ${formatINR(amount)}` : "Collect"}
          </Button>
        </>
      }
    >
      {!online && <OfflineNotice />}
      <FormError error={collect.error} />
      {payment && (
        <form id="collect-payment" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <DueSummary payment={payment} who={who} />
          {waiting && (
            <InlineAlert tone="warning" title="The member says they paid by UPI">
              Reference {waiting.utr}, sent {formatDateTime(waiting.submittedAt)}. Check your bank app before taking money again.
            </InlineAlert>
          )}
          {allowPartial && (
            <Field label="How much">
              <SegmentedControl
                label="How much is being paid"
                value={form.split}
                onChange={(split) => setForm((f) => ({ ...f, split }))}
                options={[
                  { value: "full", label: `All ${formatINR(payment.amount)}` },
                  { value: "part", label: "Part of it" },
                ]}
                block
              />
            </Field>
          )}
          {part && (
            <Field
              label="Amount received now"
              error={errors.amount}
              hint={partAmount > 0 && partAmount < payment.amount ? `${formatINR(payment.amount - partAmount)} will stay due on this bill.` : "The rest stays due on this bill."}
            >
              <Input prefix="₹" type="number" inputMode="decimal" min="1" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} autoFocus />
            </Field>
          )}
          <PaymentModeFields mode={form.mode} txnRef={form.txnRef} onChange={(p) => setForm((f) => ({ ...f, ...p }))} errors={errors} />
        </form>
      )}
    </Dialog>
  );
}

/**
 * A member paid by UPI and sent the reference (UTR). The desk finds it in the bank app, then
 * confirms (the bill is collected as UPI) or rejects it with a reason the member will see.
 */
export function VerifyPaymentDialog({ payment, onClose }) {
  const online = useOnlineStatus();
  const verify = useVerifyPayment();
  const idempotency = useIdempotencyKey();
  const showReceipt = useReceiptToast();
  const toast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (payment) {
      setRejecting(false);
      setReason("");
      verify.reset();
      idempotency.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?._id]);

  const v = payment?.verification;
  const errors = verify.error?.fields || {};

  const send = (payload) =>
    verify.mutate(
      { paymentId: payment._id, payload, idempotencyKey: idempotency.keyFor({ id: payment._id, ...payload }) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          if (payload.decision === "confirm") showReceipt(data.payment, "Payment confirmed", `${formatINR(data.payment.amount)} by UPI. Receipt ${data.payment.invoiceNo}.`);
          else toast.success("Reference rejected", { description: "The member has been told why and can send it again." });
          onClose();
        },
      }
    );

  return (
    <Dialog
      open={Boolean(payment)}
      onClose={onClose}
      title="Check UPI payment"
      description="Find this reference in the gym's bank or UPI app before confirming."
      size="sm"
      footer={
        rejecting ? (
          <>
            <Button variant="secondary" onClick={() => setRejecting(false)}>
              Back
            </Button>
            <Button variant="danger" icon={XCircle} loading={verify.isPending} disabled={!online} onClick={() => send({ decision: "reject", reason: reason.trim() })}>
              Reject reference
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" icon={XCircle} onClick={() => setRejecting(true)}>
              Not found
            </Button>
            <Button variant="primary" icon={CircleCheck} loading={verify.isPending} disabled={!online} onClick={() => send({ decision: "confirm" })}>
              Confirm payment
            </Button>
          </>
        )
      }
    >
      {!online && <OfflineNotice />}
      <FormError error={verify.error} />
      {payment && v && (
        <div className="flex flex-col gap-4">
          <DueSummary payment={payment} who={memberNameOf(payment)} />
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-ink-3">UPI reference</dt>
            <dd className="tabular select-all break-all text-[17px] font-bold tracking-wide">{v.utr}</dd>
            <dt className="text-ink-3">Sent</dt>
            <dd>{formatDateTime(v.submittedAt)}</dd>
            {v.amount != null && v.amount !== payment.amount && (
              <>
                <dt className="text-ink-3">Amount when sent</dt>
                <dd>{formatINR(v.amount)}</dd>
              </>
            )}
          </dl>
          {rejecting && (
            <Field label="Why can't you confirm it?" error={errors.reason} hint="The member sees this and can send the right reference.">
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} placeholder="e.g. No payment with this reference in the bank app" autoFocus />
            </Field>
          )}
        </div>
      )}
    </Dialog>
  );
}

/** Managers mark money given back by hand. It stops counting as revenue; the plan is not touched. */
export function RefundDialog({ payment, onClose }) {
  const online = useOnlineStatus();
  const refund = useRefundPayment();
  const idempotency = useIdempotencyKey();
  const toast = useToast();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (payment) {
      setReason("");
      refund.reset();
      idempotency.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment?._id]);

  const errors = refund.error?.fields || {};
  const submit = (e) => {
    e.preventDefault();
    const payload = { reason: reason.trim() };
    refund.mutate(
      { paymentId: payment._id, payload, idempotencyKey: idempotency.keyFor({ id: payment._id, ...payload }) },
      {
        onSuccess: () => {
          idempotency.reset();
          toast.success("Refund recorded", { description: `${formatINR(payment.amount)} no longer counts as revenue.` });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={Boolean(payment)}
      onClose={onClose}
      title="Record a refund"
      description="Use this after you have given the money back in cash or by UPI. Nothing is sent to the bank."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="refund-payment" variant="danger" icon={Undo2} loading={refund.isPending} disabled={!online}>
            Record refund
          </Button>
        </>
      }
    >
      {!online && <OfflineNotice />}
      <FormError error={refund.error} />
      {payment && (
        <form id="refund-payment" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <div className="rounded-tile bg-surface-2 p-4">
            <p className="text-sm text-ink-3">{memberNameOf(payment) || "Payment"}</p>
            <p className="tabular mt-0.5 text-[28px] font-bold leading-9">{formatINR(payment.amount)}</p>
            <p className="text-sm text-ink-2">
              {forLabel(payment)}, {MODE_LABEL[payment.mode] || "paid"} on {formatDate(payment.paidAt)}, receipt {payment.invoiceNo}
            </p>
          </div>
          <Field label="Reason" error={errors.reason} hint="Kept with the payment and printed on the receipt.">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} placeholder="e.g. Moved out of Kota, 2 months unused" autoFocus />
          </Field>
          <InlineAlert tone="info">The member&apos;s plan stays as it is. Cancel it from their profile if they should stop training.</InlineAlert>
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
