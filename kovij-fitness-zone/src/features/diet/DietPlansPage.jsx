import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Archive, Plus, Salad, Target, Users } from "lucide-react";
import { useDietPlans } from "./api";
import { DIET_GOAL, DIET_TYPE, formatKcal } from "./labels";
import { DietTypeBadge } from "./dietUi";
import { usePermission } from "../auth/permissions";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useUrlState } from "../../shared/hooks/useUrlState";
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorState, FilterChips, PageHeader, Pagination, SearchInput, SkeletonList, Tabs } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatNumber, formatRelativeTime, pluralize } from "../../shared/lib/format";

const DEFAULTS = { view: "active", type: "", q: "", page: 1 };
const LIMIT = 30;

function PlanCard({ plan }) {
  const t = plan.targets || {};
  return (
    <Link
      to={`/admin/diets/${plan._id}`}
      className="group flex h-full flex-col rounded-card border border-transparent bg-surface p-4 transition-colors hover:border-line-strong sm:p-5 dark:border-line"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink group-hover:underline">{plan.name}</p>
          <p className="text-[13px] text-ink-3">{DIET_GOAL[plan.goal] || "General fitness"}</p>
        </div>
        <DietTypeBadge type={plan.dietType} />
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink">
        {formatKcal(plan.totals.calories)}
        <span className="ml-1 text-sm font-medium text-ink-3">a day</span>
      </p>
      <p className="tabular text-[13px] text-ink-3">
        {formatNumber(plan.totals.proteinG)} g protein, {formatNumber(plan.totals.carbsG)} g carbs, {formatNumber(plan.totals.fatG)} g fat
      </p>
      {t.calories > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-2">
          <Target className="size-3.5 text-ink-3" aria-hidden />
          Target {formatKcal(t.calories)}
          {t.proteinG > 0 && `, ${formatNumber(t.proteinG)} g protein`}
        </p>
      )}
      <p className="mt-3 line-clamp-2 text-sm text-ink-2">
        {plan.mealCount ? `${pluralize(plan.mealCount, "meal")}: ${plan.mealNames.join(", ")}` : "No meals yet"}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
        <Badge size="sm" icon={Users} tone={plan.memberCount ? "brand" : "neutral"}>
          {plan.memberCount ? `${pluralize(plan.memberCount, "member")} on it` : "No members yet"}
        </Badge>
        {plan.archived && (
          <Badge size="sm" icon={Archive}>
            Archived
          </Badge>
        )}
        <span className="ml-auto text-xs text-ink-3">Edited {formatRelativeTime(plan.updatedAt)}</span>
      </div>
    </Link>
  );
}

export default function DietPlansPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const canManage = usePermission("diets.manage");

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const query = useDietPlans({
    archived: filters.view === "archived" ? "true" : "false",
    dietType: filters.type || undefined,
    q: filters.q || undefined,
    page: filters.page,
    limit: LIMIT,
  });
  const plans = query.data?.plans || [];
  const counts = query.data?.counts || {};
  const filtered = Boolean(filters.q || filters.type);
  const newPlan = canManage && (
    <ButtonLink to="/admin/diets/new" variant="primary" icon={Plus}>
      New plan
    </ButtonLink>
  );

  return (
    <>
      <PageHeader
        title="Diet plans"
        description="Reusable meal plans with daily targets. Assign one to a member here or from their profile."
        actions={newPlan}
      />
      <Tabs
        label="Plan status"
        value={filters.view}
        onChange={(view) => setFilters({ view })}
        className="mb-4"
        tabs={[
          { value: "active", label: "In use", count: counts.active },
          { value: "archived", label: "Archived", count: counts.archived },
        ]}
      />
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search plan name" label="Search diet plans" className="md:max-w-sm md:flex-1" />
        <FilterChips
          label="Diet type"
          value={filters.type}
          onChange={(type) => setFilters({ type })}
          options={[{ value: "", label: "All types" }, ...Object.entries(DIET_TYPE).map(([value, meta]) => ({ value, label: meta.label }))]}
        />
      </div>

      {query.isPending ? (
        <Card>
          <SkeletonList rows={4} />
        </Card>
      ) : query.isError && !query.data ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : plans.length === 0 ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={Salad}
              title="No plans match"
              body="Try another name or diet type."
              action={
                <Button variant="secondary" onClick={() => (setSearch(""), setFilters({ q: "", type: "" }))}>
                  Clear filters
                </Button>
              }
            />
          ) : filters.view === "archived" ? (
            <EmptyState icon={Archive} title="No archived plans" body="Plans you archive stay on members' profiles but can't be assigned again." />
          ) : (
            <EmptyState
              icon={Salad}
              title="No diet plans yet"
              body="Write a plan once, for example a 1,800 kcal veg fat-loss plan, then assign it to any member in a few taps."
              action={newPlan}
            />
          )}
        </Card>
      ) : (
        <>
          <ul className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-opacity", query.isFetching && query.isPlaceholderData && "opacity-60")}>
            {plans.map((p) => (
              <li key={p._id}>
                <PlanCard plan={p} />
              </li>
            ))}
          </ul>
          <Pagination page={filters.page} limit={LIMIT} total={query.data.total} onPage={(page) => setFilters({ page })} className="mt-4 rounded-card bg-surface" />
        </>
      )}
    </>
  );
}
