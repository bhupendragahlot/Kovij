import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { IndianRupee, Plus, Wallet } from "lucide-react";
import { usePayments } from "./api";
import { CollectPaymentDialog, ReceiptButton, RecordPaymentDialog } from "./components";
import { usePermission } from "../auth/permissions";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Avatar,
  Button,
  Card,
  DataTable,
  EmptyState,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  StatusBadge,
  Tabs,
} from "../../shared/ui";
import { formatDate, formatINR, formatNumber, gymDayKey } from "../../shared/lib/format";
import { PAYMENT_MODE_LABEL, PAYMENT_TYPE_LABEL } from "../../shared/domain/status";

const DEFAULTS = { status: "pending", q: "", mode: "", range: "month", page: 1 };
const LIMIT = 25;

function rangeToDates(range) {
  const today = gymDayKey();
  if (range === "today") return { from: today, to: today };
  if (range === "7d") return { from: gymDayKey(new Date(Date.now() - 6 * 86_400_000)), to: today };
  if (range === "month") return { from: `${today.slice(0, 8)}01`, to: today };
  return {};
}

export default function PaymentsPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const canSeeRevenue = usePermission("revenue.view");
  const [recordOpen, setRecordOpen] = useState(false);
  const [collectTarget, setCollectTarget] = useState(null);

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const isDues = filters.status === "pending";
  const params = useMemo(
    () => ({
      status: filters.status,
      q: filters.q || undefined,
      mode: filters.mode || undefined,
      page: filters.page,
      limit: LIMIT,
      ...(isDues ? {} : rangeToDates(filters.range)),
    }),
    [filters, isDues]
  );
  const query = usePayments(params);
  const data = query.data;

  const columns = [
    {
      id: "member",
      header: "Member",
      cell: (p) =>
        p.memberId ? (
          <Link to={`/admin/members/${p.memberId._id}`} className="flex items-center gap-3">
            <Avatar name={p.memberId.name} src={p.memberId.profilePhoto} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-semibold hover:underline">{p.memberId.name}</span>
              <span className="block text-[13px] text-ink-3">{p.memberId.memberCode}</span>
            </span>
          </Link>
        ) : (
          <span className="text-ink-3">Deleted member</span>
        ),
    },
    {
      id: "for",
      header: "For",
      cell: (p) => (
        <span>
          <span className="block">{PAYMENT_TYPE_LABEL[p.type] || p.type}</span>
          {p.membershipId?.planName && <span className="block text-[13px] text-ink-3">{p.membershipId.planName}</span>}
        </span>
      ),
    },
    { id: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-semibold">{formatINR(p.amount)}</span> },
    { id: "mode", header: "Mode", hideBelow: "lg", cell: (p) => PAYMENT_MODE_LABEL[p.mode] || "—" },
    {
      id: "date",
      header: isDues ? "Raised" : "Date",
      hideBelow: "lg",
      cell: (p) => <span className="whitespace-nowrap">{formatDate(isDues ? p.createdAt : p.paidAt || p.createdAt)}</span>,
    },
    { id: "status", header: "Status", cell: (p) => <StatusBadge kind="payment" status={p.status} size="sm" /> },
    { id: "invoice", header: "Receipt no.", hideBelow: "xl", cell: (p) => <span className="tabular text-ink-3">{p.invoiceNo}</span> },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (p) =>
        p.status === "pending" ? (
          <Button size="sm" variant="primary" onClick={() => setCollectTarget(p)}>
            Collect
          </Button>
        ) : p.status === "paid" ? (
          <ReceiptButton paymentId={p._id} />
        ) : null,
    },
  ];

  const mobileRow = (p) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <Avatar name={p.memberId?.name} src={p.memberId?.profilePhoto} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{p.memberId?.name || "Deleted member"}</p>
        <p className="truncate text-[13px] text-ink-3">
          {PAYMENT_TYPE_LABEL[p.type]}
          {p.membershipId?.planName ? `: ${p.membershipId.planName}` : ""}, {formatDate(p.paidAt || p.createdAt)}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className="font-bold">{formatINR(p.amount)}</span>
        {p.status === "pending" ? (
          <Button size="sm" variant="primary" onClick={() => setCollectTarget(p)}>
            Collect
          </Button>
        ) : (
          <StatusBadge kind="payment" status={p.status} size="sm" />
        )}
      </div>
    </div>
  );

  const summary = data?.totals;
  return (
    <>
      <PageHeader
        title="Payments"
        description={
          isDues
            ? summary && `${formatINR(summary.pending.amount)} outstanding across ${formatNumber(summary.pending.count)} ${summary.pending.count === 1 ? "bill" : "bills"}`
            : canSeeRevenue && summary?.paid
              ? `${formatINR(summary.paid.amount)} collected in this period`
              : "Money received at the desk"
        }
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setRecordOpen(true)}>
            Record payment
          </Button>
        }
      />

      <Tabs
        label="Payment lists"
        value={filters.status}
        onChange={(status) => setFilters({ status })}
        className="mb-4"
        tabs={[
          { value: "pending", label: "Dues" },
          { value: "paid", label: "Paid" },
          { value: "all", label: "All" },
        ]}
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Member name, phone or receipt number" label="Search payments" className="lg:max-w-sm lg:flex-1" />
        <div className="flex flex-wrap items-center gap-2">
          {!isDues && (
            <SegmentedControl
              label="Date range"
              size="sm"
              value={filters.range}
              onChange={(range) => setFilters({ range })}
              options={[
                { value: "today", label: "Today" },
                { value: "7d", label: "7 days" },
                { value: "month", label: "This month" },
                { value: "all", label: "All time" },
              ]}
            />
          )}
          <Select aria-label="Payment mode" value={filters.mode} onChange={(e) => setFilters({ mode: e.target.value })} className="h-10 w-36 md:h-9">
            <option value="">Any mode</option>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </Select>
        </div>
      </div>

      <Card padding="none" className="overflow-hidden">
        <DataTable
          caption={isDues ? "Dues" : "Payments"}
          columns={columns}
          rows={data?.payments}
          mobileRow={mobileRow}
          isPending={query.isPending}
          isFetching={query.isFetching && query.isPlaceholderData}
          error={query.error}
          onRetry={() => query.refetch()}
          empty={
            isDues ? (
              <EmptyState icon={Wallet} title="No dues" body="Everyone is paid up. Plans sold with “Pay later” and online registrations appear here until collected." />
            ) : (
              <EmptyState
                icon={IndianRupee}
                title="No payments in this period"
                body="Try a longer date range, or record a payment received at the desk."
                action={
                  <Button variant="secondary" icon={Plus} onClick={() => setRecordOpen(true)}>
                    Record payment
                  </Button>
                }
              />
            )
          }
        />
        {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
      </Card>

      <RecordPaymentDialog open={recordOpen} onClose={() => setRecordOpen(false)} />
      <CollectPaymentDialog payment={collectTarget} onClose={() => setCollectTarget(null)} />
    </>
  );
}
