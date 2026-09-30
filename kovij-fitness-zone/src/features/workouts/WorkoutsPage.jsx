import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Archive,
  ArchiveRestore,
  ClipboardList,
  Copy,
  Dumbbell,
  Ellipsis,
  MessageCircle,
  Phone,
  Plus,
  Send,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useDuplicatePlan, useMyTrainer, useRemovePlan, useSavePlan, useTrainers, useWorkoutPlans, useWorkoutRoster } from "./api";
import { AssignPlanDialog } from "./AssignPlanDialog";
import { LogSessionDialog } from "./LogSessionDialog";
import { LEVEL_LABEL, PLAN_GOAL_LABEL, dayKeyDate, perWeek } from "./labels";
import { selectRole } from "../auth/sessionSlice";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChips,
  IconButton,
  InlineAlert,
  Menu,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  SkeletonList,
  StatusBadge,
  Tabs,
  TabPanel,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { formatPhone, formatRelativeDay, formatRelativeTime, phoneHref } from "../../shared/lib/format";

const DEFAULTS = { tab: "", who: "", plan: "all", q: "", goal: "all", status: "active", page: 1 };
const LIMIT = 25;

// ── Members ────────────────────────────────────────────────────────────────

function MembersTab({ filters, setFilters, myTrainer }) {
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const trainers = useTrainers();
  const [target, setTarget] = useState(null); // { kind: "log"|"assign", member }

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const who = filters.who || (myTrainer ? "mine" : "all");
  const roster = useWorkoutRoster({ who, plan: filters.plan, q: filters.q || undefined, page: filters.page, limit: LIMIT });
  const data = roster.data;

  const whoOptions = [
    myTrainer && { value: "mine", label: "My members" },
    { value: "all", label: "All members" },
    ...(trainers.data || []).filter((t) => t.isActive !== false && t._id !== myTrainer?._id).map((t) => ({ value: t._id, label: t.name })),
    { value: "none", label: "No trainer" },
  ].filter(Boolean);

  const rowMenu = (m) => {
    const tel = phoneHref(m.phone);
    const whatsapp = phoneHref(m.phone, "whatsapp");
    return (
      <Menu
        label={`Actions for ${m.name}`}
        trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${m.name}`} />}
        items={[
          { label: "Log a session", icon: Plus, onSelect: () => setTarget({ kind: "log", member: m }) },
          { label: m.workout ? "Change plan" : "Give a plan", icon: ClipboardList, onSelect: () => setTarget({ kind: "assign", member: m }) },
          { type: "separator" },
          tel && { label: `Call ${formatPhone(m.phone)}`, icon: Phone, href: tel },
          whatsapp && { label: "WhatsApp", icon: MessageCircle, href: whatsapp, external: true },
          { label: "Open profile", icon: UserRound, to: `/admin/members/${m._id}` },
        ]}
      />
    );
  };

  const planCell = (m) =>
    m.workout ? (
      <span className="text-ink-2">{m.workout.name}</span>
    ) : (
      <Badge size="sm" tone="warn" icon={ClipboardList}>
        No plan
      </Badge>
    );

  const lastSession = (m) => (m.lastSessionDay ? `Trained ${formatRelativeDay(dayKeyDate(m.lastSessionDay))}` : "No sessions yet");

  const columns = [
    {
      id: "member",
      header: "Member",
      cell: (m) => (
        <Link to={`/admin/members/${m._id}`} className="flex items-center gap-3">
          <Avatar name={m.name} src={m.profilePhoto} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink group-hover:underline">{m.name}</span>
            <span className="block text-[13px] text-ink-3">{m.memberCode || formatPhone(m.phone)}</span>
          </span>
        </Link>
      ),
    },
    { id: "status", header: "Membership", hideBelow: "lg", cell: (m) => <StatusBadge kind="member" status={m.state} size="sm" /> },
    { id: "trainer", header: "Trainer", hideBelow: "lg", cell: (m) => <span className="text-ink-2">{m.trainer?.name || "—"}</span> },
    { id: "plan", header: "Workout plan", cell: planCell },
    { id: "last", header: "Last session", cell: (m) => <span className="whitespace-nowrap text-ink-2">{lastSession(m)}</span> },
    { id: "visits", header: "Visits (30 days)", align: "right", hideBelow: "xl", cell: (m) => m.visits30 },
    { id: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: rowMenu },
  ];

  const mobileRow = (m) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link to={`/admin/members/${m._id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={m.name} src={m.profilePhoto} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{m.name}</span>
          <span className="block truncate text-[13px] text-ink-2">{m.workout ? m.workout.name : "No workout plan"}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge kind="member" status={m.state} size="sm" />
            {!m.workout && (
              <Badge size="sm" tone="warn" icon={ClipboardList}>
                No plan
              </Badge>
            )}
            <span className="text-xs text-ink-3">{lastSession(m)}</span>
          </span>
        </span>
      </Link>
      {rowMenu(m)}
    </div>
  );

  const counts = data?.counts;

  return (
    <>
      <div className="mb-4 flex flex-col gap-3">
        <FilterChips label="Whose members" value={who} onChange={(v) => setFilters({ who: v })} options={whoOptions} />
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone or member code" label="Search members" className="md:max-w-md md:flex-1" />
          <SegmentedControl
            label="Workout plan"
            value={filters.plan}
            onChange={(plan) => setFilters({ plan })}
            options={[
              { value: "all", label: counts ? `All ${counts.all}` : "All" },
              { value: "on_plan", label: counts ? `On a plan ${counts.on_plan}` : "On a plan" },
              { value: "no_plan", label: counts ? `No plan ${counts.no_plan}` : "No plan" },
            ]}
          />
        </div>
      </div>

      {data?.linked === false && (
        <InlineAlert tone="info" className="mb-4" title="Your login isn't linked to a trainer profile">
          Ask the owner to link it on the Trainers page. Until then, use “All members”.
        </InlineAlert>
      )}

      <Card padding="none" className="overflow-hidden">
        <DataTable
          caption="Members and their workout plans"
          columns={columns}
          rows={data?.items}
          rowTo={(m) => `/admin/members/${m._id}`}
          mobileRow={mobileRow}
          isPending={roster.isPending}
          isFetching={roster.isFetching && roster.isPlaceholderData}
          error={roster.error}
          onRetry={() => roster.refetch()}
          empty={
            filters.q || filters.plan !== "all" ? (
              <EmptyState
                icon={Users}
                title="No members match"
                body="Try another search or filter."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setFilters({ q: "", plan: "all" });
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : who === "mine" ? (
              <EmptyState icon={Users} title="No members assigned to you yet" body="The owner or a manager assigns members to trainers on the Trainers page." />
            ) : who === "none" ? (
              <EmptyState icon={Users} title="Every member has a trainer" body="Nice. New members will show here until they're assigned." />
            ) : (
              <EmptyState icon={Users} title="No members here yet" body="Members appear here once they're registered and assigned." />
            )
          }
        />
        {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
      </Card>

      <LogSessionDialog open={target?.kind === "log"} onClose={() => setTarget(null)} member={target?.member} />
      <AssignPlanDialog
        open={target?.kind === "assign"}
        onClose={() => setTarget(null)}
        member={target?.member}
        currentPlanName={target?.member?.workout?.name}
      />
    </>
  );
}

// ── Plans ──────────────────────────────────────────────────────────────────

function PlanCard({ plan, onGive }) {
  const navigate = useNavigate();
  const duplicate = useDuplicatePlan();
  const remove = useRemovePlan();
  const save = useSavePlan();
  const confirm = useConfirm();
  const toast = useToast();

  const onDuplicate = () =>
    duplicate.mutate(plan._id, {
      onSuccess: (d) => (toast.success("Plan duplicated", { description: d.plan.name }), navigate(`/admin/workouts/${d.plan._id}`)),
      onError: (e) => toast.error("Couldn't duplicate the plan", { description: e.message }),
    });
  const onRemove = async () => {
    const ok = await confirm({
      title: `Remove ${plan.name}?`,
      body: plan.activeMembers
        ? `${plan.activeMembers} ${plan.activeMembers === 1 ? "member is" : "members are"} on it. They keep their copy; the plan is archived.`
        : "If members had it before, it's archived instead of deleted.",
      confirmLabel: "Remove plan",
      tone: "danger",
    });
    if (ok) remove.mutate(plan._id, { onSuccess: (d) => toast.success(d.deleted ? "Plan deleted" : "Plan archived"), onError: (e) => toast.error("Couldn't remove the plan", { description: e.message }) });
  };
  const onRestore = () =>
    save.mutate({ id: plan._id, payload: { archived: false } }, { onSuccess: () => toast.success("Plan restored"), onError: (e) => toast.error("Couldn't restore the plan", { description: e.message }) });

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start gap-2">
        <Link to={`/admin/workouts/${plan._id}`} className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold hover:underline">{plan.name}</p>
          <p className="text-[13px] text-ink-3">Updated {formatRelativeTime(plan.updatedAt)}</p>
        </Link>
        <Menu
          label={`Actions for ${plan.name}`}
          trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${plan.name}`} />}
          items={[
            { label: "Duplicate", icon: Copy, onSelect: onDuplicate },
            { type: "separator" },
            plan.archived
              ? { label: "Restore", icon: ArchiveRestore, onSelect: onRestore }
              : { label: "Remove", icon: plan.activeMembers ? Archive : Trash2, tone: "danger", onSelect: onRemove },
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge size="sm" tone="brand">
          {PLAN_GOAL_LABEL[plan.goal]}
        </Badge>
        <Badge size="sm">{LEVEL_LABEL[plan.level]}</Badge>
        <Badge size="sm">{perWeek(plan.daysPerWeek)}</Badge>
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-ink-2">
        {plan.dayCount} {plan.dayCount === 1 ? "day" : "days"}: {plan.dayNames.join(", ")}
      </p>
      <p className="mt-1 text-[13px] text-ink-3">
        {plan.exerciseCount} {plan.exerciseCount === 1 ? "exercise" : "exercises"}
        {plan.activeMembers ? `, ${plan.activeMembers} ${plan.activeMembers === 1 ? "member" : "members"} on it` : ""}
      </p>
      <div className="mt-auto flex gap-2 pt-4">
        <ButtonLink to={`/admin/workouts/${plan._id}`} variant="quiet">
          Open
        </ButtonLink>
        {!plan.archived && (
          <Button variant="secondary" icon={Send} onClick={() => onGive(plan)} disabled={!plan.exerciseCount}>
            Give to members
          </Button>
        )}
      </div>
    </Card>
  );
}

function PlansTab({ filters, setFilters }) {
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const [giving, setGiving] = useState(null);

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const plans = useWorkoutPlans({ q: filters.q || undefined, goal: filters.goal, status: filters.status, page: filters.page, limit: LIMIT });
  const data = plans.data;
  const filtered = Boolean(filters.q) || filters.goal !== "all";

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search plans" label="Search plans" className="md:max-w-sm md:flex-1" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:items-center">
          <Select aria-label="Goal" value={filters.goal} onChange={(e) => setFilters({ goal: e.target.value })} className="md:w-48">
            <option value="all">Any goal</option>
            {Object.entries(PLAN_GOAL_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <SegmentedControl
            label="Show"
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            options={[
              { value: "active", label: "In use" },
              { value: "archived", label: data?.archivedCount ? `Archived ${data.archivedCount}` : "Archived" },
            ]}
          />
        </div>
      </div>

      {plans.isPending ? (
        <Card>
          <SkeletonList rows={4} />
        </Card>
      ) : plans.isError && !data ? (
        <Card>
          <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
        </Card>
      ) : !data.items.length ? (
        <Card>
          {filtered ? (
            <EmptyState
              icon={Dumbbell}
              title="No plans match"
              body="Try another search or goal."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSearch("");
                    setFilters({ q: "", goal: "all" });
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : filters.status === "archived" ? (
            <EmptyState icon={Archive} title="Nothing archived" body="Plans you remove after members have had them are kept here." />
          ) : (
            <EmptyState
              icon={Dumbbell}
              title="No workout plans yet"
              body="Build a plan once, for example “Beginner full body, 3 days”, then give it to members in a couple of taps."
              action={
                <ButtonLink to="/admin/workouts/new" variant="primary" icon={Plus}>
                  Create the first plan
                </ButtonLink>
              }
            />
          )}
        </Card>
      ) : (
        <>
          <ul className={`grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 ${plans.isFetching && plans.isPlaceholderData ? "opacity-60" : ""}`}>
            {data.items.map((p) => (
              <li key={p._id}>
                <PlanCard plan={p} onGive={setGiving} />
              </li>
            ))}
          </ul>
          <Pagination className="mt-4 rounded-card bg-surface" page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />
        </>
      )}
      <AssignPlanDialog open={Boolean(giving)} onClose={() => setGiving(null)} plan={giving} />
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function WorkoutsPage() {
  const role = useSelector(selectRole);
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const me = useMyTrainer();
  // Trainers land on their members; everyone else on the plan templates.
  const tab = filters.tab || (role === "trainer" ? "members" : "plans");

  const switchTab = (next) => setFilters({ tab: next, q: "", page: 1 });

  return (
    <>
      <PageHeader
        title="Workout plans"
        description={tab === "members" ? "Who is on which plan, and who needs one." : "Build plans once and give them to members."}
        actions={
          <ButtonLink to="/admin/workouts/new" variant="primary" icon={Plus}>
            New plan
          </ButtonLink>
        }
      />
      <Tabs
        label="Workouts sections"
        value={tab}
        onChange={switchTab}
        className="mb-4"
        tabs={[
          { value: "members", label: "Members" },
          { value: "plans", label: "Plans" },
        ]}
      />
      <TabPanel value={tab}>
        {tab === "members" ? (
          me.isPending ? (
            <Card>
              <SkeletonList rows={5} />
            </Card>
          ) : (
            <MembersTab key="members" filters={filters} setFilters={setFilters} myTrainer={me.data} />
          )
        ) : (
          <PlansTab key="plans" filters={filters} setFilters={setFilters} />
        )}
      </TabPanel>
    </>
  );
}
