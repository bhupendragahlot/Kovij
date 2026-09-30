// End-to-end API checks. Run through run.mjs, which starts an isolated database and server.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

const BASE = process.env.E2E_API || "http://localhost:4100/api";
const ORIGIN = BASE.replace(/\/api$/, "");
const SECRET = process.env.E2E_JWT_SECRET || "e2e-secret";
let pass = 0;
let fail = 0;
const results = [];
function check(name, cond, extra = "") {
  if (cond) pass++;
  else fail++;
  results.push(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  ${extra}`}`);
}
const key = () => crypto.randomUUID().replace(/-/g, "");

async function call(method, path, { body, token, idem, raw } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (idem) headers["Idempotency-Key"] = idem;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html */
  }
  return { status: res.status, body: json, text: raw ? text : undefined, headers: res.headers };
}

// ── Security basics
check("unauthenticated admin list is 401", (await call("GET", "/admin/members")).status === 401);
check("public staff self-registration removed (404)", (await call("POST", "/auth/register", { body: { email: "x@y.z", password: "12345678", username: "xx" } })).status === 404);
const bad = await call("POST", "/auth/login", { body: { email: "owner@kovij.test", password: "nope" } });
check("wrong password is 401 INVALID_CREDENTIALS", bad.status === 401 && bad.body.code === "INVALID_CREDENTIALS", JSON.stringify(bad.body));
const login = await call("POST", "/auth/login", { body: { email: "owner@kovij.test", password: "owner-pass-123" } });
check("admin login", login.status === 200 && login.body.token && login.body.user.role === "admin", JSON.stringify(login.body));
const T = login.body.token;
check("GET /auth/me", (await call("GET", "/auth/me", { token: T })).body?.user?.email === "owner@kovij.test");

// ── Settings + plans
const st = await call("PATCH", "/admin/settings", { token: T, body: { registrationFee: 500, invoicePrefix: "kfz", gymName: "Kovij Fitness Zone", phone: "9000000000" } });
check("settings update", st.status === 200 && st.body.settings.registrationFee === 500 && st.body.settings.invoicePrefix === "KFZ", JSON.stringify(st.body));
const pub = await call("GET", "/settings");
check("public settings expose fee, hide invoice prefix", pub.body.registrationFee === 500 && pub.body.invoicePrefix === undefined, JSON.stringify(pub.body));
const plan = await call("POST", "/plans", { token: T, body: { name: "Monthly", price: 1500, duration: "month", features: ["Gym floor"] } });
check("create plan", plan.status === 201 && plan.body.price === 1500, JSON.stringify(plan.body));
const plan2 = await call("POST", "/plans", { token: T, body: { name: "Quarterly", price: 4000, duration: "quarter" } });
const PLAN = plan.body._id;
const badPlan = await call("POST", "/plans", { token: T, body: { name: "", price: -5, duration: "month" } });
check("plan validation returns 422 with field errors", badPlan.status === 422 && badPlan.body.details?.fields?.name, JSON.stringify(badPlan.body));

// ── Desk registration with idempotent payment
const reg = { details: { name: "Priya Sharma", phone: "98765 43210", email: "priya@example.com", gender: "female" }, membership: { planId: PLAN, payment: { collect: "now", mode: "upi", txnRef: "UPI123" } } };
const K1 = key();
const r1 = await call("POST", "/admin/members", { token: T, body: reg, idem: K1 });
check("register member with plan (201)", r1.status === 201 && r1.body.member.memberCode, JSON.stringify(r1.body));
check("first plan charges registration + plan", r1.body.sale?.payments?.length === 2 && r1.body.sale.payments.every((p) => p.status === "paid"), JSON.stringify(r1.body.sale));
check("sequential invoice number", /^KFZ-\d{4}-\d{5}$/.test(r1.body.sale?.payments?.[0]?.invoiceNo || ""), r1.body.sale?.payments?.[0]?.invoiceNo);
const r1b = await call("POST", "/admin/members", { token: T, body: reg, idem: K1 });
check("retry with same key replays (no duplicate)", r1b.status === 201 && r1b.headers.get("idempotent-replayed") === "true" && r1b.body.member._id === r1.body.member._id, `${r1b.status} ${r1b.headers.get("idempotent-replayed")}`);
const r1c = await call("POST", "/admin/members", { token: T, body: { ...reg, details: { ...reg.details, name: "Other" } }, idem: K1 });
check("same key + different body is 422", r1c.status === 422 && r1c.body.code === "IDEMPOTENCY_KEY_REUSED", JSON.stringify(r1c.body));
check("missing Idempotency-Key is 400", (await call("POST", "/admin/members", { token: T, body: reg })).status === 400);
const PRIYA = r1.body.member._id;

