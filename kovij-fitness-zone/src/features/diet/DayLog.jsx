import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Circle, CircleCheck, GlassWater, LoaderCircle, Minus, Plus, Utensils, X } from "lucide-react";
import { useAddExtra, useDietDay, useRemoveExtra, useSetWater, useTickMeal } from "./api";
import { formatKcal, formatMealTime, itemCalories, itemsLine, shiftDayKey } from "./labels";
import { TargetBar } from "./dietUi";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Card, CardHeader, Dialog, ErrorState, Field, FormError, IconButton, InlineAlert, Input, Skeleton, useToast } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatNumber, gymDayKey } from "../../shared/lib/format";

/** How far back the log can be filled in (matches the server). */
const DAYS_BACK = 7;

const dayLabel = (day, today) => {
  if (day === today) return "Today";
  if (day === shiftDayKey(today, -1)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }).format(new Date(`${day}T12:00:00+05:30`));
};

const EMPTY_FOOD = { food: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" };
const num = (v) => (v === "" || v == null ? null : Number(v));

function AddFoodDialog({ open, onClose, memberId, day }) {
  const add = useAddExtra(memberId);
  const idempotency = useIdempotencyKey();
  const online = useOnlineStatus();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY_FOOD);

  useEffect(() => {
    if (!open) return;
    add.reset();
    setForm(EMPTY_FOOD);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = add.error?.fields || {};
  const auto = form.calories === "" && [form.proteinG, form.carbsG, form.fatG].some((v) => v !== "") ? itemCalories(form) : null;

  const submit = (e) => {
    e.preventDefault();
    const item = { food: form.food.trim(), quantity: form.quantity.trim(), calories: num(form.calories), proteinG: num(form.proteinG) ?? 0, carbsG: num(form.carbsG) ?? 0, fatG: num(form.fatG) ?? 0 };
    add.mutate(
      { day, item, idempotencyKey: idempotency.keyFor({ day, ...item }) },
      {
        onSuccess: () => {
          idempotency.reset();
          toast.success("Food added", { description: `${item.food}${item.quantity ? ` (${item.quantity})` : ""}` });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add food"
      description="Something eaten that isn't in the plan, like chai with sugar or a samosa."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-food" variant="primary" loading={add.isPending} disabled={!online}>
            Add food
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You&apos;re offline. Reconnect to add food.
        </InlineAlert>
      )}
      <FormError error={add.error} />
      <form id="add-food" onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
        <Field label="Food" required error={errors.food} className="col-span-2">
          <Input value={form.food} onChange={(e) => set({ food: e.target.value })} placeholder="e.g. Masala chai" maxLength={80} autoFocus />
        </Field>
        <Field label="Quantity" optional error={errors.quantity} className="col-span-2">
          <Input value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} placeholder="e.g. 1 cup" maxLength={60} />
        </Field>
        <Field label="Calories" error={errors.calories} hint={auto != null ? `${formatKcal(auto)} from the macros` : undefined} className="col-span-2">
          <Input type="number" inputMode="numeric" min="0" value={form.calories} onChange={(e) => set({ calories: e.target.value })} suffix="kcal" placeholder={auto != null ? String(auto) : ""} />
        </Field>
        <Field label="Protein" optional error={errors.proteinG}>
          <Input type="number" inputMode="decimal" min="0" step="any" value={form.proteinG} onChange={(e) => set({ proteinG: e.target.value })} suffix="g" />
        </Field>
        <Field label="Carbs" optional error={errors.carbsG}>
          <Input type="number" inputMode="decimal" min="0" step="any" value={form.carbsG} onChange={(e) => set({ carbsG: e.target.value })} suffix="g" />
        </Field>
        <Field label="Fat" optional error={errors.fatG}>
          <Input type="number" inputMode="decimal" min="0" step="any" value={form.fatG} onChange={(e) => set({ fatG: e.target.value })} suffix="g" />
        </Field>
      </form>
    </Dialog>
  );
}

function MealRow({ meal, canLog, pending, onToggle }) {
  const time = formatMealTime(meal.time);
  const Icon = pending ? LoaderCircle : meal.eaten ? CircleCheck : Circle;
  const content = (
    <>
      <Icon className={cn("mt-0.5 size-6 shrink-0", pending && "animate-spin", meal.eaten ? "text-good" : "text-ink-3")} aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-ink">{meal.name}</span>
          {time && <span className="text-body-sm text-ink-3">{time}</span>}
          <span className={cn("text-body-sm font-semibold", meal.eaten ? "text-good" : "text-ink-3")}>{meal.eaten ? "Eaten" : "Not yet"}</span>
        </span>
        <span className="mt-0.5 block text-body-sm text-ink-3">{itemsLine(meal.items) || "No foods listed"}</span>
      </span>
      <span className="tabular shrink-0 text-sm font-semibold text-ink-2">{formatKcal(meal.totals.calories)}</span>
    </>
  );
  if (!canLog) return <div className="flex items-start gap-3 py-3">{content}</div>;
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={meal.eaten}
      aria-label={`${meal.name}${time ? ` at ${time}` : ""}: ${meal.eaten ? "eaten" : "not eaten yet"}`}
      onClick={onToggle}
      disabled={pending}
      className="flex min-h-14 w-full items-start gap-3 rounded-tile px-2 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-70"
    >
      {content}
    </button>
  );
}

function LogSkeleton() {
  return (
    <div className="flex flex-col gap-3" role="status" aria-label="Loading food log">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-14 w-full" />
    </div>
  );
}

/**
 * One day's food log: tick planned meals, add extra foods, count water. Staff with
 * diets.manage can fill it in for the member (today and the last week); others see it read-only.
 */
export function DayLog({ memberId, today: todayLog, canLog }) {
  const today = gymDayKey();
  const [day, setDay] = useState(today);
  const isToday = day === today;
  const other = useDietDay(memberId, day, { enabled: !isToday });
  const data = isToday ? todayLog : other.data;
  const tick = useTickMeal(memberId);
  const water = useSetWater(memberId);
  const remove = useRemoveExtra(memberId);
  const online = useOnlineStatus();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const oldest = shiftDayKey(today, -DAYS_BACK);
  const editable = canLog && online && data?.editable;
  const fail = (what) => (e) => toast.error(`Couldn't ${what}`, { description: e.message });

  const glasses = data?.water.glasses || 0;
  const target = data?.water.target || 8;

  return (
    <Card>
      <CardHeader
        title="Food log"
        description={data?.plan ? `Following ${data.plan.name}` : "No diet plan on this day"}
        action={
          <div className="flex items-center gap-1">
            <IconButton icon={ChevronLeft} label="Previous day" size="sm" variant="secondary" onClick={() => setDay((d) => shiftDayKey(d, -1))} disabled={day === oldest} />
            <span className="min-w-24 text-center text-sm font-semibold" aria-live="polite">
              {dayLabel(day, today)}
            </span>
            <IconButton icon={ChevronRight} label="Next day" size="sm" variant="secondary" onClick={() => setDay((d) => shiftDayKey(d, 1))} disabled={isToday} />
          </div>
        }
      />

      {!isToday && other.isPending ? (
        <LogSkeleton />
      ) : !isToday && other.isError ? (
        <ErrorState compact error={other.error} onRetry={() => other.refetch()} />
      ) : (
        data && (
          <div className="flex flex-col gap-5">
            {canLog && !online && (
              <InlineAlert tone="offline">You&apos;re offline. The log is read-only until you reconnect.</InlineAlert>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TargetBar label="Calories" value={data.totals.eaten.calories} target={data.targets?.calories} unit="kcal" />
              <TargetBar label="Protein" value={data.totals.eaten.proteinG} target={data.targets?.proteinG} unit="g" />
            </div>

            {data.meals.length > 0 && (
              <div>
                <p className="mb-1 text-body-sm font-semibold text-ink-3">
                  Planned meals, {data.mealsEaten} of {data.mealsPlanned} eaten
                </p>
                <ul className="-mx-2 divide-y divide-line">
                  {data.meals.map((m) => (
                    <li key={m._id}>
                      <MealRow
                        meal={m}
                        canLog={editable}
                        pending={tick.isPending && tick.variables?.mealId === m._id}
                        onToggle={() => tick.mutate({ day, mealId: m._id, eaten: !m.eaten }, { onError: fail("update the meal") })}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="text-body-sm font-semibold text-ink-3">Other food</p>
                {editable && (
                  <Button size="sm" variant="quiet" icon={Plus} onClick={() => setAdding(true)}>
                    Add food
                  </Button>
                )}
              </div>
              {data.extras.length ? (
                <ul className="divide-y divide-line">
                  {data.extras.map((x) => (
                    <li key={x._id} className="flex min-h-11 items-center gap-3 py-1.5">
                      <Utensils className="size-4 shrink-0 text-ink-3" aria-hidden />
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="font-medium text-ink">{x.food}</span>
                        {x.quantity && <span className="text-ink-3"> ({x.quantity})</span>}
                        <span className="block text-xs text-ink-3">Added by {x.addedByKind === "member" ? "the member" : "staff"}</span>
                      </span>
                      <span className="tabular text-sm font-semibold text-ink-2">{formatKcal(x.calories)}</span>
                      {editable && (
                        <IconButton
                          icon={X}
                          label={`Remove ${x.food}`}
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate({ day, itemId: x._id }, { onSuccess: () => toast.success("Food removed"), onError: fail("remove the food") })}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-ink-3">Nothing extra logged.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-tile bg-surface-2 p-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <GlassWater className="size-4 text-info" aria-hidden />
                  Water
                </p>
                <p className="tabular text-body-sm text-ink-3" aria-live="polite">
                  {formatNumber(glasses)} of {target} glasses{glasses >= target ? ", target reached" : ""}
                </p>
              </div>
              {editable ? (
                <div className="flex items-center gap-2">
                  <IconButton icon={Minus} label="One glass less" variant="secondary" disabled={glasses <= 0 || water.isPending} onClick={() => water.mutate({ day, glasses: glasses - 1 }, { onError: fail("update water") })} />
                  <span className="tabular w-8 text-center text-title-lg font-bold">{glasses}</span>
                  <IconButton icon={Plus} label="One glass more" variant="secondary" disabled={glasses >= 30 || water.isPending} onClick={() => water.mutate({ day, glasses: glasses + 1 }, { onError: fail("update water") })} />
                </div>
              ) : (
                <span className="tabular text-title-lg font-bold">{glasses}</span>
              )}
            </div>

            {canLog && !data.editable && <p className="text-body-sm text-ink-3">Only the last {DAYS_BACK} days can be changed.</p>}
          </div>
        )
      )}
      <AddFoodDialog open={adding} onClose={() => setAdding(false)} memberId={memberId} day={day} />
    </Card>
  );
}
