# Kovij Front Desk: CRM redesign plan

**Scope.** The staff-facing gym CRM at `/admin` (front desk, managers, owner), plus the backend it runs on. The public website and the member portal keep their current look; only their security and billing bugs were fixed.

**Status.** Phases 1 and 2 below are **built and verified** in this change (70 end-to-end API checks, migration test against legacy-shaped data, screenshots at phone/tablet/desktop in both themes). Phases 3–5 are the roadmap.

Legend used throughout: ✅ built in this change · 🔜 planned (phase noted) · ⚠️ needs an action from you.

---

## Contents

- [A. UX audit](#a-ux-audit)
- [B. Information architecture](#b-information-architecture)
- [C. Dashboard ("Today") specification](#c-dashboard-today-specification)
- [D. Design system](#d-design-system)
- [E. Light/dark theme strategy](#e-lightdark-theme-strategy)
- [F. Responsive strategy](#f-responsive-strategy)
- [G. PWA strategy](#g-pwa-strategy)
- [H. Key user flows](#h-key-user-flows)
- [I. Component inventory](#i-component-inventory)
- [J. Page-by-page](#j-page-by-page)
- [K. Accessibility checklist](#k-accessibility-checklist)
- [L. Performance and UX recommendations](#l-performance-and-ux-recommendations)
- [M. Implementation roadmap](#m-implementation-roadmap)
- [Architecture notes](#architecture-notes)
- [Deploying this change](#deploying-this-change)

---

## A. UX audit

Priority: **P0** blocks trust or money · **P1** daily friction for the desk · **P2** quality and consistency · **P3** polish.

### Security and money (root causes, not UI)

| # | Problem | User impact | Recommendation | Priority | Status |
|---|---|---|---|---|---|
| 1 | `POST /api/auth/register` was public and defaulted new accounts to `admin` | Anyone could make themselves an owner and read every member's data and ID scans | Remove public registration; owner creates staff in Settings; bootstrap with `npm run create-admin` | P0 | ✅ |
| 2 | Plan/product/trainer/settings writes checked only the JWT signature, and member tokens were signed with the same secret | Any logged-in member could change prices or site content | One staff guard that re-reads the user each request, plus role checks (`requireRole`) | P0 | ✅ |
| 3 | Members chose their own fees and "paid" status when joining | Free memberships; revenue numbers were fiction | Server prices every plan; online joins wait in **Awaiting payment** until the desk collects | P0 | ✅ |
| 4 | No protection against double payments (double tap, timeouts, retries) | Members charged twice; receipts out of sequence | **Idempotency-Key** on every money-moving request, with a database-level backstop (see Architecture) | P0 | ✅ |
| 5 | ID-proof scans served publicly from `/uploads` | Aadhaar/PAN copies readable by anyone with the link | Private storage, streamed only to staff | P0 | ✅ |
| 6 | Contact form emailed raw visitor HTML to any address, and a cache made most submissions vanish | Spam relay from the gym's Gmail; lost enquiries | Validate, escape, rate-limit; every enquiry becomes a **Lead** | P0 | ✅ |
| 7 | Gmail app password committed in `kovij-fitness-zone/.env` | Account takeover risk | Rotate the password; stop tracking `.env` | P0 | ⚠️ you |
| 8 | Staff session stored in `localStorage`, never re-validated; route guard only checked "a token exists" | Deactivated staff kept access; stale roles | Session validated on load (`/auth/me`), 401 ends it everywhere, deactivation is immediate | P1 | ✅ |

### Usability, hierarchy and flow

| # | Problem | User impact | Recommendation | Priority | Status |
|---|---|---|---|---|---|
| 9 | Dashboard showed only three counts; Analytics was entirely fake data | Staff couldn't see what to do next; owner couldn't trust numbers | **Today** screen built around a work queue (dues, expiring, lapsed, follow-ups) with real data | P1 | ✅ |
| 10 | No check-in / attendance at all | The desk's most frequent task happened on paper | One-search, one-tap **Check-in**, once per member per day, with "let in once" override and undo | P1 | ✅ |
| 11 | No way to register walk-ins; Google sign-in was the only door | Most gym members can't be added | Desk registration on one page; Google account optional | P1 | ✅ |
| 12 | No renewal flow; plan changes by members were free and immediate | Renewals handled off-system; lost revenue | **Renew** from anywhere; queues after the current plan or starts today; pay now or later | P1 | ✅ |
| 13 | Payments invisible to staff (bill sender asked for a raw database ID) | Dues never chased | **Payments** page with Dues first, collect in one dialog, printable receipts | P1 | ✅ |
| 14 | Member detail page was two JSON dumps | Staff couldn't read a member's state | Profile with plan, dues and visits at the top; tabs for details, plans, payments | P1 | ✅ |
| 15 | Duplicate members (same phone typed differently) | Split history, wrong dues | Phones stored in one canonical form; live duplicate warning while typing | P1 | ✅ |
| 16 | Two unrelated visual languages (marketing dark industrial vs. blue default admin), per-component `theme === "dark"` branches | Inconsistent, hard to maintain, dark mode broken (`dark:` followed the OS, not the toggle) | Token-based design system; one theme switch drives everything | P2 | ✅ |
| 17 | Errors swallowed (`catch {}`), `alert()` popups, `window.prompt()` for emails | Silent failures; lost work | Inline field errors from the server, toasts with actions, real dialogs | P2 | ✅ |
| 18 | No loading, empty, offline or permission states | Blank screens, confusion | Skeletons, purposeful empty states, offline banner, role-aware controls | P2 | ✅ |
| 19 | Tables unusable on phones | Desk staff on phones scroll sideways | Every list becomes a stacked card list below 768px | P2 | ✅ |
| 20 | Campaign `{{name}}` sent literally; "sent" counted before delivery | Embarrassing emails; wrong stats | Placeholders filled per recipient; stats from the email log | P2 | ✅ |
| 21 | Cron jobs ran on server time (UTC) | Reminders at 14:30 IST; day boundaries wrong | All business days in gym time (Asia/Kolkata) | P2 | ✅ |
| 22 | 820 KB main bundle loaded Firebase on every public page | Slow first load on phones | Firebase loaded only at sign-in; staff app split per page | P3 | ✅ (partial, see L) |

---

## B. Information architecture

Organised by how often the desk does something, not by database table.

```
Daily (what the desk does all day)
  Today .............. work queue + floor pulse                    all roles
  Check-in ........... find member → tap                           all roles
  Members ............ list, profile, register, renew              all roles
  Payments ........... dues, paid history, receipts                all roles (totals: manager+)
  Leads .............. enquiries → follow-ups → join               all roles
Manage (weekly/monthly)
  Plans .............. what can be sold, prices                    edit: manager+
  Trainers ........... team, shifts, website profiles              edit: manager+
  Campaigns .......... email offers                                manager+
  Settings ........... gym & billing, website, staff, appearance   edit: owner
```

**Deliberately not built yet** (and why):

| Area | Decision | Reason |
|---|---|---|
| Classes & schedules | 🔜 Phase 4 | Kovij runs open-floor sessions today (6–11 am, 4–9 pm). Build when group classes need booking caps. |
| Workout / PT management | 🔜 Phase 4 | PT sessions are sold today via "Record payment → Personal training". Session tracking (packages, remaining sessions, trainer calendars) comes next. |
| Reports & analytics | 🔜 Phase 4 | Today covers the daily numbers; a Reports page (revenue by plan, retention cohorts, attendance heatmap, CSV export) needs a few months of real data first. |
| Notifications centre | 🔜 Phase 3 | Push notifications for dues and follow-ups; the Today queue covers it until then. |
| Store / products | 🔜 Phase 4 | The public shop still uses a hard-coded list; API and admin screens should be rebuilt together. The product API is kept and secured. |

---

## C. Dashboard ("Today") specification

**Job:** tell the desk what to do next, then show the owner how the gym is doing. Every number links to the list that acts on it.

**Visual priority, highest first:**

1. **Checked in today (hero, inverted card).** The live floor count plus today's check-ins per hour against a typical same weekday (average of the previous 4). It's the one number the desk glances at all day, and "how busy are we vs usual" is the question behind it. It's the page's only loud element: dark in light mode, warm ember in dark mode.
2. **Needs attention (work queue).** Dues to collect, plans ending in N days, lapsed in the last 2 weeks, follow-ups due, new enquiries. Each row is a count plus a tap into the filtered list. Zero rows stay visible but dimmed, so the layout doesn't jump.
3. **KPI tiles.** Active members, new this month (vs last month *to the same day*), collected this month (manager+), dues outstanding.
4. **Collected per month** (manager+): 6 months, one series, only the latest month labelled.
5. **Ending soon:** up to 8 members with a one-tap **Renew**.
6. **Recent activity:** payments, joins, renewals.

**Role differences:** front-desk staff never receive revenue figures (the server omits them, the UI doesn't only hide them).

**States:** skeleton shaped like the layout on first load; on refresh the previous numbers stay (no flash); error card with retry; "comparison starts after a week of check-ins" when there's no history.

**Refresh:** every 60 s while open, and after any check-in/payment/renewal.

---

## D. Design system

Direction taken from the two references: the dark "Vitalis" dashboard (charcoal plates, hairlines, orange accent) and the light "body overview" dashboard (chalk canvas, white plates, an iron sidebar rail, one inverted hero card). Unified under Kovij's orange.

### Colour tokens (`kovij-fitness-zone/src/index.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | `#ECEEF1` chalk | `#0B0C0E` | page background |
| `surface` / `surface-2` / `surface-3` | `#FFFFFF` / `#F4F5F7` / `#E8EAEE` | `#15171A` / `#1C1F23` / `#262A2F` | cards / insets, hover / pressed, skeleton |
| `line` / `line-strong` | `#E2E5E9` / `#C9CED5` | `#24272C` / `#353940` | hairlines / button outlines |
| `control` | `#8E949D` | `#6B717A` | form-field borders (3:1) |
| `ink` / `ink-2` / `ink-3` | `#15171A` / `#474C54` / `#626771` | `#F2F3F5` / `#B4B9C1` / `#8B919A` | text: primary / secondary / muted |
| `rail`, `rail-ink(-2)` | `#131417` iron | `#101114` | sidebar |
| `hero`, `hero-ink(-2)` | `#131417` | `#221A12` ember | the one inverted card |
| `brand` / `brand-ink` / `on-brand` | `#FF7A1A` / `#B34700` / `#1F1003` | `#FF8A2B` / `#FF9A45` / `#1F1003` | fills / orange text / text on fills |
| `good` `warn` `bad` `info` (+ `-soft`) | `#0E7A3C` `#8A5A00` `#C0262D` `#1D5FC2` | `#4ADE80` `#FACC15` `#F87171` `#60A5FA` | status only, always with icon + label |
| `focus` | `#B34700` | `#FF9A45` | 2px focus ring, offset 2px |

White text on orange fails contrast (2.6:1), so orange buttons carry **dark ink**, as in the reference.

### Measured contrast (WCAG)

| Pair | Light | Dark | Needed |
|---|---|---|---|
| Body text on surface | 17.96 | 16.17 | 4.5 |
| Muted text on canvas (worst case) | 4.89 | 6.16 | 4.5 |
| Button label on brand | 7.10 | 7.87 | 4.5 |
| Orange text (brand-ink) on surface | 5.50 | 8.52 | 4.5 |
| Status text on its tint (worst) | 4.77 | 5.30 | 4.5 |
| Focus ring vs surface | 5.50 | 8.52 | 3 |
| Form-field border vs surface | 3.06 | 3.65 | 3 |
| Chart bars vs surface | 3.73 | 7.63 | 3 |

Chart palette: highlighted series (brand) vs comparison gray passes the colourblind separation check (ΔE 21–29). The gray is intentionally low-chroma (emphasis encoding) at 3.0:1 (light) / 3.65:1 (dark), and every chart also ships a legend and a table view.

### Typography

One family, **Manrope Variable**, self-hosted so it works offline. Tabular figures only in columns (tables, axes); big numbers keep proportional figures.

| Role | Size / line height | Weight |
|---|---|---|
| Hero figure (one per page) | 56 / 56, tracking −0.04em | 700 |
| Page title | 26 / 32, tracking −0.02em | 700 |
| KPI value | 28–32 | 700 |
| Card title | 15 / 24 | 600 |
| Body / controls | 15 on phones, 14 from tablet | 400–600 |
| Meta, hints, badges | 13 / 12 / 11 | 500–600 |

Copy rules: sentence case, no ALL-CAPS labels, verbs on buttons ("Collect ₹1,500", not "Submit"), the same verb in the toast ("₹1,500 collected").

### Spacing, radius, elevation

- **Spacing:** 4px base (Tailwind scale). Page gutters 16 / 24 / 32px (phone / tablet / desktop). Card padding 16–24px. Gaps between cards 16px.
- **Radius hierarchy** (radius signals level, never one radius everywhere): hero 28 · card 20 · tile 14 · control 12 · chip/pill full.
- **Elevation:** cards are flat (light: white on chalk; dark: 1px hairline). Shadows are reserved for things floating above the page: menus, dialogs, toasts (`shadow-pop`, `shadow-float`).
- **Icons:** Lucide, 16–22px, stroke 2; decorative icons are `aria-hidden`, icon-only buttons have a label.
- **Motion:** only in response to an action (dialog opens, toast appears, bar hover). No entrance animations on page load. `prefers-reduced-motion` disables chart and transition animation.

### Components

See [I. Component inventory](#i-component-inventory) for every component, its file and states.

---

## E. Light/dark theme strategy

- **Tokens, not branches.** Raw values live on `:root` and `.dark`; Tailwind utilities (`bg-surface`, `text-ink-2`, …) point at them. Components never check the theme.
- **Class-driven dark mode.** `@custom-variant dark (&:where(.dark, .dark *))`. This also fixed the old bug where `dark:` styles followed the OS instead of the toggle.
- **Three settings:** Light, Dark, Match device (default). Stored per device (`theme` key, shared with the public site), applied by `ThemeSync`, which also sets the browser/installed-app `theme-color`.
- **Dark is designed, not inverted.** Different steps for status colours, a warmer ember hero, hairlines instead of shadows, lighter orange for legibility.
- **Charts** read CSS variables, so they switch with the theme without re-rendering logic.
- **One state owner:** theme lives in the Redux `ui` slice; the public site's `useTheme()` is now an adapter over it.

---

## F. Responsive strategy

Designed for the phone at the desk first, then scaled up.

| Breakpoint | Width | Layout |
|---|---|---|
| Phone | < 768 | Top bar (brand, search, account) + **bottom bar**: Today · Members · **Check-in** (raised centre) · Payments · More |
| Tablet | 768–1279 | 76px icon rail + top bar with search; two-column grids |
| Desktop | ≥ 1280 | 248px labelled rail (collapsible to 76px) + top bar with ⌘K search and "New member" |

| Component | Phone | Tablet | Desktop |
|---|---|---|---|
| Navigation | bottom bar + "More" sheet | icon rail | labelled rail, collapsible |
| Tables | stacked cards (name, status, one key line) | table, low-priority columns hidden | full table |
| Dialogs | bottom sheet with drag handle | centred / side drawer | centred / side drawer |
| Forms | single column, sticky action bar above the bottom nav | two columns | two columns, max 768px wide |
| Filters | chips scroll sideways | chips wrap | chips wrap |
| Charts | full width, fixed height, table toggle | same | chart grows to fill the card |
| Check-in | tabs: "Check in" / "Here today" | same | search and today's list side by side |
| Member profile | header stacks, actions wrap | tiles in 3 columns | header with actions on the right |
| Touch targets | ≥ 44px controls, 64px check-in button | 40px | 40px |

Verified: no horizontal page scroll at 390px on Today, Members, Check-in, Payments, Leads, New member.

---

## G. PWA strategy

**Installable** as "Kovij Desk" (`/admin` start URL, standalone, maskable icons, shortcuts: Check in, Register member, Dues). ✅

**Offline and poor-network behaviour**

| Works offline (last synced copy) | Needs a connection |
|---|---|
| Open the app, navigate, change theme | Record or collect any payment |
| Today numbers, member list and profiles, today's check-ins, plans, trainers | Register, renew, edit members |
| Search within what was last loaded | Check-in (queues and sends when back online, see below) |
| | Campaigns, settings, staff |

- **Caching:** app shell precached. Read-only staff lookups use network-first with a 6 s timeout and fall back to the last copy. Payments, receipts and ID proofs are **never** cached. The cache is deleted on sign-out, so the next person at a shared desk sees nothing. ✅
- **Offline indicator:** persistent banner saying what still works. Money buttons are disabled with the reason shown. ✅
- **Retry and sync:** writes wait for a connection instead of failing. Payment, registration and renewal retries reuse the same Idempotency-Key, so a retry can never charge twice. Check-ins are idempotent per member per day. ✅
- **Updates:** a new version shows "A new version is ready, Reload" instead of reloading mid-task. ✅
- 🔜 **Phase 3:** persistent offline check-in queue (IndexedDB outbox that survives a reload), push notifications (dues due today, follow-ups), background sync.

---

## H. Key user flows

| Flow | Before | After | Shortcuts and automation |
|---|---|---|---|
| **Staff login** | Generic form, "Forgot password?" link to nowhere, session never checked | Email + password, show/hide, honest help text; returns to the page you were on; clear "session ended" message | Session re-validated on load; deactivation takes effect on the next request |
| **Dashboard** | Three counts | Work queue first; every count opens the filtered list | Auto-refresh 60 s; Renew straight from "Ending soon" |
| **Register member** | Only via Google sign-in; 6-step member wizard | One page: name + mobile required; optional plan with pay now/later; health optional; sticky "Register and collect ₹X" | Live duplicate check on phone/email; registration fee added automatically on a first plan; unsaved-changes guard; retry-safe |
| **Find a member** | Search on submit only | ⌘K / Ctrl+K or "/" from anywhere; name, phone digits or member code | Filters kept in the URL (shareable, back button works) |
| **Renew** | Not possible | "Renew" on profile, list row menu, dashboard, check-in block | Defaults to the same plan; starts after the current plan automatically; pay now or add to dues |
| **Check in** | Not possible | Type 2+ letters, tap Check in; Enter when there's one match | Once per day; Undo in the toast; inactive plan offers Renew / Collect / "Let in once" with a reason |
| **Take a payment** | Raw database ID form | "Collect ₹X" on dues, or "Record payment" with member search | Mode + reference; receipt number issued once; Print from the toast |
| **Manage leads** | Didn't exist | Cards by stage; Call / WhatsApp; Log call sets the next follow-up; Join converts to member | Website enquiries arrive automatically; conversion links to an existing member if the phone matches |
| **Schedule a class** | n/a | 🔜 Phase 4 | |
| **Manage trainers** | Basic CRUD | Shifts, specialties, phone (staff-only), active and website toggles | Phone and email never exposed on the public site |

---

## I. Component inventory

All in `kovij-fitness-zone/src/shared/ui/` unless noted.

| Component | File | States / notes |
|---|---|---|
| Button, ButtonLink, IconButton | `Button.jsx`, `styles.js` | primary · secondary · quiet · ghost · danger · inverse; sm/md/lg; loading; disabled; icon-only requires a label |
| Card, CardHeader, Tile | `Card.jsx` | plain / hero; padding sizes |
| Badge, StatusBadge | `Badge.jsx`, `StatusBadge.jsx`, `shared/domain/status.js` | one status vocabulary (tone + icon + label) for members, plans, payments, leads |
| Field | `Field.jsx` | label, optional marker, hint, error; wires `id`, `aria-describedby`, `aria-invalid` |
| Input, Textarea, Select, Switch, SegmentedControl, TagInput | `inputs.jsx`, `TagInput.jsx` | prefix/suffix/icon; invalid; disabled; radio-group keyboard support |
| Dialog (modal / sheet / drawer) | `Dialog.jsx` | native `<dialog>`: focus trap, Esc, inert page; sheet on phones |
| ConfirmProvider / useConfirm | `ConfirmProvider.jsx`, `confirmContext.js` | promise-based; destructive confirms focus Cancel |
| Menu | `Menu.jsx` | Popover API (never clipped); arrow keys, Home/End, Esc returns focus |
| Toaster / useToast | `toast/` | success · danger · warning · neutral; action (Undo, Print); pauses on hover/focus |
| DataTable | `DataTable.jsx` | table ≥768px, card list below; loading, error + retry, empty, dim-on-refetch |
| PageHeader, SearchInput, FilterChips, Tabs, Pagination | `navigation.jsx` | chips with counts; accessible tabs |
| KpiTile, Meter | `KpiTile.jsx` | delta vs named period (colour + arrow + words) |
| Skeleton, SkeletonList, EmptyState, ErrorState, QueryState | `states.jsx` | offline and permission variants |
| InlineAlert, FormError | `InlineAlert.jsx` | danger · warning · success · info · offline |
| Avatar | `Avatar.jsx` | photo with initials fallback |
| OfflineBanner | `OfflineBanner.jsx` | explains what still works |
| ChartFrame, HourlyCheckins, MonthlyRevenue | `charts/` | legend, tooltip (values first), table toggle, reduced motion |
| App shell: Sidebar, Topbar, BottomNav, CommandPalette | `layouts/crm/` | one navigation config (`navigation.js`) feeds all of them |
| Domain: MemberPicker, SaleFields, member form fields, payment dialogs, check-in flow | `features/*` | shared by several pages; no duplicated business logic |

---

## J. Page-by-page

| Page | Purpose | Layout | Key actions | Notable states |
|---|---|---|---|---|
| **Sign in** `/admin/login` | Get staff in | Iron brand panel (desktop) + form | Sign in | Session ended; wrong password; deactivated |
| **Today** `/admin` | What to do next | Hero + work queue, KPIs, trends, ending soon, activity | Check in, open a queue, Renew | No history yet; staff without revenue |
| **Check-in** `/admin/check-in` | Let members in | Search panel + "Here today" (tabs on phones) | Check in, Undo, Let in once | Already in; plan inactive; no match → Register |
| **Members** `/admin/members` | Find anyone | Search + status chips with counts + table/cards | Open, Check in, Renew, Record payment | No members yet; no match → clear filters |
| **New member** `/admin/members/new` | Register a walk-in | Sections + sticky action bar | Register (and collect) | Duplicate found; no plans yet; offline |
| **Member profile** `/admin/members/:id` | Everything about one person | Header with contact links + plan/dues/visits tiles + tabs | Check in, Renew, Collect / Record, Edit, Cancel plan (manager), View ID proof | Queued renewal; awaiting payment; no health data |
| **Payments** `/admin/payments` | Collect dues, find receipts | Tabs Dues/Paid/All + search, date range, mode | Collect, Receipt, Record payment | No dues; empty range |
| **Leads** `/admin/leads` | Turn enquiries into members | Stage tabs + follow-up chips + cards | Call, WhatsApp, Log call, Join, Mark lost | Follow-up overdue/today; lead matches an existing member |
| **Plans** `/admin/plans` | What can be sold | Card grid + side drawer form | New plan, Edit, Delete / Stop selling | Plan already sold → "Stop selling" instead of delete |
| **Trainers** `/admin/trainers` | Team and website profiles | Card grid + drawer | Add, Edit, Remove | Not working here; hidden from website |
| **Campaigns** `/admin/campaigns` | Email offers | List + composer drawer with live recipient count and preview | Save draft, Send test, Send | Delivery stats from the email log |
| **Settings** `/admin/settings` | Gym, billing, website, staff, appearance | Tabs; forms save only changed fields | Save, Add staff, Deactivate, Reset password | Read-only for non-owners; can't lock yourself out |

---

## K. Accessibility checklist

| Item | Status |
|---|---|
| Text contrast ≥ 4.5:1, UI boundaries and focus ≥ 3:1, in both themes (measured, see D) | ✅ |
| Visible 2px focus ring everywhere | ✅ |
| Full keyboard use: skip link, ⌘K palette, arrow keys in menus, tabs, segmented controls and lists; Esc closes overlays and returns focus | ✅ |
| Semantic structure: one `h1` per page, landmarks (`nav`, `main`, `aside`), real tables with captions | ✅ |
| Forms: every input labelled; errors linked with `aria-describedby`, announced, placed beside the field | ✅ |
| Status never by colour alone (icon + label); chart series identified by legend, with a table view | ✅ |
| Touch targets ≥ 44px on phones (check-in 64px) | ✅ |
| Live regions for toasts and search results | ✅ |
| Reduced motion respected (CSS and chart animations) | ✅ |
| Language set; icons decorative unless they are the only label | ✅ |
| 🔜 Screen-reader pass with NVDA and TalkBack on real devices; automated axe checks in CI | Phase 5 |

---

## L. Performance and UX recommendations

Done:

- Staff app code-split per page; public site no longer downloads it.
- Firebase loaded only at Google sign-in (main bundle 820 → 667 KB).
- TanStack Query caching, 30 s freshness, previous results kept while filtering (no flashes).
- Server-side pagination, filtering and counts for members, payments and leads.
- Hashed assets cached for a year; HTML and service worker always revalidate.
- Explicit Content Security Policy (Google sign-in, Analytics, Maps and Fonts only).

Next:

- 🔜 Split the public site's animation libraries (`framer-motion` + `motion`, ~150 KB) out of the member portal; lazy-load the shop and member portal routes.
- 🔜 Add MongoDB indexes after watching real query patterns (e.g. `payments {memberId, status}`), and cache the member-standing aggregation if the gym passes ~5,000 members.
- 🔜 Move the email queue from memory to a persistent job queue, so emails survive restarts.
- 🔜 Lighthouse and axe in CI.

---

## M. Implementation roadmap

Ordered by user impact and business value, then complexity and dependencies. Money and security come first because every later feature depends on trustworthy data.

### Phase 1: Critical fixes ✅ done

Security holes 1–6 and 8, server-side pricing, idempotent payments, escaping, private ID storage, gym-time crons, canonical phones, startup migrations, CSP.

### Phase 2: Core redesign ✅ done

Design system and themes, app shell, Today, Check-in, Members (list, register, profile, renew), Payments, Leads, Plans, Trainers, Campaigns, Settings with staff management, PWA install and offline read-only, test suites.

### Phase 3: Mobile and PWA depth

| Item | Why now | Size |
|---|---|---|
| Persistent offline check-in outbox (IndexedDB) | Desk Wi-Fi drops at peak hours | M |
| Push notifications: dues today, follow-ups due, plan ending | Replaces checking the queue manually | M |
| QR member cards + self check-in kiosk mode | Removes the queue at the desk at 6–8 am | M |
| Camera capture for profile photo and ID at the desk | Registration without a second device | S |
| Member portal on the same design system | Consistency, one component library | M |

### Phase 4: Advanced CRM

| Item | Depends on |
|---|---|
| PT packages (sessions sold, used, remaining) + trainer calendar | Payments ✅ |
| Classes and schedules (capacity, bookings, waitlist) | Check-in ✅ |
| Reports: revenue by plan, retention cohorts, attendance heatmap, CSV export | A few months of real data |
| Online payments (UPI intent / payment gateway) with webhooks, reusing the idempotency layer | Idempotency ✅ |
| Store: product admin + public shop from the API | — |
| WhatsApp reminders (Business API) | Leads ✅, templates |
| Audit log (who changed what) | Staff roles ✅ |

### Phase 5: Polish and optimisation

Bundle splitting for the public site, axe and Lighthouse in CI, NVDA/TalkBack pass, persistent job queue, index tuning, visual regression screenshots in CI.

---

## Architecture notes

### Frontend (`kovij-fitness-zone/src`)

```
app/        store (Redux Toolkit), queryClient + retry policy, http client, theme, PWA, query keys
shared/     ui/ (design system), hooks/, lib/ (format, api client), domain/ (status vocabulary)
features/   auth · dashboard · members · attendance · payments · leads · catalog · campaigns · settings
layouts/    crm/ (app shell), MarketingLayout
```

- **Server state → TanStack Query.** Every API call is a hook in `features/*/api.js`; keys come from one factory (`app/queryKeys.js`), and writes invalidate exactly what they change.
- **Client state → Redux Toolkit.** Theme, sidebar, staff session and toasts only. A listener middleware persists the session and theme.
- **Single responsibility.** Pages compose feature components; business rules (pricing, sales, standing) live on the server; formatting and status vocabulary live in `shared`.

### Payment idempotency

```
Client                                   Server
─────────────────────────────────────────────────────────────────────────────
useIdempotencyKey(): same payload → same key; edit → new key; success → reset
POST /admin/payments  Idempotency-Key: K
                                         1. insert {scope: staff, key: K, hash(body), processing}
                                            ├─ new       → run handler, store response (2xx/4xx)
                                            ├─ same body, done       → replay stored response
                                            ├─ same body, running    → 409 + Retry-After
                                            ├─ different body        → 422 KEY_REUSED
                                            └─ 5xx                   → record dropped, safe to retry
                                         2. Payment.idempotencyKey is unique: last-line guard
Retry (network drop / timeout / 409): TanStack retries up to 3× with backoff, same key K
```

Verified: concurrent double submit creates one payment, and a retry after completion replays the original receipt.

### Backend (`server/`)

`routes → middleware (auth, role, validate, idempotent) → controllers (thin) → services (pricing, sales, standing, receipts) → models`. Errors are normalised in one handler (Mongo cast, validation and duplicate errors map to 404/422/409). Startup migrations are tracked in a `migrations` collection and are safe to re-run.

---

## Deploying this change

1. ⚠️ **Rotate the Gmail app password** (it's in git history) and stop tracking `kovij-fitness-zone/.env`.
2. ⚠️ **Frontend API base:** set `VITE_API_BASE_URL` to empty on Render (same origin). The committed `.env` sets `http://localhost:4000`, which the new security policy blocks, and which wouldn't work for real visitors anyway.
3. Deploy. On first boot the server migrates automatically: partial unique indexes (so walk-ins without email work), numeric plan prices, canonical phones, member codes. Tested against legacy-shaped data; safe to re-run.
4. Create the owner account if you don't have one: `npm run create-admin -- --email you@example.com --name "Your Name"`.
5. In **Settings → Gym and billing**, set the registration fee and receipt prefix.
6. Tests: `npm test` (unit, instant), `npm run test:e2e` (starts its own throwaway database; never touches yours).