const dup = await call("POST", "/admin/members", { token: T, body: { details: { name: "Priya S", phone: "+91 98765-43210" } }, idem: key() });
check("duplicate phone blocked with matches", dup.status === 409 && dup.body.code === "DUPLICATE_MEMBER" && dup.body.details.matches[0].id === PRIYA, JSON.stringify(dup.body));
const dupForced = await call("POST", "/admin/members", { token: T, body: { details: { name: "Anu Sharma", phone: "9876543210" }, force: true }, idem: key() });
check("duplicate phone allowed with force (family)", dupForced.status === 201, JSON.stringify(dupForced.body));

const later = await call("POST", "/admin/members", { token: T, body: { details: { name: "Rahul Verma", phone: "9811122233" }, membership: { planId: PLAN, payment: { collect: "later" } } }, idem: key() });
check("register with pay-later creates dues, plan active", later.status === 201 && later.body.sale.membership.status === "active" && later.body.sale.payments.every((p) => p.status === "pending"), JSON.stringify(later.body));
const RAHUL = later.body.member._id;
const noPlan = await call("POST", "/admin/members", { token: T, body: { details: { name: "Neha <script>alert(1)</script>", phone: "9822233344" } }, idem: key() });
const NEHA = noPlan.body.member._id;

// ── Lists
const list = await call("GET", "/admin/members?state=all", { token: T });
check("members list with counts", list.status === 200 && list.body.counts.all === 4 && list.body.counts.active === 2 && list.body.counts.none === 2, JSON.stringify(list.body.counts));
const dues = await call("GET", "/admin/members?state=dues", { token: T });
check("members with dues filter", dues.body.members.length === 1 && dues.body.members[0]._id === RAHUL && dues.body.members[0].dues === 2000, JSON.stringify(dues.body.members?.map((m) => [m.name, m.dues])));
const search = await call("GET", "/admin/members?q=43210", { token: T });
check("search by phone digits", search.body.members.length === 2, search.body.members.map((m) => m.name).join(","));
const regexSafe = await call("GET", `/admin/members?q=${encodeURIComponent("(((")}`, { token: T });
check("regex characters in search don't crash", regexSafe.status === 200);
check("invalid ObjectId is 404, not 500", (await call("GET", "/admin/members/not-an-id", { token: T })).status === 404);

// ── Check-in
const c1 = await call("POST", "/admin/attendance", { token: T, body: { memberId: PRIYA } });
check("check-in active member (201)", c1.status === 201 && c1.body.alreadyCheckedIn === false && c1.body.membership.state === "active", JSON.stringify(c1.body));
const c2 = await call("POST", "/admin/attendance", { token: T, body: { memberId: PRIYA } });
check("second check-in same day is idempotent (200, already)", c2.status === 200 && c2.body.alreadyCheckedIn === true);
const c3 = await call("POST", "/admin/attendance", { token: T, body: { memberId: NEHA } });
check("check-in without plan blocked (409)", c3.status === 409 && c3.body.code === "MEMBERSHIP_INACTIVE" && c3.body.details.membership.state === "none", JSON.stringify(c3.body));
const c4 = await call("POST", "/admin/attendance", { token: T, body: { memberId: NEHA, override: true } });
check("override needs a reason (422)", c4.status === 422, JSON.stringify(c4.body));
const c5 = await call("POST", "/admin/attendance", { token: T, body: { memberId: NEHA, override: true, overrideReason: "Paying tomorrow" } });
check("override with reason (201)", c5.status === 201 && c5.body.attendance.membershipStatus === "none", JSON.stringify(c5.body));
const att = await call("GET", "/admin/attendance", { token: T });
check("today's attendance list", att.body.total === 2 && att.body.byHour.length === 24);
const undo = await call("DELETE", `/admin/attendance/${c5.body.attendance._id}`, { token: T });
check("undo check-in", undo.status === 200 && (await call("GET", "/admin/attendance", { token: T })).body.total === 1);

