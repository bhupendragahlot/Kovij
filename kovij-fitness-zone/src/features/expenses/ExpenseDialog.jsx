import { useEffect, useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { openBill, useCreateExpense, useExpenseBill, useUpdateExpense } from "./api";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY, EXPENSE_MODE } from "./labels";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, Field, FormError, IconButton, InlineAlert, Input, SegmentedControl, Textarea, useToast } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatINR, gymDayKey } from "../../shared/lib/format";

const MAX_BYTES = 5 * 1024 * 1024;
const BILL_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const emptyForm = () => ({ category: "", amount: "", date: gymDayKey(), mode: "cash", vendor: "", note: "" });
const fromExpense = (e) => ({ category: e.category, amount: String(e.amount), date: e.date, mode: e.mode, vendor: e.vendor || "", note: e.note || "" });
const sizeLabel = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

/** Six big tiles: the desk picks a category with one tap. Native radios, so arrow keys work. */
function CategoryPicker({ value, onChange, error }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-ink">What was it for?</legend>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-invalid={error ? true : undefined}>
        {EXPENSE_CATEGORIES.map((c) => {
          const { label, icon: Icon } = EXPENSE_CATEGORY[c];
          const selected = value === c;
          return (
            <label
              key={c}
              className={cn(
                "flex min-h-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-tile border px-2 py-2 text-center text-[13px] font-semibold transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus/40",
                selected ? "border-ink bg-ink text-canvas" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
              )}
            >
              <input type="radio" name="expense-category" value={c} checked={selected} onChange={() => onChange(c)} className="sr-only" />
              <Icon className="size-5" aria-hidden />
              {label}
            </label>
          );
        })}
      </div>
      {error && <p className="mt-1.5 text-[13px] font-medium text-bad">{error}</p>}
    </fieldset>
  );
}

