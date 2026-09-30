import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Ban,
  Ellipsis,
  FileText,
  IndianRupee,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  RefreshCw,
  ScanLine,
  Send,
  UserRound,
} from "lucide-react";
import { useCancelMembership, useMember } from "./api";
import { SellPlanDialog } from "./SellPlanDialog";
import { EditMemberDialog } from "./EditMemberDialog";
import { useCheckInFlow } from "../attendance/useCheckInFlow";
import { CollectPaymentDialog, ReceiptButton, RecordPaymentDialog } from "../payments/components";
import { useSendReceipt } from "../payments/api";
import { usePermission } from "../auth/permissions";
import { http } from "../../app/http";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  Menu,
  Meter,
  PageHeader,
  SkeletonList,
  StatusBadge,
  TabPanel,
  Tabs,
  useConfirm,
  useToast,
} from "../../shared/ui";
import {
  daysUntil,
  formatDate,
  formatINR,
  formatRelativeTime,
  formatPhone,
  phoneHref,
} from "../../shared/lib/format";
import { GOAL_LABEL, LEAD_SOURCE_LABEL, PAYMENT_MODE_LABEL, PAYMENT_TYPE_LABEL } from "../../shared/domain/status";

function DetailList({ items }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items
        .filter((i) => i.value)
        .map((i) => (
          <div key={i.label} className="min-w-0">
            <dt className="text-[13px] text-ink-3">{i.label}</dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-ink">{i.value}</dd>
          </div>
        ))}
    </dl>
  );
}

function PlanTile({ member, memberships }) {
  const c = member.current;
  const next = memberships.find((m) => m.status === "upcoming");
  if (!c) {
    return (
      <Card>
        <p className="text-sm font-semibold text-ink-2">Plan</p>
        <p className="mt-2 text-lg font-bold">No plan yet</p>
        <p className="mt-1 text-[13px] text-ink-3">Add a plan to let them train.</p>
      </Card>
    );
  }
  const total = Math.max(1, Math.round((new Date(c.endDate) - new Date(c.startDate)) / 86_400_000));
  const left = daysUntil(c.endDate);
  const showMeter = ["active", "expiring"].includes(member.state);
  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink-2">Plan</p>
        <StatusBadge kind="member" status={member.state} size="sm" />
      </div>
      <p className="mt-2 truncate text-lg font-bold">{c.planName}</p>
      <p className="mt-0.5 text-[13px] text-ink-3">
        {member.state === "expired"
          ? `Ended ${formatDate(c.endDate)}`
          : member.state === "upcoming"
            ? `Starts ${formatDate(c.startDate)}`
            : member.state === "pending"
              ? "Starts when payment is collected"
              : `Ends ${formatDate(c.endDate)}, ${left === 0 ? "today" : `${left} ${left === 1 ? "day" : "days"} left`}`}
      </p>
      {showMeter && <Meter className="mt-3" value={total - Math.max(0, left)} max={total} label="Plan days used" />}
      {next && member.state !== "upcoming" && (
        <p className="mt-3 text-[13px] font-semibold text-info">
          Then {next.planName} from {formatDate(next.startDate)}
        </p>
      )}
    </Card>
  );
}