// ── Payments: record (concurrent double-submit), collect, receipt
const pt = { memberId: PRIYA, type: "personal_training", amount: 3000, mode: "cash", note: "8 PT sessions" };
const K2 = key();
const [p1, p2] = await Promise.all([
  call("POST", "/admin/payments", { token: T, body: pt, idem: K2 }),
  call("POST", "/admin/payments", { token: T, body: pt, idem: K2 }),
]);
const statuses = [p1.status, p2.status].sort().join(",");
check("concurrent double-submit: one payment, other replayed or told to wait", ["201,201", "201,409"].includes(statuses), statuses);
const p3 = await call("POST", "/admin/payments", { token: T, body: pt, idem: K2 });
check("retry after completion replays", p3.headers.get("idempotent-replayed") === "true" && p3.body.payment._id === (p1.body.payment || p2.body.payment)._id);
const ptList = await call("GET", `/admin/payments?status=all&memberId=${PRIYA}`, { token: T });
check("exactly one PT payment stored", ptList.body.payments.filter((p) => p.type === "personal_training").length === 1, ptList.body.payments.length);

const pend = await call("GET", "/admin/payments?status=pending", { token: T });
check("dues list", pend.body.payments.length === 2 && pend.body.totals.pending.amount === 2000, JSON.stringify(pend.body.totals));
const target = pend.body.payments[0];
const K3 = key();
const col = await call("POST", `/admin/payments/${target._id}/collect`, { token: T, body: { mode: "card" }, idem: K3 });
check("collect a due", col.status === 200 && col.body.payment.status === "paid" && col.body.payment.mode === "card", JSON.stringify(col.body));
const col2 = await call("POST", `/admin/payments/${target._id}/collect`, { token: T, body: { mode: "card" }, idem: K3 });
check("collect retry replays", col2.status === 200 && col2.headers.get("idempotent-replayed") === "true");
const col3 = await call("POST", `/admin/payments/${target._id}/collect`, { token: T, body: { mode: "card" }, idem: key() });
check("collecting twice with a new key is refused (409 ALREADY_PAID)", col3.status === 409 && col3.body.code === "ALREADY_PAID", JSON.stringify(col3.body));

const receipt = await fetch(`${BASE}/admin/payments/${r1.body.sale.payments[0]._id}/receipt`, { headers: { Authorization: `Bearer ${T}` } }).then((r) => r.text());
check("receipt renders invoice number", receipt.includes(r1.body.sale.payments[0].invoiceNo));
const nehaPay = await call("POST", "/admin/payments", { token: T, body: { memberId: NEHA, type: "other", amount: 100, mode: "cash" }, idem: key() });
const nehaReceipt = await fetch(`${BASE}/admin/payments/${nehaPay.body.payment._id}/receipt`, { headers: { Authorization: `Bearer ${T}` } }).then((r) => r.text());
check("receipt escapes HTML in member names", nehaReceipt.includes("&lt;script&gt;") && !nehaReceipt.includes("<script>alert"), nehaReceipt.slice(0, 200));

// ── Renewal (queued after current plan)
const K4 = key();
const renew = await call("POST", `/admin/members/${PRIYA}/memberships`, { token: T, body: { planId: plan2.body._id, start: "auto", payment: { collect: "now", mode: "cash" } }, idem: K4 });
check("renewal queues after current plan (upcoming)", renew.status === 201 && renew.body.sale.membership.status === "upcoming" && renew.body.sale.payments.length === 1, JSON.stringify(renew.body));
const renew2 = await call("POST", `/admin/members/${PRIYA}/memberships`, { token: T, body: { planId: PLAN, payment: { collect: "later" } }, idem: key() });
check("second queued plan refused (409 RENEWAL_EXISTS)", renew2.status === 409 && renew2.body.code === "RENEWAL_EXISTS");
const detail = await call("GET", `/admin/members/${PRIYA}`, { token: T });
check("member detail", detail.status === 200 && detail.body.memberships.length === 2 && detail.body.attendance.total === 1, JSON.stringify({ m: detail.body.memberships?.length, a: detail.body.attendance }));