/** Add or edit an expense, with an optional photo or PDF of the bill. */
export function ExpenseDialog({ open, expense, onClose }) {
  const online = useOnlineStatus();
  const toast = useToast();
  const create = useCreateExpense();
  const update = useUpdateExpense();
  const bill = useExpenseBill();
  const idempotency = useIdempotencyKey();
  const fileRef = useRef(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [removeBill, setRemoveBill] = useState(false);
  const [clientErrors, setClientErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm(expense ? fromExpense(expense) : emptyForm());
    setFile(null);
    setRemoveBill(false);
    setClientErrors({});
    setError(null);
    idempotency.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?._id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = { ...error?.fields, ...clientErrors };
  const editing = Boolean(expense);
  const hasBill = editing && expense.bill && !removeBill;

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!BILL_TYPES.includes(f.type)) return setClientErrors((x) => ({ ...x, bill: "Use a photo (JPEG, PNG, WebP) or a PDF" }));
    if (f.size > MAX_BYTES) return setClientErrors((x) => ({ ...x, bill: "The file is larger than 5 MB. Take a smaller photo." }));
    setClientErrors((x) => ({ ...x, bill: undefined }));
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!form.category) next.category = "Choose what the money was for";
    if (!(Number(form.amount) > 0)) next.amount = "Enter the amount paid";
    if (!form.date) next.date = "Enter the date";
    else if (form.date > gymDayKey()) next.date = "The date can’t be in the future";
    setClientErrors(next);
    if (Object.keys(next).length) return;

    const payload = { category: form.category, amount: Number(form.amount), date: form.date, mode: form.mode, vendor: form.vendor.trim(), note: form.note.trim() };
    setSaving(true);
    setError(null);
    let saved;
    try {
      if (editing) {
        const before = { ...fromExpense(expense), amount: Number(expense.amount) };
        const changed = Object.fromEntries(Object.entries(payload).filter(([k, v]) => v !== (typeof before[k] === "string" ? before[k].trim() : before[k])));
        saved = Object.keys(changed).length ? (await update.mutateAsync({ id: expense._id, payload: changed })).expense : expense;
      } else {
        const body = { ...payload, vendor: payload.vendor || undefined, note: payload.note || undefined };
        saved = (await create.mutateAsync({ payload: body, idempotencyKey: idempotency.keyFor(body) })).expense;
        idempotency.reset();
      }
    } catch (err) {
      setError(err);
      setSaving(false);
      return;
    }

    const title = editing ? "Changes saved" : `${formatINR(saved.amount)} expense added`;
    try {
      if (file) await bill.mutateAsync({ id: saved._id, file });
      else if (removeBill) await bill.mutateAsync({ id: saved._id, file: null });
      toast.success(title, file ? { description: "Bill attached." } : undefined);
    } catch (err) {
      toast.warning(`${title}, but the bill didn't ${file ? "upload" : "come off"}`, { description: `${err.message} Open the expense to try again.` });
    }
    setSaving(false);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit expense" : "Add expense"}
      description={editing ? undefined : "Money the gym paid out: rent, salaries, bills, equipment, repairs."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="expense-form" variant="primary" loading={saving} disabled={!online}>
            {editing ? "Save changes" : "Add expense"}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You&apos;re offline. Expenses can be saved when the connection is back.
        </InlineAlert>
      )}
      <FormError error={error} />
      <form id="expense-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <CategoryPicker value={form.category} onChange={(category) => set({ category })} error={errors.category} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Amount" error={errors.amount}>
            <Input prefix="₹" type="number" inputMode="decimal" min="1" value={form.amount} onChange={(e) => set({ amount: e.target.value })} />
          </Field>
          <Field label="Date paid" error={errors.date}>
            <Input type="date" value={form.date} max={gymDayKey()} onChange={(e) => set({ date: e.target.value })} />
          </Field>
        </div>
        <Field label="Paid by" error={errors.mode}>
          <SegmentedControl label="How the gym paid" value={form.mode} onChange={(mode) => set({ mode })} options={Object.entries(EXPENSE_MODE).map(([value, label]) => ({ value, label }))} block />
        </Field>
        <Field label="Paid to" optional error={errors.vendor}>
          <Input value={form.vendor} onChange={(e) => set({ vendor: e.target.value })} maxLength={120} placeholder="e.g. Sharma Estates, JVVNL, Aman (trainer)" />
        </Field>
        <Field label="Note" optional error={errors.note}>
          <Textarea value={form.note} onChange={(e) => set({ note: e.target.value })} maxLength={500} rows={2} placeholder="e.g. September rent, treadmill belt replaced" />
        </Field>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink">
            Bill <span className="font-normal text-ink-3">(optional)</span>
          </p>
          {file ? (
            <div className="flex items-center gap-3 rounded-tile border border-line-strong bg-surface-2 p-2.5">
              <FileText className="size-5 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{file.name}</p>
                <p className="text-xs text-ink-3">{sizeLabel(file.size)}, uploads when you save</p>
              </div>
              <IconButton icon={X} label="Don't attach this file" size="sm" onClick={() => setFile(null)} />
            </div>
          ) : hasBill ? (
            <div className="flex items-center gap-3 rounded-tile border border-line-strong bg-surface-2 p-2.5">
              <FileText className="size-5 shrink-0 text-ink-3" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{expense.bill.name}</p>
                <p className="text-xs text-ink-3">{sizeLabel(expense.bill.size || 0)}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => openBill(expense._id).catch((err) => toast.error("Couldn't open the bill", { description: err.message }))}>
                View
              </Button>
              <IconButton icon={X} label="Remove the bill" size="sm" onClick={() => setRemoveBill(true)} />
            </div>
          ) : null}
          {!file && (
            <>
              <input ref={fileRef} type="file" accept={BILL_TYPES.join(",")} onChange={pickFile} className="sr-only" id="expense-bill" tabIndex={-1} />
              <Button className={cn((hasBill || file) && "mt-2")} icon={Paperclip} onClick={() => fileRef.current?.click()}>
                {hasBill ? "Replace bill" : "Attach photo or PDF"}
              </Button>
            </>
          )}
          {removeBill && !file && <p className="mt-1.5 text-[13px] text-ink-3">The bill will be removed when you save.</p>}
          {errors.bill && <p className="mt-1.5 text-[13px] font-medium text-bad">{errors.bill}</p>}
        </div>
      </form>
    </Dialog>
  );
}
