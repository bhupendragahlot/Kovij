import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Ellipsis, Hourglass, IndianRupee, Mail, Plus, Printer, Undo2, Wallet } from "lucide-react";
import { downloadCsv, openReceipt, usePayments, useSendReceipt } from "./api";
import { CollectPaymentDialog, PaymentStatusBadge, RecordPaymentDialog, RefundDialog, VerifyPaymentDialog } from "./components";
import { MODE_LABEL, TYPE_LABEL, TYPE_OPTIONS, paymentState } from "./labels";
import { usePermission } from "../auth/permissions";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Avatar,
  Button,
  Card,
  DataTable,
  EmptyState,
  Field,
  IconButton,
  Input,
  Menu,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  Tabs,
  useToast,
} from "../../shared/ui";
import { formatDate, formatINR, formatNumber, gymDayKey } from "../../shared/lib/format";

const DEFAULTS = { status: "pending", q: "", mode: "", type: "", range: "month", from: "", to: "", page: 1 };
const LIMIT = 25;
const RANGES = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "lastmonth", label: "Last month" },
  { value: "custom", label: "Pick dates" },
  { value: "all", label: "All time" },
];

function rangeToDates(range, from, to) {
  const today = gymDayKey();
  if (range === "today") return { from: today, to: today };
  if (range === "7d") return { from: gymDayKey(new Date(Date.now() - 6 * 86_400_000)), to: today };
  if (range === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  if (range === "lastmonth") {
    const [y, m] = today.split("-").map(Number);
    const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
    const days = new Date(Date.UTC(Number(prev.slice(0, 4)), Number(prev.slice(5)), 0)).getUTCDate();
    return { from: `${prev}-01`, to: `${prev}-${days}` };
  }
  if (range === "custom") return { from: from || undefined, to: to || undefined };
  return {};
}

const isDueTab = (status) => status === "pending" || status === "awaiting";

function MemberCell({ p }) {
  if (!p.memberId) return <span className="text-ink-3">Deleted member</span>;
  return (
    <Link to={`/admin/members/${p.memberId._id}`} className="flex items-center gap-3">
      <Avatar name={p.memberId.name} src={p.memberId.profilePhoto} size="sm" />
      <span className="min-w-0">
        <span className="block truncate font-semibold hover:underline">{p.memberId.name}</span>
        <span className="block text-[13px] text-ink-3">{p.memberId.memberCode}</span>
      </span>
    </Link>
  );
}

/** "Membership: Quarterly", plus part-payment context. */
function ForCell({ p }) {
  const paidSoFar = p.status === "pending" && p.originalAmount != null ? p.originalAmount - p.amount : 0;
  return (
    <span>
      <span className="block">{TYPE_LABEL[p.type] || p.type}</span>
      {p.membershipId?.planName && <span className="block text-[13px] text-ink-3">{p.membershipId.planName}</span>}
      {p.dueId?.invoiceNo && <span className="block text-[13px] text-ink-3">Part of bill {p.dueId.invoiceNo}</span>}
      {paidSoFar > 0 && <span className="block text-[13px] text-ink-3">{formatINR(paidSoFar)} of {formatINR(p.originalAmount)} paid</span>}
      {p.meta?.needsReview && <span className="block text-[13px] font-semibold text-warn">Check: {p.note}</span>}
    </span>
  );
}

function RowActions({ p, onCollect, onVerify, onRefund, canCollect, canRefund, block = false }) {
  const toast = useToast();
  const sendReceipt = useSendReceipt();
  const state = paymentState(p);
  const size = block ? "md" : "sm";

  if (state === "awaiting" && canCollect) {
    return (
      <Button size={size} variant="primary" icon={Hourglass} onClick={() => onVerify(p)}>
        Check UPI
      </Button>
    );
  }
  if (state === "pending") {
    return canCollect ? (
      <Button size={size} variant="primary" onClick={() => onCollect(p)}>
        Collect
      </Button>
    ) : null;
  }
  if (state !== "paid" && state !== "refunded") return null;

  const print = () => openReceipt(p._id).catch((e) => toast.error("Couldn't open the receipt", { description: e.message }));
  const email = () =>
    sendReceipt.mutate(p._id, {
      onSuccess: (d) => toast.success("Receipt emailed", { description: d.message }),
      onError: (e) => toast.error("Couldn't email the receipt", { description: e.message }),
    });
  const items = [];
  if (p.memberId?.email) items.push({ label: "Email receipt", icon: Mail, onSelect: email, disabled: sendReceipt.isPending });
  if (state === "paid" && canRefund) {
    if (items.length) items.push({ type: "separator" });
    items.push({ label: "Record refund", icon: Undo2, tone: "danger", onSelect: () => onRefund(p) });
  }
  return (
    <div className="flex items-center justify-end gap-1">
      {block ? (
        <IconButton icon={Printer} label={`Print receipt ${p.invoiceNo}`} onClick={print} />
      ) : (
        <Button size={size} variant="ghost" icon={Printer} onClick={print}>
          Receipt
        </Button>
      )}
      {items.length > 0 && (
        <Menu
          label={`More for receipt ${p.invoiceNo}`}
          trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`More for receipt ${p.invoiceNo}`} size={block ? "md" : "sm"} />}
          items={items}
        />
      )}
    </div>
  );
}

