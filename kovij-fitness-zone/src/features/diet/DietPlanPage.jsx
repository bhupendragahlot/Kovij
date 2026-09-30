import { cloneElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Copy, Ellipsis, Plus, Salad, Save, Trash2, UserPlus, X } from "lucide-react";
import { dietKeys, useArchiveDietPlan, useDeleteDietPlan, useDietPlan, useDuplicateDietPlan, useSaveDietPlan } from "./api";
import { DIET_GOAL, DIET_TYPE, MEAL_PRESETS, draftTotals, formatKcal, formatMealTime, itemCalories } from "./labels";
import { AssignDietDialog, MacroLine, TargetBar } from "./dietUi";
import { usePermission } from "../auth/permissions";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  IconButton,
  InlineAlert,
  Input,
  Menu,
  PageHeader,
  Select,
  Skeleton,
  Textarea,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatDate, formatNumber } from "../../shared/lib/format";

// ── Form state ──────────────────────────────────────────────────────────────

let keySeq = 0;
/** Client-only keys so React keeps each row's input focus while rows are added or moved. */
const newKey = () => `row-${++keySeq}`;
const str = (v) => (v == null ? "" : String(v));
const num = (v) => (v === "" || v == null ? null : Number(v));

const emptyItem = () => ({ key: newKey(), food: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "" });
const newMeal = (preset) => ({ key: newKey(), name: preset?.name || "", time: preset?.time || "", items: [emptyItem()] });
const EMPTY_FORM = { name: "", goal: "general_fitness", dietType: "veg", targets: { calories: "", proteinG: "", carbsG: "", fatG: "" }, notes: "", meals: [] };

function toForm(plan) {
  return {
    name: plan.name,
    goal: plan.goal || "general_fitness",
    dietType: plan.dietType || "veg",
    targets: { calories: str(plan.targets?.calories), proteinG: str(plan.targets?.proteinG), carbsG: str(plan.targets?.carbsG), fatG: str(plan.targets?.fatG) },
    notes: plan.notes || "",
    meals: plan.meals.map((m) => ({
      key: newKey(),
      name: m.name,
      time: m.time || "",
      items: m.items.map((it) => ({ key: newKey(), food: it.food, quantity: it.quantity || "", calories: str(it.calories), proteinG: str(it.proteinG), carbsG: str(it.carbsG), fatG: str(it.fatG) })),
    })),
  };
}

const isBlankItem = (it) => !it.food.trim() && !it.quantity.trim() && [it.calories, it.proteinG, it.carbsG, it.fatG].every((v) => v === "");

/**
 * Form → request body. Fully blank food rows are dropped; `itemMap` remembers which on-screen
 * row each sent item came from, so a server error lands on the right input.
 */
function buildPayload(form) {
  const itemMap = [];
  const meals = form.meals.map((m, mi) => {
    itemMap[mi] = [];
    const items = [];
    m.items.forEach((it, ui) => {
      if (isBlankItem(it)) return;
      itemMap[mi].push(ui);
      items.push({ food: it.food.trim(), quantity: it.quantity.trim(), calories: num(it.calories), proteinG: num(it.proteinG) ?? 0, carbsG: num(it.carbsG) ?? 0, fatG: num(it.fatG) ?? 0 });
    });
    return { name: m.name.trim(), time: m.time || "", items };
  });
  const payload = {
    name: form.name.trim(),
    goal: form.goal,
    dietType: form.dietType,
    targets: { calories: num(form.targets.calories), proteinG: num(form.targets.proteinG), carbsG: num(form.targets.carbsG), fatG: num(form.targets.fatG) },
    notes: form.notes.trim(),
    meals,
  };
  return { payload, itemMap };
}

