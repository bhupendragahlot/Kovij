import { TriangleAlert, CircleCheck } from "lucide-react";
import { BrandMark } from "../../layouts/crm/BrandMark";
import { cn } from "../../shared/lib/cn";

/** Layout for the signed-out staff screens: sign in, forgot password, choose a new password. */
export function AuthShell({ title, description, children }) {
  return (
    <div className="kv-app flex min-h-dvh bg-canvas font-ui text-ink">
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-rail p-10 text-rail-ink lg:flex">
        <BrandMark />
        <div>
          <p className="text-[44px] font-bold leading-[1.05] tracking-[-0.03em]">
            Run the front desk
            <br />
            from one screen.
          </p>
          <p className="mt-4 max-w-sm text-body-lg text-rail-ink-2">
            Check members in, collect dues, renew plans and follow up leads at Kovij Fitness Zone.
          </p>
        </div>
        <p className="text-sm text-rail-ink-2">Staff access only</p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandMark tone="ink" />
          </div>
          <h1 className="text-headline-sm font-bold sm:text-headline">{title}</h1>
          {description && <p className="mt-1 text-body-lg text-ink-3">{description}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

/** Message box for these screens (warning or success). */
export function AuthNotice({ tone = "warn", children, className }) {
  const Icon = tone === "good" ? CircleCheck : TriangleAlert;
  return (
    <div
      role={tone === "good" ? "status" : "alert"}
      className={cn("mt-6 flex gap-2.5 rounded-tile p-3.5 text-sm", tone === "good" ? "bg-good-soft text-good" : "bg-warn-soft text-warn", className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
