import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckCircle2, Clock, Copy, CreditCard, Download, Mail, ReceiptText, Smartphone, Store } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { meKeys, useDues, useEmailReceipt, usePaymentHistory, useSubmitUtr, useUpiIntent } from "../queries";
import { mapi, memberHttp } from "../http";
import { useIdempotencyKey } from "../../../shared/hooks/useIdempotencyKey";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, ErrorState, Field, FormError, Input, PageHeader, Pagination, SkeletonList, buttonClasses, chipClasses, useToast } from "../../../shared/ui";
import { formatDate, formatINR, pluralize } from "../../../shared/lib/format";

const isPhone = () => /Android|iPhone|iPad/i.test(navigator.userAgent || "");

export default function PaymentsPage() {
  const dues = useDues();
  const [paying, setPaying] = useState(null);
  const data = dues.data;
  return (
    <>
      <PageHeader title="Payments" description={data ? (data.totalDue ? `${formatINR(data.totalDue)} to pay` : "Nothing to pay right now.") : undefined} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader title="To pay" />
          {dues.isPending ? (
            <SkeletonList rows={2} />
          ) : dues.isError ? (
            <ErrorState compact error={dues.error} onRetry={() => dues.refetch()} />
          ) : !data.dues.length ? (
            <EmptyState compact icon={CheckCircle2} title="All paid" body="Bills for new plans and renewals show up here." />
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {data.dues.map((d) => {
                const checking = d.verification?.state === "submitted" || d.status === "awaiting_verification";
                return (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0 flex-1 basis-48">
                      <p className="font-semibold">{d.forLabel}</p>
                      <p className="text-body-sm text-ink-3">
                        Bill {d.invoiceNo} · raised {formatDate(d.raisedAt)}
                      </p>
                      {checking && (
                        <Badge size="sm" tone="info" icon={Clock} className="mt-1.5">
                          Paid by UPI, the gym is checking
                        </Badge>
                      )}
                      {d.verification?.state === "rejected" && (
                        <p className="mt-1.5 text-body-sm text-bad">
                          The gym couldn’t match UPI reference {d.verification.utr}
                          {d.verification.reason ? `: ${d.verification.reason}` : ""}. Check it and try again, or pay at the desk.
                        </p>
                      )}
                    </div>
                    <p className="tabular text-title-lg font-bold">{formatINR(d.amount)}</p>
                    {!checking && (
                      <Button variant="primary" onClick={() => setPaying(d)} className="max-sm:w-full">
                        Pay
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <ReceiptHistory />
      </div>
      {paying && <PayDialog due={paying} options={data.payOptions} onClose={() => setPaying(null)} />}
    </>
  );
}

/** Choose how to pay one bill: UPI (any app), card/UPI online when the gym has it switched on, or the desk. */
function PayDialog({ due, options, onClose }) {
  const [method, setMethod] = useState(options.upi.available ? "upi" : options.online.available ? "online" : "desk");
  return (
    <Dialog open onClose={onClose} title={`Pay ${formatINR(due.amount)}`} footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <p className="-mt-2 mb-4 text-sm text-ink-3">{due.forLabel}</p>
      <div className="mb-4 flex flex-wrap gap-2" role="radiogroup" aria-label="How to pay">
        {options.upi.available && <MethodButton active={method === "upi"} onClick={() => setMethod("upi")} icon={Smartphone} label="UPI" />}
        {options.online.available && <MethodButton active={method === "online"} onClick={() => setMethod("online")} icon={CreditCard} label="Card or UPI online" />}
        <MethodButton active={method === "desk"} onClick={() => setMethod("desk")} icon={Store} label="At the desk" />
      </div>
      {method === "upi" && <UpiPay due={due} onDone={onClose} />}
      {method === "online" && <OnlinePay due={due} onDone={onClose} />}
      {method === "desk" && <p className="text-body-lg">Pay {formatINR(due.amount)} by cash, UPI or card at the front desk on your next visit. Show your check-in pass so they can find your bill.</p>}
    </Dialog>
  );
}

function MethodButton({ active, onClick, icon: Icon, label }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={chipClasses(active, "h-9")}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </button>
  );
}

function UpiPay({ due, onDone }) {
  const intent = useUpiIntent(due.id);
  const submit = useSubmitUtr();
  const toast = useToast();
  const { keyFor } = useIdempotencyKey();
  const [utr, setUtr] = useState("");
  const [qr, setQr] = useState("");
  const upi = intent.data?.upi;

  useEffect(() => {
    if (!upi?.link) return;
    QRCode.toString(upi.link, { type: "svg", margin: 1, color: { dark: "#111111", light: "#ffffff" } }).then(setQr).catch(() => setQr(""));
  }, [upi?.link]);

  if (intent.isPending) return <SkeletonList rows={3} />;
  if (intent.isError) return <ErrorState compact error={intent.error} onRetry={() => intent.refetch()} />;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(upi.upiId);
      toast.success("UPI ID copied");
    } catch {
      toast.error("Couldn't copy", { description: upi.upiId });
    }
  };

  const send = (e) => {
    e.preventDefault();
    const payload = { dueId: due.id, utr: utr.trim() };
    submit.mutate(
      { ...payload, idempotencyKey: keyFor(payload) },
      {
        onSuccess: (data) => {
          toast.success("Thanks! Payment sent for checking", { description: data.message });
          onDone();
        },
      }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4 text-body-lg">
        <li>
          <p className="font-semibold">1. Pay {formatINR(upi.amount)} to {upi.payeeName}</p>
          {isPhone() ? (
            <a href={upi.link} className={buttonClasses({ variant: "primary", size: "lg", className: "mt-2" })}>
              <Smartphone className="size-4" aria-hidden />
              Open my UPI app
            </a>
          ) : (
            qr && <div className="mt-2 w-44 rounded-tile bg-white p-2 [&>svg]:size-full" role="img" aria-label="UPI QR code to scan with your phone" dangerouslySetInnerHTML={{ __html: qr }} />
          )}
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            Or pay to <span className="font-semibold text-ink">{upi.upiId}</span>
            <button type="button" onClick={copy} className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline">
              <Copy className="size-3.5" aria-hidden />
              Copy
            </button>
          </p>
          <p className="mt-1 text-sm text-ink-3">Add “{upi.reference}” in the note if your app asks.</p>
        </li>
        <li>
          <p className="font-semibold">2. Enter the UPI reference</p>
          <p className="text-sm text-ink-3">After paying, your app shows a 12-digit reference (UTR or UPI ref no.). The gym matches it and marks the bill paid.</p>
        </li>
      </ol>
      <form onSubmit={send} className="flex flex-col gap-3" noValidate>
        <FormError error={submit.error?.fields?.utr ? null : submit.error} />
        <Field label="UPI reference (UTR)" error={submit.error?.fields?.utr}>
          <Input inputMode="numeric" autoComplete="off" value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 4271 1234 5678" />
        </Field>
        <Button type="submit" variant="primary" loading={submit.isPending} disabled={utr.replace(/\D/g, "").length < 8}>
          I’ve paid, send for checking
        </Button>
      </form>
    </div>
  );
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(window.Razorpay);
    s.onerror = () => reject(new Error("Couldn't open the payment window. Check your connection."));
    document.body.appendChild(s);
  });
}

function OnlinePay({ due, onDone }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const [Razorpay, order] = await Promise.all([loadRazorpay(), mapi.post(`/member/payments/dues/${due.id}/online-order`, {})]);
      const c = order.checkout;
      const rzp = new Razorpay({
        key: c.key,
        order_id: c.orderId,
        amount: c.amount,
        currency: c.currency,
        name: c.name,
        description: c.description,
        prefill: c.prefill,
        notes: c.notes,
        theme: { color: getComputedStyle(document.documentElement).getPropertyValue("--kv-brand").trim() || "#ff7a1a" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (resp) => {
          try {
            const result = await mapi.post("/member/payments/online/verify", resp);
            queryClient.invalidateQueries({ queryKey: meKeys.all });
            toast.success(result.status === "paid" ? "Payment received" : "Payment is processing", { description: result.message });
            onDone();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        },
      });
      rzp.open();
    } catch (e) {
      setError(e);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <FormError error={error} />
      <p className="text-body-lg">Pay securely with a card, net banking or UPI. The bill is marked paid as soon as your bank confirms.</p>
      <Button variant="primary" icon={CreditCard} onClick={start} loading={busy}>
        Pay {formatINR(due.amount)} online
      </Button>
    </div>
  );
}

function ReceiptHistory() {
  const [page, setPage] = useState(1);
  const history = usePaymentHistory(page);
  const email = useEmailReceipt();
  const toast = useToast();
  const data = history.data;

  const open = async (p) => {
    // A new tab must open synchronously (pop-up blockers), then receive the receipt.
    const win = window.open("", "_blank");
    try {
      const res = await memberHttp.get(`/member/payments/${p.id}/receipt`, { responseType: "text" });
      const url = URL.createObjectURL(new Blob([res.data], { type: "text/html" }));
      if (win) win.location = url;
      else window.location.assign(url);
    } catch (e) {
      win?.close();
      toast.error("Couldn't open the receipt", { description: e.message });
    }
  };

  return (
    <Card>
      <CardHeader title="Receipts" description={data?.totalPaid ? `${formatINR(data.totalPaid)} paid in total` : undefined} />
      {history.isPending ? (
        <SkeletonList rows={3} />
      ) : history.isError ? (
        <ErrorState compact error={history.error} onRetry={() => history.refetch()} />
      ) : !data.payments.length ? (
        <EmptyState compact icon={ReceiptText} title="No payments yet" body="Receipts for everything you pay appear here." />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-line">
            {data.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0">
                <div className="min-w-0 flex-1 basis-48">
                  <p className="font-semibold">{p.forLabel}</p>
                  <p className="text-body-sm text-ink-3">
                    {p.paidAt ? formatDate(p.paidAt) : "Not paid"} · {p.modeLabel || "—"} · {p.invoiceNo}
                    {p.status === "refunded" && " · Refunded"}
                  </p>
                </div>
                <p className="tabular font-bold">{formatINR(p.amount)}</p>
                {p.receiptAvailable && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" icon={Download} onClick={() => open(p)}>
                      Receipt
                    </Button>
                    <Button size="sm" variant="ghost" icon={Mail} loading={email.isPending && email.variables === p.id} onClick={() => email.mutate(p.id, { onSuccess: (d) => toast.success("Receipt emailed", { description: d.message }), onError: (e) => toast.error("Couldn't email it", { description: e.message }) })}>
                      <span className="sr-only">Email the receipt for {p.invoiceNo}</span>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <Pagination page={page} limit={20} total={data.total} onPage={setPage} />
        </>
      )}
      <p className="mt-3 text-body-sm text-ink-3">{pluralize(data?.total || 0, "payment")} on record.</p>
    </Card>
  );
}