export default function MemberProfilePage() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const detail = useMember(id);
  const { checkIn, isPending: checkingIn, dialog: checkInDialog } = useCheckInFlow();
  const cancelMembership = useCancelMembership(id);
  const sendReceipt = useSendReceipt();
  const canCancel = usePermission("membership.cancel");
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState("overview");
  const [collectTarget, setCollectTarget] = useState(null);

  const action = params.get("action");
  const openAction = (a) => setParams(a ? { action: a } : {}, { replace: true });

  if (detail.isPending) return <SkeletonList rows={6} className="pt-6" />;
  if (detail.isError) return <ErrorState error={detail.error} onRetry={() => detail.refetch()} />;

  const { member, profile, memberships, payments, attendance } = detail.data;
  const dues = payments.filter((p) => p.status === "pending");
  const cancellable = memberships.find((m) => ["active", "upcoming", "pending"].includes(m.status));

  // "Pay" from elsewhere: settle the oldest due if there is one, otherwise record a new payment.
  const payAction = action === "pay";
  const payDue = payAction && dues.length ? dues[dues.length - 1] : null;

  const onCancelPlan = async () => {
    const ok = await confirm({
      title: `Cancel ${cancellable.planName}?`,
      body: `${member.name} will no longer be able to check in on this plan. Payments already taken are not refunded automatically.`,
      confirmLabel: "Cancel plan",
      cancelLabel: "Keep plan",
      tone: "danger",
    });
    if (!ok) return;
    cancelMembership.mutate(cancellable._id, {
      onSuccess: () => toast.success(`${cancellable.planName} cancelled`),
      onError: (e) => toast.error("Couldn't cancel the plan", { description: e.message }),
    });
  };

  const tel = phoneHref(member.phone);
  const whatsapp = phoneHref(member.phone, "whatsapp");

  const paymentColumns = [
    { id: "date", header: "Date", cell: (p) => <span className="whitespace-nowrap">{formatDate(p.paidAt || p.createdAt)}</span> },
    { id: "item", header: "For", cell: (p) => PAYMENT_TYPE_LABEL[p.type] || p.type },
    { id: "amount", header: "Amount", align: "right", cell: (p) => <span className="font-semibold">{formatINR(p.amount)}</span> },
    { id: "mode", header: "Mode", hideBelow: "lg", cell: (p) => PAYMENT_MODE_LABEL[p.mode] || "—" },
    { id: "status", header: "Status", cell: (p) => <StatusBadge kind="payment" status={p.status} size="sm" /> },
    { id: "invoice", header: "Receipt no.", hideBelow: "xl", cell: (p) => <span className="tabular text-ink-3">{p.invoiceNo}</span> },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (p) =>
        p.status === "pending" ? (
          <Button size="sm" variant="primary" onClick={() => setCollectTarget(p)}>
            Collect
          </Button>
        ) : p.status === "paid" ? (
          <ReceiptButton paymentId={p._id} />
        ) : null,
    },
  ];

  const paymentMobileRow = (p) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{formatINR(p.amount)}</p>
        <p className="text-[13px] text-ink-3">
          {PAYMENT_TYPE_LABEL[p.type]}, {formatDate(p.paidAt || p.createdAt)}
        </p>
      </div>
      <StatusBadge kind="payment" status={p.status} size="sm" />
      {p.status === "pending" ? (
        <Button size="sm" variant="primary" onClick={() => setCollectTarget(p)}>
          Collect
        </Button>
      ) : (
        p.status === "paid" && <ReceiptButton paymentId={p._id} />
      )}
    </div>
  );

  return (
    <>
      <PageHeader title={member.name} back={{ to: "/admin/members", label: "Members" }} className="md:mb-4" />

      <Card padding="lg" className="mb-4">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar name={member.name} src={member.profilePhoto} size="xl" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink-3">
                {member.memberCode || "No member code"}, joined {formatDate(member.createdAt)}
                {member.source && member.source !== "desk" ? ` (${member.source === "google" ? "online" : LEAD_SOURCE_LABEL[member.source] || member.source})` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tel && (
                  <a href={tel} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold hover:bg-surface-3">
                    <Phone className="size-4" aria-hidden />
                    <span className="tabular">{formatPhone(member.phone)}</span>
                  </a>
                )}
                {whatsapp && (
                  <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold hover:bg-surface-3">
                    <MessageCircle className="size-4" aria-hidden />
                    WhatsApp
                  </a>
                )}
                {member.email && (
                  <a href={`mailto:${member.email}`} className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold hover:bg-surface-3">
                    <Mail className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{member.email}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={ScanLine} onClick={() => checkIn(member)} loading={checkingIn}>
              Check in
            </Button>
            <Button variant="secondary" icon={RefreshCw} onClick={() => openAction("renew")}>
              {member.current && member.state !== "expired" ? "Renew" : "Add plan"}
            </Button>
            <Button variant="secondary" icon={IndianRupee} onClick={() => (dues.length ? setCollectTarget(dues[dues.length - 1]) : openAction("pay"))}>
              {dues.length ? `Collect ${formatINR(member.dues)}` : "Record payment"}
            </Button>
            <Menu
              label="More actions"
              trigger={(props) => <IconButton {...props} icon={Ellipsis} label="More actions" variant="secondary" />}
              items={[
                { label: "Edit details", icon: Pencil, onSelect: () => openAction("edit") },
                member.email && { label: "Send email", icon: Send, href: `mailto:${member.email}` },
                profile?.idProof?.url && { label: "View ID proof", icon: FileText, onSelect: () => openIdProof(id, toast) },
                canCancel && cancellable && { type: "separator" },
                canCancel && cancellable && { label: `Cancel ${cancellable.planName}`, icon: Ban, tone: "danger", onSelect: onCancelPlan },
              ]}
            />
          </div>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <PlanTile member={member} memberships={memberships} />
        <Card>
          <p className="text-sm font-semibold text-ink-2">Dues</p>
          <p className={`mt-2 text-lg font-bold ${member.dues > 0 ? "text-warn" : ""}`}>{member.dues > 0 ? formatINR(member.dues) : "Nothing due"}</p>
          <p className="mt-0.5 text-[13px] text-ink-3">{dues.length ? `${dues.length} unpaid ${dues.length === 1 ? "bill" : "bills"}` : "All bills paid"}</p>
        </Card>
        <Card>
          <p className="text-sm font-semibold text-ink-2">Visits</p>
          <p className="mt-2 text-lg font-bold">{attendance.last30Days} in the last 30 days</p>
          <p className="mt-0.5 text-[13px] text-ink-3">{attendance.lastCheckInAt ? `Last in ${formatRelativeTime(attendance.lastCheckInAt)}` : "Hasn't checked in yet"}</p>
        </Card>
      </div>

      <Tabs
        label="Member sections"
        value={tab}
        onChange={setTab}
        className="mb-4"
        tabs={[
          { value: "overview", label: "Overview" },
          { value: "plans", label: "Plans", count: memberships.length },
          { value: "payments", label: "Payments", count: payments.length },
        ]}
      />

      {tab === "overview" && (
        <TabPanel value="overview" className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Details" action={<Button size="sm" variant="ghost" icon={Pencil} onClick={() => openAction("edit")}>Edit</Button>} />
            <DetailList
              items={[
                { label: "Mobile", value: formatPhone(member.phone) },
                { label: "Email", value: member.email },
                { label: "Gender", value: member.gender && { male: "Male", female: "Female", other: "Other", prefer_not_say: "Prefer not to say" }[member.gender] },
                { label: "Date of birth", value: member.dob && formatDate(member.dob) },
                { label: "Address", value: [member.address?.line1, member.address?.city, member.address?.state].filter(Boolean).join(", ") },
                { label: "Emergency contact", value: [member.emergencyContact?.name, formatPhone(member.emergencyContact?.phone)].filter(Boolean).join(", ") },
              ]}
            />
            {member.notes && (
              <div className="mt-4 rounded-tile bg-surface-2 p-3.5">
                <p className="text-[13px] font-semibold text-ink-3">Notes for staff</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{member.notes}</p>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader title="Health" description="Visible to staff and trainers only." />
            {profile ? (
              <>
                {profile.medicalCondition?.has && (
                  <div className="mb-4">
                    <Badge tone="bad">Medical condition</Badge>
                    <p className="mt-2 text-sm">{profile.medicalCondition.details || "Details not given"}</p>
                  </div>
                )}
                <DetailList
                  items={[
                    { label: "Height", value: profile.heightCm && `${profile.heightCm} cm` },
                    { label: "Weight", value: profile.weightKg && `${profile.weightKg} kg` },
                    { label: "BMI", value: profile.bmi || null },
                    { label: "Blood group", value: profile.bloodGroup },
                    { label: "Goal", value: GOAL_LABEL[profile.fitnessGoal?.goalKind] },
                    { label: "Injuries", value: profile.injuries },
                    { label: "Allergies", value: profile.allergies },
                  ]}
                />
              </>
            ) : (
              <EmptyState compact icon={UserRound} title="No health details yet" body="Add height, weight and any medical notes so trainers can plan safely." />
            )}
          </Card>
        </TabPanel>
      )}

      {tab === "plans" && (
        <TabPanel value="plans">
          <Card padding="none">
            {memberships.length === 0 ? (
              <EmptyState
                icon={RefreshCw}
                title="No plans yet"
                body="Add a plan to let this member check in."
                action={<Button variant="primary" onClick={() => openAction("renew")}>Add plan</Button>}
              />
            ) : (
              <ol className="divide-y divide-line">
                {memberships.map((m) => (
                  <li key={m._id} className="flex flex-wrap items-center gap-3 px-4 py-3.5 md:px-5">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{m.planName || "Plan"}</p>
                      <p className="text-[13px] text-ink-3">
                        {formatDate(m.startDate)} to {formatDate(m.endDate)}
                        {m.price != null ? `, ${formatINR(m.price)}` : ""}
                      </p>
                    </div>
                    <StatusBadge kind="membership" status={m.status} size="sm" />
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </TabPanel>
      )}

      {tab === "payments" && (
        <TabPanel value="payments">
          <Card padding="none" className="overflow-hidden">
            <DataTable
              caption={`Payments for ${member.name}`}
              columns={paymentColumns}
              rows={payments}
              mobileRow={paymentMobileRow}
              empty={<EmptyState icon={IndianRupee} title="No payments yet" body="Payments and dues for this member will be listed here." />}
            />
          </Card>
          {member.email && payments.some((p) => p.status === "paid") && (
            <p className="mt-3 text-[13px] text-ink-3">
              Need to resend a receipt?{" "}
              <button
                type="button"
                className="font-semibold text-brand-ink hover:underline"
                onClick={() => {
                  const last = payments.find((p) => p.status === "paid");
                  sendReceipt.mutate(last._id, {
                    onSuccess: (d) => toast.success("Receipt sent", { description: d.message }),
                    onError: (e) => toast.error("Couldn't send the receipt", { description: e.message }),
                  });
                }}
              >
                Email the latest receipt to {member.email}
              </button>
            </p>
          )}
        </TabPanel>
      )}

      <SellPlanDialog open={action === "renew"} onClose={() => openAction(null)} member={member} memberships={memberships} />
      <RecordPaymentDialog open={payAction && !payDue} onClose={() => openAction(null)} member={member} />
      <CollectPaymentDialog
        payment={collectTarget || payDue}
        memberName={member.name}
        onClose={() => {
          setCollectTarget(null);
          if (payAction) openAction(null);
        }}
      />
      <EditMemberDialog open={action === "edit"} onClose={() => openAction(null)} member={member} profile={profile} />
      {checkInDialog}
    </>
  );
}

/** ID proofs are private: fetch with the staff token, then open the file from memory. */
async function openIdProof(memberId, toast) {
  const tab = window.open("", "_blank");
  try {
    const res = await http.get(`/admin/members/${memberId}/id-proof`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    if (tab) tab.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    toast.error("Couldn't open the ID proof", { description: e.message });
  }
}
