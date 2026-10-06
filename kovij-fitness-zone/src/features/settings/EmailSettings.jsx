import { useState } from "react";
import { CircleCheck, Mail, Send, TriangleAlert } from "lucide-react";
import { useEmailSetup, useSendTestEmail } from "./api";
import { Badge, Button, Card, CardHeader, ErrorState, Field, InlineAlert, Input, SkeletonList, Tile } from "../../shared/ui";
import { formatDateTime, formatNumber } from "../../shared/lib/format";

const PROVIDER = { smtp: "SMTP", brevo: "Brevo (HTTPS)" };

function Count({ label, value, tone }) {
  return (
    <Tile>
      <p className="text-[13px] font-semibold text-ink-3">{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone || ""}`}>{formatNumber(value)}</p>
    </Tile>
  );
}

/** Settings → Email (owner): is email set up, did it work this week, and a test send. */
export default function EmailSettings() {
  const setup = useEmailSetup();
  const test = useSendTestEmail();
  const [to, setTo] = useState("");

  if (setup.isPending) {
    return (
      <Card>
        <SkeletonList rows={4} />
      </Card>
    );
  }
  if (setup.isError) {
    return (
      <Card>
        <ErrorState error={setup.error} onRetry={() => setup.refetch()} />
      </Card>
    );
  }

  const { email: s, lastWeek, lastFailure, defaultTo } = setup.data;
  const result = test.data;
  const send = (e) => {
    e.preventDefault();
    test.mutate(to.trim() || defaultTo);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Email"
          description="How the app emails members and staff: welcome emails, receipts, reminders, password links."
          action={
            s.configured ? (
              <Badge tone="good" icon={CircleCheck}>
                Set up
              </Badge>
            ) : (
              <Badge tone="bad" icon={TriangleAlert}>
                Not set up
              </Badge>
            )
          }
        />
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-3">Sends with</dt>
          <dd className="font-semibold">
            {PROVIDER[s.provider]} via {s.server}
          </dd>
          <dt className="text-ink-3">From</dt>
          <dd className="font-semibold">{s.from ? `${s.fromName} <${s.from}>` : "Not set"}</dd>
        </dl>
        {!s.configured && (
          <InlineAlert tone="danger" className="mt-4" title="No email is being sent">
            Add {s.missing.join(" and ")} in your hosting settings (on Render: your service, then Environment), then redeploy.
          </InlineAlert>
        )}
      </Card>

      <Card>
        <CardHeader title="Last 7 days" />
        <div className="grid grid-cols-3 gap-3">
          <Count label="Sent" value={lastWeek.sent} tone="text-good" />
          <Count label="Failed" value={lastWeek.failed} tone={lastWeek.failed ? "text-bad" : ""} />
          <Count label="Waiting" value={lastWeek.queued} />
        </div>
        {lastFailure && (
          <InlineAlert tone="danger" className="mt-4" title={`Latest failure, ${formatDateTime(lastFailure.at)}`}>
            {lastFailure.error}
          </InlineAlert>
        )}
      </Card>

      <Card>
        <CardHeader title="Send a test email" description="Sends one email now and shows exactly what happened." />
        <form onSubmit={send} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="Send to" error={test.error?.fields?.to} className="flex-1">
            <Input type="email" inputMode="email" placeholder={defaultTo || "you@example.com"} value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" icon={Send} loading={test.isPending}>
            Send test email
          </Button>
        </form>
        {test.isError && !test.error?.fields?.to && (
          <InlineAlert tone="danger" className="mt-4">
            {test.error.message}
          </InlineAlert>
        )}
        {result &&
          (result.ok ? (
            <InlineAlert tone="success" className="mt-4" title={`Sent to ${result.to}`}>
              Check that inbox, and the spam folder if it isn't there in a minute.
            </InlineAlert>
          ) : result.status === "queued" ? (
            <InlineAlert tone="warning" className="mt-4" title="Still sending">
              The mail server is slow to answer. Check the counts above in a minute.
            </InlineAlert>
          ) : (
            <InlineAlert tone="danger" className="mt-4" title={`Not sent to ${result.to}`}>
              {result.error}
            </InlineAlert>
          ))}
      </Card>

      <Card>
        <CardHeader title="If emails don't arrive" />
        <div className="flex flex-col gap-3 text-sm text-ink-2">
          <p>
            <strong className="text-ink">Hosted on Render's free plan?</strong> It blocks email ports (SMTP), so Gmail can't be used from there. Send through
            Brevo instead, which works over HTTPS:
          </p>
          <ol className="ml-5 list-decimal space-y-1">
            <li>Create a free account at brevo.com (300 emails a day).</li>
            <li>Under Senders, add the address emails should come from and verify it.</li>
            <li>Under SMTP and API, create an API key.</li>
            <li>
              In Render, add <code className="rounded bg-surface-2 px-1">BREVO_API_KEY</code> (the key) and{" "}
              <code className="rounded bg-surface-2 px-1">EMAIL_FROM</code> (the verified address), then redeploy and send a test here.
            </li>
          </ol>
          <p>
            <strong className="text-ink">Using Gmail?</strong> <code className="rounded bg-surface-2 px-1">EMAIL_PASS</code> must be a 16-letter App Password
            (Google Account, Security, App passwords), not the normal Gmail password. A paid Render plan allows Gmail.
          </p>
          <p className="flex items-center gap-2 text-ink-3">
            <Mail className="size-4" aria-hidden />
            Members only get emails if their profile has an email address and they haven't turned emails off.
          </p>
        </div>
      </Card>
    </div>
  );
}
