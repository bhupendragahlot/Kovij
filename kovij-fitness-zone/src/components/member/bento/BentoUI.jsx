import React from "react";
import { useTheme } from "../../../context/ThemeContext";

function clsx(...parts) {
  return parts.filter(Boolean).join(" ");
}

export function MemberPage({ eyebrow, title, subtitle, right }) {
  const { theme } = useTheme();
  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-start justify-between gap-4">
        <div>
          {eyebrow && (
            <div
              className={clsx(
                "text-xs font-semibold tracking-widest uppercase",
                theme === "dark" ? "text-gray-400" : "text-gray-500"
              )}
            >
              {eyebrow}
            </div>
          )}
          <h2
            className={clsx(
              "mt-2 font-['Lexend'] font-black leading-[0.95]",
              "text-3xl sm:text-4xl md:text-5xl",
              theme === "dark" ? "text-white" : "text-gray-900"
            )}
          >
            {title}
          </h2>
          {subtitle && (
            <p className={clsx("mt-2 text-sm sm:text-base", theme === "dark" ? "text-gray-400" : "text-gray-600")}>
              {subtitle}
            </p>
          )}
        </div>
        {right ? <div className="pt-1">{right}</div> : null}
      </div>
    </div>
  );
}

export function BentoGrid({ children }) {
  return <div className="mt-6 grid gap-4 md:grid-cols-12">{children}</div>;
}

export function BentoCard({ className = "", tone = "neutral", title, subtitle, children, right }) {
  const { theme } = useTheme();

  const tones = {
    lilac:
      theme === "dark"
        ? "bg-gradient-to-br from-violet-500/10 via-gray-950/60 to-gray-950/60 border-gray-800"
        : "bg-gradient-to-br from-violet-200 via-white to-white border-violet-200/60",
    mint:
      theme === "dark"
        ? "bg-gradient-to-br from-emerald-500/10 via-gray-950/60 to-gray-950/60 border-gray-800"
        : "bg-gradient-to-br from-emerald-200 via-white to-white border-emerald-200/60",
    peach:
      theme === "dark"
        ? "bg-gradient-to-br from-rose-500/10 via-gray-950/60 to-gray-950/60 border-gray-800"
        : "bg-gradient-to-br from-rose-200 via-white to-white border-rose-200/60",
    sky:
      theme === "dark"
        ? "bg-gradient-to-br from-sky-500/10 via-gray-950/60 to-gray-950/60 border-gray-800"
        : "bg-gradient-to-br from-sky-200 via-white to-white border-sky-200/60",
    neutral:
      theme === "dark"
        ? "bg-gray-950/60 border-gray-800"
        : "bg-white border-gray-200/80",
  };

  return (
    <section
      className={clsx(
        "relative overflow-hidden rounded-[28px] border p-5 sm:p-6",
        "shadow-[0_14px_40px_-28px_rgba(0,0,0,0.6)]",
        tones[tone] || tones.neutral,
        className
      )}
    >
      {(title || right) && (
        <div className="flex items-start justify-between gap-3">
          <div>
            {title && <div className={clsx("text-sm font-bold", theme === "dark" ? "text-white" : "text-gray-900")}>{title}</div>}
            {subtitle && <div className={clsx("mt-1 text-xs", theme === "dark" ? "text-gray-400" : "text-gray-500")}>{subtitle}</div>}
          </div>
          {right ? <div>{right}</div> : null}
        </div>
      )}
      <div className={clsx(title ? "mt-4" : "", theme === "dark" ? "text-gray-100" : "text-gray-900")}>{children}</div>
    </section>
  );
}

export function PrimaryButton({ children, className = "", ...props }) {
  return (
    <button
      {...props}
      className={clsx(
        "rounded-2xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white",
        "hover:bg-black active:scale-[0.99] transition",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SoftButton({ children, className = "", ...props }) {
  const { theme } = useTheme();
  return (
    <button
      {...props}
      className={clsx(
        "rounded-2xl px-4 py-3 text-sm font-semibold transition",
        theme === "dark" ? "bg-white/10 text-white hover:bg-white/15" : "bg-gray-100 text-gray-900 hover:bg-gray-200",
        className
      )}
    >
      {children}
    </button>
  );
}