const inUse = await call("DELETE", `/plans/${PLAN}`, { token: T });
check("deleting a sold plan is blocked (409 PLAN_IN_USE)", inUse.status === 409 && inUse.body.code === "PLAN_IN_USE");

// ── Dashboard (admin sees revenue)
const dash = await call("GET", "/admin/dashboard", { token: T });
check("dashboard for admin includes revenue", dash.status === 200 && dash.body.revenue?.monthToDate > 0 && dash.body.today.checkIns === 1 && dash.body.members.active === 2, JSON.stringify({ rev: dash.body.revenue, today: dash.body.today?.checkIns, m: dash.body.members, err: dash.body.message }));

// ── Roles: front-desk staff
const staff = await call("POST", "/admin/staff", { token: T, body: { name: "Desk Person", username: "desk1", email: "desk@kovij.test", role: "staff", password: "desk-pass-123" } });
check("admin creates staff account", staff.status === 201, JSON.stringify(staff.body));
const S = (await call("POST", "/auth/login", { body: { email: "desk@kovij.test", password: "desk-pass-123" } })).body.token;
const sDash = await call("GET", "/admin/dashboard", { token: S });
check("staff dashboard hides revenue", sDash.status === 200 && sDash.body.revenue === undefined);
check("staff cannot change plans (403)", (await call("POST", "/plans", { token: S, body: { name: "X", price: 1, duration: "day" } })).status === 403);
check("staff cannot change settings (403)", (await call("PATCH", "/admin/settings", { token: S, body: { registrationFee: 0 } })).status === 403);
check("staff cannot override price (403)", (await call("POST", `/admin/members/${NEHA}/memberships`, { token: S, body: { planId: PLAN, priceOverride: 1, payment: { collect: "later" } }, idem: key() })).status === 403);
const sPay = await call("GET", "/admin/payments?status=all", { token: S });
check("staff sees dues total but not revenue total", sPay.body.totals.pending && sPay.body.totals.paid === undefined);
const deact = await call("PATCH", `/admin/staff/${staff.body.staff.id}`, { token: T, body: { isActive: false } });
check("deactivating staff ends their session immediately", deact.status === 200 && (await call("GET", "/admin/members", { token: S })).status === 401);
const selfLock = await call("PATCH", `/admin/staff/${login.body.user.id}`, { token: T, body: { role: "staff" } });
check("admin cannot demote themself (409)", selfLock.status === 409);

// ── Member tokens can't reach staff APIs
const memberToken = jwt.sign({ memberId: RAHUL, type: "member", role: "user" }, SECRET, { expiresIn: "1h" });
check("member token refused on staff API (403)", (await call("GET", "/admin/members", { token: memberToken })).status === 403);
check("member token can't create plans (403)", (await call("POST", "/plans", { token: memberToken, body: { name: "Free", price: 0, duration: "year" } })).status === 403);
check("members can no longer record their own payments (404)", (await call("POST", "/payments/record", { token: memberToken, body: { type: "membership", amount: 0, mode: "cash", status: "paid" } })).status === 404);