/** Money in by mode for the current filters (owners and managers). */
function ModeTotals({ totals }) {
  if (!totals?.byMode) return null;
  const modes = Object.entries(totals.byMode).filter(([, v]) => v.count > 0);
  return (
    <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Collected by payment mode">
      <div className="rounded-tile bg-surface p-3 dark:border dark:border-line">
        <p className="text-[13px] text-ink-3">Collected</p>
        <p className="tabular text-lg font-bold">{formatINR(totals.paid.amount)}</p>
        <p className="text-[13px] text-ink-3">{formatNumber(totals.paid.count)} payments</p>
      </div>
      {modes.map(([mode, v]) => (
        <div key={mode} className="rounded-tile bg-surface p-3 dark:border dark:border-line">
          <p className="text-[13px] text-ink-3">{MODE_LABEL[mode] || mode}</p>
          <p className="tabular text-lg font-bold">{formatINR(v.amount)}</p>
          <p className="text-[13px] text-ink-3">{formatNumber(v.count)} payments</p>
        </div>
      ))}
    </div>
  );
}

export default function PaymentsPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const canSeeRevenue = usePermission("revenue.view");
  const canCollect = usePermission("payments.collect");
  const canRefund = usePermission("payments.refund");
  const toast = useToast();
  const [recordOpen, setRecordOpen] = useState(false);
  const [collectTarget, setCollectTarget] = useState(null);
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [refundTarget, setRefundTarget] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const dues = isDueTab(filters.status);
  const listFilters = useMemo(
    () => ({
      status: filters.status,
      q: filters.q || undefined,
      mode: filters.mode || undefined,
      type: filters.type || undefined,
      ...(dues ? {} : rangeToDates(filters.range, filters.from, filters.to)),
    }),
    [filters, dues]
  );
  const params = useMemo(() => ({ ...listFilters, page: filters.page, limit: LIMIT }), [listFilters, filters.page]);
  const query = usePayments(params);
  const data = query.data;
  const summary = data?.totals;
  const awaitingCount = summary?.awaitingCount ?? 0;
  const filtered = Boolean(filters.q || filters.mode || filters.type);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadCsv("/admin/payments/export.csv", listFilters, `payments-${gymDayKey()}.csv`);
      toast.success("CSV exported", { description: "Check your downloads folder." });
    } catch (e) {
      toast.error("Couldn't export the CSV", { description: e.message });
    } finally {
      setExporting(false);
    }
  };

  const actionProps = { onCollect: setCollectTarget, onVerify: setVerifyTarget, onRefund: setRefundTarget, canCollect, canRefund };

  const columns = [
    { id: "member", header: "Member", cell: (p) => <MemberCell p={p} /> },
    { id: "for", header: "For", cell: (p) => <ForCell p={p} /> },
    { id: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-semibold">{formatINR(p.amount)}</span> },
    { id: "mode", header: "Mode", hideBelow: "lg", cell: (p) => (p.verification?.state === "submitted" ? `UPI ${p.verification.utr}` : MODE_LABEL[p.mode] || "—") },
    {
      id: "date",
      header: dues ? "Raised" : filters.status === "refunded" ? "Refunded" : "Date",
      hideBelow: "lg",
      cell: (p) => <span className="whitespace-nowrap">{formatDate(dues ? p.createdAt : filters.status === "refunded" ? p.refund?.at : p.paidAt || p.createdAt)}</span>,
    },
    { id: "status", header: "Status", cell: (p) => <PaymentStatusBadge payment={p} /> },
    { id: "invoice", header: "Receipt no.", hideBelow: "xl", cell: (p) => <span className="tabular whitespace-nowrap text-ink-3">{p.invoiceNo}</span> },
    { id: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (p) => <RowActions p={p} {...actionProps} /> },
  ];

  // Phones: details and status on the left, amount and the one-tap action on the right.
  const mobileRow = (p) => (
    <div className="flex items-start gap-3 px-4 py-3">
      <Avatar name={p.memberId?.name} src={p.memberId?.profilePhoto} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{p.memberId?.name || "Deleted member"}</p>
        <p className="text-[13px] text-ink-3">
          {TYPE_LABEL[p.type]}
          {p.membershipId?.planName ? `: ${p.membershipId.planName}` : ""}, {formatDate(dues ? p.createdAt : p.paidAt || p.createdAt)}
        </p>
        {p.verification?.state === "submitted" && <p className="text-[13px] text-ink-2">UPI reference {p.verification.utr}</p>}
        {p.status === "pending" && p.originalAmount != null && (
          <p className="text-[13px] text-ink-3">
            {formatINR(p.originalAmount - p.amount)} of {formatINR(p.originalAmount)} paid
          </p>
        )}
        {p.dueId?.invoiceNo && <p className="text-[13px] text-ink-3">Part of bill {p.dueId.invoiceNo}</p>}
        <div className="mt-1.5">
          <PaymentStatusBadge payment={p} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-2">
        <span className="tabular font-bold">{formatINR(p.amount)}</span>
        <RowActions p={p} {...actionProps} block />
      </div>
    </div>
  );

  const description = dues
    ? summary && `${formatINR(summary.pending.amount)} outstanding across ${formatNumber(summary.pending.count)} ${summary.pending.count === 1 ? "bill" : "bills"}`
    : canSeeRevenue && summary?.paid
      ? `${formatINR(summary.paid.amount)} collected in this period`
      : "Money received at the desk";

  const empty = {
    pending: <EmptyState icon={Wallet} title={filtered ? "No dues match" : "No dues"} body={filtered ? "Try clearing the search or filters." : "Everyone is paid up. Plans sold with “Pay later” and online registrations appear here until collected."} />,
    awaiting: <EmptyState icon={Hourglass} title="No UPI payments to check" body="When a member pays by UPI in the app and sends the reference, it shows up here for you to confirm." />,
    refunded: <EmptyState icon={Undo2} title="No refunds in this period" body="Refunds you record from a paid payment's menu are listed here." />,
  }[filters.status] || (
    <EmptyState
      icon={IndianRupee}
      title="No payments in this period"
      body="Try a longer date range, or record a payment received at the desk."
      action={
        canCollect && (
          <Button variant="secondary" icon={Plus} onClick={() => setRecordOpen(true)}>
            Record payment
          </Button>
        )
      }
    />
  );

  return (
    <>
      <PageHeader
        title="Payments"
        description={description}
        actions={
          <>
            {canSeeRevenue && (
              <Button icon={Download} onClick={exportCsv} loading={exporting}>
                Export CSV
              </Button>
            )}
            {canCollect && (
              <Button variant="primary" icon={Plus} onClick={() => setRecordOpen(true)}>
                Record payment
              </Button>
            )}
          </>
        }
      />

      <Tabs
        label="Payment lists"
        value={filters.status}
        onChange={(status) => setFilters({ status })}
        className="mb-4"
        tabs={[
          { value: "pending", label: "Dues" },
          { value: "awaiting", label: "UPI to check", count: awaitingCount || undefined },
          { value: "paid", label: "Paid" },
          { value: "refunded", label: "Refunded" },
          { value: "all", label: "All" },
        ]}
      />

      <div className="mb-4 flex flex-col gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Member, phone, receipt number or UPI reference" label="Search payments" className="lg:max-w-md" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
          {!dues && (
            <Select aria-label="Date range" value={filters.range} onChange={(e) => setFilters({ range: e.target.value })} className="lg:w-40">
              {RANGES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          )}
          <Select aria-label="Payment mode" value={filters.mode} onChange={(e) => setFilters({ mode: e.target.value })} className="lg:w-36">
            <option value="">Any mode</option>
            {Object.entries(MODE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <Select aria-label="Paid for" value={filters.type} onChange={(e) => setFilters({ type: e.target.value })} className="lg:w-44">
            <option value="">Anything</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        </div>
        {!dues && filters.range === "custom" && (
          <div className="grid grid-cols-2 gap-2 sm:max-w-md">
            <Field label="From">
              <Input type="date" value={filters.from} max={filters.to || gymDayKey()} onChange={(e) => setFilters({ from: e.target.value })} />
            </Field>
            <Field label="To">
              <Input type="date" value={filters.to} min={filters.from || undefined} max={gymDayKey()} onChange={(e) => setFilters({ to: e.target.value })} />
            </Field>
          </div>
        )}
      </div>

      {!dues && filters.status !== "refunded" && canSeeRevenue && <ModeTotals totals={summary} />}

      <Card padding="none" className="overflow-hidden">
        <DataTable
          caption={dues ? "Dues" : "Payments"}
          columns={columns}
          rows={data?.payments}
          mobileRow={mobileRow}
          isPending={query.isPending}
          isFetching={query.isFetching && query.isPlaceholderData}
          error={query.error}
          onRetry={() => query.refetch()}
          empty={empty}
        />
        {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
      </Card>

      <RecordPaymentDialog open={recordOpen} onClose={() => setRecordOpen(false)} />
      <CollectPaymentDialog payment={collectTarget} onClose={() => setCollectTarget(null)} />
      <VerifyPaymentDialog payment={verifyTarget} onClose={() => setVerifyTarget(null)} />
      <RefundDialog payment={refundTarget} onClose={() => setRefundTarget(null)} />
    </>
  );
}
