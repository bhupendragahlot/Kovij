import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Ellipsis, IndianRupee, RefreshCw, ScanLine, UserPlus, Users, UserRound } from "lucide-react";
import { useMembers } from "./api";
import { useCheckInFlow } from "../attendance/useCheckInFlow";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  DataTable,
  EmptyState,
  FilterChips,
  IconButton,
  Menu,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
} from "../../shared/ui";
import { formatINR, formatNumber, formatPhone, formatRelativeDay, formatShortDate } from "../../shared/lib/format";

const DEFAULTS = { q: "", state: "all", page: 1 };
const LIMIT = 25;

const STATES = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "expiring", label: "Ending soon" },
  { value: "pending", label: "Awaiting payment" },
  { value: "dues", label: "With dues" },
  { value: "expired", label: "Lapsed" },
  { value: "none", label: "No plan" },
];

function planLine(m) {
  const c = m.current;
  if (!c) return "No plan yet";
  if (m.state === "active" || m.state === "expiring") return `${c.planName}, ends ${formatShortDate(c.endDate)}`;
  if (m.state === "expired") return `${c.planName}, ended ${formatShortDate(c.endDate)}`;
  if (m.state === "upcoming") return `${c.planName}, starts ${formatShortDate(c.startDate)}`;
  return c.planName;
}

export default function MembersPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const { checkIn, dialog: checkInDialog } = useCheckInFlow();

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const query = useMembers({ q: filters.q || undefined, state: filters.state, page: filters.page, limit: LIMIT });
  const data = query.data;
  const counts = data?.counts;
  const isFiltered = Boolean(filters.q) || filters.state !== "all";

  const rowMenu = (m) => (
    <Menu
      label={`Actions for ${m.name}`}
      trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${m.name}`} size="sm" />}
      items={[
        { label: "Check in", icon: ScanLine, onSelect: () => checkIn(m) },
        { label: "Renew or add plan", icon: RefreshCw, to: `/admin/members/${m._id}?action=renew` },
        { label: "Record payment", icon: IndianRupee, to: `/admin/members/${m._id}?action=pay` },
        { type: "separator" },
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
        m.current?.endDate && ["active", "expiring", "expired"].includes(m.state) ? (
          <span className="whitespace-nowrap">
            <span className="text-ink">{formatShortDate(m.current.endDate)}</span>
            <span className="block text-[13px] text-ink-3">{formatRelativeDay(m.current.endDate)}</span>
          </span>
        ) : (
          <span className="text-ink-3">—</span>
        ),
    },
    { id: "status", header: "Status", cell: (m) => <StatusBadge kind="member" status={m.state} /> },
    {
      id: "dues",
      header: "Dues",
      align: "right",
      cell: (m) => (m.dues > 0 ? <span className="font-semibold text-warn">{formatINR(m.dues)}</span> : <span className="text-ink-3">—</span>),
    },
    { id: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: rowMenu },
  ];

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
            <StatusBadge kind="member" status={m.state} size="sm" />
            {m.dues > 0 && <span className="text-xs font-semibold text-warn">{formatINR(m.dues)} due</span>}
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
          <ButtonLink to="/admin/members/new" variant="primary" icon={UserPlus} className="xl:hidden">
            New member
          </ButtonLink>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, phone or member code" label="Search members" className="md:max-w-md" />
        <FilterChips
          label="Filter by status"
          value={filters.state}
          onChange={(state) => setFilters({ state })}
          options={STATES.map((s) => ({ ...s, count: counts?.[s.value] }))}
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
                body={filters.q ? `Nobody matches “${filters.q}” in this list. Try a phone number or clear the filters.` : "No members are in this group right now."}
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setFilters({ q: "", state: "all" });
                    }}
                  >
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
                  <ButtonLink to="/admin/members/new" variant="primary" icon={UserPlus}>
                    Register the first member
                  </ButtonLink>
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