// ── Self-join is priced by the server and waits for payment
const joiner = await call("POST", "/admin/members", { token: T, body: { details: { name: "Online Joiner", phone: "9833344455" } }, idem: key() });
const JID = joiner.body.member._id;
const jt = jwt.sign({ memberId: JID, type: "member", role: "user" }, SECRET, { expiresIn: "1h" });
const join = await call("POST", "/membership/join", {
  token: jt,
  body: {
    personalDetails: { fullName: "Online Joiner", age: 28, gender: "male", mobile: "9833344455", email: "joiner@example.com", address: { city: "Kota", state: "RJ" } },
    healthDetails: { heightCm: 175, weightKg: 70, medicalCondition: { has: false } },
    fitnessGoal: { goalKind: "general_fitness" },
    selectedPlanId: PLAN,
    // A tampered client trying to set its own price and status: must be ignored.
    payment: { registrationFee: 0, membershipFee: 0, mode: "cash", status: "paid" },
  },
});
check("self-join creates pending membership with server prices", join.status === 201 && join.body.membership.status === "pending" && join.body.membership.amountDue === 2000, JSON.stringify(join.body));
const mine = await call("GET", "/membership/me", { token: jt });
check("member sees awaiting-payment state + dues", mine.body.membership?.status === "pending" && mine.body.dues.amount === 2000, JSON.stringify({ s: mine.body.membership?.status, d: mine.body.dues }));
check("pending member can't check in", (await call("POST", "/admin/attendance", { token: T, body: { memberId: JID } })).body.code === "MEMBERSHIP_INACTIVE");
const jDues = (await call("GET", `/admin/payments?status=pending&memberId=${JID}`, { token: T })).body.payments;
for (const d of jDues) await call("POST", `/admin/payments/${d._id}/collect`, { token: T, body: { mode: "upi" }, idem: key() });
const afterPay = await call("GET", "/membership/me", { token: jt });
check("collecting all dues activates the membership", afterPay.body.membership?.status === "active" && afterPay.body.dues.amount === 0, JSON.stringify({ s: afterPay.body.membership?.status, d: afterPay.body.dues }));

// ── Leads + website contact form
const lead = await call("POST", "/admin/leads", { token: T, body: { name: "Karan", phone: "9844455566", source: "instagram", interestPlanId: PLAN, note: "Asked about evening batch" } });
check("create lead", lead.status === 201 && lead.body.lead.notes.length === 1, JSON.stringify(lead.body));
const note = await call("POST", `/admin/leads/${lead.body.lead._id}/notes`, { token: T, body: { text: "Coming Saturday for trial" } });
check("logging a note moves new → contacted", note.body.lead.status === "contacted");
const conv = await call("POST", `/admin/leads/${lead.body.lead._id}/convert`, { token: T });
check("convert lead to member", conv.status === 201 && conv.body.member.memberCode, JSON.stringify(conv.body));
const conv2 = await call("POST", `/admin/leads/${lead.body.lead._id}/convert`, { token: T });
check("converting twice returns the same member", conv2.body.alreadyConverted === true && String(conv2.body.memberId) === String(conv.body.memberId));
const contact = await call("POST", "/send-email", { body: { name: "Web <b>Visitor</b>", email: "visitor@example.com", phone: "9855566677", message: "Hi <img src=x onerror=alert(1)>" } });
check("website contact form accepted", contact.status === 200 && contact.body.success, JSON.stringify(contact.body));
const webLeads = await call("GET", "/admin/leads?status=new", { token: T });
check("website enquiry becomes a lead", webLeads.body.leads.some((l) => l.source === "website" && l.email === "visitor@example.com"));
const badContact = await call("POST", "/send-email", { body: { name: "", email: "not-an-email", message: "" } });
check("contact form validates input (422)", badContact.status === 422);

// ── Campaigns + public trainers
const camp = await call("POST", "/campaigns", { token: T, body: { title: "Diwali", type: "offer", subject: "{{firstName}}, 20% off", bodyHtml: "<p>Hi {{firstName}}</p>", audienceFilter: "activeMembers" } });
check("create campaign", camp.status === 201);
const aud = await call("GET", "/campaigns/audience/activeMembers", { token: T });
check("audience preview count", aud.status === 200 && aud.body.count >= 1, JSON.stringify(aud.body));
const tr = await call("POST", "/admin/trainers", { token: T, body: { name: "Aman", role: "Strength coach", phone: "9000011111", email: "aman@kovij.test" } });
const pubTr = await call("GET", "/trainers");
check("public trainer list hides phone and email", tr.status === 201 && pubTr.body.trainers[0].phone === undefined && pubTr.body.trainers[0].email === undefined, JSON.stringify(pubTr.body.trainers?.[0]));

// ── Uploads are not public
const up = await fetch(`${ORIGIN}/uploads/members/1700000000-abc.pdf`);
check("legacy uploads folder doesn't serve arbitrary files", up.status === 404);

console.log(results.join("\n"));
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
