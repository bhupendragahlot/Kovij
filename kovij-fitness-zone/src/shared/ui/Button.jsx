import { Link } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import { cn } from "../lib/cn";
import { BUTTON_ICON, BUTTON_VARIANTS, ICON_BUTTON_SIZES, buttonClasses } from "./styles";

/** Pill button. Sizes sm 32 / md 40 / lg 48 px (all tap as 48 px on touch screens). */
export function Button({
  variant,
  size = "md",
  block,
  loading = false,
  icon: Icon,
  iconRight: IconRight,
  className,
  children,
  type = "button",
  disabled,
  ...props
}) {
  const iconClass = BUTTON_ICON[size] || BUTTON_ICON.md;
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className={cn(iconClass, "animate-spin")} aria-hidden /> : Icon && <Icon className={iconClass} aria-hidden />}
      {children}
      {IconRight && !loading && <IconRight className={iconClass} aria-hidden />}
    </button>
  );
}

export function ButtonLink({ variant, size = "md", block, icon: Icon, className, children, ...props }) {
  return (
    <Link className={buttonClasses({ variant, size, block, className })} {...props}>
      {Icon && <Icon className={BUTTON_ICON[size] || BUTTON_ICON.md} aria-hidden />}
      {children}
    </Link>
  );
}

/** Round icon-only button. `label` is required: it becomes the accessible name and tooltip. */
export function IconButton({ icon: Icon, label, variant = "ghost", size = "md", className, type = "button", ...props }) {
  const s = ICON_BUTTON_SIZES[size] || ICON_BUTTON_SIZES.md;
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "state-layer touch-target inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40",
        BUTTON_VARIANTS[variant],
        s.box,
        className
      )}
      {...props}
    >
      <Icon className={s.icon} aria-hidden />
    </button>
  );
}
