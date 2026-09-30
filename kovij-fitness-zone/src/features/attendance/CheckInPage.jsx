import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, DoorOpen, Ellipsis, LogIn, LogOut, MonitorSmartphone, QrCode, ScanLine, Search, Undo2, UserPlus } from "lucide-react";
import { useAttendance, useCheckOut, useUndoCheckIn, useUndoCheckOut } from "./api";
import { useCheckInFlow } from "./useCheckInFlow";
import { ScanDialog } from "./ScanDialog";
import { VisitStatusBadge } from "./components";
import { formatDuration } from "./lib";
import { useMembers } from "../members/api";
import { usePermission } from "../auth/permissions";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useIsDesktop } from "../../shared/hooks/useMediaQuery";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { newIdempotencyKey } from "../../shared/lib/apiClient";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  IconButton,
  Menu,
  PageHeader,
  SearchInput,
  SkeletonList,
  StatusBadge,
  Tabs,
  useToast,
} from "../../shared/ui";
import { formatNumber, formatPhone, formatShortDate, formatTime } from "../../shared/lib/format";

/** Check-out with a toast named after the button. */
function useDeskCheckOut() {
  const checkOut = useCheckOut();
  const toast = useToast();
  const run = (visit, name) =>
    checkOut.mutate(
      { attendanceId: visit._id, idempotencyKey: newIdempotencyKey() },
      {
        onSuccess: (res) =>
          toast.success(`${name} checked out`, {
            description: res.alreadyCheckedOut ? `Already left at ${formatTime(res.attendance.checkedOutAt)}` : `In the gym for ${formatDuration(res.attendance.minutesInGym)} today`,
          }),
        onError: (e) => toast.error("Couldn't check out", { description: e.message }),
      }
    );
  return { run, isPending: checkOut.isPending };
}

