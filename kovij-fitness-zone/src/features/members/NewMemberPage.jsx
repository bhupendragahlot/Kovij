import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserPlus } from "lucide-react";
import { uploadMemberPhoto, useCreateMember, useDuplicateCheck } from "./api";
import { SaleFields } from "./SaleFields";
import { EMPTY_SALE, saleSummary, salePayload } from "./sale";
import { AddressFields, ContactFields, HealthFields, JoiningFields } from "./MemberFormFields";
import { EMPTY_HEALTH, fieldErrorsFor, newMemberDetails, toDetailsPayload, toHealthPayload } from "./memberForm";
import { PhotoPicker } from "./PhotoField";
import { useSellablePlans } from "../catalog/api";
import { useSettings } from "../settings/api";
import { usePermission } from "../auth/permissions";
import { openReceipt } from "../payments/api";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { useUnsavedChangesGuard } from "../../shared/hooks/useUnsavedChangesGuard";
import { Button, Card, CardHeader, ErrorState, FormError, InlineAlert, PageHeader, SkeletonList, Switch, useToast } from "../../shared/ui";
import { formatINR, formatPhone } from "../../shared/lib/format";

function DuplicateNotice({ matches, onForce, forced }) {
  if (!matches?.length) return null;
  return (
    <InlineAlert
      tone="warning"
      title={matches.length === 1 ? "This person may already be registered" : "These members have the same phone or email"}
      action={
        onForce && (
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={forced} onChange={(e) => onForce(e.target.checked)} className="size-4 accent-[var(--kv-brand)]" />
            It&apos;s a different person (e.g. family sharing a phone). Register anyway.
          </label>
        )
      }
    >
      <ul className="mt-1 flex flex-col gap-1">
        {matches.map((m) => (
          <li key={m.id || m._id}>
            <Link to={`/admin/members/${m.id || m._id}`} className="font-semibold underline">
              {m.name}
            </Link>
            {[m.memberCode, formatPhone(m.phone)].filter(Boolean).length ? ` (${[m.memberCode, formatPhone(m.phone)].filter(Boolean).join(", ")})` : ""}
          </li>
        ))}
      </ul>
    </InlineAlert>
  );
}

