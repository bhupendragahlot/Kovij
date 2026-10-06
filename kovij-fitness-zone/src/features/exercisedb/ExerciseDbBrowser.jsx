import { useState } from "react";
import { SearchX } from "lucide-react";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { Button, EmptyState, ErrorState, InlineAlert, SearchInput, Select, Skeleton } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatNumber } from "../../shared/lib/format";
import { ExerciseDbMedia } from "./ExerciseDbMedia";
import { cap, exerciseFacts } from "./format";

const NO_FILTERS = { bodyPart: "", muscle: "", equipment: "", type: "" };
/** The server accepts letters, numbers and a little punctuation in a search. */
const cleanSearch = (s) =>
  s
    .replace(/[^\p{L}\p{N} '&./()-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

function ExerciseTile({ exercise: e, onOpen, action, layout }) {
  if (layout === "list") {
    return (
      <div className="flex items-center gap-3 py-2.5">
        <button type="button" onClick={() => onOpen?.(e)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ExerciseDbMedia src={e.thumbUrl || e.gifUrl} className="size-14 shrink-0 rounded-tile border border-line" iconClassName="size-5" />
          <span className="min-w-0">
            <span className="block truncate font-semibold text-ink hover:underline">{e.name}</span>
            <span className="block truncate text-[13px] text-ink-3">{exerciseFacts(e)}</span>
          </span>
        </button>
        {action}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface">
      <button type="button" onClick={() => onOpen?.(e)} className="group flex flex-1 flex-col text-left">
        <ExerciseDbMedia src={e.thumbUrl || e.gifUrl} className="aspect-square w-full border-b border-line" />
        <span className="flex flex-1 flex-col gap-1 p-3">
          <span className="font-semibold leading-snug text-ink group-hover:underline">{e.name}</span>
          <span className="text-[13px] text-ink-3">{exerciseFacts(e)}</span>
        </span>
      </button>
      {action && <div className="px-3 pb-3">{action}</div>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options, anyLabel }) {
  if (!options?.length) return null;
  return (
    <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{anyLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {cap(o)}
        </option>
      ))}
    </Select>
  );
}

/**
 * Search and filter ExerciseDB. `api` supplies the data hooks (staff or member):
 *   { useFilters(), useSearch(params) }   (useSearch is an infinite query over cursor pages)
 * `renderAction(exercise)` adds a button under each result (e.g. "Add"); `onOpen` opens details.
 */
export function ExerciseDbBrowser({ api, onOpen, renderAction, layout = "grid", autoFocus = false, className }) {
  const [search, setSearch] = useState("");
  const [f, setF] = useState(NO_FILTERS);
  const q = useDebouncedValue(cleanSearch(search), 400);
  const filters = api.useFilters();
  const params = {
    q: q || undefined,
    bodyPart: f.bodyPart || undefined,
    muscle: f.muscle || undefined,
    equipment: f.equipment || undefined,
    type: f.type || undefined,
  };
  const results = api.useSearch(params);
  const pages = results.data?.pages || [];
  const items = pages.flatMap((p) => p.items);
  const total = pages[0]?.total ?? 0;
  const filtered = Boolean(q) || Object.values(f).some(Boolean);
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const clear = () => (setSearch(""), setF(NO_FILTERS));
  const fl = filters.data;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-col gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search exercises, e.g. bench press" label="Search ExerciseDB" autoFocus={autoFocus} />
        {filters.isError ? (
          <p className="text-[13px] text-ink-3">
            Filters didn’t load.{" "}
            <button type="button" className="font-semibold text-brand-ink hover:underline" onClick={() => filters.refetch()}>
              Try again
            </button>
          </p>
        ) : (
          <div className={cn("grid grid-cols-1 gap-2 sm:grid-cols-2", layout === "grid" && "lg:grid-cols-4")}>
            {filters.isPending ? (
              [0, 1, 2].map((i) => <Skeleton key={i} className="h-11 rounded-control md:h-10" />)
            ) : (
              <>
                <FilterSelect
                  label="Body part"
                  anyLabel="Any body part"
                  value={f.bodyPart}
                  onChange={(bodyPart) => set({ bodyPart })}
                  options={fl?.bodyParts}
                />
                <FilterSelect
                  label="Target muscle"
                  anyLabel="Any target muscle"
                  value={f.muscle}
                  onChange={(muscle) => set({ muscle })}
                  options={fl?.targetMuscles}
                />
                <FilterSelect
                  label="Equipment"
                  anyLabel="Any equipment"
                  value={f.equipment}
                  onChange={(equipment) => set({ equipment })}
                  options={fl?.equipments}
                />
                <FilterSelect label="Exercise type" anyLabel="Any type" value={f.type} onChange={(type) => set({ type })} options={fl?.exerciseTypes} />
              </>
            )}
          </div>
        )}
      </div>

      {results.isPending ? (
        <div
          className={layout === "grid" ? "grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4" : "flex flex-col gap-3"}
          aria-busy="true"
          aria-label="Loading exercises"
        >
          {Array.from({ length: layout === "grid" ? 8 : 4 }, (_, i) => (
            <Skeleton key={i} className={layout === "grid" ? "aspect-[3/4] rounded-card" : "h-16 rounded-tile"} />
          ))}
        </div>
      ) : results.isError && !items.length ? (
        <ErrorState compact error={results.error} title="Couldn't search the exercise library" onRetry={() => results.refetch()} />
      ) : !items.length ? (
        <EmptyState
          compact
          icon={SearchX}
          title="No exercises match"
          body={q ? `Nothing in ExerciseDB matches “${q}” with these filters.` : "Try another body part, muscle or equipment."}
          action={
            filtered && (
              <Button variant="secondary" onClick={clear}>
                Clear search and filters
              </Button>
            )
          }
        />
      ) : (
        <div className={cn("transition-opacity", results.isFetching && !results.isFetchingNextPage && "opacity-60")}>
          <p className="mb-2 text-[13px] text-ink-3" aria-live="polite">
            {total === 1 ? "1 exercise" : `${formatNumber(total)} exercises`}
            {filtered ? " match" : " in ExerciseDB"}
          </p>
          {layout === "grid" ? (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
              {items.map((e) => (
                <li key={e.id}>
                  <ExerciseTile exercise={e} onOpen={onOpen} action={renderAction?.(e)} layout="grid" />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="flex flex-col divide-y divide-line">
              {items.map((e) => (
                <li key={e.id}>
                  <ExerciseTile exercise={e} onOpen={onOpen} action={renderAction?.(e)} layout="list" />
                </li>
              ))}
            </ul>
          )}
          {results.isFetchNextPageError && (
            <InlineAlert tone="danger" className="mt-3">
              {results.error?.message || "More results didn't load."}
            </InlineAlert>
          )}
          {results.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" loading={results.isFetchingNextPage} onClick={() => results.fetchNextPage()}>
                Show more
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
