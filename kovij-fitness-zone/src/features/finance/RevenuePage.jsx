import { Link } from "react-router-dom";
import { ArrowRight, Banknote, CalendarDays, CreditCard, Globe, IndianRupee, Scale, Smartphone, TrendingDown, TrendingUp, Undo2, Wallet } from "lucide-react";
import { useFinanceOverview } from "./api";
import { DailyRevenue } from "./charts";
import { BreakdownList, MonthPicker } from "./components";
import { currentMonth, isValidMonth, monthLabel } from "./month";
import { MODE_LABEL, TYPE_LABEL } from "../payments/labels";
import { useUrlState } from "../../shared/hooks/useUrlState";
import { Button, ButtonLink, Card, CardHeader, ErrorState, KpiTile, PageHeader, Skeleton, Tile } from "../../shared/ui";
import { MonthlyRevenue } from "../../shared/ui/charts/charts";
import { cn } from "../../shared/lib/cn";
import { formatINR, formatNumber, pluralize } from "../../shared/lib/format";

const MODE_ICON = { cash: Banknote, upi: Smartphone, card: CreditCard, online: Globe };
const TYPE_ORDER = ["membership", "renewal", "registration", "personal_training", "other"];

function RevenueSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading revenue">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-72 rounded-card" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-card" />
        <Skeleton className="h-56 rounded-card" />
      </div>
    </div>
  );
}

/** Collected, spent and what is left for the month: the owner's bottom line. */
function MoneyInOut({ selected, month }) {
  const profit = selected.net >= 0;
  const NetIcon = profit ? TrendingUp : TrendingDown;
  return (
    <Card aria-labelledby="in-out">
      <CardHeader id="in-out" title="Money in and out" description={monthLabel(month)} action={<ButtonLink to="/admin/expenses" size="sm" variant="ghost">Expenses<ArrowRight className="size-4" aria-hidden /></ButtonLink>} />
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Tile>
          <dt className="text-[13px] text-ink-3">Collected</dt>
          <dd className="tabular text-xl font-bold">{formatINR(selected.collected)}</dd>
          <dd className="text-[13px] text-ink-3">{pluralize(selected.payments, "payment")}</dd>
        </Tile>
        <Tile>
          <dt className="text-[13px] text-ink-3">Spent</dt>
          <dd className="tabular text-xl font-bold">{formatINR(selected.expenses)}</dd>
          <dd className="text-[13px] text-ink-3">Rent, salaries, bills</dd>
        </Tile>
        <Tile className={profit ? "bg-good-soft" : "bg-bad-soft"}>
          <dt className={cn("flex items-center gap-1.5 text-[13px] font-semibold", profit ? "text-good" : "text-bad")}>
            <NetIcon className="size-4" aria-hidden />
            {profit ? "Left over" : "Loss"}
          </dt>
          <dd className="tabular text-xl font-bold">{formatINR(Math.abs(selected.net))}</dd>
          <dd className="text-[13px] text-ink-3">Collected minus spent</dd>
        </Tile>
      </dl>
      {selected.refunds.count > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ink-3">
          <Undo2 className="size-3.5" aria-hidden />
          {formatINR(selected.refunds.amount)} refunded this month ({pluralize(selected.refunds.count, "payment")}), already left out of the figures above.
        </p>
      )}
    </Card>
  );
}

/** What is still owed, by how long it has been waiting. */
function Outstanding({ outstanding }) {
  return (
    <Card aria-labelledby="owed">
      <CardHeader
        id="owed"
        title="Still owed"
        description={outstanding.count ? `${formatINR(outstanding.total)} across ${pluralize(outstanding.count, "bill")} from ${pluralize(outstanding.members, "member")}` : "Nothing is owed right now."}
        action={outstanding.count > 0 && <ButtonLink to="/admin/payments?status=pending" size="sm" variant="ghost">See dues<ArrowRight className="size-4" aria-hidden /></ButtonLink>}
      />
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {outstanding.ageing.map((b, i) => (
          <Tile key={b.key} className={cn(i === 2 && b.amount > 0 && "bg-warn-soft")}>
            <dt className="flex items-center gap-1.5 text-[13px] text-ink-3">
              <CalendarDays className="size-3.5" aria-hidden />
              {b.label} old
            </dt>
            <dd className="tabular text-xl font-bold">{formatINR(b.amount)}</dd>
            <dd className="text-[13px] text-ink-3">{pluralize(b.count, "bill")}</dd>
          </Tile>
        ))}
      </dl>
    </Card>
  );
}