function SearchPanel({ visitsToday }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const term = useDebouncedValue(q.trim(), 200);
  const online = useOnlineStatus();
  const checkOut = useDeskCheckOut();
  const { checkIn, isPending, dialog } = useCheckInFlow({
    onCheckedIn: () => {
      setQ("");
      inputRef.current?.focus();
    },
  });
  const results = useMembers({ q: term, limit: 8 }, { enabled: term.length >= 2 });
  const members = term.length >= 2 ? results.data?.members || [] : [];

  const onKeyDown = (e) => {
    // Enter checks in the only match, the fastest path at a busy desk.
    const only = members.length === 1 ? members[0] : null;
    if (e.key === "Enter" && only && visitsToday.get(only._id)?.status !== "in") {
      e.preventDefault();
      checkIn(only);
    }
  };

  return (
    <Card padding="lg">
      <SearchInput
        inputRef={inputRef}
        value={q}
        onChange={setQ}
        onKeyDown={onKeyDown}
        autoFocus
        label="Find a member to check in"
        placeholder="Name, phone or member code"
        className="[&_input]:h-14 [&_input]:text-[17px]"
      />
      <p className="mt-2 text-[13px] text-ink-3">When only one member matches, press Enter to check them in.</p>

      <div className="mt-4" aria-live="polite">
        {term.length < 2 ? (
          <EmptyState compact icon={Search} title="Search to check someone in" body="Type at least two letters of a name, or the last digits of a phone number." />
        ) : results.isPending ? (
          <SkeletonList rows={3} />
        ) : results.isError ? (
          <ErrorState compact error={results.error} onRetry={() => results.refetch()} />
        ) : members.length === 0 ? (
          <EmptyState
            compact
            icon={UserPlus}
            title={`No member matches “${term}”`}
            body="Check the spelling, or register them if they are new."
            action={
              <ButtonLink to="/admin/members/new" variant="secondary" icon={UserPlus}>
                Register new member
              </ButtonLink>
            }
          />
        ) : (
          <ul className="-mx-2 flex flex-col gap-1">
            {members.map((m) => {
              const visit = visitsToday.get(m._id);
              const inGym = visit?.status === "in";
              return (
                <li key={m._id} className="flex items-center gap-3 rounded-tile px-2 py-2.5 hover:bg-surface-2">
                  <Avatar name={m.name} src={m.profilePhoto} size="lg" />
                  <Link to={`/admin/members/${m._id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">{m.name}</span>
                    <span className="block truncate text-[13px] text-ink-3">{[m.memberCode, formatPhone(m.phone)].filter(Boolean).join(", ")}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusBadge kind="member" status={m.state} size="sm" />
                      {m.current?.endDate && ["active", "expiring"].includes(m.state) && (
                        <span className="text-xs text-ink-3">until {formatShortDate(m.current.endDate)}</span>
                      )}
                      {inGym && (
                        <Badge tone="good" icon={CircleCheck} size="sm">
                          In at {formatTime(visit.lastInAt || visit.checkedInAt)}
                        </Badge>
                      )}
                      {visit && visit.status === "out" && (
                        <Badge tone="neutral" icon={LogOut} size="sm">
                          Left at {formatTime(visit.checkedOutAt)}
                        </Badge>
                      )}
                    </span>
                  </Link>
                  {inGym ? (
                    <Button variant="secondary" icon={LogOut} onClick={() => checkOut.run(visit, m.name)} disabled={checkOut.isPending || !online} className="max-sm:px-3">
                      Check out
                    </Button>
                  ) : (
                    <Button
                      // Only members who can walk straight in get the loud button; others open the "plan not active" choice.
                      variant={["active", "expiring"].includes(m.state) ? "primary" : "secondary"}
                      icon={visit ? LogIn : ScanLine}
                      onClick={() => checkIn(m)}
                      disabled={isPending || !online}
                      className="max-sm:px-3"
                    >
                      {visit ? "Check in again" : "Check in"}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      {dialog}
    </Card>
  );
}

function TodayList({ attendance }) {
  const undo = useUndoCheckIn();
  const undoOut = useUndoCheckOut();
  const checkOut = useDeskCheckOut();
  const toast = useToast();
  const items = attendance.data?.items || [];
  const inGym = attendance.data?.summary?.inGym;

  return (
    <Card padding="lg">
      <CardHeader
        title="Here today"
        description={attendance.data ? `${formatNumber(attendance.data.total)} checked in so far${inGym != null ? `, ${formatNumber(inGym)} in the gym now` : ""}` : undefined}
        action={
          <Link to="/admin/attendance" className="text-sm font-semibold text-brand-ink hover:underline">
            Full day
          </Link>
        }
      />
      {attendance.isPending ? (
        <SkeletonList rows={5} />
      ) : attendance.isError && !attendance.data ? (
        <ErrorState compact error={attendance.error} onRetry={() => attendance.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState compact icon={DoorOpen} title="No one has checked in yet" body="Check-ins appear here with the time they arrived." />
      ) : (
        <ol className="-mx-2 flex flex-col">
          {items.map((a) => (
            <li key={a._id} className="flex items-center gap-3 rounded-tile px-2 py-2">
              <span className="tabular w-16 shrink-0 text-[13px] font-semibold text-ink-3">{formatTime(a.checkedInAt)}</span>
              <Avatar name={a.memberId.name} src={a.memberId.profilePhoto} size="sm" />
              <span className="min-w-0 flex-1">
                <Link to={`/admin/members/${a.memberId._id}`} className="block truncate text-sm font-semibold text-ink hover:underline">
                  {a.memberId.name}
                </Link>
                {a.checkedOutAt && <span className="block text-[12px] text-ink-3">Left {formatTime(a.checkedOutAt)}, {formatDuration(a.durationMinutes)}</span>}
              </span>
              {a.membershipStatus !== "active" && (
                <Badge tone="warn" size="sm" icon={DoorOpen}>
                  Let in once
                </Badge>
              )}
              {a.status !== "in" && <VisitStatusBadge status={a.status} />}
              <Menu
                label={`Actions for ${a.memberId.name}`}
                trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${a.memberId.name}`} size="sm" />}
                items={[
                  a.status === "in" && { label: "Check out", icon: LogOut, onSelect: () => checkOut.run(a, a.memberId.name) },
                  a.checkedOutAt && {
                    label: "Undo check-out",
                    icon: Undo2,
                    onSelect: () =>
                      undoOut.mutate(a._id, {
                        onSuccess: () => toast.info(`Check-out for ${a.memberId.name} undone`),
                        onError: (e) => toast.error("Couldn't undo", { description: e.message }),
                      }),
                  },
                  {
                    label: "Undo check-in",
                    icon: Undo2,
                    tone: "danger",
                    onSelect: () =>
                      undo.mutate(a._id, {
                        onSuccess: () => toast.info(`Check-in for ${a.memberId.name} undone`),
                        onError: (e) => toast.error("Couldn't undo", { description: e.message }),
                      }),
                  },
                ]}
              />
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export default function CheckInPage() {
  const attendance = useAttendance();
  const isDesktop = useIsDesktop();
  const canCheckIn = usePermission("attendance.checkin");
  const [tab, setTab] = useState("search");
  const [scanOpen, setScanOpen] = useState(false);
  const visitsToday = useMemo(() => new Map((attendance.data?.items || []).map((a) => [a.memberId._id, a])), [attendance.data]);

  return (
    <>
      <PageHeader
        title="Check-in"
        description="Find the member or scan their QR code. Visits are counted once per day."
        actions={
          canCheckIn && (
            <>
              <ButtonLink to="/admin/kiosk" variant="ghost" icon={MonitorSmartphone}>
                Kiosk mode
              </ButtonLink>
              <Button variant="primary" icon={QrCode} onClick={() => setScanOpen(true)}>
                Scan QR
              </Button>
            </>
          )
        }
      />
      {isDesktop ? (
        <div className="grid grid-cols-12 items-start gap-4">
          <div className="col-span-7">
            <SearchPanel visitsToday={visitsToday} />
          </div>
          <div className="col-span-5">
            <TodayList attendance={attendance} />
          </div>
        </div>
      ) : (
        <>
          <Tabs
            label="Check-in views"
            value={tab}
            onChange={setTab}
            className="mb-4"
            tabs={[
              { value: "search", label: "Check in" },
              { value: "today", label: "Here today", count: attendance.data?.total },
            ]}
          />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === "search" ? <SearchPanel visitsToday={visitsToday} /> : <TodayList attendance={attendance} />}
          </div>
        </>
      )}
      {canCheckIn && <ScanDialog open={scanOpen} onClose={() => setScanOpen(false)} />}
    </>
  );
}
