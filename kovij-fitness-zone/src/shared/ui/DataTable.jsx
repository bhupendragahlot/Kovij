import { useNavigate } from "react-router-dom";
import { cn } from "../lib/cn";
import { ErrorState, SkeletonList } from "./states";

const HIDE = { sm: "max-sm:hidden", md: "max-md:hidden", lg: "max-lg:hidden", xl: "max-xl:hidden" };

/**
 * One list component, two layouts:
 *   ≥ md  a real <table> (sortable columns can be added per page)
 *   < md  a stacked list rendered by `mobileRow` — tables don't shrink well to a phone
 *
 * Rows can open a detail page via `rowTo(row)`. Keyboard users reach the same link through
 * the primary cell, which renders `rowTo` as a real <a>; the whole-row click is a pointer shortcut.
 *
 * @param {{ id: string, header: string, cell: (row) => any, align?: 'right', hideBelow?: 'sm'|'md'|'lg'|'xl', className?: string }[]} columns
 */
export function DataTable({
  columns,
  rows,
  getRowId = (r) => r._id,
  rowTo,
  mobileRow,
  isPending,
  error,
  onRetry,
  empty,
  isFetching,
  caption,
  className,
}) {
  const navigate = useNavigate();

  if (isPending) return <SkeletonList rows={6} className="p-4" />;
  if (error && !rows?.length) return <ErrorState error={error} onRetry={onRetry} compact />;
  if (!rows?.length) return empty ?? null;

  return (
    <div className={cn("transition-opacity duration-200", isFetching && "opacity-60", className)}>
      {mobileRow && (
        <ul className="divide-y divide-line md:hidden">
          {rows.map((row) => (
            <li key={getRowId(row)}>{mobileRow(row)}</li>
          ))}
        </ul>
      )}
      <div className={cn("overflow-x-auto", mobileRow && "max-md:hidden")}>
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-line">
              {columns.map((c) => (
                <th
                  key={c.id}
                  scope="col"
                  className={cn(
                    "whitespace-nowrap px-4 py-3 text-left text-[13px] font-semibold text-ink-3 first:pl-5 last:pr-5",
                    c.align === "right" && "text-right",
                    c.hideBelow && HIDE[c.hideBelow],
                    c.headerClassName
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const to = rowTo?.(row);
              return (
                <tr
                  key={getRowId(row)}
                  onClick={
                    to
                      ? (e) => {
                          // Let real links, buttons and menus inside the row handle their own clicks.
                          if (e.target.closest("a,button,input,select,label,[role=menu]")) return;
                          navigate(to);
                        }
                      : undefined
                  }
                  className={cn("group", to && "cursor-pointer hover:bg-surface-2/70")}
                >
                  {columns.map((c) => (
                    <td
                      key={c.id}
                      className={cn(
                        "px-4 py-3 align-middle first:pl-5 last:pr-5",
                        c.align === "right" && "text-right tabular",
                        c.hideBelow && HIDE[c.hideBelow],
                        c.className
                      )}
                    >
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
