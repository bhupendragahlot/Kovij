import { useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight, CircleCheck, Ellipsis, Minus, Pencil, Plus, Ruler, Trash2, TriangleAlert } from "lucide-react";
import { useDeleteEntry, useProgress } from "./api";
import { BMI_TONE, METRIC, METRICS, dayToDate, formatChange, formatMeasure, goodDirection } from "./labels";
import { EntryDialog } from "./EntryDialog";
import { ProgressChart } from "./ProgressChart";
import { PhotosSection } from "./PhotosSection";
import { usePermission } from "../auth/permissions";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Badge, Button, Card, DataTable, EmptyState, ErrorState, IconButton, Menu, SegmentedControl, Skeleton, useConfirm, useToast } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatDate, formatShortDate } from "../../shared/lib/format";

/**
 * OWNER: diet, progress & notes module. Member profile tab: "Progress".
 * Weight, BMI, body fat and tape measurements over time, plus private progress photos.
 * Reading needs members.health.view; recording needs progress.manage.
 */

/** Change with an arrow and words; coloured only when the member's goal says which way is good. */
function Change({ value, unit, good, className }) {
  if (value == null) return null;
  const Arrow = value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const dir = value === 0 ? null : value > 0 ? "up" : "down";
  const tone = !good || !dir ? "text-ink-3" : dir === good ? "text-good" : "text-bad";
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[13px] font-semibold", tone, className)}>
      <Arrow className="size-3.5 shrink-0" aria-hidden strokeWidth={2.6} />
      {formatChange(value, unit)}
    </span>
  );
}

function StatTile({ label, children, sub }) {
  return (
    <div className="flex min-w-0 flex-col rounded-card border border-transparent bg-surface p-4 dark:border-line">
      <p className="text-sm font-semibold text-ink-2">{label}</p>
      <div className="mt-1.5 min-w-0">{children}</div>
      {sub && <div className="mt-1 text-[13px] text-ink-3">{sub}</div>}
    </div>
  );
}

function SummaryTiles({ summary, goal }) {
  const since = summary.firstDay ? `since ${formatShortDate(dayToDate(summary.firstDay))}` : "";
  const tile = (key) => {
    const meta = METRIC[key];
    const latest = summary.latest[key];
    const change = summary.change[key];
    return (
      <StatTile
        key={key}
        label={meta.label}
        sub={
          latest == null ? (
            "Not recorded yet"
          ) : change != null ? (
            <span className="flex flex-wrap items-center gap-x-1">
              <Change value={change} unit={meta.unit} good={goodDirection(key, goal)} /> {since}
            </span>
          ) : (
            `On ${formatShortDate(dayToDate(summary.latestDays[key]))}`
          )
        }
      >
        <p className="text-2xl font-bold tracking-tight text-ink">{latest == null ? "–" : formatMeasure(latest, meta.unit)}</p>
      </StatTile>
    );
  };
  const band = summary.bmiCategory;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tile("weightKg")}
      <StatTile
        label="BMI"
        sub={band ? `${band.label} range is ${band.range}. BMI can't tell muscle from fat.` : summary.heightCm ? "Add a weight to work it out" : "Needs height and weight"}
      >
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-2xl font-bold tracking-tight text-ink">{summary.bmi ?? "–"}</p>
          {band && (
            <Badge size="sm" tone={BMI_TONE[band.key]} icon={band.key === "healthy" ? CircleCheck : TriangleAlert}>
              {band.label}
            </Badge>
          )}
        </div>
      </StatTile>
      {tile("bodyFatPct")}
      {tile("waistCm")}
    </div>
  );
}

function TabSkeleton() {
  return (
    <div className="flex flex-col gap-4" role="status" aria-label="Loading progress">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-card" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-card" />
    </div>
  );
}

