import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, BookOpen, Ellipsis, Pencil, PlayCircle, Plus, Trash2 } from "lucide-react";
import { useExercises, useRemoveExercise, useSaveExercise } from "./api";
import { ExerciseFormDialog } from "./ExerciseFormDialog";
import { CATEGORY_LABEL, EQUIPMENT_LABEL, MUSCLE_LABEL } from "./labels";
import { usePermission } from "../auth/permissions";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChips,
  IconButton,
  Menu,
  PageHeader,
  Pagination,
  SearchInput,
  SegmentedControl,
  Select,
  useConfirm,
  useToast,
} from "../../shared/ui";

const DEFAULTS = { q: "", muscle: "all", equipment: "all", status: "active", page: 1 };
const LIMIT = 50;

function ExerciseBadges({ e }) {
  return (
    <span className="mt-1 flex flex-wrap gap-1.5">
      <Badge size="sm">{CATEGORY_LABEL[e.category]}</Badge>
      {!e.builtIn && (
        <Badge size="sm" tone="brand">
          Added by gym
        </Badge>
      )}
      {e.archived && (
        <Badge size="sm" icon={Archive}>
          Archived
        </Badge>
      )}
    </span>
  );
}

export default function ExerciseLibraryPage() {
  const canManage = usePermission("workouts.manage");
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const save = useSaveExercise();
  const remove = useRemoveExercise();
  const confirm = useConfirm();
  const toast = useToast();

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const query = useExercises(
    { q: filters.q || undefined, muscle: filters.muscle, equipment: filters.equipment, status: filters.status, page: filters.page, limit: LIMIT },
    { enabled: canManage }
  );
  const data = query.data;
  const archivedView = filters.status === "archived";
  const isFiltered = Boolean(filters.q) || filters.muscle !== "all" || filters.equipment !== "all";

  if (!canManage) {
    return (
      <>
        <PageHeader title="Exercise library" />
        <Card>
          <ErrorState error={{ status: 403, message: "The exercise library is for trainers and managers." }} />
        </Card>
      </>
    );
  }

  const onArchive = async (e) => {
    const builtInOrUsed = e.builtIn;
    const ok = await confirm({
      title: builtInOrUsed ? `Archive ${e.name}?` : `Remove ${e.name}?`,
      body: builtInOrUsed
        ? "It won't be offered for new plans. Plans and sessions that already use it keep it. You can restore it any time."
        : "If a plan or session uses it, it's archived instead so history keeps its name.",
      confirmLabel: builtInOrUsed ? "Archive exercise" : "Remove exercise",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(e._id, {
      onSuccess: (d) => toast.success(d.deleted ? `${e.name} deleted` : `${e.name} archived`),
      onError: (err) => toast.error("Couldn't remove the exercise", { description: err.message }),
    });
  };

  const onRestore = (e) =>
    save.mutate(
      { id: e._id, payload: { archived: false } },
      {
        onSuccess: () => toast.success(`${e.name} restored`),
        onError: (err) => toast.error("Couldn't restore the exercise", { description: err.message }),
      }
    );

  const rowMenu = (e) => (
    <Menu
      label={`Actions for ${e.name}`}
      trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${e.name}`} size="sm" />}
      items={[
        { label: "Edit", icon: Pencil, onSelect: () => setEditing(e) },
        e.videoUrl && { label: "Watch video", icon: PlayCircle, href: e.videoUrl, external: true },
        { type: "separator" },
        e.archived
          ? { label: "Restore", icon: ArchiveRestore, onSelect: () => onRestore(e) }
          : { label: e.builtIn ? "Archive" : "Remove", icon: e.builtIn ? Archive : Trash2, tone: "danger", onSelect: () => onArchive(e) },
      ]}
    />
  );

  const columns = [
    {
      id: "name",
      header: "Exercise",
      cell: (e) => (
        <button type="button" onClick={() => setEditing(e)} className="text-left">
          <span className="block font-semibold text-ink hover:underline">{e.name}</span>
          <ExerciseBadges e={e} />
        </button>
      ),
    },
    {
      id: "muscle",
      header: "Muscles",
      cell: (e) => (
        <span className="text-ink-2">
          {MUSCLE_LABEL[e.primaryMuscle]}
          {e.secondaryMuscles?.length ? <span className="block text-[13px] text-ink-3">Also {e.secondaryMuscles.map((m) => MUSCLE_LABEL[m]).join(", ")}</span> : null}
        </span>
      ),
    },
    { id: "equipment", header: "Equipment", cell: (e) => <span className="text-ink-2">{EQUIPMENT_LABEL[e.equipment]}</span> },
    { id: "how", header: "How to do it", hideBelow: "xl", cell: (e) => <span className="line-clamp-2 max-w-md text-[13px] text-ink-3">{e.instructions || "—"}</span> },
    { id: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: rowMenu },
  ];

  const mobileRow = (e) => (
    <div className="flex items-start gap-3 px-4 py-3">
      <button type="button" onClick={() => setEditing(e)} className="min-w-0 flex-1 text-left">
        <span className="block font-semibold text-ink">{e.name}</span>
        <span className="block text-[13px] text-ink-3">
          {MUSCLE_LABEL[e.primaryMuscle]}, {EQUIPMENT_LABEL[e.equipment]}
        </span>
        <ExerciseBadges e={e} />
      </button>
      {rowMenu(e)}
    </div>
  );

  const muscleOptions = [{ value: "all", label: "All" }, ...Object.entries(MUSCLE_LABEL).map(([value, label]) => ({ value, label }))].map((o) => ({
    ...o,
    count: data?.counts?.[o.value] ?? undefined,
  }));

  return (
    <>
      <PageHeader
        title="Exercise library"
        description="Exercises trainers use to build plans. Built-in ones come with instructions; add your own any time."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Add exercise
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <SearchInput value={search} onChange={setSearch} placeholder="Search exercises" label="Search exercises" className="md:max-w-sm md:flex-1" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex md:items-center">
            <Select aria-label="Equipment" value={filters.equipment} onChange={(e) => setFilters({ equipment: e.target.value })} className="md:w-48">
              <option value="all">Any equipment</option>
              {Object.entries(EQUIPMENT_LABEL).map(([v, l]) => (
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
                { value: "archived", label: "Archived" },
              ]}
            />
          </div>
        </div>
        <FilterChips label="Filter by muscle" value={filters.muscle} onChange={(muscle) => setFilters({ muscle })} options={muscleOptions} />
      </div>

      <Card padding="none" className="overflow-hidden">
        <DataTable
          caption="Exercise library"
          columns={columns}
          rows={data?.items}
          mobileRow={mobileRow}
          isPending={query.isPending}
          isFetching={query.isFetching && query.isPlaceholderData}
          error={query.error}
          onRetry={() => query.refetch()}
          empty={
            isFiltered ? (
              <EmptyState
                icon={BookOpen}
                title="No exercises match"
                body={filters.q ? `Nothing called “${filters.q}” here. Add it as your own exercise, or clear the filters.` : "Try another muscle or equipment."}
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSearch("");
                        setFilters({ q: "", muscle: "all", equipment: "all" });
                      }}
                    >
                      Clear filters
                    </Button>
                    {filters.q && !archivedView && (
                      <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                        Add “{filters.q}”
                      </Button>
                    )}
                  </div>
                }
              />
            ) : archivedView ? (
              <EmptyState icon={Archive} title="Nothing archived" body="Exercises you archive are kept here, and can be restored." />
            ) : (
              <EmptyState
                icon={BookOpen}
                title="No exercises yet"
                body="Add the exercises your trainers use."
                action={
                  <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                    Add exercise
                  </Button>
                }
              />
            )
          }
        />
        {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
      </Card>

      <ExerciseFormDialog
        open={creating || Boolean(editing)}
        exercise={editing}
        initialName={creating ? filters.q : ""}
        onClose={() => (setCreating(false), setEditing(null))}
      />
    </>
  );
}
