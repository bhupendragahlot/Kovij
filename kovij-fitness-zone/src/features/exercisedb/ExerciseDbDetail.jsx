import { Badge, ErrorState, Skeleton } from "../../shared/ui";
import { ExerciseDbMedia } from "./ExerciseDbMedia";
import { cap } from "./format";

function FactRow({ label, values }) {
  if (!values?.length) return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-ink-3">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <Badge key={v} size="sm">
            {cap(v)}
          </Badge>
        ))}
      </dd>
    </div>
  );
}

/**
 * Everything ExerciseDB knows about one exercise: animation, muscles, equipment and steps.
 * `query` is the detail query; `fallback` (a saved snapshot) shows while it loads or if it fails.
 */
export function ExerciseDbDetail({ query, fallback, children }) {
  const e = query.data || null;
  const facts = e || fallback;

  return (
    <div className="flex flex-col gap-4">
      {query.isPending ? (
        <Skeleton className="aspect-[4/3] w-full rounded-tile" />
      ) : (
        <ExerciseDbMedia
          src={e?.gifUrl || e?.imageUrl}
          alt={e ? `How to do ${e.name}` : ""}
          eager
          className="aspect-[4/3] w-full rounded-tile border border-line"
          iconClassName="size-10"
        />
      )}

      {children}

      {facts && (
        <dl className="divide-y divide-line">
          <FactRow label="Body part" values={facts.bodyParts} />
          <FactRow label="Target muscle" values={facts.targetMuscles} />
          <FactRow label="Also works" values={e?.secondaryMuscles} />
          <FactRow label="Equipment" values={facts.equipments} />
          <FactRow label="Type" values={e?.exerciseTypes} />
          <FactRow label="Level" values={e?.difficulty ? [e.difficulty] : []} />
        </dl>
      )}

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : query.isError ? (
        <ErrorState compact title="Instructions didn't load" error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <>
          {e.overview && <p className="text-sm text-ink-2">{e.overview}</p>}
          {e.instructions?.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold text-ink">How to do it</h3>
              <ol className="flex flex-col gap-2.5">
                {e.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-ink-2">
                    <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-ink">{i + 1}</span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
      <p className="text-xs text-ink-3">Exercise data and animations from ExerciseDB.</p>
    </div>
  );
}