export default function MemberProgressTab({ member, profile }) {
  const canView = usePermission("members.health.view");
  const canManage = usePermission("progress.manage");
  const progress = useProgress(member._id, { enabled: canView });
  const remove = useDeleteEntry(member._id);
  const online = useOnlineStatus();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [changeFrom, setChangeFrom] = useState("previous");
  const goal = profile?.fitnessGoal?.goalKind;

  if (!canView) {
    return (
      <Card>
        <ErrorState error={{ status: 403, message: "Measurements and photos are health information. Your role can't see them." }} />
      </Card>
    );
  }
  if (progress.isPending) return <TabSkeleton />;
  if (progress.isError && !progress.data) {
    return (
      <Card>
        <ErrorState error={progress.error} onRetry={() => progress.refetch()} />
      </Card>
    );
  }

  const { summary, entries, defaults } = progress.data;
  const shown = METRICS.filter((m) => entries.some((e) => e[m.key] != null));
  const deltaKey = changeFrom === "first" ? "sinceFirst" : "sincePrevious";

  const onDelete = async (entry) => {
    const ok = await confirm({ title: `Delete the entry from ${formatDate(dayToDate(entry.day))}?`, body: "This can't be undone.", confirmLabel: "Delete entry", tone: "danger" });
    if (!ok) return;
    remove.mutate(entry._id, {
      onSuccess: () => toast.success("Entry deleted"),
      onError: (e) => toast.error("Couldn't delete the entry", { description: e.message }),
    });
  };

  const valueCell = (e, m) =>
    e[m.key] == null ? (
      <span className="text-ink-3">–</span>
    ) : (
      <span className="flex flex-col items-end">
        <span className="font-semibold">{formatMeasure(e[m.key], m.unit)}</span>
        <Change value={e[deltaKey]?.[m.key]} unit={m.unit} good={goodDirection(m.key, goal)} className="text-xs" />
      </span>
    );

  const HIDE = { chestCm: "lg", hipsCm: "lg", bicepsCm: "xl", thighsCm: "xl", neckCm: "xl", calvesCm: "xl" };
  const columns = [
    {
      id: "day",
      header: "Date",
      cell: (e) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap font-semibold">{formatDate(dayToDate(e.day))}</span>
          <span className="text-xs text-ink-3">{e.recordedByKind === "member" ? "By the member" : e.recordedByName ? `By ${e.recordedByName}` : ""}</span>
        </span>
      ),
    },
    ...shown.map((m) => ({ id: m.key, header: m.unit ? `${m.label} (${m.unit})` : m.label, align: "right", hideBelow: HIDE[m.key], cell: (e) => valueCell(e, m) })),
    canManage && {
      id: "actions",
      // Positioned wrapper keeps the visually hidden label inside the table's scroll area.
      header: (
        <span className="relative">
          <span className="sr-only">Actions</span>
        </span>
      ),
      align: "right",
      cell: (e) => (
        <Menu
          label={`Entry from ${formatDate(dayToDate(e.day))}`}
          trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for the entry from ${formatDate(dayToDate(e.day))}`} size="sm" />}
          items={[
            { label: "Edit entry", icon: Pencil, onSelect: () => setEditing(e), disabled: !online },
            { label: "Delete entry", icon: Trash2, tone: "danger", onSelect: () => onDelete(e), disabled: !online },
          ]}
        />
      ),
    },
  ].filter(Boolean);

  const mobileRow = (e) => {
    const main = ["weightKg", "bmi", "bodyFatPct", "waistCm"].filter((k) => e[k] != null);
    const rest = METRICS.filter((m) => !main.includes(m.key) && e[m.key] != null);
    const body = (
      <>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{formatDate(dayToDate(e.day))}</span>
          <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {main.map((k) => (
              <span key={k} className="inline-flex flex-wrap items-baseline gap-x-1">
                <span className="text-ink-3">{METRIC[k].label}</span>
                <span className="font-semibold">{formatMeasure(e[k], METRIC[k].unit)}</span>
                <Change value={e[deltaKey]?.[k]} unit={METRIC[k].unit} good={goodDirection(k, goal)} className="text-xs" />
              </span>
            ))}
          </span>
          {rest.length > 0 && <span className="mt-1 block text-[13px] text-ink-3">{rest.map((m) => `${m.label} ${formatMeasure(e[m.key], m.unit)}`).join(", ")}</span>}
        </span>
        {canManage && <ChevronRight className="mt-1 size-4 shrink-0 text-ink-3" aria-hidden />}
      </>
    );
    return canManage ? (
      <button type="button" onClick={() => setEditing(e)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2" aria-label={`Edit the entry from ${formatDate(dayToDate(e.day))}`}>
        {body}
      </button>
    ) : (
      <div className="flex items-start gap-3 px-4 py-3">{body}</div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-3">
          {summary.entries ? `${summary.entries} ${summary.entries === 1 ? "entry" : "entries"} since ${formatDate(dayToDate(summary.firstDay))}` : "No measurements yet"}
        </p>
        {canManage && (
          <Button variant="primary" icon={Plus} onClick={() => setEditing({})} disabled={!online}>
            Add entry
          </Button>
        )}
      </div>

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            icon={Ruler}
            title="No measurements yet"
            body="Record weight and a few tape measurements every 2 to 4 weeks, on the same scale and at the same time of day."
            action={
              canManage && (
                <Button variant="primary" icon={Plus} onClick={() => setEditing({})} disabled={!online}>
                  Add entry
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <SummaryTiles summary={summary} goal={goal} />
          <Card>
            <ProgressChart entries={entries} />
          </Card>
          <Card padding="none" className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 md:px-5">
              <h2 className="text-[15px] font-semibold leading-6 text-ink">Measurements</h2>
              <SegmentedControl
                label="Show change since"
                size="sm"
                value={changeFrom}
                onChange={setChangeFrom}
                options={[
                  { value: "previous", label: "Since last" },
                  { value: "first", label: "Since first" },
                ]}
              />
            </div>
            <DataTable caption={`Measurements for ${member.name}`} columns={columns} rows={entries} mobileRow={mobileRow} />
          </Card>
        </>
      )}

      <PhotosSection memberId={member._id} entries={entries} canManage={canManage} />

      <EntryDialog
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        memberId={member._id}
        entry={editing?._id ? editing : null}
        entries={entries}
        defaultHeightCm={defaults.heightCm}
        onEditExisting={(existing) => setEditing(existing)}
      />
    </div>
  );
}
