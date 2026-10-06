import { useState } from "react";
import { CalendarClock, CircleStop, Ellipsis, ExternalLink, History, RefreshCw, Salad, StickyNote, UserPlus } from "lucide-react";
import { useMemberDiet, useNutritionHistory, useStopDiet } from "./api";
import { DIET_GOAL, formatKcal, formatMealTime, itemsLine } from "./labels";
import { AssignDietDialog, DietTypeBadge, MacroLine } from "./dietUi";
import { DayLog } from "./DayLog";
import { NutritionChart } from "./NutritionChart";
import { usePermission } from "../auth/permissions";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, IconButton, InlineAlert, Menu, Skeleton, Tile, useConfirm, useToast } from "../../shared/ui";
import { formatDate, formatNumber } from "../../shared/lib/format";

/**
 * OWNER: diet, progress & notes module. Member profile tab: "Diet".
 * The member's plan (current and next), their food log and two weeks of history.
 * Anyone who can see health data can read it; trainers and managers (diets.manage) can assign,
 * stop and log for the member.
 */

function Targets({ targets }) {
  const parts = [];
  if (targets?.calories) parts.push(formatKcal(targets.calories));
  if (targets?.proteinG) parts.push(`${formatNumber(targets.proteinG)} g protein`);
  if (targets?.carbsG) parts.push(`${formatNumber(targets.carbsG)} g carbs`);
  if (targets?.fatG) parts.push(`${formatNumber(targets.fatG)} g fat`);
  if (!parts.length) return null;
  return <p className="tabular text-sm text-ink-2">Daily target: {parts.join(", ")}</p>;
}

function PlanMeals({ meals }) {
  return (
    <details className="group mt-4 rounded-tile border border-line">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3.5 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
        See all {meals.length} meals
        <span className="text-body-sm font-medium text-ink-3 group-open:hidden">Show</span>
        <span className="hidden text-body-sm font-medium text-ink-3 group-open:inline">Hide</span>
      </summary>
      <ol className="divide-y divide-line border-t border-line">
        {meals.map((m) => (
          <li key={m._id} className="px-3.5 py-3">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-semibold">
                {m.name}
                {m.time && <span className="ml-2 text-body-sm font-medium text-ink-3">{formatMealTime(m.time)}</span>}
              </span>
              <span className="tabular text-sm font-semibold text-ink-2">{formatKcal(m.totals.calories)}</span>
            </p>
            <p className="mt-0.5 text-body-sm text-ink-3">{itemsLine(m.items) || "No foods listed"}</p>
          </li>
        ))}
      </ol>
    </details>
  );
}

