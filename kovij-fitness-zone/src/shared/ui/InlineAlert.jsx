import { CircleAlert, CircleCheck, CloudOff, Info, TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn";

const TONES = {
  danger: { cls: "bg-bad-soft text-bad", icon: CircleAlert },
  warning: { cls: "bg-warn-soft text-warn", icon: TriangleAlert },
  success: { cls: "bg-good-soft text-good", icon: CircleCheck },
  info: { cls: "bg-info-soft text-info", icon: Info },
  offline: { cls: "bg-warn-soft text-warn", icon: CloudOff },
};

/** In-context message inside a form or card (not a toast). */
export function InlineAlert({ tone = "info", title, children, className, action }) {
  const { cls, icon: Icon } = TONES[tone];
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-2.5 rounded-tile p-3.5 text-sm", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

/** Shows a request error that isn't tied to one field (field errors render beside inputs). */
export function FormError({ error }) {
  if (!error) return null;
  const hasFields = Object.keys(error.fields || {}).length > 0;
  if (hasFields && error.code === "VALIDATION_ERROR") return null;
  return (
    <InlineAlert tone={error.isNetwork ? "offline" : "danger"} className="mb-4">
      {error.message}
    </InlineAlert>
  );
}
