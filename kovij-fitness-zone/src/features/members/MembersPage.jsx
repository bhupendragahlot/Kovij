import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Ellipsis, IndianRupee, RefreshCw, ScanLine, SlidersHorizontal, UserPlus, Users, UserRound, X } from "lucide-react";
import { downloadMembersCsv, useMembers } from "./api";
import { MemberStateBadge } from "./StatusBadges";
import { trainersResource } from "../catalog/api";
import { useCheckInFlow } from "../attendance/useCheckInFlow";
import { usePermission } from "../auth/permissions";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  Field,
  FilterChips,
  IconButton,
  Input,
  Menu,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  useToast,
} from "../../shared/ui";
import { formatDate, formatINR, formatNumber, formatPhone, formatRelativeDay, formatShortDate, gymDayKey } from "../../shared/lib/format";

const DEFAULTS = { q: "", state: "all", page: 1, joinedFrom: "", joinedTo: "", trainerId: "" };
const LIMIT = 25;

const STATES = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expiring", label: "Ending soon" },
  { value: "paused", label: "Frozen" },
  { value: "pending", label: "Awaiting payment" },
  { value: "dues", label: "With dues", money: true },
  { value: "expired", label: "Lapsed" },
  { value: "none", label: "No plan" },
];

function planLine(m) {
  const c = m.current;
  if (!c) return "No plan yet";
  if (m.state === "active" || m.state === "expiring") return `${c.planName}, ends ${formatShortDate(c.endDate)}`;
  if (m.state === "paused") return `${c.planName}, frozen until ${formatShortDate(c.freeze?.endDate)}`;
  if (m.state === "expired") return `${c.planName}, ended ${formatShortDate(c.endDate)}`;
  if (m.state === "upcoming") return `${c.planName}, starts ${formatShortDate(c.startDate)}`;
  return c.planName;
}

