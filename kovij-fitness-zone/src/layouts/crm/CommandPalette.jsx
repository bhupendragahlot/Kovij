import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { CornerDownLeft, UserPlus } from "lucide-react";
import { commandPaletteSet, selectCommandPaletteOpen } from "../../app/uiSlice";
import { selectRole } from "../../features/auth/sessionSlice";
import { useMembers } from "../../features/members/api";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useHotkey } from "../../shared/hooks/useHotkey";
import { Avatar, Dialog, SearchInput, StatusBadge } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatPhone } from "../../shared/lib/format";
import { flatNav } from "./navigation";

/**
 * Ctrl/Cmd+K (or "/") from anywhere: find a member by name, phone or code, or jump to a page.
 * Arrow keys move, Enter opens.
 */
export function CommandPalette() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const open = useSelector(selectCommandPaletteOpen);
  const role = useSelector(selectRole);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const term = useDebouncedValue(q.trim(), 200);

  const setOpen = (v) => dispatch(commandPaletteSet(v));
  useHotkey("mod+k", () => setOpen(!open));
  useHotkey("/", () => setOpen(true), { enabled: !open });

  const members = useMembers({ q: term, limit: 8 }, { enabled: open && term.length >= 2 });

  const results = useMemo(() => {
    if (term.length >= 2) {
      return (members.data?.members || []).map((m) => ({
        id: m._id,
        kind: "member",
        member: m,
        to: `/admin/members/${m._id}`,
      }));
    }
    const pages = flatNav(role).map((n) => ({ id: n.id, kind: "page", label: n.label, icon: n.icon, to: n.to }));
    return [{ id: "new-member", kind: "page", label: "Register a new member", icon: UserPlus, to: "/admin/members/new" }, ...pages];
  }, [term, members.data, role]);

  useEffect(() => setActive(0), [term]);
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const go = (item) => {
    if (!item) return;
    setOpen(false);
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active]);
    }
  };

  const searching = term.length >= 2;

  return (
    <Dialog open={open} onClose={() => setOpen(false)} title="Search" size="lg" initialFocusRef={inputRef} className="md:top-[12vh] md:mt-0 md:mb-auto">
      <SearchInput
        inputRef={inputRef}
        value={q}
        onChange={setQ}
        onKeyDown={onKeyDown}
        label="Search members or pages"
        placeholder="Name, phone or member code"
      />
      <div className="mt-3 min-h-40" aria-live="polite">
        {searching && members.isFetching && !members.data && <p className="px-2 py-6 text-center text-sm text-ink-3">Searching…</p>}
        {searching && members.data && results.length === 0 && (
          <p className="px-2 py-6 text-center text-sm text-ink-3">No member matches &ldquo;{term}&rdquo;. Check the spelling or search by phone number.</p>
        )}
        {!searching && <p className="px-2 pb-1 pt-1 text-xs font-semibold text-ink-3">Go to</p>}
        <ul role="listbox" aria-label={searching ? "Members" : "Pages"} className="flex flex-col gap-0.5">
          {results.map((item, i) => (
            <li key={item.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => go(item)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-tile px-2.5 py-2 text-left",
                  i === active ? "bg-surface-2" : "hover:bg-surface-2"
                )}
              >
                {item.kind === "member" ? (
                  <>
                    <Avatar name={item.member.name} src={item.member.profilePhoto} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{item.member.name}</span>
                      <span className="block truncate text-xs text-ink-3">
                        {[item.member.memberCode, formatPhone(item.member.phone)].filter(Boolean).join(", ")}
                      </span>
                    </span>
                    <StatusBadge kind="member" status={item.member.state} size="sm" />
                  </>
                ) : (
                  <>
                    <span className="grid size-8 place-items-center rounded-[9px] bg-surface-3 text-ink-2">
                      <item.icon className="size-4" aria-hidden />
                    </span>
                    <span className="flex-1 text-sm font-semibold text-ink">{item.label}</span>
                  </>
                )}
                {i === active && <CornerDownLeft className="size-4 text-ink-3" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
