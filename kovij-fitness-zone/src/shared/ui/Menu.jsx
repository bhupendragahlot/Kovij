import { useId, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";

/**
 * Dropdown menu rendered in the browser's top layer (Popover API), so it is never clipped by
 * scrolling tables or cards. Keyboard: arrows move, Home/End jump, Esc closes and restores focus.
 *
 *   <Menu trigger={(props) => <IconButton {...props} icon={Ellipsis} label="More" />}
 *         items={[{ label: "Renew", icon: RefreshCw, onSelect }, { label: "Open", to: "/x" }]} />
 */
export function Menu({ trigger, items, align = "end", label }) {
  const menuId = useId();
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  const position = () => {
    const t = triggerRef.current?.getBoundingClientRect();
    const m = menuRef.current;
    if (!t || !m) return;
    const width = m.offsetWidth;
    const height = m.offsetHeight;
    let left = align === "end" ? t.right - width : t.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    const below = t.bottom + 6;
    const top = below + height > window.innerHeight - 8 ? Math.max(8, t.top - height - 6) : below;
    m.style.left = `${left}px`;
    m.style.top = `${top}px`;
  };

  useLayoutEffect(() => {
    if (!open) return undefined;
    position();
    menuRef.current?.querySelector('[role="menuitem"]:not([aria-disabled="true"])')?.focus();
    const reposition = () => menuRef.current?.hidePopover?.();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = () => {
    const m = menuRef.current;
    if (!m) return;
    if (m.matches(":popover-open")) m.hidePopover();
    else m.showPopover();
  };

  const onMenuKeyDown = (e) => {
    const nodes = [...menuRef.current.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"])')];
    const i = nodes.indexOf(document.activeElement);
    const go = (idx) => nodes[(idx + nodes.length) % nodes.length]?.focus();
    if (e.key === "ArrowDown") (e.preventDefault(), go(i + 1));
    else if (e.key === "ArrowUp") (e.preventDefault(), go(i - 1));
    else if (e.key === "Home") (e.preventDefault(), go(0));
    else if (e.key === "End") (e.preventDefault(), go(nodes.length - 1));
    else if (e.key === "Tab") menuRef.current.hidePopover();
  };

  const close = () => menuRef.current?.hidePopover();
  const visible = items.filter(Boolean);

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: toggle,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": menuId,
      })}
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={label}
        onToggle={(e) => {
          const isOpen = e.newState === "open";
          setOpen(isOpen);
          if (!isOpen && menuRef.current?.contains(document.activeElement)) triggerRef.current?.focus();
        }}
        onKeyDown={onMenuKeyDown}
        className="kv-app font-ui fixed m-0 min-w-52 rounded-tile border border-line bg-surface p-1.5 text-ink shadow-pop"
      >
        {visible.map((item, idx) => {
          if (item.type === "separator") return <div key={`sep-${idx}`} role="separator" className="my-1 h-px bg-line" />;
          if (item.type === "heading") {
            return (
              <div key={`h-${idx}`} role="presentation" className="px-3 pb-1.5 pt-2">
                <p className="text-sm font-semibold text-ink">{item.label}</p>
                {item.hint && <p className="text-xs text-ink-3">{item.hint}</p>}
              </div>
            );
          }
          const Icon = item.icon;
          const cls = cn(
            "flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-left text-sm font-medium outline-none md:py-2",
            "hover:bg-surface-2 focus-visible:bg-surface-2",
            item.tone === "danger" ? "text-bad" : "text-ink",
            item.disabled && "opacity-50"
          );
          const content = (
            <>
              {Icon && <Icon className="size-4 shrink-0 text-current opacity-80" aria-hidden />}
              <span className="flex-1">{item.label}</span>
              {item.hint && <span className="text-xs text-ink-3">{item.hint}</span>}
            </>
          );
          if (item.to) {
            return (
              <Link key={item.label} role="menuitem" to={item.to} className={cls} onClick={close} tabIndex={-1}>
                {content}
              </Link>
            );
          }
          if (item.href) {
            return (
              <a key={item.label} role="menuitem" href={item.href} target={item.external ? "_blank" : undefined} rel={item.external ? "noreferrer" : undefined} className={cls} onClick={close} tabIndex={-1}>
                {content}
              </a>
            );
          }
          return (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              aria-disabled={item.disabled || undefined}
              className={cls}
              onClick={() => {
                if (item.disabled) return;
                close();
                item.onSelect?.();
              }}
            >
              {content}
            </button>
          );
        })}
      </div>
    </>
  );
}