/** Server field paths use sent indexes; point them back at on-screen rows. */
function screenErrors(fields = {}, itemMap = []) {
  const out = {};
  for (const [path, msg] of Object.entries(fields)) {
    const m = path.match(/^meals\.(\d+)\.items\.(\d+)\.(.+)$/);
    if (m) out[`meals.${m[1]}.items.${itemMap[m[1]]?.[m[2]] ?? m[2]}.${m[3]}`] = msg;
    else out[path] = msg;
  }
  return out;
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** Compact labelled cell: label visible on phones, column header on wider screens. */
function Cell({ label, error, className, children }) {
  const id = useId();
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-ink-3 sm:sr-only">
        {label}
      </label>
      {cloneElement(children, { id, "aria-invalid": error ? true : undefined, "aria-describedby": error ? `${id}-error` : undefined })}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

const ITEM_GRID = "sm:grid-cols-[minmax(0,2.2fr)_minmax(0,1.5fr)_repeat(4,minmax(0,1fr))_2.75rem]";

function ItemRow({ item, path, errors, onChange, onRemove }) {
  const set = (patch) => onChange({ ...item, ...patch });
  const auto = item.calories === "" && [item.proteinG, item.carbsG, item.fatG].some((v) => v !== "") ? String(itemCalories(item)) : "0";
  const numberProps = { type: "number", inputMode: "decimal", min: "0", step: "any" };
  return (
    <li className={cn("relative grid grid-cols-2 gap-2 rounded-tile border border-line p-3 sm:items-start sm:rounded-none sm:border-0 sm:p-0", ITEM_GRID)}>
      <Cell label="Food" error={errors[`${path}.food`]} className="col-span-2 pr-10 sm:col-span-1 sm:pr-0">
        <Input value={item.food} onChange={(e) => set({ food: e.target.value })} placeholder="e.g. Moong dal chilla" maxLength={80} />
      </Cell>
      <Cell label="Quantity" error={errors[`${path}.quantity`]} className="col-span-2 sm:col-span-1">
        <Input value={item.quantity} onChange={(e) => set({ quantity: e.target.value })} placeholder="e.g. 2 pieces" maxLength={60} />
      </Cell>
      <Cell label="Calories" error={errors[`${path}.calories`]}>
        <Input {...numberProps} value={item.calories} onChange={(e) => set({ calories: e.target.value })} placeholder={auto} suffix="kcal" />
      </Cell>
      <Cell label="Protein" error={errors[`${path}.proteinG`]}>
        <Input {...numberProps} value={item.proteinG} onChange={(e) => set({ proteinG: e.target.value })} placeholder="0" suffix="g" />
      </Cell>
      <Cell label="Carbs" error={errors[`${path}.carbsG`]}>
        <Input {...numberProps} value={item.carbsG} onChange={(e) => set({ carbsG: e.target.value })} placeholder="0" suffix="g" />
      </Cell>
      <Cell label="Fat" error={errors[`${path}.fatG`]}>
        <Input {...numberProps} value={item.fatG} onChange={(e) => set({ fatG: e.target.value })} placeholder="0" suffix="g" />
      </Cell>
      <IconButton
        icon={X}
        label={`Remove ${item.food || "this food"}`}
        size="md"
        onClick={onRemove}
        className="absolute right-2 top-2 sm:static"
      />
    </li>
  );
}

function MealEditor({ meal, index, count, errors, onChange, onRemove, onMove }) {
  const path = `meals.${index}`;
  const totals = draftTotals(meal.items);
  const setItem = (i, next) => onChange({ ...meal, items: meal.items.map((it, j) => (j === i ? next : it)) });
  const removeItem = (i) => onChange({ ...meal, items: meal.items.filter((_, j) => j !== i) });
  return (
    <Card padding="none" as="li">
      <div className="flex flex-wrap items-end gap-3 border-b border-line p-4 md:px-5">
        <Field label="Meal" error={errors[`${path}.name`]} className="min-w-0 flex-1 basis-40">
          <Input value={meal.name} onChange={(e) => onChange({ ...meal, name: e.target.value })} placeholder="e.g. Breakfast" maxLength={60} />
        </Field>
        <Field label="Time" optional error={errors[`${path}.time`]} className="w-36">
          <Input type="time" value={meal.time} onChange={(e) => onChange({ ...meal, time: e.target.value })} />
        </Field>
        <Menu
          label={`Options for ${meal.name || "this meal"}`}
          trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Options for ${meal.name || "this meal"}`} variant="secondary" />}
          items={[
            { label: "Move up", icon: ArrowUp, disabled: index === 0, onSelect: () => onMove(-1) },
            { label: "Move down", icon: ArrowDown, disabled: index === count - 1, onSelect: () => onMove(1) },
            { type: "separator" },
            { label: "Remove meal", icon: Trash2, tone: "danger", onSelect: onRemove },
          ]}
        />
      </div>
      <div className="p-4 md:px-5">
        <div className={cn("mb-1.5 hidden gap-2 text-xs font-semibold text-ink-3 sm:grid", ITEM_GRID)} aria-hidden>
          <span>Food</span>
          <span>Quantity</span>
          <span>Calories</span>
          <span>Protein</span>
          <span>Carbs</span>
          <span>Fat</span>
          <span />
        </div>
        {meal.items.length ? (
          <ul className="flex flex-col gap-3 sm:gap-2">
            {meal.items.map((it, i) => (
              <ItemRow key={it.key} item={it} path={`${path}.items.${i}`} errors={errors} onChange={(next) => setItem(i, next)} onRemove={() => removeItem(i)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No foods in this meal yet.</p>
        )}
        {errors[`${path}.items`] && <p className="mt-2 text-[13px] font-medium text-bad">{errors[`${path}.items`]}</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button size="sm" variant="quiet" icon={Plus} onClick={() => onChange({ ...meal, items: [...meal.items, emptyItem()] })}>
            Add food
          </Button>
          <MacroLine totals={totals} />
        </div>
      </div>
    </Card>
  );
}

function AddMealMenu({ used, onAdd, variant = "secondary" }) {
  const presets = MEAL_PRESETS.filter((p) => !used.includes(p.name.toLowerCase()));
  return (
    <Menu
      label="Add a meal"
      align="start"
      trigger={(props) => (
        <Button {...props} variant={variant} icon={Plus}>
          Add meal
        </Button>
      )}
      items={[
        ...presets.map((p) => ({ label: p.name, hint: formatMealTime(p.time), onSelect: () => onAdd(p) })),
        presets.length > 0 && { type: "separator" },
        { label: "Another meal", icon: Plus, onSelect: () => onAdd(null) },
      ]}
    />
  );
}

function MembersOnPlan({ plan, onAssign, canAssign }) {
  const members = plan.members || [];
  return (
    <Card>
      <CardHeader
        title="Members on this plan"
        description={members.length ? `${members.length} following it now or soon` : undefined}
        action={
          canAssign && (
            <Button size="sm" variant="quiet" icon={UserPlus} onClick={onAssign}>
              Assign
            </Button>
          )
        }
      />
      {members.length ? (
        <ul className="-mx-1 flex flex-col">
          {members.map((m) => (
            <li key={m.assignmentId}>
              <Link to={`/admin/members/${m.member._id}`} className="flex min-h-11 items-center gap-3 rounded-[10px] px-1 py-2 hover:bg-surface-2">
                <Avatar name={m.member.name} src={m.member.profilePhoto} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{m.member.name}</span>
                  <span className="block text-xs text-ink-3">
                    {new Date(m.startDate) > new Date() ? `Starts ${formatDate(m.startDate)}` : `Since ${formatDate(m.startDate)}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">Nobody yet. Assign it from here or from a member&apos;s profile.</p>
      )}
    </Card>
  );
}

function EditorSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" role="status" aria-label="Loading plan">
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-48 w-full rounded-card" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
      <Skeleton className="h-72 w-full rounded-card" />
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function DietPlanPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canManage = usePermission("diets.manage");
  const online = useOnlineStatus();
  const toast = useToast();
  const confirm = useConfirm();
  const query = useDietPlan(isNew ? null : id);
  const save = useSaveDietPlan();
  const archive = useArchiveDietPlan();
  const duplicate = useDuplicateDietPlan();
  const remove = useDeleteDietPlan();
  const createKey = useIdempotencyKey();
  const duplicateKey = useIdempotencyKey();

  const [form, setForm] = useState(EMPTY_FORM);
  const [baseline, setBaseline] = useState(() => JSON.stringify(buildPayload(EMPTY_FORM).payload));
  const [assigning, setAssigning] = useState(false);
  const loadedFor = useRef(null);

  // Load the saved plan into the form once per plan (a background refetch never wipes edits).
  useEffect(() => {
    if (isNew) {
      if (loadedFor.current !== "new") {
        loadedFor.current = "new";
        setForm({ ...EMPTY_FORM, meals: [newMeal(MEAL_PRESETS[1])] });
        setBaseline(JSON.stringify(buildPayload(EMPTY_FORM).payload));
      }
      return;
    }
    if (query.data && loadedFor.current !== id) {
      loadedFor.current = id;
      const next = toForm(query.data);
      setForm(next);
      setBaseline(JSON.stringify(buildPayload(next).payload));
    }
  }, [isNew, id, query.data]);

  const built = useMemo(() => buildPayload(form), [form]);
  const dirty = JSON.stringify(built.payload) !== baseline;
  useUnsavedChangesGuard(dirty && !save.isPending);

  const errors = screenErrors(save.error?.fields, built.itemMap);
  const allItems = form.meals.flatMap((m) => m.items);
  const totals = draftTotals(allItems);
  const plan = query.data;

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setTarget = (patch) => setForm((f) => ({ ...f, targets: { ...f.targets, ...patch } }));
  const setMeal = (i, meal) => setForm((f) => ({ ...f, meals: f.meals.map((m, j) => (j === i ? meal : m)) }));
  const addMeal = (preset) => setForm((f) => ({ ...f, meals: [...f.meals, newMeal(preset)] }));
  const moveMeal = (i, step) =>
    setForm((f) => {
      const meals = [...f.meals];
      const j = i + step;
      if (j < 0 || j >= meals.length) return f;
      [meals[i], meals[j]] = [meals[j], meals[i]];
      return { ...f, meals };
    });
  const removeMeal = async (i) => {
    const meal = form.meals[i];
    const hasFood = meal.items.some((it) => !isBlankItem(it));
    if (hasFood && !(await confirm({ title: `Remove ${meal.name || "this meal"}?`, body: "Its foods are removed too. Nothing is saved until you save the plan.", confirmLabel: "Remove meal", tone: "danger" }))) return;
    setForm((f) => ({ ...f, meals: f.meals.filter((_, j) => j !== i) }));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!online) return;
    const { payload } = built;
    save.mutate(
      { id: isNew ? undefined : id, payload, idempotencyKey: isNew ? createKey.keyFor(payload) : undefined },
      {
        onSuccess: (data) => {
          createKey.reset();
          const next = toForm(data.plan);
          setBaseline(JSON.stringify(buildPayload(next).payload));
          queryClient.setQueryData(dietKeys.plan(data.plan._id), data.plan);
          if (isNew) {
            toast.success("Plan created", { description: "Assign it to a member when you're ready." });
            loadedFor.current = data.plan._id;
            setForm(next);
            // After the guard has seen the saved state.
            setTimeout(() => navigate(`/admin/diets/${data.plan._id}`, { replace: true }), 0);
          } else {
            toast.success("Plan saved", { description: data.plan.members?.length ? "Members already on it keep their copy." : undefined });
            setForm(next);
          }
        },
        onError: (err) => {
          if (!err.fields || !Object.keys(err.fields).length) toast.error("Couldn't save the plan", { description: err.message });
        },
      }
    );
  };

  const onArchive = (archived) =>
    archive.mutate(
      { id, archived },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(dietKeys.plan(id), data.plan);
          toast.success(archived ? "Plan archived" : "Plan restored");
        },
        onError: (e) => toast.error(archived ? "Couldn't archive the plan" : "Couldn't restore the plan", { description: e.message }),
      }
    );

  const onDuplicate = () =>
    duplicate.mutate(
      { id, idempotencyKey: duplicateKey.keyFor({ duplicate: id }) },
      {
        onSuccess: (data) => {
          duplicateKey.reset();
          queryClient.setQueryData(dietKeys.plan(data.plan._id), data.plan);
          toast.success("Plan duplicated", { description: "You're now editing the copy." });
          navigate(`/admin/diets/${data.plan._id}`);
        },
        onError: (e) => toast.error("Couldn't duplicate the plan", { description: e.message }),
      }
    );

  const onDelete = async () => {
    const ok = await confirm({ title: `Delete ${plan.name}?`, body: "This can't be undone. Members who had it before keep their copy.", confirmLabel: "Delete plan", tone: "danger" });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: () => {
        loadedFor.current = null;
        setBaseline(JSON.stringify(built.payload));
        toast.success("Plan deleted");
        setTimeout(() => navigate("/admin/diets", { replace: true }), 0);
      },
      onError: (e) => {
        if (e.code === "PLAN_IN_USE") {
          toast.warning("Members are following this plan", { description: e.message, action: { label: "Archive", onClick: () => onArchive(true) } });
        } else toast.error("Couldn't delete the plan", { description: e.message });
      },
    });
  };

  const header = (
    <PageHeader
      title={isNew ? "New diet plan" : plan?.name || "Diet plan"}
      description={isNew ? "Add meals and foods; totals add up as you type." : undefined}
      back={{ to: "/admin/diets", label: "Diet plans" }}
      actions={
        !isNew &&
        plan &&
        canManage && (
          <>
            <Button variant="secondary" icon={UserPlus} onClick={() => setAssigning(true)} disabled={plan.archived || !plan.meals.length}>
              Assign to member
            </Button>
            <Menu
              label="More plan actions"
              trigger={(props) => <IconButton {...props} icon={Ellipsis} label="More plan actions" variant="secondary" />}
              items={[
                { label: "Duplicate plan", icon: Copy, onSelect: onDuplicate, disabled: duplicate.isPending },
                plan.archived
                  ? { label: "Restore plan", icon: ArchiveRestore, onSelect: () => onArchive(false) }
                  : { label: "Archive plan", icon: Archive, onSelect: () => onArchive(true) },
                { type: "separator" },
                { label: "Delete plan", icon: Trash2, tone: "danger", onSelect: onDelete },
              ]}
            />
          </>
        )
      }
    />
  );

  if (!canManage) {
    return (
      <>
        {header}
        <Card>
          <ErrorState error={{ status: 403, message: "Only trainers and managers can edit diet plans." }} />
        </Card>
      </>
    );
  }
  if (!isNew && query.isPending) {
    return (
      <>
        {header}
        <EditorSkeleton />
      </>
    );
  }
  if (!isNew && query.isError && !plan) {
    return (
      <>
        {header}
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      </>
    );
  }

  const target = (k) => num(form.targets[k]);

  return (
    <>
      {header}
      {plan?.archived && (
        <InlineAlert
          tone="warning"
          title="This plan is archived"
          className="mb-4"
          action={
            <Button size="sm" variant="secondary" icon={ArchiveRestore} onClick={() => onArchive(false)} loading={archive.isPending}>
              Restore plan
            </Button>
          }
        >
          Members already on it keep their copy. Restore it to assign it again.
        </InlineAlert>
      )}

      <form id="diet-plan-form" onSubmit={submit} noValidate className="pb-28">
        <FormError error={save.error} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <Card padding="lg">
              <CardHeader title="Plan details" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Plan name" required error={errors.name} className="sm:col-span-2">
                  <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Veg fat loss, 1,800 kcal" maxLength={100} />
                </Field>
                <Field label="Goal" error={errors.goal}>
                  <Select value={form.goal} onChange={(e) => set({ goal: e.target.value })}>
                    {Object.entries(DIET_GOAL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Diet type" error={errors.dietType}>
                  <Select value={form.dietType} onChange={(e) => set({ dietType: e.target.value })}>
                    {Object.entries(DIET_TYPE).map(([v, meta]) => (
                      <option key={v} value={v}>
                        {meta.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <fieldset className="mt-5">
                <legend className="text-sm font-semibold text-ink">Daily targets</legend>
                <p className="mt-0.5 text-[13px] text-ink-3">Optional. The member sees how close each day gets.</p>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Calories" error={errors["targets.calories"]}>
                    <Input type="number" inputMode="numeric" min="0" value={form.targets.calories} onChange={(e) => setTarget({ calories: e.target.value })} suffix="kcal" />
                  </Field>
                  <Field label="Protein" error={errors["targets.proteinG"]}>
                    <Input type="number" inputMode="decimal" min="0" value={form.targets.proteinG} onChange={(e) => setTarget({ proteinG: e.target.value })} suffix="g" />
                  </Field>
                  <Field label="Carbs" error={errors["targets.carbsG"]}>
                    <Input type="number" inputMode="decimal" min="0" value={form.targets.carbsG} onChange={(e) => setTarget({ carbsG: e.target.value })} suffix="g" />
                  </Field>
                  <Field label="Fat" error={errors["targets.fatG"]}>
                    <Input type="number" inputMode="decimal" min="0" value={form.targets.fatG} onChange={(e) => setTarget({ fatG: e.target.value })} suffix="g" />
                  </Field>
                </div>
              </fieldset>
            </Card>

            <section aria-labelledby="meals-heading" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 id="meals-heading" className="text-[15px] font-semibold text-ink">
                    Meals
                  </h2>
                  <p className="text-[13px] text-ink-3">Leave calories empty to work them out from protein, carbs and fat.</p>
                </div>
                {form.meals.length > 0 && <AddMealMenu used={form.meals.map((m) => m.name.trim().toLowerCase())} onAdd={addMeal} />}
              </div>
              {errors.meals && <p className="text-[13px] font-medium text-bad">{errors.meals}</p>}
              {form.meals.length === 0 ? (
                <Card>
                  <EmptyState
                    compact
                    icon={Salad}
                    title="No meals yet"
                    body="Add breakfast, lunch and dinner, then the foods in each."
                    action={<AddMealMenu used={[]} onAdd={addMeal} variant="primary" />}
                  />
                </Card>
              ) : (
                <ol className="flex flex-col gap-3">
                  {form.meals.map((meal, i) => (
                    <MealEditor
                      key={meal.key}
                      meal={meal}
                      index={i}
                      count={form.meals.length}
                      errors={errors}
                      onChange={(next) => setMeal(i, next)}
                      onRemove={() => removeMeal(i)}
                      onMove={(step) => moveMeal(i, step)}
                    />
                  ))}
                </ol>
              )}
            </section>

            <Card padding="lg">
              <Field label="Notes for the member" optional hint="Shown with the plan, e.g. swaps, cooking tips or when to take water." error={errors.notes}>
                <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} maxLength={2000} />
              </Field>
            </Card>
          </div>

          <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
            <Card>
              <CardHeader title="Day total" description="Adds up the foods above." />
              <div className="flex flex-col gap-3">
                <TargetBar label="Calories" value={totals.calories} target={target("calories")} unit="kcal" />
                <TargetBar label="Protein" value={totals.proteinG} target={target("proteinG")} unit="g" />
                <TargetBar label="Carbs" value={totals.carbsG} target={target("carbsG")} unit="g" />
                <TargetBar label="Fat" value={totals.fatG} target={target("fatG")} unit="g" />
              </div>
              {form.meals.length > 0 && (
                <ul className="mt-4 flex flex-col gap-1 border-t border-line pt-3 text-sm">
                  {form.meals.map((m) => (
                    <li key={m.key} className="flex items-center justify-between gap-3">
                      <span className="truncate text-ink-2">{m.name || "Unnamed meal"}</span>
                      <span className="tabular font-semibold">{formatKcal(draftTotals(m.items).calories)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            {!isNew && plan && <MembersOnPlan plan={plan} canAssign={!plan.archived && plan.meals.length > 0} onAssign={() => setAssigning(true)} />}
          </aside>
        </div>

        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md md:bottom-0 md:left-[76px] md:px-6 xl:left-[var(--kv-rail-w)]">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 xl:px-2">
            <div className="min-w-0 text-sm">
              <p className="tabular font-semibold text-ink">
                {formatKcal(totals.calories)} a day, {formatNumber(totals.proteinG)} g protein
              </p>
              <p className="truncate text-[13px] text-ink-3">
                {!online ? "You're offline. Reconnect to save." : dirty ? "Unsaved changes" : isNew ? "Not saved yet" : "All changes saved"}
              </p>
            </div>
            <Button type="submit" variant="primary" icon={Save} loading={save.isPending} disabled={!online || (!dirty && !isNew)}>
              {isNew ? "Create plan" : "Save plan"}
            </Button>
          </div>
        </div>
      </form>

      {!isNew && plan && <AssignDietDialog open={assigning} onClose={() => setAssigning(false)} plan={plan} />}
    </>
  );
}
