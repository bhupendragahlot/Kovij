import { useEffect, useMemo, useState } from "react";
import { Download, Ellipsis, Paperclip, Pencil, Plus, ReceiptText, Trash2 } from "lucide-react";
import { openBill, useDeleteExpense, useExpenses } from "./api";
import { ExpenseDialog } from "./ExpenseDialog";
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY, EXPENSE_MODE } from "./labels";
import { BreakdownList, MonthPicker } from "../finance/components";
import { currentMonth, dayLabel, isValidMonth, monthLabel } from "../finance/month";
import { downloadCsv } from "../payments/api";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  FilterChips,
  IconButton,
  Menu,
  PageHeader,
  Pagination,
  SearchInput,
  Skeleton,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { formatINR, formatNumber } from "../../shared/lib/format";

const LIMIT = 25;

function CategoryCell({ category }) {
  const meta = EXPENSE_CATEGORY[category] || EXPENSE_CATEGORY.other;
  const Icon = meta.icon;
  return (
    <span className="flex items-center gap-2 font-semibold">
      <span className="grid size-8 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-2">
        <Icon className="size-4" aria-hidden />
      </span>
      {meta.label}
    </span>
  );
}

export default function ExpensesPage() {
  const defaults = useMemo(() => ({ month: currentMonth(), category: "", q: "", page: 1 }), []);
  const [filters, setFilters] = useUrlState(defaults);
  const month = isValidMonth(filters.month) ? filters.month : defaults.month;
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const online = useOnlineStatus();
  const confirm = useConfirm();
  const toast = useToast();
  const remove = useDeleteExpense();
  const [dialog, setDialog] = useState({ open: false, expense: null });
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const params = { month, category: filters.category || undefined, q: filters.q || undefined, page: filters.page, limit: LIMIT };
  const query = useExpenses(params);
  const data = query.data;
  const byCategory = data?.totals.byCategory || {};
  const monthTotal = Object.values(byCategory).reduce((s, c) => s + c.amount, 0);
  const monthCount = Object.values(byCategory).reduce((s, c) => s + c.count, 0);

  const openNew = () => setDialog({ open: true, expense: null });
  const openEdit = (expense) => setDialog({ open: true, expense });

  const onDelete = async (e) => {
    const ok = await confirm({
      title: "Delete this expense?",
      body: `${formatINR(e.amount)} ${EXPENSE_CATEGORY[e.category]?.label.toLowerCase() || "expense"} on ${dayLabel(e.date)}. It will no longer count in your totals.`,
      confirmLabel: "Delete expense",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(e._id, {
      onSuccess: () => toast.success("Expense deleted"),
      onError: (err) => toast.error("Couldn't delete the expense", { description: err.message }),
    });
  };

  const viewBill = (e) =>
    openBill(e._id).catch((err) =>
      toast.error("Couldn't open the bill", { description: err.status === 404 ? "The file is missing. Edit the expense to attach it again." : err.message })
    );

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadCsv("/admin/expenses/export.csv", { month, category: filters.category || undefined, q: filters.q || undefined }, `expenses-${month}.csv`);
      toast.success("CSV exported", { description: "Check your downloads folder." });
    } catch (err) {
      toast.error("Couldn't export the CSV", { description: err.message });
    } finally {
      setExporting(false);
    }
  };

  const actions = (e, size = "sm") => (
    <div className="flex items-center justify-end gap-1">
      {e.bill && <IconButton icon={Paperclip} label={`Open bill for ${formatINR(e.amount)} ${EXPENSE_CATEGORY[e.category]?.label || ""}`} size={size} onClick={() => viewBill(e)} />}
      <Menu
        label={`Actions for ${formatINR(e.amount)} ${EXPENSE_CATEGORY[e.category]?.label || ""}`}
        trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${formatINR(e.amount)} ${EXPENSE_CATEGORY[e.category]?.label || ""}`} size={size} />}
        items={[
          { label: "Edit", icon: Pencil, onSelect: () => openEdit(e) },
          { type: "separator" },
          { label: "Delete", icon: Trash2, tone: "danger", onSelect: () => onDelete(e), disabled: !online },
        ]}
      />
    </div>
  );

  const columns = [
    { id: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap">{dayLabel(e.date)}</span> },
    { id: "category", header: "Category", cell: (e) => <CategoryCell category={e.category} /> },
    {
      id: "vendor",
      header: "Paid to",
      cell: (e) => (
        <span className="block max-w-72">
          <span className="block truncate">{e.vendor || <span className="text-ink-3">Not noted</span>}</span>
          {e.note && <span className="block truncate text-body-sm text-ink-3">{e.note}</span>}
        </span>
      ),
    },
    { id: "mode", header: "Paid by", hideBelow: "lg", cell: (e) => EXPENSE_MODE[e.mode] || e.mode },
    { id: "amount", header: "Amount", align: "right", cell: (e) => <span className="font-semibold">{formatINR(e.amount)}</span> },
    { id: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (e) => actions(e) },
  ];

  const mobileRow = (e) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <CategoryCell category={e.category} />
      <div className="min-w-0 flex-1 text-right">
        <p className="tabular font-bold">{formatINR(e.amount)}</p>
        <p className="truncate text-body-sm text-ink-3">
          {dayLabel(e.date)}
          {e.vendor ? `, ${e.vendor}` : ""}
        </p>
      </div>
      {actions(e, "md")}
    </div>
  );

  const filtering = Boolean(filters.category || filters.q);
  const chips = [
    { value: "", label: "All", count: monthCount },
    ...EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY[c].label, count: byCategory[c]?.count || 0 })),
  ];

  return (
    <>
      <PageHeader
        title="Expenses"
        description={data ? `${formatINR(monthTotal)} spent in ${monthLabel(month)}` : "Rent, salaries, bills, equipment and maintenance."}
        actions={
          <>
            <Button icon={Download} onClick={exportCsv} loading={exporting} disabled={!monthCount}>
              Export CSV
            </Button>
            <Button variant="primary" icon={Plus} onClick={openNew}>
              Add expense
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <MonthPicker value={month} onChange={(m) => setFilters({ month: m })} />
        <SearchInput value={search} onChange={setSearch} placeholder="Paid to or note" label="Search expenses" className="lg:w-80" />
      </div>
      <FilterChips label="Category" value={filters.category} onChange={(category) => setFilters({ category })} options={chips} className="mb-4" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_20rem]">
        <Card padding="none" className="order-2 overflow-hidden xl:order-1">
          <DataTable
            caption={`Expenses in ${monthLabel(month)}`}
            columns={columns}
            rows={data?.items}
            mobileRow={mobileRow}
            isPending={query.isPending}
            isFetching={query.isFetching && query.isPlaceholderData}
            error={query.error}
            onRetry={() => query.refetch()}
            empty={
              filtering ? (
                <EmptyState icon={ReceiptText} title="No expenses match" body="Try another category or clear the search." action={<Button onClick={() => (setSearch(""), setFilters({ category: "", q: "" }))}>Clear filters</Button>} />
              ) : (
                <EmptyState
                  icon={ReceiptText}
                  title={`No expenses in ${monthLabel(month)}`}
                  body="Add rent, salaries, electricity and other bills to see what the gym really earns."
                  action={
                    <Button variant="primary" icon={Plus} onClick={openNew}>
                      Add expense
                    </Button>
                  }
                />
              )
            }
          />
          {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
        </Card>

        <Card className="order-1 xl:order-2" aria-labelledby="expense-split">
          <CardHeader id="expense-split" title="Where the money went" description={monthLabel(month)} />
          {query.isPending ? (
            <div className="flex flex-col gap-3" role="status" aria-label="Loading">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : (
            <>
              <p className="tabular mb-4 text-headline font-bold leading-9">{formatINR(monthTotal)}</p>
              <BreakdownList
                label={`Expenses by category in ${monthLabel(month)}`}
                items={EXPENSE_CATEGORIES.map((c) => ({ key: c, label: EXPENSE_CATEGORY[c].label, icon: EXPENSE_CATEGORY[c].icon, amount: byCategory[c]?.amount || 0 }))}
                total={monthTotal}
                emptyText="Nothing recorded this month yet."
                onSelect={(category) => setFilters({ category })}
              />
              {monthCount > 0 && <p className="mt-4 text-body-sm text-ink-3">{formatNumber(monthCount)} {monthCount === 1 ? "expense" : "expenses"}. Tap a category to list only those.</p>}
            </>
          )}
        </Card>
      </div>

      <ExpenseDialog open={dialog.open} expense={dialog.expense} onClose={() => setDialog({ open: false, expense: null })} />
    </>
  );
}