function CurrentPlanCard({ current, upcoming, canManage, onAssign, onStop, stopping }) {
  const shown = current || upcoming;
  if (!shown) {
    return (
      <Card>
        <EmptyState
          compact
          icon={Salad}
          title="No diet plan yet"
          body={canManage ? "Assign a plan with meals and daily targets. The member sees it in their app and can tick meals off." : "A trainer can assign one. It will show here and in the member's app."}
          action={
            canManage && (
              <Button variant="primary" icon={UserPlus} onClick={onAssign}>
                Assign plan
              </Button>
            )
          }
        />
      </Card>
    );
  }
  const startsLater = !current && upcoming;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-2">{startsLater ? "Next diet plan" : "Diet plan"}</p>
          <p className="mt-1 text-title-lg font-bold leading-6 text-ink">{shown.name}</p>
          <p className="mt-0.5 text-body-sm text-ink-3">
            {startsLater ? `Starts ${formatDate(shown.startDate)}` : `Since ${formatDate(shown.startDate)}`}
            {shown.assignedByName ? `, assigned by ${shown.assignedByName}` : ""}
          </p>
        </div>
        {canManage && (
          <Menu
            label="Diet plan actions"
            trigger={(props) => <IconButton {...props} icon={Ellipsis} label="Diet plan actions" variant="secondary" />}
            items={[
              { label: "Change plan", icon: RefreshCw, onSelect: onAssign },
              shown.planId && { label: "Open plan template", icon: ExternalLink, to: `/admin/diets/${shown.planId}` },
              { type: "separator" },
              { label: "Stop plan", icon: CircleStop, tone: "danger", onSelect: onStop, disabled: stopping },
            ]}
          />
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <DietTypeBadge type={shown.dietType} />
        {shown.goal && <Badge size="sm">{DIET_GOAL[shown.goal]}</Badge>}
      </div>
      <div className="mt-3 flex flex-col gap-1">
        <Targets targets={shown.targets} />
        <MacroLine totals={shown.totals} />
      </div>
      {shown.note && (
        <Tile className="mt-4 flex gap-2.5 p-3.5">
          <StickyNote className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
          <p className="text-sm text-ink-2">
            <span className="font-semibold text-ink">Note for the member: </span>
            {shown.note}
          </p>
        </Tile>
      )}
      {shown.meals?.length > 0 && <PlanMeals meals={shown.meals} />}
      {current && upcoming && (
        <InlineAlert tone="info" className="mt-4">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-4" aria-hidden />
            Next: <strong>{upcoming.name}</strong> from {formatDate(upcoming.startDate)}
          </span>
        </InlineAlert>
      )}
    </Card>
  );
}

function HistoryCard({ memberId }) {
  const history = useNutritionHistory(memberId, 14);
  return (
    <Card>
      <CardHeader title="Last 14 days" />
      {history.isPending ? (
        <Skeleton className="h-52 w-full" />
      ) : history.isError ? (
        <ErrorState compact error={history.error} onRetry={() => history.refetch()} />
      ) : history.data.days.length === 0 ? (
        <EmptyState compact icon={History} title="Nothing logged yet" body="Days appear here once there's a plan or food is logged." />
      ) : (
        <>
          <NutritionChart history={history.data} />
          <p className="mt-3 text-body-sm text-ink-3">
            {history.data.summary.daysLogged
              ? `Logged ${history.data.summary.daysLogged} of 14 days, about ${formatKcal(history.data.summary.avgCalories)} and ${history.data.summary.avgWaterGlasses} glasses of water a day.`
              : "No food logged in the last 14 days."}
          </p>
        </>
      )}
    </Card>
  );
}

function PastPlans({ past }) {
  if (!past.length) return null;
  return (
    <Card>
      <CardHeader title="Earlier plans" />
      <ol className="-my-1 divide-y divide-line">
        {past.map((p) => (
          <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{p.name}</span>
              <span className="block text-body-sm text-ink-3">
                {formatDate(p.startDate)}
                {p.endedAt ? ` to ${formatDate(p.endedAt)}` : ""}
              </span>
            </span>
            <DietTypeBadge type={p.dietType} />
          </li>
        ))}
      </ol>
    </Card>
  );
}

function TabSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" role="status" aria-label="Loading diet">
      <Skeleton className="h-56 w-full rounded-card" />
      <Skeleton className="h-72 w-full rounded-card" />
    </div>
  );
}

export default function MemberDietTab({ member }) {
  const diet = useMemberDiet(member._id);
  const stop = useStopDiet(member._id);
  const canManage = usePermission("diets.manage");
  const canView = usePermission("members.health.view");
  const confirm = useConfirm();
  const toast = useToast();
  const [assigning, setAssigning] = useState(false);

  if (!canView) {
    return (
      <Card>
        <ErrorState error={{ status: 403, message: "Diet details are health information. Your role can't see them." }} />
      </Card>
    );
  }
  if (diet.isPending) return <TabSkeleton />;
  if (diet.isError && !diet.data) {
    return (
      <Card>
        <ErrorState error={diet.error} onRetry={() => diet.refetch()} />
      </Card>
    );
  }

  const { current, upcoming, past, today } = diet.data;
  const first = member.name.split(" ")[0];

  const onStop = async () => {
    const ok = await confirm({
      title: `Stop ${first}'s diet plan?`,
      body: upcoming && current ? "The current plan and the one waiting to start both stop today. Their food log so far is kept." : "The plan stops today. Their food log so far is kept.",
      confirmLabel: "Stop plan",
      cancelLabel: "Keep plan",
      tone: "danger",
    });
    if (!ok) return;
    stop.mutate(undefined, {
      onSuccess: () => toast.success("Plan stopped"),
      onError: (e) => toast.error("Couldn't stop the plan", { description: e.message }),
    });
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 xl:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <CurrentPlanCard current={current} upcoming={upcoming} canManage={canManage} onAssign={() => setAssigning(true)} onStop={onStop} stopping={stop.isPending} />
        <DayLog memberId={member._id} today={today} canLog={canManage} />
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <HistoryCard memberId={member._id} />
        <PastPlans past={past} />
      </div>
      <AssignDietDialog open={assigning} onClose={() => setAssigning(false)} member={member} currentPlanName={current?.name || upcoming?.name} />
    </div>
  );
}
