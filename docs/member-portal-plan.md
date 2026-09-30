# Kovij member app: UX plan and design specification

**What this covers.** Member sign-up, sign-in, password recovery, and the member home ("dashboard"), designed phone-first for Android and adapted for tablet and desktop. It builds on the Kovij design system used by the staff CRM (tokens in `kovij-fitness-zone/src/index.css`) so members and staff see one brand.

**Visual design.** Every screen and state below is drawn on the design canvas **Kovij Member App**. Artboard names are given in *italics* throughout.

**Status.** Plan and design only. Nothing in this document is built yet; section 10 is the build plan.

---

## Contents

0. [Assumptions and missing requirements](#0-assumptions-and-missing-requirements) (read first)
1. [Goals and principles](#1-goals-and-principles)
2. [Navigation and user flows](#2-navigation-and-user-flows)
3. [Screen specifications: authentication](#3-screen-specifications-authentication)
4. [Screen specifications: member home](#4-screen-specifications-member-home)
5. [States: validation, loading, empty, success, error, session](#5-states)
6. [Mobile-first responsive strategy](#6-mobile-first-responsive-strategy)
7. [Mobile-specific components](#7-mobile-specific-components)
8. [Component hierarchy and design system](#8-component-hierarchy-and-design-system)
9. [Accessibility and touch](#9-accessibility-and-touch)
10. [Implementation structure and phases](#10-implementation-structure-and-phases)

---

## 0. Assumptions and missing requirements

The brief asks for features the CRM doesn't support yet. Each gap below has a recommended default, which the design follows; the ones marked **Decide** need your confirmation before building.

### 0.1 How members sign in

| # | Finding in the current system | Recommendation | |
|---|---|---|---|
| A1 | Members can only sign in with **Google** (Firebase popup). The brief needs sign-up, sign-in, forgot and reset password, which implies email and password. | Keep Firebase and **add its Email/Password provider** alongside Google. Firebase already handles password hashing, reset emails, link expiry and brute-force limits, and the server's token exchange works for any Firebase provider. Building our own password system is more work and more risk. | **Decide** |
| A2 | Mobile-number sign-in (OTP) is common in India, but SMS costs money per message and needs DLT registration. | Not in phase 1. Email or Google now; phone OTP later if members ask for it. | **Decide** |
| A3 | Google sign-in uses a popup, which fails in installed web apps and some Android in-app browsers. | Use redirect sign-in on phones and in the installed app; keep the popup on desktop. Serve Firebase's auth helper from our own domain so redirect works in browsers that block third-party storage. | Default |
| A4 | The server issues a 7-day member token. After a password reset, other phones would stay signed in for up to a week. | Short member token (1 hour), silently renewed from Firebase in the background. A password change or a disabled account then signs out every phone within an hour. | Default |

### 0.2 Members who joined at the desk

| # | Finding | Recommendation | |
|---|---|---|---|
| B1 | Walk-ins registered at the desk have a member record but **no login**. Nothing connects a new app account to that record. | On first sign-in the server links the account **automatically when a verified email matches** a desk record. A phone match alone isn't proof (the number isn't verified), so the app asks for a **6-digit app code** the desk generates from the member's profile. The code is single use, expires in 24 h, and allows 5 attempts. *Claim a desk membership* | **Decide** |
| B2 | Family members often share a phone number (the CRM allows this). | The claim screen links exactly one record, the one the code was issued for. | Default |

### 0.3 Registration vs. membership

| # | Finding | Recommendation | |
|---|---|---|---|
| C1 | Today "join" is a 6-step form mixing account, health, plan and uploads. | **Split it.** Sign-up is one short screen (name, mobile, email, password). Choosing a plan and adding health details come afterwards, from home, as "Finish setting up". Short sign-up converts better on phones. | Default |
| C2 | Online joins already wait as "Awaiting payment" until the desk collects (built in the CRM change). | The member app shows exactly that state, with the amount and "Show pass at desk". *Membership card: awaiting payment* | Built |
| C3 | Online payment isn't supported. | Home shows dues with "pay at the front desk". A **Pay** button appears only when online payments ship (CRM roadmap phase 4). | Default |

### 0.4 Dashboard content the CRM doesn't have

The brief says not to invent functionality. These items were therefore scoped to what the CRM actually holds:

| Brief asks for | What exists | Shown in the design |
|---|---|---|
| Workout / training information | No workout programmes or member↔trainer assignment in the CRM | Fitness goal and body metrics from the profile; **weight** from the existing (unused) `BodyMeasurement` model. No workout builder. |
| Upcoming sessions / classes | No classes module (CRM phase 4) | **"At the gym now"**: opening hours plus how busy it usually is, from real check-in history. The card becomes "Next class" when classes ship. |
| Trainer information | Public trainer profiles with shifts | "Trainers" row with shifts; tap for bio and specialties. Assignment appears with PT packages (CRM phase 4). |
| Notifications | None stored; the CRM emails renewals, receipts and welcomes | **"Updates"** feed derived on the server from those same events, with an unread count. Push notifications later (CRM phase 3). |
| Check-in / attendance | Attendance exists but is staff-only | New member endpoint: visits this month, last visit, this week, calendar. **Check-in pass** (QR of the member code) for the desk. |
| Progress / fitness | Height, weight, BMI, goal in the profile | Weight tile with change since the last entry; full history on Profile. |

### 0.5 Other gaps to confirm

| # | Gap | Recommendation | |
|---|---|---|---|
| D1 | Opening hours are hard-coded in the public site's `Timing` component. | Add weekly hours (and closed days) to CRM Settings so the website and the app use one source. | Default |
| D2 | Health details are sensitive personal data under India's DPDP Act 2023; minors need verifiable parental consent. | Consent checkbox at sign-up with a privacy notice link. If date of birth shows under 18, require a guardian's name and phone before health details are saved. | **Decide** |
| D3 | Language | English at launch; all copy kept in one strings module so Hindi can be added. | Default |
| D4 | The staff app and the member app share one website. | Each gets its own install identity: the member area links its own manifest ("Kovij", start `/member/home`) so members never install the staff desk app. | Default |

---

## 1. Goals and principles

**Who uses it:** members aged roughly 16–55, mostly on mid-range Android phones (360–412 px wide), often on patchy mobile data inside a gym, one hand free.

**The three jobs**, in order of frequency:

1. Get in the door: show the pass at the desk.
2. Know where I stand: plan dates, days left, dues.
3. Keep going: visits this week, when the gym is quiet, who the trainers are.

**Principles**

- **Thumb first.** Primary actions sit in the bottom third: bottom navigation, extended floating button for the pass, sticky form buttons.
- **One loud element per screen.** On home it's the dark membership card; everything else is quiet white cards on the chalk canvas.
- **State before data.** The membership card changes shape by state (active, ending, awaiting payment, queued, ended, none), and each state names its next action.
- **Honest copy.** No invented stats; "usually quiet" is computed from real check-ins; money wording says where to pay.
- **Works on bad networks.** Pass and last-known membership load from the phone; nothing important depends on a live request.

---

## 2. Navigation and user flows

### 2.1 Structure

```
Signed out                              Signed in (bottom navigation on phones)
  Welcome ─┬─ Create account              Home ─────────── membership, quick actions, week, gym now, trainers,
           │    └─ Verify email                            payments, updates
           │         └─ Claim (if desk record found)       └─ Check-in pass (floating button, full screen)
           ├─ Sign in                     Visits ───────── month calendar, visit list
           │    └─ Forgot password                        
           │         └─ Link sent ─ (email) ─ Reset password / Link expired
           └─ Claim your account          Payments ─────── dues, receipts (download / email copy)
                                          Profile ──────── details, health and goals, plan history, notifications,
                                                           appearance, help and gym contact, sign out
Always reachable: Updates (bell), Plans (from membership card: choose / renew)
```

Four destinations fit Android's navigation bar guidance (3–5). The pass is a floating action, not a tab, because it's an action you complete, not a place you browse.

### 2.2 Routes

| Route | Screen | Replaces |
|---|---|---|
| `/member` | Welcome (redirects to home when signed in) | — |
| `/member/sign-up`, `/verify-email`, `/claim` | Create account, verify, claim | `/member/join` |
| `/member/sign-in`, `/forgot-password` | Sign in, recovery | `/member/login` |
| `/member/auth/action` | Firebase email action handler: reset password, verify email | — |
| `/member/home`, `/pass`, `/visits`, `/payments`, `/profile/*`, `/plans`, `/updates` | Signed-in app | `/member/dashboard`, `/membership`, `/account/*` |

Old routes redirect to the new ones.

### 2.3 Key flows

**New member, online (5 taps plus the email):** Welcome → Create account (Google, or the email form) → Verify email (open email app, tap link) → Home with "No plan yet" card → See plans → pick a plan → Home shows "Awaiting payment ₹X, show pass at desk".

**Member who joined at the desk:** Welcome → "Claim your account" → Create account with the same mobile/email → after verification:
- email matched the desk record → linked automatically, home shows their live plan
- only the mobile matched → *Claim* screen asks for the desk's 6-digit app code → linked

**Returning member:** app opens straight to Home (session restored from the phone). If the session has ended: *Session ended* sheet → Sign in → back to the same screen.

**Forgot password:** Sign in → Forgot password → Link sent (resend after 60 s) → email link opens `/member/auth/action` → Choose a new password → signed in, other phones signed out. Expired or used link → *Reset link expired* → send a new one.

**At the desk:** Home → Check-in pass (floating button, or the app shortcut from the home-screen icon) → desk scans the QR or types the code. Works offline.

**Renew:** membership card "Renew plan" (shown within 7 days of the end, or after it ends) → Plans → pick a plan → "Awaiting payment" → desk collects → the new plan starts the day after the current one ends.

**Sign out:** Profile → Sign out → confirmation sheet → Welcome, with a snackbar "Signed out". Cached data and the saved pass are removed from the phone.

---

## 3. Screen specifications: authentication

Common frame on phones: top app bar (64 px) with a back or close button (48×48 target), content with 16–20 px side margins, actions pinned to the bottom above the keyboard. Inputs are 52 px high with the label above (not floating), and the error appears below the field with an icon.

### Welcome (*Welcome*)
- Brand mark; headline "Your membership, in your pocket."; one-line promise; a sample membership card showing what they'll get.
- Bottom: **Create account** (filled), **Sign in** (outlined), "Joined at the front desk? **Claim your account**".
- Shown once: signed-in users skip straight to Home.

### Create account (*Create account (email error shown)*)
- **Continue with Google** first (fewest taps), then "or use your email".
- Fields: Full name · Mobile (+91 fixed prefix, numeric keypad) · Email · Password (show/hide, hint "At least 8 characters"). No "confirm password" field: show/hide does that job with less typing.
- Consent checkbox: terms, plus permission to keep health details, with a privacy notice link. Required.
- Sticky **Create account**; "Already have an account? Sign in".
- Autofill: `autocomplete="name | tel-national | email | new-password"`, so Google Password Manager offers a strong password.

### Verify email (*Verify your email*)
- "Check your inbox" with the address shown. **Open email app** (Android intent that opens the default mail app); **Resend link** with a 60-second countdown; "Wrong email? Change it".
- Explains the automatic link to a desk membership.
- The screen polls every 5 s (and checks when the app regains focus), so after tapping the link in the mail app, returning to Kovij continues automatically.

### Claim a desk membership (*Claim a desk membership*)
- Shows the mobile number the member just entered, so they know which desk record was found. Six 58 px digit boxes: numeric keypad, paste fills all six, auto-advance, Backspace moves back.
- **Link membership**; "I'm new to Kovij" continues without linking.
- Errors: wrong code (attempts left), expired code, too many attempts (ask the desk for a new one).

### Sign in (*Sign in (wrong password shown)*)
- Google button, then email and password. "Forgot password?" is a 48 px-tall link, right-aligned.
- Wrong email or password gets one generic message at the top of the form (it never says which one was wrong).
- On success, returns to the screen the member was trying to open.

### Forgot password (*Reset your password*, *Reset link sent*)
- One email field, then **Send reset link**. Note for Google users: there's no Kovij password to reset.
- The confirmation is identical whether or not the account exists ("If there's an account for…"), so it can't be used to discover who is a member. Resend after 55–60 s; "Back to sign in".

### Reset password (*Choose a new password*, *Reset link expired or used*)
- Opened from the email link: the code is verified first (spinner), and the account email is shown.
- New password with show/hide; live checklist (8+ characters, different from email).
- **Save password** signs the member in on this phone; other phones are signed out.
- Expired or used link: explains the 1-hour, single-use rule, with **Send a new link**.

### Sign out (*Profile with sign-out sheet*)
- Profile lists Sign out as an outlined button, never a destructive-looking one inside a list.
- Bottom sheet: "Sign out of Kovij?" and the consequence (the pass needs sign-in again). Buttons: **Sign out** (danger), **Cancel**. The Android back gesture closes the sheet.

### Desktop sign-in (*Desktop sign-in, 1440 px*)
- The same form, 420 px wide and centred, beside a dark brand panel.

---

## 4. Screen specifications: member home

Phone order is the order of importance (*Home, full scroll (light)*, *Home, first screen (dark)*):

| # | Block | Content | Why here |
|---|---|---|---|
| 1 | **Top app bar** (72 px) | Avatar (opens Profile), "Good evening, Priya", bell with unread dot (opens Updates) | Identity plus one notification entry point |
| 2 | **Membership card** (dark hero) | Status badge; big number (days left / amount due / start date); plan and end date; ring of the plan used; the state's action | The one question every member has: "am I good to train?" |
| 3 | **Quick actions** (scrolling chips) | Renew plan, Receipts, Call the desk, WhatsApp, Gym hours | Common tasks one tap away; the row scrolls sideways on phones |
| 4 | **Stat tiles** 2×2 | Visits this month (vs last month), Last visit, Weight (change), Dues | Glanceable progress, modelled on the reference's "daily target" tiles |
| 5 | **This week** | 7 day circles, visited days filled, today dashed | Streak motivation without inventing goals |
| 6 | **At the gym now** | Open/closed until X; "Getting busy, usually quieter after 8 pm"; typical crowd by hour with the current hour highlighted | Replaces "classes"; genuinely useful for planning a visit |
| 7 | **Trainers** | Horizontal photo cards: name, specialty, shift | Visual variety like the reference's activity cards; real data |
| 8 | **Payments** | Next renewal; last receipt (tap to open) | Money status without leaving home |
| 9 | **Updates** | Latest 2 events | Replaces a notification centre until push exists |
| — | **Check-in pass** (extended floating button) | Bottom-right, above the navigation bar | The action members take most, in thumb reach |
| — | **Navigation bar** (80 px) | Home, Visits, Payments, Profile | Android navigation bar pattern |

### Membership card states (*Membership card: …* artboards)

| State | Big number | Action | Tone |
|---|---|---|---|
| Active | days left + plan-used ring | none (pass is the floating button) | green badge |
| Ends soon (≤ 7 days) | days left, amber ring | **Renew plan**; note that the next plan starts the day after, so no days are lost | amber |
| Awaiting payment | ₹ amount due | **Show pass at desk**; how to pay | amber |
| Next plan queued | start date | none | blue |
| Ended | days since it ended | **Renew plan** | red |
| No plan yet | "Ready?" | **See plans** | neutral |

### Check-in pass (*Check-in pass*)
- Full screen on phones: QR (a signed token for the member code, refreshed daily; the plain code is the fallback), name, code in large spaced letters, validity.
- Keeps the screen on (Screen Wake Lock) and **works offline** (saved at the last sign-in).
- "Can't scan? Tell the desk your code."
- Also available as an app-icon shortcut ("Check-in pass").

---

## 5. States

### 5.1 Form validation

| Field | Rule | Message |
|---|---|---|
| Full name | Required, 2–80 characters | "Enter your name as the desk should see it" |
| Mobile | 10 digits starting 6–9; spaces, `+91` and a leading `0` are stripped on paste | "Enter a 10-digit mobile number" |
| Email | Required for email sign-up; valid format; stored lowercase | "Enter a full email address, like name@gmail.com" |
| Password | 8–128 characters, not the email; Firebase password policy on | "Use at least 8 characters" |
| Consent | Must be ticked | "Tick this to continue. We need it to keep your health details." |
| App code | 6 digits | "Enter all 6 digits" |

**Timing:** validate a field when the member leaves it; after its first error, re-check as they type. On submit, move focus to the first invalid field and announce the error. Server-side errors map back to the same field.

**Firebase errors → member-facing copy**

| Code | Message |
|---|---|
| `auth/email-already-in-use` | "There's already an account with this email. **Sign in** instead." |
| `auth/invalid-credential`, `wrong-password`, `user-not-found` | "Email or password is incorrect. Check them, or reset your password." |
| `auth/too-many-requests` | "Too many attempts. Wait a few minutes or reset your password." |
| `auth/network-request-failed` | "No connection. Check your internet and try again." |
| `auth/user-disabled` | "This account is paused. Please contact the front desk." |
| `auth/expired-action-code`, `invalid-action-code` | Reset link expired screen |
| `auth/popup-closed-by-user` | Nothing; the member simply returns to the form |

### 5.2 Loading

| Where | Treatment |
|---|---|
| Button actions | Spinner inside the button; the label stays ("Creating account…"); double taps ignored |
| App start with a saved session | Home paints immediately from saved data; a thin progress line shows while it refreshes. First launch ever: brand splash (from the manifest) |
| First load of a screen | Skeletons shaped like the real layout (*Loading (skeleton)*) |
| Refresh | Pull to refresh; content stays visible, no skeleton flash |

### 5.3 Empty (*New member (empty states)*)

| Where | Copy and action |
|---|---|
| No plan | Membership card "Ready? Pick a plan", **See plans** |
| No visits yet | "Your check-ins will appear here after your first workout." |
| No payments | "Receipts appear here after your first payment at the desk." |
| No updates | "You're all caught up." |
| New account | **Finish setting up** checklist: email verified, photo, emergency contact, health and goals (each optional except verification) |

### 5.4 Success feedback
Snackbars at the bottom, above the navigation bar, with one action where useful: "Password changed", "Signed out", "Membership linked", "Receipt emailed to …", "Plan requested. Pay ₹X at the desk" (action: Show pass). Membership changes also update the card immediately.

### 5.5 Errors
- **Inline:** forms (5.1).
- **Section:** a card that fails to load shows "Couldn't load visits" with **Try again**, while the rest of home still works.
- **Screen:** full-screen error with retry only when nothing can be shown.
- **Offline** (*Offline (saved copy)*): amber banner "You're offline. Showing what was saved at 8:14 am. Your pass still works." Receipts and plan changes show why they're unavailable instead of failing.

### 5.6 Session and account states

| State | What the member sees |
|---|---|
| Signed out | Welcome |
| Restoring (saved session) | Home from saved data, refreshing |
| Email not verified | Verify email screen until verified (Google accounts skip this) |
| Desk record found by phone | Claim screen (skippable) |
| Session ended (renewal failed, 30 days away, password changed elsewhere) | *Session ended* sheet over the current screen, then Sign in, then back to the same screen |
| Account paused (member deactivated by staff) | "Your account is paused. Please contact the front desk." with Call / WhatsApp buttons |
| Signed out on this phone | Pass and saved data removed |

---

## 6. Mobile-first responsive strategy

### 6.1 Breakpoints

One breakpoint system for the whole product (the staff CRM uses the same Tailwind values). They line up closely with Android's window size classes.

| Class | Width | Typical devices | Navigation |
|---|---|---|---|
| **Compact** | < 640 px | Android phones 360–430 wide (Galaxy A/S, Pixel, Redmi) | Bottom navigation bar + floating pass button |
| **Medium** | 640–1023 | Large phones landscape, foldables open (~673–840), small tablets portrait (800–834) | Navigation rail (96 px) with the pass button at its top |
| **Expanded** | 1024–1279 | Tablets landscape, small laptops | Rail + two-column content |
| **Large** | 1280–1535 | Laptops and desktops | Rail + two columns + right panel (pass, payments, updates) |
| **Extra-large** | ≥ 1536 | Large monitors | Same as large; content capped at 1440 px and centred |

**Height** also matters. On short screens (< 700 px tall: 360×640 phones, landscape phones), the membership card uses its compact form (smaller ring, no note), and sticky bottom actions stop sticking while the keyboard is open.

**Test matrix:** 360×640, 360×800, 393×851, 412×915, 673×841 (foldable), 834×1194 (tablet portrait), 1280×800, 1440×900, 1920×1080; Android font size at 100%, 130% and 200%.

### 6.2 How components change

| Component | Compact | Medium / expanded | Large+ | Behaviour |
|---|---|---|---|---|
| Navigation | Bottom bar (4 items) | Rail with labels | Rail | **Changes structure** |
| Check-in pass | Floating button → full-screen pass | Button at the top of the rail → pass sheet | Always visible in the right panel | **Replaced** by a persistent panel on large screens |
| Membership card | Full width | Full width (tablet) / left column | Left column | **Scales** (number 56→64 px) |
| Quick actions | One row, scrolls sideways | Wraps onto 2 lines | Card in the left column | **Horizontally scrollable → reflows** |
| Stat tiles | 2×2 grid | 4 in a row | 2×2 beside the membership card | **Reflows** |
| This week + Gym now | Stacked | Side by side | Split across the two columns | **Stacks vertically** on phones |
| Trainers | Scrolls sideways, partial last card | Scrolls sideways | 5 cards visible | **Horizontally scrollable** |
| Payments, Updates | Cards in the scroll | Cards | **Moved into the right panel** | **Changes structure** |
| Dialogs and confirmations | Bottom sheet | Centred dialog | Centred dialog | **Mobile-specific component** |
| Snackbars | Bottom, above the nav bar | Bottom left | Bottom left | Moves |
| Auth forms | Full screen, sticky button | Centred card 480 px | Form beside a brand panel | **Changes structure** |
| Top app bar | Greeting + bell | Same | Greeting + bell + avatar, larger type | Scales |
| Visits calendar | List first, month grid collapsed | Month grid + list side by side | Same | Reflows |

### 6.3 Android device realities

- **Edge-to-edge:** content respects `env(safe-area-inset-*)` so gesture navigation and camera cutouts never cover buttons. The status bar colour follows the theme (`theme-color`).
- **Keyboard:** `interactive-widget=resizes-content` in the viewport tag keeps the sticky button above the keyboard; the focused field scrolls into view.
- **Viewport units:** `dvh`, not `vh`, so the address bar showing and hiding doesn't jump the layout.
- **Back gesture:** closes the open sheet or dialog first, then goes back a screen, never out of the app from a sheet.
- **Font scaling:** all sizes in `rem`; layouts tested at 200% (tiles become one column, labels wrap).
- **Aspect ratios 16:9 to 21:9:** nothing depends on a fixed height except the bars; the content area scrolls.

---

## 7. Mobile-specific components

Built for touch rather than shrunk from desktop:

| Component | Spec | Replaces on phones |
|---|---|---|
| **Navigation bar** | 80 px, 4 items, 60×32 pill behind the active icon, labels always visible | Sidebar |
| **Extended floating button** | 56 px, "Check-in pass", bottom-right, 16 px above the nav bar; shrinks to an icon while scrolling down | Pass panel |
| **Top app bar** | 64–72 px; title collapses from large to small on scroll on secondary screens | Page header |
| **Bottom sheet** | Drag handle, 28 px top radius, swipe or back to dismiss, focus trapped | Centred dialogs |
| **Snackbar** | One line plus one action, bottom, 4 s (errors stay until dismissed) | Toasts |
| **Pull to refresh** | On home, visits and payments | Refresh button |
| **Chip row** | 44 px chips, scrolls sideways, last chip partly visible as a scroll hint | Button groups |
| **Code input** | 6 boxes, numeric keypad, paste and SMS/one-time-code autofill | Single text field |
| **Password field** | Show/hide toggle, strength checklist on reset | Password + confirm pair |
| **Full-screen pass** | Wake lock, offline | Sidebar pass panel |
| **Horizontal card scroller** | Snap to cards, 16 px peek | Grid |

**Density on phones.** Visual sizes are compact (chips 44, list rows 64, text fields 52, buttons 48–52), but **every target is at least 48×48 px**. Spacing uses an 8 px grid with 16 px margins and 12–16 px between cards. Type: headlines 22–28 px, body 15–16 px (never below 14), labels 12–13 px.

**Motion.** Sheets slide up (220 ms); the pressed state is an 8% ink overlay; the floating button shrinks on scroll. Nothing animates on its own, and reduced-motion settings are respected.

---

## 8. Component hierarchy and design system

```
Tokens (shared with the staff app: index.css)
 └ Primitives:  Button (pill shape for the member app) · IconButton · TextField · PasswordField · CodeInput
 │              Checkbox · Chip · Badge / StatusBadge · Avatar · Card · ListItem · Skeleton · Ring (progress)
 └ Mobile:      TopAppBar · NavigationBar · NavigationRail · BottomSheet · Snackbar · ExtendedFab
 │              PullToRefresh · ChipRow · HorizontalScroller
 └ Patterns:    AuthScreen (layout) · FormActions (sticky) · MembershipCard (state machine) · StatTile
 │              WeekStrip · GymNowCard · TrainerCard · PaymentsSummary · UpdatesList · PassCard (QR)
 │              EmptyState · ErrorState · OfflineBanner · SessionSheet
 └ Shells:      MemberShell (picks bar / rail / rail + panel by size class) · AuthShell
 └ Screens:     Welcome · SignUp · VerifyEmail · Claim · SignIn · ForgotPassword · ResetPassword
                Home · Pass · Visits · Payments · Profile · Plans · Updates
```

**Reuse from the staff app** (already built): tokens and dark mode, `Field`, `Input`, `Dialog` (already a bottom sheet on phones), `Badge`/`StatusBadge` and its status vocabulary, `Avatar`, skeleton/empty/error states, the toast store, the `ApiError` client, TanStack Query and the Redux store.

**Member-app specifics:** pill buttons and larger radii (cards 20–24, hero 28) give the consumer app a friendlier feel than the staff tool, while colour, type (Manrope) and status language stay identical.

**Retire:** `BentoUI` and its pastel card tones, `MemberSidebar`, `MemberBottomNav`, `MemberAuthContext` (moves to the Redux session slice), plus the Account hub's duplicate entries ("Transactions" duplicates Payments; "Saved addresses" is a placeholder).

---

## 9. Accessibility and touch

| Area | Rule |
|---|---|
| Targets | ≥ 48×48 px, ≥ 8 px apart; primary actions in the bottom third |
| One-handed use | Nav bar, floating button, sticky form buttons and sheet buttons all within thumb reach; nothing essential only at the top except Back |
| Contrast | Same measured tokens as the staff app: text ≥ 4.5:1, controls and focus ≥ 3:1, in both themes |
| Screen readers (TalkBack) | Real buttons and links; icon buttons labelled ("Updates, 2 new"); the membership card reads as one sentence ("Active. 24 days left. Quarterly plan ends 23 October."); the QR has a text alternative (the code) |
| Forms | Visible labels; errors linked to fields and announced; no placeholder-only fields; correct keyboard per field (`inputmode`) and autofill (`autocomplete`) |
| Status | Never colour alone: every status carries an icon and a word |
| Gestures | Every swipe has a button alternative (close ✕ on sheets, pull-to-refresh also triggers on app resume) |
| Text size | Works at 200% system font size; no truncated essential text (it wraps) |
| Motion | Respects "Remove animations"; no auto-playing motion |
| Time limits | Resend countdowns only delay; they never expire the form. Reset links expire after 1 h, with a clear way to request a new one |
| Focus | Visible focus ring for keyboard and switch access; focus moves into sheets and returns to the trigger |

---

## 10. Implementation structure and phases

### 10.1 Frontend (inside the existing React app)

```
src/features/member/
  app/        MemberShell.jsx · navigation.js · memberSessionSlice.js · memberHttp.js · useSizeClass.js
  auth/       firebaseAuth.js   (lazy wrapper: google (redirect on phones), signUp, signIn, sendReset,
                                 checkResetCode, confirmReset, sendVerification, signOut)
              authErrors.js     (Firebase code → copy, section 5.1)
              api.js            (session exchange, claim)
              RequireMember.jsx · screens/{Welcome,SignUp,VerifyEmail,Claim,SignIn,ForgotPassword,ResetPassword}.jsx
  home/       api.js (useMemberHome) · HomeScreen.jsx · MembershipCard.jsx · StatGrid.jsx · WeekStrip.jsx
              GymNowCard.jsx · TrainerRow.jsx · PaymentsSummary.jsx · UpdatesPreview.jsx · QuickActions.jsx
  pass/       PassScreen.jsx (wake lock, saved pass)
  visits/ · payments/ · profile/ · plans/ · updates/
src/shared/ui/mobile/   TopAppBar · NavigationBar · NavigationRail · BottomSheet · Snackbar · ExtendedFab
                        PullToRefresh · CodeInput · PasswordField · Ring · HorizontalScroller
src/shared/hooks/       useSizeClass · useBackToClose · useWakeLock · useCountdown · usePullToRefresh
```

- **State:** session in a Redux slice (like the staff session); all server data through TanStack Query hooks, one query-key factory. Membership, pass and the latest home payload are persisted on the phone for offline use; health details are never persisted.
- **Firebase** stays lazy-loaded (it's already out of the main bundle).
- **PWA:** member manifest ("Kovij", start `/member/home`, shortcut "Check-in pass") linked on member routes; the service worker caches the member home and pass for offline use and never caches receipts.

### 10.2 Backend additions

| Endpoint / change | Purpose |
|---|---|
| `POST /api/member/auth/session` | Exchange any Firebase token (Google or email) for a short member token; auto-link a desk record by verified email; report `claimable` when only the phone matches |
| `POST /api/admin/members/:id/app-code` (staff) · `POST /api/member/auth/claim` | Desk issues a 6-digit code; member links it (hashed, 24 h, single use, 5 attempts) |
| `GET /api/member/home` | Everything home needs in one request: membership state, dues, visits (month, last, week), weight, gym status (hours + typical crowd by hour), trainers, payments summary, updates |
| `GET /api/member/visits?month=` | Calendar and list |
| `GET/POST /api/member/measurements` | Weight log (existing `BodyMeasurement` model) |
| `GET /api/member/updates` · `Member.updatesSeenAt` | Derived updates feed and unread count |
| `Settings.openingHours` | One source of hours for the website and the app |
| Member token 1 h + `ACCOUNT_PAUSED` response | Section 0.1, A4; staff-deactivated members |

### 10.3 Firebase console setup (one-time)
Enable the Email/Password provider · add the site to authorised domains · set the email action URL to `/member/auth/action` and brand the sender name and templates · minimum password length 8 · turn on email enumeration protection · optionally App Check (reCAPTCHA) against scripted sign-ups.

### 10.4 Phases

| Phase | Scope | Depends on |
|---|---|---|
| **M1 Accounts** | Firebase email/password + Google redirect, session exchange, verify email, reset handler, claim codes (+ "App code" button on the staff member profile), redirects from old routes | Decisions A1, B1, D2 |
| **M2 Home and pass** | `/member/home`, membership card states, quick actions, tiles, week, gym now, trainers, payments, updates, offline pass | M1 |
| **M3 Rest of the app** | Visits, Payments (receipts), Profile (details, health, weight log, appearance, sign out), Plans (choose/renew using the existing request-and-pay-at-desk flow), Updates | M2 |
| **M4 App feel and polish** | Member manifest and install prompt, pull to refresh, collapsing top bar, back-gesture handling, 200% font and TalkBack pass, test matrix (section 6.1) | M3 |
| Later | Push notifications, phone OTP, online payments, classes, PT packages | CRM roadmap phases 3–4 |

**Tests:** extend `npm run test:e2e` with member flows (session exchange, auto-link, claim-code limits, home payload per membership state, token expiry), plus screenshot checks at 360, 412, 834 and 1440 px in both themes.