export default function RevenuePage() {
  const [filters, setFilters] = useUrlState({ month: currentMonth() });
  const month = isValidMonth(filters.month) ? filters.month : currentMonth();
  const query = useFinanceOverview(month);
  const d = query.data;

  return (
    <>
      <PageHeader title="Revenue" description="Money collected, what is still owed, and what the gym spent. Refunds are left out." />

      {query.isPending ? (
        <RevenueSkeleton />
      ) : query.isError && !d ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : (
        <div className={cn("flex flex-col gap-4 transition-opacity", query.isFetching && query.isPlaceholderData && "opacity-60")}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiTile
              label="Collected today"
              icon={IndianRupee}
              to="/admin/payments?status=paid&range=today"
              value={formatINR(d.summary.today.amount)}
              sub={pluralize(d.summary.today.count, "payment")}
              delta={{ current: d.summary.today.amount, previous: d.summary.today.previous, label: d.summary.today.compareLabel }}
            />
            <KpiTile
              label="This month"
              icon={Wallet}
              to="/admin/payments?status=paid&range=month"
              value={formatINR(d.summary.month.amount)}
              sub={pluralize(d.summary.month.count, "payment")}
              delta={{ current: d.summary.month.amount, previous: d.summary.month.previous, label: d.summary.month.compareLabel }}
            />
            <KpiTile
              label={`${d.summary.year.year} so far`}
              icon={Scale}
              value={formatINR(d.summary.year.amount)}
              sub={pluralize(d.summary.year.count, "payment")}
              delta={{ current: d.summary.year.amount, previous: d.summary.year.previous, label: d.summary.year.compareLabel }}
            />
          </div>

          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold">Month details</h2>
            <MonthPicker value={month} onChange={(m) => setFilters({ month: m })} />
          </div>

          <MoneyInOut selected={d.selected} month={month} />

          <Card>
            {d.selected.collected > 0 ? (
              <DailyRevenue data={d.daily} title={`Collected per day, ${monthLabel(month)}`} />
            ) : (
              <div className="py-6 text-center">
                <p className="text-[15px] font-semibold">No money collected in {monthLabel(month)}</p>
                <p className="mt-1 text-sm text-ink-3">Payments recorded at the desk or paid online show up here by the day they came in.</p>
                {month !== currentMonth() && (
                  <Button className="mt-4" onClick={() => setFilters({ month: currentMonth() })}>
                    Go to this month
                  </Button>
                )}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card aria-labelledby="by-mode">
              <CardHeader id="by-mode" title="How members paid" description={monthLabel(month)} />
              <BreakdownList
                label={`Collected by payment mode in ${monthLabel(month)}`}
                items={d.byMode.map((r) => ({ key: r.mode, label: MODE_LABEL[r.mode] || r.mode, icon: MODE_ICON[r.mode], amount: r.amount, hint: formatNumber(r.count) }))}
                total={d.selected.collected}
                emptyText="No payments this month."
              />
            </Card>
            <Card aria-labelledby="by-type">
              <CardHeader id="by-type" title="What it was for" description={monthLabel(month)} />
              <BreakdownList
                label={`Collected by type in ${monthLabel(month)}`}
                items={TYPE_ORDER.map((t) => {
                  const r = d.byType.find((x) => x.type === t) || { amount: 0, count: 0 };
                  return { key: t, label: TYPE_LABEL[t], amount: r.amount, hint: formatNumber(r.count) };
                })}
                total={d.selected.collected}
                emptyText="No payments this month."
              />
            </Card>
          </div>

          <Outstanding outstanding={d.outstanding} />

          <Card>
            <MonthlyRevenue data={d.monthly} />
          </Card>
        </div>
      )}
    </>
  );
}
