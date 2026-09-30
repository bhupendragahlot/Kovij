import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, Copy, Ellipsis, Save, Send, Trash2 } from "lucide-react";
import { useDuplicatePlan, useRemovePlan, useSavePlan, useWorkoutPlan } from "./api";
import { AssignPlanDialog } from "./AssignPlanDialog";
import { PlanDaysEditor } from "./PlanDaysEditor";
import { LEVEL_LABEL, PLAN_GOAL_LABEL } from "./labels";
import { countExercises, draftProblems, emptyDay, toDraftDays, toPayloadDays } from "./planDraft";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";
import {
  Button,
  Card,
  CardHeader,
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
  SkeletonList,
  Textarea,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { formatRelativeTime } from "../../shared/lib/format";

const NEW_PLAN = { name: "", goal: "general_fitness", level: "beginner", daysPerWeek: 3, notes: "" };

const detailsOf = (p) => ({ name: p.name, goal: p.goal, level: p.level, daysPerWeek: p.daysPerWeek, notes: p.notes || "" });

function payloadOf(details, days) {
  return { ...details, name: details.name.trim(), daysPerWeek: Number(details.daysPerWeek), notes: details.notes.trim() || undefined, days: toPayloadDays(days) };
}

function BuilderSkeleton() {
  return (
    <div className="flex max-w-3xl flex-col gap-4" role="status" aria-label="Loading plan">
      <Skeleton className="h-8 w-60" />
      <Card>
        <SkeletonList rows={2} />
      </Card>
      <Card>
        <SkeletonList rows={4} />
      </Card>
    </div>
  );
}

export default function WorkoutPlanPage() {
  const { id } = useParams();
  const isNew = id === "new";
  const navigate = useNavigate();
  const query = useWorkoutPlan(isNew ? null : id);
  const save = useSavePlan();
  const duplicate = useDuplicatePlan();
  const remove = useRemovePlan();
  const idempotency = useIdempotencyKey();
  const online = useOnlineStatus();
  const confirm = useConfirm();
  const toast = useToast();

  const [details, setDetails] = useState(NEW_PLAN);
  const [days, setDays] = useState(() => [emptyDay(0)]);
  const [baseline, setBaseline] = useState(null);
  const [loadedId, setLoadedId] = useState(null);
  const [clientErrors, setClientErrors] = useState({});
  const [assignOpen, setAssignOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Start from the saved plan once it arrives (and again when opening another plan).
  useEffect(() => {
    if (isNew) {
      if (loadedId !== "new") {
        const fresh = [emptyDay(0)];
        setDetails(NEW_PLAN);
        setDays(fresh);
        setBaseline(JSON.stringify(payloadOf(NEW_PLAN, fresh)));
        setLoadedId("new");
      }
      return;
    }
    if (query.data && loadedId !== query.data._id) {
      const d = detailsOf(query.data);
      const draft = toDraftDays(query.data.days);
      setDetails(d);
      setDays(draft.length ? draft : [emptyDay(0)]);
      setBaseline(JSON.stringify(payloadOf(d, draft)));
      setLoadedId(query.data._id);
    }
  }, [isNew, query.data, loadedId]);

  const payload = useMemo(() => payloadOf(details, days), [details, days]);
  const dirty = baseline != null && JSON.stringify(payload) !== baseline;
  useUnsavedChangesGuard(dirty && !leaving);

  if (!isNew && query.isPending) return <BuilderSkeleton />;
  if (!isNew && query.isError) {
    return (
      <>
        <PageHeader title="Workout plan" back={{ to: "/admin/workouts?tab=plans", label: "Workout plans" }} />
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} title={query.error?.status === 404 ? "This plan no longer exists" : undefined} />
        </Card>
      </>
    );
  }

  const plan = query.data;
  const archived = plan?.archived;
  const set = (patch) => setDetails((d) => ({ ...d, ...patch }));
  const errors = { ...save.error?.fields, ...clientErrors };
  const exerciseTotal = countExercises(days);

  const submit = (e) => {
    e.preventDefault();
    const problems = draftProblems(days);
    if (!details.name.trim()) problems.name = "Name the plan";
    setClientErrors(problems);
    if (Object.keys(problems).length) {
      toast.error("Check the highlighted fields", { description: "Some details need fixing before the plan can be saved." });
      setTimeout(() => document.querySelector("[aria-invalid=true]")?.focus(), 0);
      return;
    }
    save.mutate(
      { id: isNew ? undefined : id, payload, idempotencyKey: isNew ? idempotency.keyFor(payload) : undefined },
      {
        onSuccess: (data) => {
          idempotency.reset();
          const saved = data.plan;
          const d = detailsOf(saved);
          const draft = toDraftDays(saved.days);
          setDetails(d);
          setDays(draft);
          setBaseline(JSON.stringify(payloadOf(d, draft)));
          setLoadedId(saved._id);
          toast.success(isNew ? "Plan created" : "Plan saved");
          // Navigate after the unsaved-changes guard sees the new baseline.
          if (isNew) setTimeout(() => navigate(`/admin/workouts/${saved._id}`, { replace: true }), 0);
        },
        onError: (err) => {
          if (err.code !== "VALIDATION_ERROR") return;
          setTimeout(() => document.querySelector("[aria-invalid=true]")?.focus(), 0);
        },
      }
    );
  };

  const onDuplicate = () =>
    duplicate.mutate(id, {
      onSuccess: (data) => {
        toast.success("Plan duplicated", { description: data.plan.name });
        navigate(`/admin/workouts/${data.plan._id}`);
      },
      onError: (err) => toast.error("Couldn't duplicate the plan", { description: err.message }),
    });

  const onRemove = async () => {
    const ok = await confirm({
      title: `Remove ${plan.name}?`,
      body: plan.activeMembers
        ? `${plan.activeMembers} ${plan.activeMembers === 1 ? "member is" : "members are"} on this plan. They keep their copy. The plan is archived so their history still shows where it came from.`
        : "If members have had this plan before, it's archived instead of deleted.",
      confirmLabel: "Remove plan",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(id, {
      onSuccess: (data) => {
        toast.success(data.deleted ? "Plan deleted" : "Plan archived");
        setLeaving(true);
        setTimeout(() => navigate("/admin/workouts?tab=plans"), 0);
      },
      onError: (err) => toast.error("Couldn't remove the plan", { description: err.message }),
    });
  };

  const onRestore = () =>
    save.mutate(
      { id, payload: { archived: false } },
      { onSuccess: () => toast.success("Plan restored"), onError: (err) => toast.error("Couldn't restore the plan", { description: err.message }) }
    );

  const canGive = !isNew && !archived && !dirty && exerciseTotal > 0;

  return (
    <>
      <PageHeader
        title={isNew ? "New workout plan" : plan.name}
        description={isNew ? "Build the days once, then give the plan to as many members as you like." : `Updated ${formatRelativeTime(plan.updatedAt)}`}
        back={{ to: "/admin/workouts?tab=plans", label: "Workout plans" }}
        actions={
          !isNew && (
            <>
              <Button variant="primary" icon={Send} onClick={() => setAssignOpen(true)} disabled={!canGive}>
                Give to members
              </Button>
              <Menu
                label="More plan actions"
                trigger={(props) => <IconButton {...props} icon={Ellipsis} label="More plan actions" variant="secondary" />}
                items={[
                  { label: "Duplicate plan", icon: Copy, onSelect: onDuplicate },
                  archived ? { label: "Restore plan", icon: ArchiveRestore, onSelect: onRestore } : { label: "Remove plan", icon: plan.activeMembers ? Archive : Trash2, tone: "danger", onSelect: onRemove },
                ]}
              />
            </>
          )
        }
      />

      <form onSubmit={submit} noValidate className="max-w-3xl pb-24">
        <div className="flex flex-col gap-4">
          {archived && (
            <InlineAlert tone="warning" title="This plan is archived" action={<Button size="sm" variant="secondary" icon={ArchiveRestore} onClick={onRestore}>Restore plan</Button>}>
              It can't be given to members until you restore it.
            </InlineAlert>
          )}
          {!isNew && plan.activeMembers > 0 && (
            <InlineAlert tone="info">
              {plan.activeMembers} {plan.activeMembers === 1 ? "member is" : "members are"} on this plan. Saving changes here doesn't change their copies; give the plan again to update them.
            </InlineAlert>
          )}
          {!isNew && dirty && exerciseTotal > 0 && !archived && <p className="text-[13px] text-ink-3">Save your changes to give this plan to members.</p>}
          <FormError error={save.error} />

          <Card padding="lg">
            <CardHeader title="Plan details" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Plan name" error={errors.name} required className="sm:col-span-2">
                <Input value={details.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} placeholder="e.g. Beginner full body" />
              </Field>
              <Field label="Goal" error={errors.goal}>
                <Select value={details.goal} onChange={(e) => set({ goal: e.target.value })}>
                  {Object.entries(PLAN_GOAL_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sessions a week" error={errors.daysPerWeek} hint="The days below repeat in order.">
                <Select value={details.daysPerWeek} onChange={(e) => set({ daysPerWeek: Number(e.target.value) })}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "session" : "sessions"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Level" error={errors.level} className="sm:col-span-2">
                <Select value={details.level} onChange={(e) => set({ level: e.target.value })}>
                  {Object.entries(LEVEL_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Notes for members" optional error={errors.notes} className="sm:col-span-2" hint="Warm-up, how to progress, what to do on rest days.">
                <Textarea value={details.notes} onChange={(e) => set({ notes: e.target.value })} rows={3} maxLength={2000} />
              </Field>
            </div>
          </Card>

          <PlanDaysEditor days={days} onChange={setDays} errors={errors} />
        </div>

        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md md:bottom-0 md:left-[76px] md:px-6 xl:left-[var(--kv-rail-w)]">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 xl:px-2">
            <p className="hidden text-sm text-ink-3 sm:block" aria-live="polite">
              {!online
                ? "You're offline. Reconnect to save."
                : `${days.length} ${days.length === 1 ? "day" : "days"}, ${exerciseTotal} ${exerciseTotal === 1 ? "exercise" : "exercises"}${dirty ? ", not saved yet" : isNew ? "" : ", all changes saved"}`}
            </p>
            <Button type="submit" variant="primary" size="lg" icon={Save} loading={save.isPending} disabled={!online || (!dirty && !isNew)} className="max-sm:w-full">
              {isNew ? "Create plan" : "Save plan"}
            </Button>
          </div>
        </div>
      </form>

      {!isNew && plan && <AssignPlanDialog open={assignOpen} onClose={() => setAssignOpen(false)} plan={{ _id: plan._id, name: plan.name }} />}
    </>
  );
}
