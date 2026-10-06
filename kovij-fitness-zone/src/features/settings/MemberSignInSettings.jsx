import { KeyRound, Lock } from "lucide-react";
import { useUpdateSettings } from "./api";
import { Card, CardHeader, InlineAlert, Switch, useToast } from "../../shared/ui";

/**
 * Settings → Member sign-in (owner): which ways members can sign in to the member app.
 * Mobile number, email or member ID with a password is always on; the other two can be switched
 * off, which hides them on the sign-in page and makes the server refuse them.
 */
export default function MemberSignInSettings({ settings, readOnly }) {
  const update = useUpdateSettings();
  const toast = useToast();
  // Missing = on (gyms set up before these switches existed).
  const on = (key) => settings?.memberSignIn?.[key] !== false;

  const set = (key, value, label) =>
    update.mutate(
      { memberSignIn: { [key]: value } },
      {
        onSuccess: () => toast.success(`${label} ${value ? "turned on" : "turned off"}`),
        onError: (e) => toast.error(`Couldn't change ${label.toLowerCase()}`, { description: e.message }),
      }
    );

  return (
    <Card>
      <CardHeader title="Member sign-in" description="Choose how members sign in to the member app and website." />
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-tile bg-surface-2 p-3">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">Mobile number, email or member ID with a password</p>
            <p className="text-body-sm text-ink-3">
              Always on, and shown first. Members registered at the desk start with their date of birth (DDMMYYYY) as the password.
            </p>
          </div>
          <Lock className="mt-0.5 size-4 shrink-0 text-ink-3" aria-label="Always on" />
        </div>
        <Switch
          label="Sign in with a mobile code"
          description="Members get a one-time code on their mobile number. Off: the Mobile code tab is hidden and codes are refused."
          checked={on("mobileOtp")}
          disabled={readOnly || update.isPending}
          onChange={(value) => set("mobileOtp", value, "Mobile code sign-in")}
        />
        <Switch
          label="Continue with Google"
          description="Members sign in with their Google account. Off: the Google button is hidden and Google sign-ins are refused."
          checked={on("google")}
          disabled={readOnly || update.isPending}
          onChange={(value) => set("google", value, "Google sign-in")}
        />
        {!on("mobileOtp") && !on("google") && (
          <InlineAlert tone="info">
            Members can only sign in with a password now. Anyone without one (joined with a mobile code or Google) needs the desk to add their date of birth and
            reset their app password from their profile.
          </InlineAlert>
        )}
        {readOnly && <InlineAlert tone="info">Only the owner can change these.</InlineAlert>}
      </div>
    </Card>
  );
}
