import { Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/cn";
import { BUTTON_VARIANTS, buttonClasses } from "./styles";

export function Button({ variant, size, block, loading = false, icon: Icon, iconRight: IconRight, className, children, type = "button", disabled, ...props }) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : Icon && <Icon className="size-4" aria-hidden />}
      {children}
      {IconRight && !loading && <IconRight className="size-4" aria-hidden />}
    </button>
  );
}

export function ButtonLink({ variant, size, block, icon: Icon, className, children, ...props }) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...props}>
      {Icon && <Icon className="size-4" aria-hidden />}
      {children}
    </Link>
  );
}

const ICON_SIZES = { sm: "size-9 rounded-[10px]", md: "size-11 md:size-10 rounded-control", lg: "size-12 rounded-control" };

/** Icon-only button. `label` is required: it becomes the accessible name and tooltip. */
export function IconButton({ icon: Icon, label, variant = "ghost", size = "md", className, type = "button", ...props }) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center transition-colors duration-150 disabled:opacity-50",
        BUTTON_VARIANTS[variant],
        ICON_SIZES[size],
        className
      )}
      {...props}
    >
      <Icon className="size-[18px]" aria-hidden />
    </button>
  );
}