export default function NewMemberPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnlineStatus();
  const plans = useSellablePlans();
  const settings = useSettings();
  const canOverridePrice = usePermission("price.override");
  const canSell = usePermission("memberships.sell");
  const canRegister = usePermission("members.edit");
  const create = useCreateMember();
  const idempotency = useIdempotencyKey();

  const [initialDetails] = useState(newMemberDetails);
  const [details, setDetails] = useState(initialDetails);
  const [health, setHealth] = useState(EMPTY_HEALTH);
  const [photo, setPhoto] = useState(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [withPlan, setWithPlan] = useState(canSell);
  const [sale, setSale] = useState(EMPTY_SALE);
  const [force, setForce] = useState(false);
  const [clientErrors, setClientErrors] = useState({});
  const [done, setDone] = useState(false);

  const duplicates = useDuplicateCheck({ phone: details.phone, email: details.email });
  const serverMatches = create.error?.code === "DUPLICATE_MEMBER" ? create.error.details?.matches : null;
  const matches = serverMatches || duplicates.data;

  const dirty = useMemo(
    () =>
      JSON.stringify(details) !== JSON.stringify(initialDetails) || JSON.stringify(health) !== JSON.stringify(EMPTY_HEALTH) || Boolean(sale.planId) || Boolean(photo),
    [details, initialDetails, health, sale.planId, photo]
  );
  useUnsavedChangesGuard(dirty && !done);

  const plan = plans.data?.find((p) => p._id === sale.planId);
  const { total } = saleSummary({ plan, sale, registrationFee: settings.data?.registrationFee || 0, isFirstPlan: true });
  const detailErrors = { ...fieldErrorsFor(create.error, "details"), ...clientErrors };

  const submit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!details.name.trim()) errors.name = "Enter the member's name";
    if (String(details.phone).replace(/\D/g, "").length < 10) errors.phone = "Enter a 10-digit mobile number";
    if (withPlan && !sale.planId) errors.planId = "Choose a plan, or turn off “Start a plan now”";
    setClientErrors(errors);
    if (Object.keys(errors).length) {
      document.querySelector("[aria-invalid=true]")?.focus();
      return;
    }

    const payload = {
      details: toDetailsPayload(details),
      health: toHealthPayload(health),
      membership: withPlan ? salePayload(sale) : undefined,
      force,
    };
    create.mutate(
      { payload, idempotencyKey: idempotency.keyFor(payload) },
      {
        onSuccess: async (data) => {
          setDone(true);
          idempotency.reset();
          const planPayment = data.sale?.payments?.find((p) => p.type !== "registration" && p.status === "paid");
          toast.success(`${data.member.name} registered`, {
            description: data.sale ? `${data.sale.planName}${planPayment ? `, ${formatINR(total)} collected` : ", payment due"}` : `Member code ${data.member.memberCode}`,
            action: planPayment ? { label: "Print", onClick: () => openReceipt(planPayment._id) } : undefined,
          });
          // The member exists now; a failed photo upload must not undo that, so it only warns.
          if (photo) {
            setSavingPhoto(true);
            try {
              await uploadMemberPhoto(data.member._id, photo);
            } catch (err) {
              toast.warning("The photo didn't save", { description: `${err.message} Add it again from the profile.` });
            } finally {
              setSavingPhoto(false);
            }
          }
          // Navigate after the guard sees `done`.
          setTimeout(() => navigate(`/admin/members/${data.member._id}`, { replace: true }), 0);
        },
      }
    );
  };

  const submitLabel = !withPlan || !plan ? "Register member" : sale.collect === "now" ? `Register and collect ${formatINR(total)}` : "Register, payment due";

  if (!canRegister) {
    return (
      <>
        <PageHeader title="New member" back={{ to: "/admin/members", label: "Members" }} />
        <Card>
          <ErrorState error={{ status: 403, message: "Registering members is done at the front desk. Ask a desk colleague or the manager." }} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="New member" description="Walk-in registration. Only name and mobile are required." back={{ to: "/admin/members", label: "Members" }} />

      <form onSubmit={submit} noValidate className="max-w-3xl pb-24">
        <FormError error={create.error?.code === "DUPLICATE_MEMBER" ? null : create.error} />
        <div className="flex flex-col gap-4">
          <Card padding="lg">
            <CardHeader title="Contact" />
            <div className="mb-5">
              <PhotoPicker name={details.name} file={photo} onChange={setPhoto} disabled={create.isPending || savingPhoto} />
            </div>
            <ContactFields value={details} onChange={setDetails} errors={detailErrors} />
            <DuplicateNotice matches={matches} forced={force} onForce={matches?.some((m) => m.phone && m.phone.replace(/\D/g, "").endsWith(details.phone.replace(/\D/g, "").slice(-10))) ? setForce : null} />
          </Card>

          {canSell && (
            <Card padding="lg">
              <CardHeader title="Plan and payment" />
              <Switch label="Start a plan now" description="Turn off to register the member and add a plan later." checked={withPlan} onChange={setWithPlan} />
              {withPlan && (
                <div className="mt-5">
                  {plans.isPending ? (
                    <SkeletonList rows={2} />
                  ) : plans.data?.length ? (
                    <SaleFields
                      plans={plans.data}
                      sale={sale}
                      onChange={setSale}
                      errors={{ ...fieldErrorsFor(create.error, "membership"), planId: clientErrors.planId }}
                      isFirstPlan
                      registrationFee={settings.data?.registrationFee || 0}
                      canOverridePrice={canOverridePrice}
                    />
                  ) : (
                    <InlineAlert tone="warning">
                      No active plans yet. <Link to="/admin/plans" className="font-semibold underline">Create a plan</Link> first, or register without one.
                    </InlineAlert>
                  )}
                </div>
              )}
            </Card>
          )}

          <Card padding="lg">
            <CardHeader title="Joining" description="When they joined and how they found the gym." />
            <JoiningFields value={details} onChange={setDetails} errors={detailErrors} />
          </Card>

          <Card padding="lg">
            <CardHeader title="Address and emergency contact" description="Optional, but useful if something happens on the floor." />
            <AddressFields value={details} onChange={setDetails} errors={detailErrors} />
          </Card>

          <Card padding="lg">
            <CardHeader title="Health" description="Optional. Trainers use this to plan safely." />
            <HealthFields value={health} onChange={setHealth} errors={fieldErrorsFor(create.error, "health")} />
          </Card>
        </div>

        <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md md:bottom-0 md:left-[76px] md:px-6 xl:left-[var(--kv-rail-w)]">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 xl:px-2">
            <p className="hidden text-sm text-ink-3 sm:block">{!online
                ? "Reconnect to register."
                : !withPlan
                  ? "Registering without a plan"
                  : plan
                    ? `${plan.name}, ${sale.collect === "now" ? "paying now" : "pay later"}`
                    : "Choose a plan above"}</p>
            <Button type="submit" variant="primary" size="lg" icon={UserPlus} loading={create.isPending || savingPhoto} disabled={!online} className="max-sm:w-full">
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </>
  );
}
