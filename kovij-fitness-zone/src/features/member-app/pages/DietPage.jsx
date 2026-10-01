import { Link } from "react-router-dom";
import { Apple, CheckCircle2, Circle, Droplet, Minus, Plus } from "lucide-react";
import { useDiet, useTickMeal, useWater } from "../queries";
import { Card, CardHeader, EmptyState, ErrorState, FormError, IconButton, PageHeader, SkeletonList, useToast } from "../../../shared/ui";
import { formatNumber } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";

const DIET_TYPE = { veg: "Vegetarian", non_veg: "Non-vegetarian", eggetarian: "Eggetarian", vegan: "Vegan" };

function Meter({ label, value, target, unit }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="tabular text-ink-3">
          <span className="font-bold text-ink">{formatNumber(Math.round(value))}</span>
          {target ? ` / ${formatNumber(target)} ${unit}` : ` ${unit}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-2" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={target || 0} aria-valuenow={Math.round(value)}>
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DietPage() {
  const diet = useDiet();
  const d = diet.data;
  const today = d?.today;
  const tick = useTickMeal(today?.day);
  const water = useWater(today?.day);
  const toast = useToast();

  if (diet.isPending) return <><PageHeader title="Diet" /><Card><SkeletonList rows={5} /></Card></>;
  if (diet.isError) return <><PageHeader title="Diet" /><Card><ErrorState error={diet.error} onRetry={() => diet.refetch()} /></Card></>;
  if (!d.current) {
    return (
      <>
        <PageHeader title="Diet" />
        <Card>
          <EmptyState
            icon={Apple}
            title="No diet plan yet"
            body={d.upcoming ? `Your plan “${d.upcoming.name}” starts soon.` : "Your trainer can make one for you: Indian meals, your targets, your routine."}
            action={!d.upcoming && <Link to="/member/support/new" className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-bold text-on-brand">Ask for a diet plan</Link>}
          />
        </Card>
      </>
    );
  }

  const t = today.totals;
  const setTick = (meal) =>
    tick.mutate({ mealId: meal._id, eaten: !meal.eaten }, { onError: (e) => toast.error("Couldn't save", { description: e.message }) });
  const setWater = (glasses) => water.mutate(Math.max(0, Math.min(30, glasses)), { onError: (e) => toast.error("Couldn't save", { description: e.message }) });

  return (
    <>
      <PageHeader title={d.current.name} description={[DIET_TYPE[d.current.dietType], d.current.assignedByName && `from ${d.current.assignedByName}`].filter(Boolean).join(" · ")} />
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader
            title="Today"
            description={today.remainingCalories != null ? (today.remainingCalories > 0 ? `${formatNumber(today.remainingCalories)} kcal left to eat` : "Today’s calories are done") : `${today.mealsEaten} of ${today.mealsPlanned} meals eaten`}
          />
          <div className="flex flex-col gap-3">
            <Meter label="Calories" value={t.eaten.calories} target={today.targets?.calories || t.planned.calories} unit="kcal" />
            <Meter label="Protein" value={t.eaten.proteinG} target={today.targets?.proteinG || t.planned.proteinG} unit="g" />
          </div>
        </Card>

        <Card>
          <CardHeader title="Meals" description="Tap a meal when you’ve eaten it." />
          <FormError error={tick.error} />
          <ul className="flex flex-col gap-2">
            {today.meals.map((meal) => (
              <li key={meal._id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={meal.eaten}
                  disabled={!today.editable}
                  onClick={() => setTick(meal)}
                  className={cn("flex w-full items-start gap-3 rounded-tile border p-3 text-left transition-colors", meal.eaten ? "border-good/40 bg-good-soft" : "border-line hover:bg-surface-2")}
                >
                  {meal.eaten ? <CheckCircle2 className="mt-0.5 size-6 shrink-0 text-good" aria-hidden /> : <Circle className="mt-0.5 size-6 shrink-0 text-ink-3" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-bold">{meal.name}</span>
                      <span className="tabular shrink-0 text-[13px] text-ink-3">
                        {meal.time} · {formatNumber(meal.totals?.calories || 0)} kcal
                      </span>
                    </span>
                    <span className="mt-0.5 block text-sm text-ink-2">{meal.items.map((i) => `${i.food}${i.quantity ? ` (${i.quantity})` : ""}`).join(", ")}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {d.current.notes && <p className="mt-4 text-sm text-ink-2">Trainer’s note: {d.current.notes}</p>}
        </Card>

        <Card>
          <CardHeader title="Water" description={`${today.water.glasses} of ${today.water.target} glasses`} />
          <div className="flex items-center gap-3">
            <IconButton icon={Minus} label="One glass less" variant="secondary" onClick={() => setWater(today.water.glasses - 1)} disabled={!today.water.glasses || water.isPending} />
            <div className="flex flex-1 flex-wrap gap-1.5" aria-hidden>
              {Array.from({ length: Math.max(today.water.target, today.water.glasses) }, (_, i) => (
                <Droplet key={i} className={cn("size-6", i < today.water.glasses ? "fill-info text-info" : "text-line-strong")} />
              ))}
            </div>
            <IconButton icon={Plus} label="One more glass" variant="primary" onClick={() => setWater(today.water.glasses + 1)} disabled={water.isPending} />
          </div>
        </Card>
      </div>
    </>
  );
}
