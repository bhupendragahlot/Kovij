import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { Field, Input } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { MIN_PASSWORD } from "./passwordRules";

const MIN = MIN_PASSWORD;

/** New password + confirm, with show/hide and a live length check. */
export function NewPasswordFields({ value, onChange, errors = {}, passwordLabel = "New password" }) {
  const [shown, setShown] = useState(false);
  const longEnough = value.password.length >= MIN;
  const toggle = (
    <button
      type="button"
      onClick={() => setShown((v) => !v)}
      className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink"
      aria-pressed={shown}
    >
      {shown ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
      {shown ? "Hide" : "Show"}
    </button>
  );
  return (
    <>
      <Field
        label={passwordLabel}
        error={errors.password}
        labelAction={toggle}
        hint={
          !errors.password && (
            <span className={cn("inline-flex items-center gap-1", longEnough && "text-good")}>
              {longEnough && <Check className="size-3.5" aria-hidden />}
              At least {MIN} characters. Not your email.
            </span>
          )
        }
      >
        <Input
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          value={value.password}
          onChange={(e) => onChange({ ...value, password: e.target.value })}
          required
        />
      </Field>
      <Field label="Type it again" error={errors.confirm}>
        <Input
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          value={value.confirm}
          onChange={(e) => onChange({ ...value, confirm: e.target.value })}
          required
        />
      </Field>
    </>
  );
}
