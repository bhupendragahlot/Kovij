import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, RotateCcw } from "lucide-react";
import { useMember } from "./api";
import { api } from "../../app/http";
import { qk } from "../../app/queryKeys";
import { usePermission } from "../auth/permissions";
import { Badge, Button, Dialog, InlineAlert, useConfirm, useToast } from "../../shared/ui";
import { formatDate, formatPhone } from "../../shared/lib/format";
import { dobPassword } from "./appPassword";

/** Member profile → "App login": how the member signs in to the app, and a reset to their date of birth. */
export default function MemberAppLoginAction({ member }) {
  const [open, setOpen] = useState(false);
  const canReset = usePermission("members.edit");
  const detail = useMember(member._id);
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const reset = useMutation({
    mutationFn: () => api.post(`/admin/members/${member._id}/app-password/reset`, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: qk.members.detail(member._id) });
      toast.success("App password reset", { description: data.message });
    },
    onError: (e) => toast.error("Couldn't reset the password", { description: e.message }),
  });

  const pw = detail.data?.appPassword;
  const dob = member.dob;
  const onReset = async () => {
    const ok = await confirm({
      title: `Reset ${member.name}'s app password?`,
      body: `It becomes their date of birth, ${dobPassword(dob)}, and they're signed out of the app on every phone.`,
      confirmLabel: "Reset password",
    });
    if (ok) reset.mutate();
  };

  return (
    <>
      <Button variant="secondary" icon={KeyRound} onClick={() => setOpen(true)}>
        App login
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Member app login"
        description={`How ${member.name} signs in to the member app.`}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Close
            </Button>
            {canReset && dob && (
              <Button variant="primary" icon={RotateCcw} loading={reset.isPending} onClick={onReset}>
                Reset to date of birth
              </Button>
            )}
          </>
        }
      >
        <div className="flex flex-col gap-4 text-sm">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
            <dt className="text-ink-3">Login</dt>
            <dd className="font-semibold">
              {[member.phone && formatPhone(member.phone), member.memberCode, member.email].filter(Boolean).join(" or ")}
            </dd>
            <dt className="text-ink-3">Password</dt>
            <dd>
              {!pw ? (
                <span className="text-ink-3">Loading…</span>
              ) : !pw.set ? (
                <Badge tone="warn">Not set yet</Badge>
              ) : pw.isDefault ? (
                <span>
                  <span className="tabular font-bold">{dobPassword(dob)}</span>
                  <span className="block text-body-sm text-ink-3">Their date of birth (DDMMYYYY). They should change it in the app.</span>
                </span>
              ) : (
                <span>
                  <Badge tone="good">Chosen by the member</Badge>
                  <span className="block text-body-sm text-ink-3">Since {formatDate(pw.setAt)}</span>
                </span>
              )}
            </dd>
          </dl>
          {pw && !pw.set && !dob && <InlineAlert tone="info">Add a date of birth to the profile. It becomes their first app password.</InlineAlert>}
          {pw && !pw.set && dob && <InlineAlert tone="info">Reset to give them their date of birth as a password.</InlineAlert>}
          <p className="text-body-sm text-ink-3">Members can also sign in with a code sent to their mobile number. Forgot the password? Reset it here.</p>
        </div>
      </Dialog>
    </>
  );
}