/** Joined-date range and trainer. Lives in the URL like the other filters. */
function MoreFilters({ filters, setFilters, trainers }) {
  const today = gymDayKey();
  return (
    <div className="grid grid-cols-1 gap-3 rounded-card bg-surface p-4 sm:grid-cols-3 dark:border dark:border-line">
      <Field label="Joined from">
        <Input type="date" value={filters.joinedFrom} max={filters.joinedTo || today} onChange={(e) => setFilters({ joinedFrom: e.target.value })} />
      </Field>
      <Field label="Joined until">
        <Input type="date" value={filters.joinedTo} min={filters.joinedFrom || undefined} max={today} onChange={(e) => setFilters({ joinedTo: e.target.value })} />
      </Field>
      <Field label="Trainer">
        <Select value={filters.trainerId} onChange={(e) => setFilters({ trainerId: e.target.value })} disabled={!trainers}>
          <option value="">Any trainer</option>
          <option value="none">No trainer assigned</option>
          {(trainers || []).map((t) => (
            <option key={t._id} value={t._id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

export default function MembersPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const { checkIn, dialog: checkInDialog } = useCheckInFlow();
  const canSeeMoney = usePermission("payments.view");
  const canCollect = usePermission("payments.collect");
  const canSell = usePermission("memberships.sell");
  const canCheckIn = usePermission("attendance.checkin");
  const canRegister = usePermission("members.edit");
  const online = useOnlineStatus();
  const toast = useToast();
  const extraCount = [filters.joinedFrom, filters.joinedTo, filters.trainerId].filter(Boolean).length;
  const [showMore, setShowMore] = useState(extraCount > 0);
  const [exporting, setExporting] = useState(false);
  const trainers = trainersResource.useList({ enabled: showMore });

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const state = !canSeeMoney && filters.state === "dues" ? "all" : filters.state;
  const listFilters = {
    q: filters.q || undefined,
    state,
    joinedFrom: filters.joinedFrom || undefined,
    joinedTo: filters.joinedTo || undefined,
    trainerId: filters.trainerId || undefined,
  };
  const query = useMembers({ ...listFilters, page: filters.page, limit: LIMIT });
  const data = query.data;
  const counts = data?.counts;
  const isFiltered = Boolean(filters.q) || state !== "all" || extraCount > 0;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const n = await downloadMembersCsv(listFilters);
      toast.success("List exported", { description: `${formatNumber(n)} ${n === 1 ? "member" : "members"} in the spreadsheet. It has no health details.` });
    } catch (e) {
      toast.error("Couldn't export the list", { description: e.message });
    } finally {
      setExporting(false);
    }
  };

  const clearAll = () => {
    setSearch("");
    setFilters({ q: "", state: "all", joinedFrom: "", joinedTo: "", trainerId: "" });
  };

  const rowMenu = (m) => (
    <Menu
      label={`Actions for ${m.name}`}
      trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${m.name}`} size="sm" />}
      items={[
        canCheckIn && { label: "Check in", icon: ScanLine, onSelect: () => checkIn(m) },
        canSell && { label: "Renew or add plan", icon: RefreshCw, to: `/admin/members/${m._id}?action=renew` },
        canCollect && { label: "Record payment", icon: IndianRupee, to: `/admin/members/${m._id}?action=pay` },
        (canCheckIn || canSell || canCollect) && { type: "separator" },
        { label: "Open profile", icon: UserRound, to: `/admin/members/${m._id}` },
      ]}
    />
  );

  const columns = [
    {
      id: "member",
      header: "Member",
      cell: (m) => (
        <Link to={`/admin/members/${m._id}`} className="flex items-center gap-3">
          <Avatar name={m.name} src={m.profilePhoto} />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink group-hover:underline">{m.name}</span>
            <span className="block text-[13px] text-ink-3">{m.memberCode || "No code"}</span>
          </span>
        </Link>
      ),
    },
    { id: "phone", header: "Phone", hideBelow: "lg", cell: (m) => <span className="tabular text-ink-2">{formatPhone(m.phone) || "—"}</span> },
    { id: "plan", header: "Plan", cell: (m) => <span className="text-ink-2">{m.current?.planName || "—"}</span> },
    {
      id: "ends",
      header: "Ends",
      hideBelow: "lg",
      cell: (m) =>
        m.current?.endDate && ["active", "expiring", "expired", "paused"].includes(m.state) ? (
          <span className="whitespace-nowrap">
            <span className="text-ink">{formatShortDate(m.current.endDate)}</span>
            <span className="block text-[13px] text-ink-3">{formatRelativeDay(m.current.endDate)}</span>
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    { id: "joined", header: "Joined", hideBelow: "xl", cell: (m) => <span className="whitespace-nowrap text-ink-2">{formatDate(m.joinedOn || m.joinedAt || m.createdAt)}</span> },
    { id: "status", header: "Status", cell: (m) => <MemberStateBadge status={m.state} /> },
    canSeeMoney && {
      id: "dues",
      header: "Dues",
      align: "right",
      cell: (m) => (m.dues > 0 ? <span className="font-semibold text-warn">{formatINR(m.dues)}</span> : <span className="text-ink-3">—</span>),
    },
    { id: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: rowMenu },
  ].filter(Boolean);

  const mobileRow = (m) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link to={`/admin/members/${m._id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={m.name} src={m.profilePhoto} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold text-ink">{m.name}</span>
          </span>
          <span className="block truncate text-[13px] text-ink-3">{planLine(m)}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <MemberStateBadge status={m.state} size="sm" />
            {canSeeMoney && m.dues > 0 && <span className="text-xs font-semibold text-warn">{formatINR(m.dues)} due</span>}
          </span>
        </span>
      </Link>
      {rowMenu(m)}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Members"
        description={counts ? `${formatNumber(counts.all)} registered, ${formatNumber(counts.active + counts.expiring)} with an active plan` : "Everyone registered at the gym"}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportCsv} loading={exporting} disabled={!online || !data?.total}>
              Export
            </Button>
            {canRegister && (
              <ButtonLink to="/admin/members/new" variant="primary" icon={UserPlus} className="xl:hidden">
                New member
              </ButtonLink>
            )}
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone or member code" label="Search members" className="min-w-0 flex-1 md:max-w-md md:flex-none md:basis-[28rem]" />
          <Button variant={extraCount ? "quiet" : "secondary"} icon={SlidersHorizontal} onClick={() => setShowMore((v) => !v)} aria-expanded={showMore} aria-controls="member-more-filters">
            <span className="max-sm:sr-only">Filters</span>
            {extraCount > 0 && <span className="tabular rounded-full bg-ink px-1.5 text-xs text-canvas">{extraCount}</span>}
          </Button>
          {extraCount > 0 && (
            <IconButton icon={X} label="Clear joined date and trainer filters" variant="ghost" onClick={() => setFilters({ joinedFrom: "", joinedTo: "", trainerId: "" })} />
          )}
        </div>
        {showMore && (
          <div id="member-more-filters">
            <MoreFilters filters={filters} setFilters={setFilters} trainers={trainers.isError ? null : trainers.data} />
          </div>
        )}
        <FilterChips
          label="Filter by status"
          value={state}
          onChange={(s) => setFilters({ state: s })}
          options={STATES.filter((s) => !s.money || canSeeMoney).map((s) => ({ value: s.value, label: s.label, count: counts?.[s.value] }))}
        />
      </div>

      <Card padding="none" className="overflow-hidden">
        <DataTable
          caption="Members"
          columns={columns}
          rows={data?.members}
          rowTo={(m) => `/admin/members/${m._id}`}
          mobileRow={mobileRow}
          isPending={query.isPending}
          isFetching={query.isFetching && query.isPlaceholderData}
          error={query.error}
          onRetry={() => query.refetch()}
          empty={
            isFiltered ? (
              <EmptyState
                icon={Users}
                title="No members match"
                body={filters.q ? `Nobody matches “${filters.q}” with these filters. Try a phone number or clear the filters.` : "No members are in this group right now."}
                action={
                  <Button variant="secondary" onClick={clearAll}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No members yet"
                body="Register walk-ins at the desk, or share the join link so people can sign up online."
                action={
                  canRegister && (
                    <ButtonLink to="/admin/members/new" variant="primary" icon={UserPlus}>
                      Register the first member
                    </ButtonLink>
                  )
                }
              />
            )
          }
        />
        {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
      </Card>
      {checkInDialog}
    </>
  );
}
